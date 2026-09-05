import { describe, expect, it } from 'vitest'
import {
  addFromCoordinates,
  DEFAULT_SPONSOR_SPAN_M,
  draftFromFeature,
  editFromCoordinates,
  emptyDraft,
  heightFieldCaption,
  spacingFieldCaption,
  type CoordinatePlaceDraft,
  type CoordinatePlaceGeo,
} from './coordinatePlace.ts'
import type { FeatureIdCounter } from './featureFactory.ts'
import type { WorldFeature } from '../types.ts'

const geo: CoordinatePlaceGeo = {
  gpsToEnuAmsl: (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt,
    z: -lat * 1000,
  }),
  enuToGpsAmsl: (east, up, north) => ({
    lat: north / 1000,
    lon: east / 1000,
    alt: up,
  }),
}

function draft(partial: Partial<CoordinatePlaceDraft> & Pick<CoordinatePlaceDraft, 'kind'>): CoordinatePlaceDraft {
  return {
    name: '',
    label: '',
    lat: 41.0,
    lon: 29.0,
    altMsl: 2,
    ...partial,
  }
}

describe('coordinatePlace Add', () => {
  it('adds a sponsor with exact lat/lon and includes the new id before any remount', () => {
    const features: WorldFeature[] = []
    const counter: FeatureIdCounter = { n: 0 }
    let remountStarted = false
    const result = addFromCoordinates(
      features,
      draft({
        kind: 'sponsor',
        name: 'Rolex board',
        label: 'Rolex',
        heightM: 8,
        latB: 41.0,
        lonB: 29.02,
        altBMsl: 2,
      }),
      geo,
      counter,
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'features') return
    expect(remountStarted).toBe(false)
    expect(result.createdIds).toHaveLength(1)
    expect(result.features.some((f) => f.id === result.createdIds[0])).toBe(
      true,
    )
    const sp = result.features[0]!
    expect(sp.type).toBe('sponsor')
    expect(sp.points[0]).toEqual({ lat: 41.0, lon: 29.0, altMsl: 2 })
    expect(sp.points[1]).toEqual({ lat: 41.0, lon: 29.02, altMsl: 2 })
    expect(sp.label).toBe('Rolex')
    expect(sp.heightM).toBe(8)
    expect(sp.boardAspect).toBeCloseTo(2)
    remountStarted = true
    expect(result.features.map((f) => f.id)).toContain(result.createdIds[0])
  })

  it('stretches sponsor A–B uniformly (glyph metres scale with span)', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const added = addFromCoordinates(
      [],
      draft({
        kind: 'sponsor',
        heightM: 8,
        latB: 41.0,
        lonB: 29.02,
      }),
      geo,
      counter,
    )
    expect(added.ok && added.mode === 'features').toBe(true)
    if (!added.ok || added.mode !== 'features') return
    const id = added.createdIds[0]!
    const edited = editFromCoordinates(
      added.features,
      id,
      draft({
        kind: 'sponsor',
        heightM: 8,
        latB: 41.0,
        lonB: 29.04,
      }),
      geo,
    )
    expect(edited.ok && edited.mode === 'features').toBe(true)
    if (!edited.ok || edited.mode !== 'features') return
    expect(edited.features[0]!.heightM).toBeCloseTo(16)
    expect(edited.features[0]!.boardAspect).toBeCloseTo(2)
  })

  it('defaults sponsor B east of A when only one lat/lon is typed', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const result = addFromCoordinates(
      [],
      draft({ kind: 'sponsor' }),
      geo,
      counter,
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'features') return
    const sp = result.features[0]!
    expect(sp.points).toHaveLength(2)
    const spanLon = sp.points[1]!.lon - sp.points[0]!.lon
    expect(spanLon * 1000).toBeCloseTo(DEFAULT_SPONSOR_SPAN_M)
  })

  it('adds start with both GPS ends', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const result = addFromCoordinates(
      [],
      draft({
        kind: 'start',
        latB: 41.01,
        lonB: 29.01,
        altBMsl: 0,
        heightM: 24,
      }),
      geo,
      counter,
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'features') return
    const line = result.features[0]!
    expect(line.type).toBe('start')
    expect(line.points).toHaveLength(2)
    expect(line.points[1]).toEqual({ lat: 41.01, lon: 29.01, altMsl: 0 })
    expect(line.heightM).toBe(24)
  })

  it('returns a fleet boat payload (not a WorldFeature)', () => {
    const result = addFromCoordinates(
      [],
      draft({
        kind: 'boat',
        telemetryId: '21',
        name: 'Alpha',
        visibility: 'ghost',
        heightM: 1,
      }),
      geo,
      { n: 0 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'fleet') return
    expect(result.fleet.id).toBe('21')
    expect(result.fleet.kind).toBe('boat')
    expect(result.fleet.visibility).toBe('ghost')
  })

  it('rejects fleet place without telemetry id', () => {
    const result = addFromCoordinates(
      [],
      draft({ kind: 'drone', telemetryId: '', name: '' }),
      geo,
      { n: 0 },
    )
    expect(result.ok).toBe(false)
  })
})

