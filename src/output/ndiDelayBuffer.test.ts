import { describe, expect, it } from 'vitest'
import {
  clampNdiDelayMs,
  DEFAULT_OUTPUT_DELAY_MS,
  estimateNdiDelayBufferBytes,
  isNdiDelayHighMemory,
  NDI_DELAY_MS_DEFAULT,
  NDI_DELAY_MS_MAX,
  NDI_DELAY_WARN_MS,
  NdiDelayBuffer,
  normalizeOutputDelayMs,
  type NdiDelayedFrame,
} from './ndiDelayBuffer.ts'

function frame(at: number, bytes = 4): NdiDelayedFrame {
  return {
    capturedAtMs: at,
    width: 1,
    height: 1,
    data: new ArrayBuffer(bytes),
    bottomUp: true,
  }
}

describe('clampNdiDelayMs', () => {
  it('defaults non-finite to 0', () => {
    expect(clampNdiDelayMs(undefined)).toBe(0)
    expect(clampNdiDelayMs(null)).toBe(0)
    expect(clampNdiDelayMs(Number.NaN)).toBe(0)
    expect(clampNdiDelayMs('100')).toBe(0)
  })

  it('clamps to 0..30000', () => {
    expect(clampNdiDelayMs(-1)).toBe(0)
    expect(clampNdiDelayMs(0)).toBe(0)
    expect(clampNdiDelayMs(1500.6)).toBe(1501)
    expect(clampNdiDelayMs(NDI_DELAY_MS_MAX)).toBe(30_000)
    expect(clampNdiDelayMs(99_999)).toBe(30_000)
  })
})

describe('isNdiDelayHighMemory / estimate', () => {
  it('warns only above 3000 ms', () => {
    expect(isNdiDelayHighMemory(NDI_DELAY_WARN_MS)).toBe(false)
    expect(isNdiDelayHighMemory(NDI_DELAY_WARN_MS + 1)).toBe(true)
  })

  it('estimates 0 bytes at delay 0 (no standing buffer)', () => {
    expect(
      estimateNdiDelayBufferBytes({
        width: 1920,
        height: 1080,
        delayMs: 0,
        fps: 30,
      }),
    ).toBe(0)
  })

  it('estimates ~7.5 GB for 30 s @ 1080p30', () => {
    const bytes = estimateNdiDelayBufferBytes({
      width: 1920,
      height: 1080,
      delayMs: 30_000,
      fps: 30,
    })
    // 1920*1080*4*900 = 7_464_960_000
    expect(bytes).toBe(1920 * 1080 * 4 * 900)
  })
})

describe('normalizeOutputDelayMs', () => {
  it('defaults all channels to 0', () => {
    expect(normalizeOutputDelayMs(undefined)).toEqual(DEFAULT_OUTPUT_DELAY_MS)
    expect(normalizeOutputDelayMs(null)).toEqual({
      ar: 0,
      '3d': 0,
      '2d': 0,
    })
  })

  it('clamps per-channel values', () => {
    expect(
      normalizeOutputDelayMs({ ar: 500, '3d': -10, '2d': 50_000 }),
    ).toEqual({ ar: 500, '3d': 0, '2d': 30_000 })
  })
})

describe('NdiDelayBuffer', () => {
  it('bypasses at delay 0 without growing the ring', () => {
    const buf = new NdiDelayBuffer()
    expect(buf.getDelayMs()).toBe(NDI_DELAY_MS_DEFAULT)
    const f = frame(1000)
    const out = buf.push(f, 1000)
    expect(out).toEqual([f])
    expect(buf.getBufferedCount()).toBe(0)
    expect(buf.popReady(10_000)).toEqual([])
  })

  it('holds frames until age >= delayMs (FIFO)', () => {
    const buf = new NdiDelayBuffer()
    buf.setDelayMs(1000)
    expect(buf.push(frame(0), 0)).toEqual([])
    expect(buf.getBufferedCount()).toBe(1)
    expect(buf.push(frame(100), 100)).toEqual([])
    expect(buf.getBufferedCount()).toBe(2)

    const readyAt1000 = buf.popReady(1000)
    expect(readyAt1000).toHaveLength(1)
    expect(readyAt1000[0]!.capturedAtMs).toBe(0)

    const readyAt1100 = buf.popReady(1100)
    expect(readyAt1100).toHaveLength(1)
    expect(readyAt1100[0]!.capturedAtMs).toBe(100)
    expect(buf.getBufferedCount()).toBe(0)
  })

  it('push returns ready frames in the same call', () => {
    const buf = new NdiDelayBuffer()
    buf.setDelayMs(500)
    buf.push(frame(0), 0)
    const out = buf.push(frame(500), 500)
    expect(out).toHaveLength(1)
    expect(out[0]!.capturedAtMs).toBe(0)
    expect(buf.getBufferedCount()).toBe(1)
  })

  it('clearing delay to 0 drops the ring', () => {
    const buf = new NdiDelayBuffer()
    buf.setDelayMs(2000)
    buf.push(frame(0), 0)
    buf.push(frame(10), 10)
    expect(buf.getBufferedCount()).toBe(2)
    buf.setDelayMs(0)
    expect(buf.getBufferedCount()).toBe(0)
    expect(buf.push(frame(20), 20)).toHaveLength(1)
  })

  it('shrinking delay drops buffered frames', () => {
    const buf = new NdiDelayBuffer()
    buf.setDelayMs(5000)
    buf.push(frame(0), 0)
    buf.push(frame(100), 100)
    buf.setDelayMs(1000)
    expect(buf.getBufferedCount()).toBe(0)
  })

  it('does not preallocate a multi-GB standing buffer', () => {
    const buf = new NdiDelayBuffer()
    expect(buf.getBufferedCount()).toBe(0)
    buf.setDelayMs(30_000)
    expect(buf.getBufferedCount()).toBe(0)
  })
})
