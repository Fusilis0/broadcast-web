import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WorldFeature } from '../features/types.ts'
import {
  buildLineSignLayout,
  DEFAULT_LINE_SIGN_WIDTH_M,
  LINE_SIGN_BAND_DEPTH_M,
  LINE_SIGN_WATER_Y,
  LINE_SIGN_Y_OFFSET,
} from './lineSignLayout.ts'
import { WATER_PLANE_Y, WATER_PLANE_Y_OFFSET } from '../waterPlanePlacement.ts'
import type { GpsToEnuAmslFn } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
    expect(layout[0]!.kind).toBe('start')
    expect(layout[0]!.label).toBe('START')
    expect(layout[0]!.widthM).toBeCloseTo(30)
    expect(layout[0]!.midX).toBeCloseTo(35)
    expect(layout[0]!.midY).toBeCloseTo(35)
    expect(LINE_SIGN_BAND_DEPTH_M).toBe(24)
    expect(LINE_SIGN_WATER_Y).toBe(0)
    expect(LINE_SIGN_WATER_Y).toBe(WATER_PLANE_Y)
    expect(LINE_SIGN_Y_OFFSET).toBe(WATER_PLANE_Y_OFFSET)
  })

  it('keeps two-point finish A–B hypot (does not stretch authored span)', () => {
    const features: WorldFeature[] = [
      {
        id: 'finish:ab',
        name: 'Finish',
        type: 'finish',
        points: [
          { lat: 0.01, lon: 0.02, altMsl: 0 },
          { lat: 0.01, lon: 0.05, altMsl: 0 },
        ],
      },
    ]
    const layout = buildLineSignLayout(features, mockEnu)
    expect(layout).toHaveLength(1)
    expect(layout[0]!.kind).toBe('finish')
    expect(layout[0]!.widthM).toBeCloseTo(30)
    expect(LINE_SIGN_BAND_DEPTH_M).toBe(24)
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
    expect(DEFAULT_LINE_SIGN_WIDTH_M).toBe(100)
    expect(layout[0]!.widthM).toBeCloseTo(100)
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

describe('createLineSignTexture (source)', () => {
  it('draws a full-width line above the letters — no solid plate, no glyph crop', () => {
    const src = readFileSync(resolve(__dirname, 'lineSignMesh.ts'), 'utf8')
    expect(src).toContain('fillText(label')
    expect(src).toContain('LINE_SIGN_STROKE_PX')
    expect(src).toContain('ctx.lineTo(w, lineY)')
    expect(src).not.toMatch(/fillRect\s*\(\s*0\s*,/)
    expect(src).not.toContain('barH')
    expect(src).not.toContain('cropCanvasToOpaqueGlyph')
    expect(src).toContain('generateMipmaps = false')
    expect(src).toContain('fog: false')
  })
})
