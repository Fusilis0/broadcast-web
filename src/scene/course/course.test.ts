import { describe, expect, it } from 'vitest'
import { buildCourseLayout } from './courseLayout.ts'
import { gateBaseName, pairGates } from './gatePairing.ts'
import { normalizeCourse } from './normalizeCourse.ts'
import type { GpsToEnuAmslFn } from './types.ts'
import {
  courseWaterCueBounds,
  createWaterShoreCue,
  WATER_CUE_DEFAULTS,
} from './waterCue.ts'

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

  it('parses optional waypoint rounding (unknown → none)', () => {
    const course = normalizeCourse({
      waypoints: [
        { name: 'A', type: 'mark', lat: 41, lon: 29, rounding: 'cw' },
        { name: 'B', type: 'mark', lat: 41, lon: 29, rounding: 'nope' },
        { name: 'C', type: 'mark', lat: 41, lon: 29 },
      ],
    })
    expect(course.waypoints[0]!.rounding).toBe('cw')
    expect(course.waypoints[1]!.rounding).toBe('none')
    expect(course.waypoints[2]!.rounding).toBeUndefined()
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

  it('uses GEO y (Alt MSL) and pairs gates', () => {
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
    // mockEnu y = alt + 35; default alt 0 → 35 (not COURSE_WATER_Y)
    expect(layout.marks.every((m) => m.y === 35)).toBe(true)
    expect(layout.gates[0]!.left.x).toBe(80)
    expect(layout.gates[0]!.right.z).toBe(90)
    expect(layout.gates[0]!.left.y).toBe(35)

    const lifted = buildCourseLayout(
      normalizeCourse({
        waypoints: [
          { name: 'Hi', type: 'mark', lat: 0, lon: 0, altMsl: 3 },
        ],
      }),
      mockEnu,
    )
    expect(lifted.marks[0]!.y).toBe(38)
  })
})

describe('water / shore cue', () => {
  it('builds padded AABB around course points', () => {
    const bounds = courseWaterCueBounds(
      [
        { x: 0, z: 0 },
        { x: 100, z: 50 },
      ],
      10,
    )
    expect(bounds).not.toBeNull()
    expect(bounds!.centerX).toBe(50)
    expect(bounds!.centerZ).toBe(25)
    expect(bounds!.sizeX).toBe(120)
    expect(bounds!.sizeZ).toBe(70)
  })

  it('returns null for empty points', () => {
    expect(courseWaterCueBounds([])).toBeNull()
  })

  it('creates dispose-safe water + shore pads', () => {
    const cue = createWaterShoreCue(
      [
        { x: -20, z: -10 },
        { x: 20, z: 10 },
      ],
      { paddingM: WATER_CUE_DEFAULTS.paddingM },
    )
    expect(cue).not.toBeNull()
    expect(cue!.root.name).toBe('waterShoreCue')
    expect(cue!.root.children).toHaveLength(2)
    cue!.setVisible(false)
    expect(cue!.root.visible).toBe(false)
    cue!.setVisible(true)
    expect(cue!.root.visible).toBe(true)
    cue!.dispose()
    expect(cue!.root.children).toHaveLength(0)
  })
})
