import { describe, expect, it } from 'vitest'
import {
  createGatePairFeatures,
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
    expect(pointTypeForTool('sponsor')).toBe(null)
    expect(pointTypeForTool('select')).toBe(null)
  })

  it('creates mark / sponsor / gate pair from ENU clicks', () => {
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

    const sponsors = featuresToSponsorsData(features)
    expect(sponsors.sponsors).toHaveLength(1)
    expect(sponsors.sponsors[0]!.label).toBe('Acme')

    const flags = featuresToFlagsData(features)
    expect(flags).not.toBeNull()
    expect(flags!.point1.lon).toBeCloseTo(28.977)
    expect(flags!.point2.lon).toBeCloseTo(28.979)
  })
})
