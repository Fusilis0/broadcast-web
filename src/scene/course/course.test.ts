import { describe, expect, it } from 'vitest'
import { buildCourseLayout, COURSE_WATER_Y } from './courseLayout.ts'
import { gateBaseName, pairGates } from './gatePairing.ts'
import { normalizeCourse } from './normalizeCourse.ts'
import type { GpsToEnuAmslFn } from './types.ts'

describe('normalizeCourse', () => {
  it('fills defaults and keeps valid waypoints', () => {
    const course = normalizeCourse({
      name: 'demo',
      waypoints: [
        { name: 'A', type: 'mark', lat: 41.01, lon: 28.98 },
        { name: 'bad', type: 'mark', lat: 'x', lon: 1 },
        { name: 'Gate1-Left', type: 'gateLeft', lat: 41, lon: 29, altMsl: 2 },
      ],
    })
    expect(course.name).toBe('demo')
    expect(course.waypoints).toHaveLength(2)
    expect(course.waypoints[0]).toEqual({
      name: 'A',
      type: 'mark',
      lat: 41.01,
      lon: 28.98,
      altMsl: 0,
    })
    expect(course.waypoints[1]!.altMsl).toBe(2)
    expect(course.appearance.boundaryColor).toBe(0xffb200)
  })

  it('parses appearance hex colors', () => {
    const course = normalizeCourse({
      waypoints: [],
      appearance: {
        boundaryColor: '#aabbcc',
        gateColor: '#112233',
        buoyHeightM: 8,
      },
    })
    expect(course.appearance.boundaryColor).toBe(0xaabbcc)
    expect(course.appearance.gateColor).toBe(0x112233)
    expect(course.appearance.buoyHeightM).toBe(8)
  })

  it('returns empty course for junk', () => {
    expect(normalizeCourse(null).waypoints).toEqual([])
    expect(normalizeCourse({ waypoints: 'nope' }).waypoints).toEqual([])
  })
})

describe('gate pairing', () => {
  it('strips Unity-style suffixes', () => {
    expect(gateBaseName('Gate1-Left')).toBe('Gate1')
    expect(gateBaseName('Gate1-Right')).toBe('Gate1')
    expect(gateBaseName('Start Left')).toBe('Start')
    expect(gateBaseName('Start Right')).toBe('Start')
  })

  it('pairs left/right by base name', () => {
    const pairs = pairGates([
      {
        name: 'Gate1-Left',
        type: 'gateLeft',
        lat: 1,
        lon: 2,
        altMsl: 0,
      },
      {
        name: 'Gate1-Right',
        type: 'gateRight',
        lat: 3,
        lon: 4,
        altMsl: 0,
      },
      {
        name: 'Orphan-Left',
        type: 'gateLeft',
        lat: 5,
        lon: 6,
        altMsl: 0,
      },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.baseName).toBe('Gate1')
    expect(pairs[0]!.left.lat).toBe(1)
    expect(pairs[0]!.right.lon).toBe(4)
  })
})

describe('buildCourseLayout', () => {
  const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt + 35, // pretend geoid offset
    z: lat * 1000,
  })

  it('forces water Y and pairs gates', () => {
    const course = normalizeCourse({
      waypoints: [
        { name: 'M1', type: 'mark', lat: 0.01, lon: 0.02 },
        { name: 'M2', type: 'mark', lat: 0.03, lon: 0.04 },
        { name: 'M3', type: 'mark', lat: 0.05, lon: 0.06 },
        { name: 'Gate1-Left', type: 'gateLeft', lat: 0.07, lon: 0.08 },
        { name: 'Gate1-Right', type: 'gateRight', lat: 0.09, lon: 0.1 },
      ],
    })
    const layout = buildCourseLayout(course, mockEnu)
    expect(layout.marks).toHaveLength(3)
    expect(layout.gates).toHaveLength(1)
    expect(layout.marks.every((m) => m.y === COURSE_WATER_Y)).toBe(true)
    expect(layout.gates[0]!.left.x).toBe(80)
    expect(layout.gates[0]!.right.z).toBe(90)
    expect(layout.gates[0]!.left.y).toBe(COURSE_WATER_Y)
  })
})
