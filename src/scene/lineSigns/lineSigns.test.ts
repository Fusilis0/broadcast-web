import { describe, expect, it } from 'vitest'
import type { WorldFeature } from '../features/types.ts'
import {
  buildLineSignLayout,
  DEFAULT_LINE_SIGN_WIDTH_M,
  LINE_SIGN_WATER_Y,
  LINE_SIGN_Y_OFFSET,
} from './lineSignLayout.ts'
import { WATER_PLANE_Y, WATER_PLANE_Y_OFFSET } from '../waterPlanePlacement.ts'
import type { GpsToEnuAmslFn } from './types.ts'

const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
  x: lon * 1000,
  y: alt + 35,
  z: lat * 1000,
})

describe('buildLineSignLayout', () => {
  it('builds A–B span for two-point start/finish', () => {
    const features: WorldFeature[] = [
      {
        id: 'start:1',
        name: 'Start',
        type: 'start',
        points: [
          { lat: 0.01, lon: 0.02, altMsl: 0 },
          { lat: 0.01, lon: 0.05, altMsl: 0 },
        ],
        label: 'start',
        color: 0xff0000,
      },
    ]
    const layout = buildLineSignLayout(features, mockEnu)
    expect(layout).toHaveLength(1)
    expect(layout[0]!.label).toBe('START')
    expect(layout[0]!.widthM).toBeCloseTo(30)
    expect(layout[0]!.midX).toBeCloseTo(35)
    expect(LINE_SIGN_WATER_Y).toBe(0)
    expect(LINE_SIGN_WATER_Y).toBe(WATER_PLANE_Y)
    expect(LINE_SIGN_Y_OFFSET).toBe(WATER_PLANE_Y_OFFSET)
  })

  it('expands single-point finish east–west', () => {
    const features: WorldFeature[] = [
      {
        id: 'finish:1',
        name: 'Finish',
        type: 'finish',
        points: [{ lat: 1, lon: 2, altMsl: 0 }],
      },
    ]
    const layout = buildLineSignLayout(features, mockEnu)
    expect(layout).toHaveLength(1)
    expect(layout[0]!.widthM).toBeCloseTo(DEFAULT_LINE_SIGN_WIDTH_M)
    expect(layout[0]!.label).toBe('FINISH')
    expect(layout[0]!.midX).toBeCloseTo(2000)
    expect(layout[0]!.midZ).toBeCloseTo(1000)
  })

  it('ignores non line-sign types', () => {
    const features: WorldFeature[] = [
      {
        id: 'mark:1',
        name: 'M',
        type: 'mark',
        points: [{ lat: 0, lon: 0, altMsl: 0 }],
      },
    ]
    expect(buildLineSignLayout(features, mockEnu)).toEqual([])
  })
})
