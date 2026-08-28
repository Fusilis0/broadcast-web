import { describe, expect, it } from 'vitest'
import {
  featureAssetKind,
  resolveAssetFocusEnu,
  type AssetRowId,
} from './assetInspector.ts'
import type { WorldFeature } from '../features/types.ts'
import {
  filterFeaturesFor2d,
  filterFeaturesFor3d,
  isFeatureVisible2d,
  isFeatureVisible3d,
} from '../features/featureVisibility.ts'
import { buildRaceProject } from '../../projects/buildRaceProject.ts'
import { parseRaceProject } from '../../projects/parseRaceProject.ts'

describe('featureAssetKind', () => {
  it('groups world feature types', () => {
    expect(featureAssetKind('sponsor')).toBe('sponsor')
    expect(featureAssetKind('billboardChain')).toBe('billboardChain')
    expect(featureAssetKind('buoy')).toBe('buoy')
    expect(featureAssetKind('gateLeft')).toBe('gate')
    expect(featureAssetKind('start')).toBe('startFinish')
    expect(featureAssetKind('flagP1')).toBe('flag')
    expect(featureAssetKind('arrow')).toBe('other')
  })
})

describe('feature visibility helpers', () => {
  it('defaults omitted → visible; false → hidden', () => {
    expect(isFeatureVisible3d({})).toBe(true)
    expect(isFeatureVisible2d({})).toBe(true)
    expect(isFeatureVisible3d({ visible3d: false })).toBe(false)
    expect(isFeatureVisible2d({ visible2d: false })).toBe(false)
    expect(
      filterFeaturesFor3d([
        { id: 'a', visible3d: true },
        { id: 'b', visible3d: false },
        { id: 'c' },
      ]).map((f) => f.id),
    ).toEqual(['a', 'c'])
    expect(
      filterFeaturesFor2d([
        { id: 'a', visible2d: false },
        { id: 'b' },
      ]).map((f) => f.id),
    ).toEqual(['b'])
  })
})

describe('resolveAssetFocusEnu', () => {
  const gpsToEnuAmsl = (lat: number, lon: number, _alt: number) => ({
    x: lon * 100,
    y: 0,
    z: lat * 100,
  })

  it('uses live boat position when present', () => {
    const target: AssetRowId = { kind: 'boat', id: '21' }
    const enu = resolveAssetFocusEnu(target, {
      getBoatEnu: () => ({ x: 1, y: 2, z: 3 }),
      features: [],
      gpsToEnuAmsl,
    })
    expect(enu).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('falls back to planned boat GPS', () => {
    const target: AssetRowId = { kind: 'boat', id: '21' }
    const enu = resolveAssetFocusEnu(target, {
      getBoatEnu: () => null,
      getBoatPlanned: () => ({ lat: 1, lon: 2 }),
      features: [],
      gpsToEnuAmsl,
    })
    expect(enu).toEqual({ x: 200, y: 0, z: 100 })
  })

  it('centers on feature layout centroid', () => {
    const feature: WorldFeature = {
      id: 'sponsor:1',
      name: 'S1',
      type: 'sponsor',
      points: [
        { lat: 1, lon: 2, altMsl: 0 },
        { lat: 3, lon: 4, altMsl: 0 },
      ],
    }
    const enu = resolveAssetFocusEnu(
      { kind: 'feature', id: 'sponsor:1' },
      {
        getBoatEnu: () => null,
        features: [feature],
        gpsToEnuAmsl,
      },
    )
    expect(enu).toEqual({ x: 300, y: 0, z: 200 })
  })
})

describe('visibility Save → Load round-trip', () => {
  it('preserves feature visible* and fleet map maps; old packs stay valid', () => {
    const built = buildRaceProject({
      id: 'vis-demo',
      name: 'Vis demo',
      origin: { lat: 41, lon: 29, altMsl: 0 },
      boatIds: ['21'],
      povIds: ['1'],
      boatMapVisible: { '21': false },
      povMapVisible: { '1': false },
      features: [
        {
          id: 'buoy:1',
          name: 'B1',
          type: 'buoy',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          visible3d: false,
          visible2d: true,
        },
      ],
    })
    expect(built.fleet.boatMapVisible).toEqual({ '21': false })
    expect(built.fleet.povMapVisible).toEqual({ '1': false })
    expect(built.features?.[0]?.visible3d).toBe(false)

    const again = parseRaceProject(built)
    expect(again.fleet.boatMapVisible).toEqual({ '21': false })
    expect(again.features?.[0]?.visible3d).toBe(false)

    // Old pack without visibility fields still parses.
    const old = parseRaceProject({
      schemaVersion: 1,
      id: 'old',
      name: 'Old',
      origin: { lat: 41, lon: 29, altMsl: 0 },
      fleet: { boatIds: ['21'] },
      povIds: ['1'],
      features: [
        {
          id: 'mark:1',
          name: 'M1',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
        },
      ],
    })
    expect(old.fleet.boatMapVisible).toBeUndefined()
    expect(old.features?.[0]?.visible3d).toBeUndefined()
    expect(isFeatureVisible3d(old.features![0]!)).toBe(true)
  })
})

describe('rounding Save → Load round-trip', () => {
  it('preserves cw/ccw/none; omitted stays omitted (effective CW)', () => {
    const built = buildRaceProject({
      id: 'round-demo',
      name: 'Round demo',
      origin: { lat: 41, lon: 29, altMsl: 0 },
      boatIds: ['21'],
      povIds: ['1'],
      features: [
        {
          id: 'course:Mark-NW',
          name: 'Mark-NW',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          rounding: 'cw',
        },
        {
          id: 'buoy:1',
          name: 'B1',
          type: 'buoy',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          rounding: 'none',
        },
        {
          id: 'course:Mark-SE',
          name: 'Mark-SE',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          rounding: 'ccw',
        },
        {
          id: 'course:Mark-SW',
          name: 'Mark-SW',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
        },
      ],
    })
    expect(built.features?.[0]?.rounding).toBe('cw')
    expect(built.features?.[1]?.rounding).toBe('none')
    expect(built.features?.[2]?.rounding).toBe('ccw')
    expect(built.features?.[3]?.rounding).toBeUndefined()

    const again = parseRaceProject(built)
    expect(again.features?.[0]?.rounding).toBe('cw')
    expect(again.features?.[1]?.rounding).toBe('none')
    expect(again.features?.[2]?.rounding).toBe('ccw')
    expect(again.features?.[3]?.rounding).toBeUndefined()
  })
})