describe('coordinatePlace Edit', () => {
  it('edits the selected feature in place (same id)', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const added = addFromCoordinates(
      [],
      draft({ kind: 'buoy', telemetryId: '91', name: 'buoy-1' }),
      geo,
      counter,
    )
    expect(added.ok && added.mode === 'features').toBe(true)
    if (!added.ok || added.mode !== 'features') return
    const id = added.createdIds[0]!
    const edited = editFromCoordinates(
      added.features,
      id,
      draft({
        kind: 'buoy',
        name: 'Windward',
        label: 'W',
        lat: 41.5,
        lon: 29.5,
        altMsl: 3,
        heightM: 6,
        telemetryId: '92',
      }),
      geo,
    )
    expect(edited.ok && edited.mode === 'features').toBe(true)
    if (!edited.ok || edited.mode !== 'features') return
    expect(edited.features).toHaveLength(1)
    expect(edited.features[0]!.id).toBe(id)
    expect(edited.features[0]!.name).toBe('Windward')
    expect(edited.features[0]!.points[0]).toEqual({
      lat: 41.5,
      lon: 29.5,
      altMsl: 3,
    })
    expect(edited.features[0]!.telemetryId).toBe('92')
    expect(edited.features[0]!.heightM).toBe(6)
  })

  it('edits start/finish both ends', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const added = addFromCoordinates(
      [],
      draft({
        kind: 'finish',
        latB: 41.02,
        lonB: 29.02,
      }),
      geo,
      counter,
    )
    if (!added.ok || added.mode !== 'features') return
    const id = added.createdIds[0]!
    const edited = editFromCoordinates(
      added.features,
      id,
      draft({
        kind: 'finish',
        lat: 40,
        lon: 28,
        altMsl: 1,
        latB: 40.1,
        lonB: 28.1,
        altBMsl: 1,
        heightM: 24,
      }),
      geo,
    )
    if (!edited.ok || edited.mode !== 'features') return
    const line = edited.features[0]!
    expect(line.id).toBe(id)
    expect(line.points[0]).toEqual({ lat: 40, lon: 28, altMsl: 1 })
    expect(line.points[1]).toEqual({ lat: 40.1, lon: 28.1, altMsl: 1 })
    expect(line.heightM).toBe(24)
  })
})

describe('captions + draft helpers', () => {
  it('labels chain height as vertical and spacing as logo pitch', () => {
    expect(heightFieldCaption('billboardChain')).toMatch(/vertical/i)
    expect(heightFieldCaption('sponsor')).toMatch(/glyph/i)
    expect(spacingFieldCaption()).toMatch(/logo pitch/i)
  })

  it('round-trips draftFromFeature / emptyDraft', () => {
    const empty = emptyDraft('mark')
    expect(empty.kind).toBe('mark')
    expect(Number.isNaN(empty.lat)).toBe(true)
    const feature: WorldFeature = {
      id: 'mark:1',
      name: 'M1',
      type: 'mark',
      points: [{ lat: 1, lon: 2, altMsl: 3 }],
      heightM: 5,
    }
    const d = draftFromFeature(feature)
    expect(d.lat).toBe(1)
    expect(d.lon).toBe(2)
    expect(d.altMsl).toBe(3)
    expect(d.heightM).toBe(5)
  })

  it('persists buoy mesh/tag flags on Add and draftFromFeature', () => {
    const hidden: WorldFeature = {
      id: 'buoy:1',
      name: 'B1',
      type: 'buoy',
      points: [{ lat: 41, lon: 29, altMsl: 0 }],
      visibleBuoyMesh: false,
      visibleTag: false,
      visible3d: true,
    }
    const d = draftFromFeature(hidden)
    expect(d.visibleBuoyMesh).toBe(false)
    expect(d.visibleTag).toBe(false)
    expect(d.visible3d).toBe(true)

    const counter: FeatureIdCounter = { n: 0 }
    const result = addFromCoordinates(
      [],
      draft({
        kind: 'buoy',
        name: 'B2',
        visibleBuoyMesh: false,
        visibleTag: true,
        rounding: 'none',
      }),
      geo,
      counter,
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'features') return
    expect(result.features[0]!.visibleBuoyMesh).toBe(false)
    expect(result.features[0]!.visibleTag).toBe(true)
    expect(result.features[0]!.rounding).toBe('none')
  })
})
