/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  createStreamMap2d,
  resolveStreamMapOptions,
  STREAM_MAP_DEFAULT_TITLE,
  STREAM_MAP_HEIGHT_PX,
  STREAM_MAP_SIZE_PX,
  STREAM_MAP_WIDTH_PX,
} from './streamMap.ts'

describe('resolveStreamMapOptions', () => {
  it('defaults 16:9 at 1920×1080 (studio lock), stream variant, visible (off-screen host)', () => {
    expect(STREAM_MAP_WIDTH_PX).toBe(1920)
    expect(STREAM_MAP_HEIGHT_PX).toBe(1080)
    expect(STREAM_MAP_SIZE_PX).toBe(STREAM_MAP_HEIGHT_PX)
    expect(STREAM_MAP_WIDTH_PX / STREAM_MAP_HEIGHT_PX).toBeCloseTo(16 / 9)
    expect(resolveStreamMapOptions()).toEqual({
      sizePx: STREAM_MAP_HEIGHT_PX,
      widthPx: STREAM_MAP_WIDTH_PX,
      heightPx: STREAM_MAP_HEIGHT_PX,
      title: STREAM_MAP_DEFAULT_TITLE,
      visible: true,
      variant: 'stream',
    })
  })

  it('honors size / title / visible overrides (sizePx is 16:9 height)', () => {
    expect(
      resolveStreamMapOptions({
        sizePx: 320,
        title: 'Custom',
        visible: true,
      }),
    ).toEqual({
      sizePx: 320,
      widthPx: Math.round(320 * (16 / 9)),
      heightPx: 320,
      title: 'Custom',
      visible: true,
      variant: 'stream',
    })
  })
})

describe('createStreamMap2d canvas', () => {
  it('creates a 1920×1080 backing store (matches AR/3D lock)', () => {
    const map = createStreamMap2d()
    try {
      const canvas = map.getCanvas()
      expect(canvas.width).toBe(STREAM_MAP_WIDTH_PX)
      expect(canvas.height).toBe(STREAM_MAP_HEIGHT_PX)
      expect(canvas.width).toBe(1920)
      expect(canvas.height).toBe(1080)
      const gen = map.getPaintGeneration()
      expect(gen).toBeGreaterThan(0)
      map.redraw()
      expect(map.getPaintGeneration()).toBeGreaterThan(gen)
    } finally {
      map.dispose()
    }
  })
})
