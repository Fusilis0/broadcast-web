import { describe, expect, it } from 'vitest'
import { normalizeCourse } from '../course/normalizeCourse.ts'
import { normalizeCountdownFlags } from '../flags/normalizeCountdownFlags.ts'
import { normalizeSponsors } from '../sponsors/normalizeSponsors.ts'
import {
  adaptCourseToFeatures,
  adaptFlagsToFeatures,
  adaptSponsorsToFeatures,
} from './adapters.ts'
import {
  layoutFeatures,
  pairLayoutGates,
} from './layoutFeatures.ts'
import {
  clearLayoutFeatures,
  getLayoutFeatures,
  setLayoutFeatures,
} from './layoutStore.ts'
import type { GpsToEnuAmslFn } from './types.ts'

const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
  x: lon * 1000,
  y: alt + 35,
  z: lat * 1000,
})

const courseSlice = {
  name: 'demo',
  waypoints: [
    {
      name: 'Mark-NW',
      type: 'mark',
      lat: 41.0087,
      lon: 28.9778,
      altMsl: 0,
      rounding: 'cw',
    },
    { name: 'Mark-NE', type: 'mark', lat: 41.0087, lon: 28.979, altMsl: 0 },
    {
      name: 'Gate1-Left',
      type: 'gateLeft',
      lat: 41.00795,
      lon: 28.9778,
      altMsl: 0,
    },
    {
      name: 'Gate1-Right',
      type: 'gateRight',
      lat: 41.00795,
      lon: 28.979,
      altMsl: 0,
    },
  ],
}

const sponsorsSlice = {
  name: 'sponsors',
  sponsors: [
    {
      id: 'sp-west',
      label: 'Fusilis',
      a: { lat: 41.00855, lon: 28.97755, altMsl: 0 },
      b: { lat: 41.00745, lon: 28.97755, altMsl: 0 },
      heightM: 8,
      color: '#1e4d8c',
      panelColor: '#f4f4f2',
      frameColor: '#2c3338',
    },
  ],
}

const flagsSlice = {
  name: 'countdown',
  point1: { lat: 41.00795, lon: 28.9775, altMsl: 0 },
  point2: { lat: 41.00795, lon: 28.9793, altMsl: 0 },
}

describe('feature adapters', () => {
  it('adapts course / sponsors / flags fixture slices to expected counts/types', () => {
    const course = normalizeCourse(courseSlice)
    const sponsors = normalizeSponsors(sponsorsSlice)
    const flags = normalizeCountdownFlags(flagsSlice)!

    const courseFeatures = adaptCourseToFeatures(course)
    const sponsorFeatures = adaptSponsorsToFeatures(sponsors)
    const flagFeatures = adaptFlagsToFeatures(flags)

    expect(courseFeatures).toHaveLength(4)
    expect(courseFeatures.filter((f) => f.type === 'mark')).toHaveLength(2)
    expect(courseFeatures.filter((f) => f.type === 'gateLeft')).toHaveLength(1)
    expect(courseFeatures.filter((f) => f.type === 'gateRight')).toHaveLength(1)
    expect(courseFeatures.find((f) => f.name === 'Mark-NW')?.rounding).toBe('cw')
    expect(
      courseFeatures.find((f) => f.name === 'Mark-NE')?.rounding,
    ).toBeUndefined()

    expect(sponsorFeatures).toHaveLength(1)
    expect(sponsorFeatures[0]!.type).toBe('sponsor')
    expect(sponsorFeatures[0]!.points).toHaveLength(2)
    expect(sponsorFeatures[0]!.label).toBe('Fusilis')
    expect(sponsorFeatures[0]!.panelColor).toBe(0xf4f4f2)
    expect(sponsorFeatures[0]!.frameColor).toBe(0x2c3338)

    expect(flagFeatures).toHaveLength(2)
    expect(flagFeatures.map((f) => f.type)).toEqual(['flagP1', 'flagP2'])
  })
})

describe('layoutFeatures', () => {
  it('converts once via GEO, keeps GEO y, pairs gates, keeps projection sane', () => {
    const course = normalizeCourse(courseSlice)
    const sponsors = normalizeSponsors(sponsorsSlice)
    const flags = normalizeCountdownFlags(flagsSlice)!
    const world = [
      ...adaptCourseToFeatures(course),
      ...adaptSponsorsToFeatures(sponsors),
      ...adaptFlagsToFeatures(flags),
    ]

    const layout = layoutFeatures(world, mockEnu)
    expect(layout).toHaveLength(7)
    expect(layout.find((f) => f.name === 'Mark-NW')?.rounding).toBe('cw')
    // mockEnu y = alt + 35; altMsl 0 → y 35 (do not force FEATURE_WATER_Y)
    expect(layout.every((f) => f.points.every((p) => p.y === 35))).toBe(true)
    const lifted = layoutFeatures(
      [
        {
          id: 'mark:lift',
          name: 'Lift',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 2 }],
        },
      ],
      mockEnu,
    )
    expect(lifted[0]!.points[0]!.y).toBe(37)

    const gates = pairLayoutGates(layout)
    expect(gates).toHaveLength(1)
    expect(gates[0]!.baseName).toBe('Gate1')
    // mockEnu: x = lon*1000, z = lat*1000
    expect(gates[0]!.left.points[0]!.x).toBeCloseTo(28.9778 * 1000)
    expect(gates[0]!.right.points[0]!.x).toBeCloseTo(28.979 * 1000)
    expect(gates[0]!.left.points[0]!.z).toBeCloseTo(41.00795 * 1000)

    const sponsor = layout.find((f) => f.type === 'sponsor')!
    expect(sponsor.points).toHaveLength(2)
    expect(sponsor.points[0]!.x).toBeCloseTo(sponsor.points[1]!.x)
    expect(sponsor.rawPoints[0]!.lat).toBeCloseTo(41.00855)
    expect(sponsor.panelColor).toBe(0xf4f4f2)
    expect(sponsor.frameColor).toBe(0x2c3338)

    clearLayoutFeatures()
    setLayoutFeatures(layout)
    expect(getLayoutFeatures()).toHaveLength(7)
    clearLayoutFeatures()
    expect(getLayoutFeatures()).toHaveLength(0)
  })
})
