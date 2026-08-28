import { describe, expect, it } from 'vitest'
import {
  createArrowFeature,
  createBillboardChainFeature,
  createBuoyFeature,
  createGatePairFeatures,
  createLineSignFeature,
  createPointFeature,
  createSponsorFeature,
  pointTypeForTool,
  type FeatureIdCounter,
} from './featureFactory.ts'
import { serializeWorldFeaturesExport } from './exportJson.ts'
import {
  featuresToCourseData,
  featuresToFlagsData,
  featuresToSponsorsData,
} from './reverseAdapters.ts'
import {
  formatSegmentReadout,
  segmentBearingDeg,
  segmentLengthM,
  segmentReadout,
} from './segmentReadout.ts'
import {
  applySnap,
  nearestVertex,
  snapToGrid,
  verticesFromLayoutPoints,
} from './snap.ts'
import {
  formatValidationSummary,
  validateWorldFeatures,
} from './validateFeatures.ts'
import { POLYLINE_TOOLS, TWO_CLICK_TOOLS } from './tools.ts'
import type { WorldFeature } from '../types.ts'

/** Fake inverse: east→lon scale, north→lat scale (matches mockEnu in features.test). */
const fakeEnuToGps = (east: number, _up: number, north: number) => ({
  lat: north / 1000,
  lon: east / 1000,
  alt: 0,
})

describe('featureFactory', () => {
  it('maps place tools to point types', () => {
    expect(pointTypeForTool('mark')).toBe('mark')
    expect(pointTypeForTool('buoy')).toBe('buoy')
    expect(pointTypeForTool('sponsor')).toBe(null)
    expect(pointTypeForTool('billboardChain')).toBe(null)
    expect(pointTypeForTool('start')).toBe(null)
    expect(pointTypeForTool('select')).toBe(null)
  })

  it('creates mark / sponsor / gate pair / arrow from ENU clicks', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const mark = createPointFeature('mark', 100, 200, fakeEnuToGps, counter)!
    expect(mark.type).toBe('mark')
    expect(mark.points[0]!.lon).toBeCloseTo(0.1)
    expect(mark.points[0]!.lat).toBeCloseTo(0.2)

    const sp = createSponsorFeature(0, 0, 50, 0, fakeEnuToGps, counter)
    expect(sp.type).toBe('sponsor')
    expect(sp.points).toHaveLength(2)

    const [left, right] = createGatePairFeatures(
      1,
      2,
      3,
      4,
      fakeEnuToGps,
      counter,
    )
    expect(left.type).toBe('gateLeft')
    expect(right.type).toBe('gateRight')
    expect(left.name.replace(/-Left$/, '')).toBe(
      right.name.replace(/-Right$/, ''),
    )

    const arrow = createArrowFeature(0, 0, 0, 10, fakeEnuToGps, counter)
    expect(arrow.type).toBe('arrow')
    expect(arrow.points).toHaveLength(1)
    expect(arrow.label).toMatch(/^brg 000°$/)
    expect(TWO_CLICK_TOOLS.has('arrow')).toBe(true)

    const start = createLineSignFeature(
      'start',
      0,
      0,
      40,
      0,
      fakeEnuToGps,
      counter,
    )
    expect(start.type).toBe('start')
    expect(start.points).toHaveLength(2)
    expect(start.label).toBe('START')
    expect(TWO_CLICK_TOOLS.has('start')).toBe(true)
    expect(TWO_CLICK_TOOLS.has('finish')).toBe(true)
    expect(pointTypeForTool('start')).toBe(null)
  })

  it('creates buoy and billboardChain features', () => {
    const counter: FeatureIdCounter = { n: 0 }
    const buoy = createBuoyFeature(10, 20, fakeEnuToGps, counter, {
      telemetryId: '91',
    })
    expect(buoy.type).toBe('buoy')
    expect(buoy.points).toHaveLength(1)
    expect(buoy.telemetryId).toBe('91')

    const chain = createBillboardChainFeature(
      [
        { east: 0, north: 0 },
        { east: 30, north: 0 },
        { east: 30, north: 40 },
      ],
      fakeEnuToGps,
      counter,
      { spacingM: 15, textureUrl: '/textures/sponsors/rolex.png' },
    )
    expect(chain).not.toBeNull()
    expect(chain!.type).toBe('billboardChain')
    expect(chain!.points).toHaveLength(3)
    expect(chain!.spacingM).toBe(15)
    expect(chain!.textureUrl).toBe('/textures/sponsors/rolex.png')
    expect(POLYLINE_TOOLS.has('billboardChain')).toBe(true)

    expect(
      createBillboardChainFeature(
        [{ east: 0, north: 0 }],
        fakeEnuToGps,
        counter,
      ),
    ).toBeNull()
  })
})

describe('snap', () => {
  it('snaps to grid and prefers vertex over grid', () => {
    expect(snapToGrid(2.4, 7.6, 5)).toEqual({ east: 0, north: 10 })
    const verts = [
      { east: 10, north: 0 },
      { east: 0, north: 20 },
    ]
    expect(nearestVertex(9.5, 0.2, verts, 3)).toEqual({ east: 10, north: 0 })
    expect(nearestVertex(50, 50, verts, 3)).toBeNull()

    const vertexWin = applySnap(9.8, 0.1, verts, {
      vertexEnabled: true,
      gridEnabled: true,
      vertexRadiusM: 3,
      gridStepM: 5,
    })
    expect(vertexWin.mode).toBe('vertex')
    expect(vertexWin.east).toBe(10)

    const gridOnly = applySnap(2.6, 2.4, [], {
      vertexEnabled: true,
      gridEnabled: true,
      gridStepM: 5,
    })
    expect(gridOnly.mode).toBe('grid')
    expect(gridOnly).toEqual({ east: 5, north: 0, mode: 'grid' })
  })

  it('collects unique layout vertices', () => {
    const verts = verticesFromLayoutPoints([
      {
        points: [
          { x: 1, z: 2 },
          { x: 1, z: 2 },
          { x: 3, z: 4 },
        ],
      },
    ])
    expect(verts).toHaveLength(2)
  })
})

describe('segmentReadout', () => {
  it('reports north / east bearings and length', () => {
    expect(segmentBearingDeg(0, 0, 0, 10)).toBeCloseTo(0)
    expect(segmentBearingDeg(0, 0, 10, 0)).toBeCloseTo(90)
    expect(segmentLengthM(0, 0, 3, 4)).toBeCloseTo(5)
    const r = segmentReadout(0, 0, 0, -10)
    expect(r.bearingDeg).toBeCloseTo(180)
    expect(formatSegmentReadout(r)).toBe('brg 180° · 10.0 m')
  })
})

describe('validateWorldFeatures', () => {
  it('flags orphan gates and incomplete sponsors', () => {
    const features: WorldFeature[] = [
      {
        id: 'course:Gate1-Left',
        name: 'Gate1-Left',
        type: 'gateLeft',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
      },
      {
        id: 'sponsor:bad',
        name: 'bad',
        type: 'sponsor',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
      },
      {
        id: 'empty',
        name: '   ',
        type: 'mark',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
      },
    ]
    const result = validateWorldFeatures(features)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'orphan_gate_left')).toBe(true)
    expect(result.errors.some((e) => e.code === 'sponsor_missing_b')).toBe(true)
    expect(result.errors.some((e) => e.code === 'empty_name')).toBe(true)
    expect(formatValidationSummary(result)).toMatch(/^Invalid/)
  })

  it('accepts paired gates and complete sponsors (warn on empty label)', () => {
    const features: WorldFeature[] = [
      {
        id: 'course:Gate1-Left',
        name: 'Gate1-Left',
        type: 'gateLeft',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
      },
      {
        id: 'course:Gate1-Right',
        name: 'Gate1-Right',
        type: 'gateRight',
        points: [{ lat: 41, lon: 29.001, altMsl: 0 }],
      },
      {
        id: 'sponsor:sp1',
        name: 'sp1',
        type: 'sponsor',
        points: [
          { lat: 41, lon: 29, altMsl: 0 },
          { lat: 41.001, lon: 29, altMsl: 0 },
        ],
      },
    ]
    const result = validateWorldFeatures(features)
    expect(result.ok).toBe(true)
    expect(result.warnings.some((w) => w.code === 'sponsor_empty_label')).toBe(
      true,
    )
  })

  it('validates buoy and billboardChain', () => {
    const ok: WorldFeature[] = [
      {
        id: 'buoy:1',
        name: 'buoy-1',
        type: 'buoy',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
      },
      {
        id: 'chain:1',
        name: 'chain-1',
        type: 'billboardChain',
        points: [
          { lat: 41, lon: 29, altMsl: 0 },
          { lat: 41.001, lon: 29.001, altMsl: 0 },
        ],
        spacingM: 12,
      },
    ]
    expect(validateWorldFeatures(ok).ok).toBe(true)

    const short: WorldFeature[] = [
      {
        id: 'chain:bad',
        name: 'chain-bad',
        type: 'billboardChain',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
        spacingM: 12,
      },
    ]
    const r = validateWorldFeatures(short)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.code === 'chain_too_short')).toBe(true)
  })
})

describe('serializeWorldFeaturesExport', () => {
  it('wraps features array as JSON', () => {
    const features: WorldFeature[] = [
      {
        id: 'course:Mark-1',
        name: 'Mark-1',
        type: 'mark',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
      },
    ]
    const text = serializeWorldFeaturesExport(features)
    const parsed = JSON.parse(text) as { features: WorldFeature[] }
    expect(parsed.features).toHaveLength(1)
    expect(parsed.features[0]!.type).toBe('mark')
  })

  it('round-trips rounding on export JSON', () => {
    const features: WorldFeature[] = [
      {
        id: 'course:Mark-1',
        name: 'Mark-1',
        type: 'mark',
        points: [{ lat: 41, lon: 29, altMsl: 0 }],
        rounding: 'cw',
      },
    ]
    const text = serializeWorldFeaturesExport(features)
    const parsed = JSON.parse(text) as { features: WorldFeature[] }
    expect(parsed.features[0]!.rounding).toBe('cw')
  })

  it('round-trips panelColor / frameColor on export JSON', () => {
    const features: WorldFeature[] = [
      {
        id: 'sponsor:sp1',
        name: 'sp1',
        type: 'sponsor',
        points: [
          { lat: 41, lon: 29, altMsl: 0 },
          { lat: 41.01, lon: 29, altMsl: 0 },
        ],
        panelColor: 0xf4f4f2,
        frameColor: 0x2c3338,
      },
    ]
    const text = serializeWorldFeaturesExport(features)
    const parsed = JSON.parse(text) as { features: WorldFeature[] }
    expect(parsed.features[0]!.panelColor).toBe(0xf4f4f2)
    expect(parsed.features[0]!.frameColor).toBe(0x2c3338)
  })
})

describe('reverseAdapters', () => {
  it('splits world list into course / sponsors / flags fixtures', () => {
    const features: WorldFeature[] = [
      {
        id: 'course:Mark-NW',
        name: 'Mark-NW',
        type: 'mark',
        points: [{ lat: 41.01, lon: 28.97, altMsl: 0 }],
        heightM: 5,
        color: 0xffdd33,
        rounding: 'ccw',
      },
      {
        id: 'sponsor:sp1',
        name: 'sp1',
        type: 'sponsor',
        points: [
          { lat: 41.01, lon: 28.97, altMsl: 0 },
          { lat: 41.0, lon: 28.97, altMsl: 0 },
        ],
        label: 'Acme',
        color: 0x123456,
        heightM: 8,
        panelColor: 0xf4f4f2,
        frameColor: 0x2c3338,
      },
      {
        id: 'flags:p1',
        name: 'P1',
        type: 'flagP1',
        points: [{ lat: 41.007, lon: 28.977, altMsl: 0 }],
        heightM: 10,
      },
      {
        id: 'flags:p2',
        name: 'P2',
        type: 'flagP2',
        points: [{ lat: 41.007, lon: 28.979, altMsl: 0 }],
        heightM: 10,
      },
    ]

    const course = featuresToCourseData(features)
    expect(course.waypoints).toHaveLength(1)
    expect(course.waypoints[0]!.name).toBe('Mark-NW')
    expect(course.waypoints[0]!.rounding).toBe('ccw')

    const sponsors = featuresToSponsorsData(features)
    expect(sponsors.sponsors).toHaveLength(1)
    expect(sponsors.sponsors[0]!.label).toBe('Acme')
    expect(sponsors.sponsors[0]!.panelColor).toBe(0xf4f4f2)
    expect(sponsors.sponsors[0]!.frameColor).toBe(0x2c3338)

    const flags = featuresToFlagsData(features)
    expect(flags).not.toBeNull()
    expect(flags!.point1.lon).toBeCloseTo(28.977)
    expect(flags!.point2.lon).toBeCloseTo(28.979)
  })
})
