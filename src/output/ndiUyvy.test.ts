import { describe, expect, it } from 'vitest'
import {
  createNdiPackPool,
  evenPackWidth,
  packedFrameBytes,
  rgbaToUyva,
  rgbaToUyvy,
} from './ndiUyvy.ts'

function rgbaFill(
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): Uint8Array {
  const buf = new Uint8Array(w * h * 4)
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  return buf
}

describe('ndiUyvy pack', () => {
  it('sizes UYVY at 2 bytes/pixel and UYVA at 3', () => {
    expect(packedFrameBytes('uyvy', 1920, 1080)).toBe(1920 * 1080 * 2)
    expect(packedFrameBytes('uyva', 1920, 1080)).toBe(1920 * 1080 * 3)
    expect(evenPackWidth(1921)).toBe(1920)
    expect(packedFrameBytes('uyvy', 3, 2)).toBe(2 * 2 * 2)
  })

  it('maps black to limited-range Y=16, C=128', () => {
    const src = rgbaFill(2, 1, 0, 0, 0)
    const dest = new Uint8Array(4)
    expect(rgbaToUyvy(src, 2, 1, dest)).toBe(4)
    expect(dest[0]).toBe(128)
    expect(dest[1]).toBe(16)
    expect(dest[2]).toBe(128)
    expect(dest[3]).toBe(16)
  })

  it('maps white to limited-range Y≈235, C=128', () => {
    const src = rgbaFill(2, 1, 255, 255, 255)
    const dest = new Uint8Array(4)
    expect(rgbaToUyvy(src, 2, 1, dest)).toBe(4)
    expect(dest[1]).toBeGreaterThanOrEqual(233)
    expect(dest[1]).toBeLessThanOrEqual(235)
    expect(dest[3]).toBe(dest[1])
    expect(dest[0]).toBeGreaterThanOrEqual(127)
    expect(dest[0]).toBeLessThanOrEqual(128)
    expect(dest[2]).toBeGreaterThanOrEqual(127)
    expect(dest[2]).toBeLessThanOrEqual(128)
  })

  it('appends the alpha plane for UYVA', () => {
    const src = rgbaFill(2, 1, 0, 0, 0, 64)
    src[7] = 200
    const dest = new Uint8Array(6)
    expect(rgbaToUyva(src, 2, 1, dest)).toBe(6)
    expect(dest[4]).toBe(64)
    expect(dest[5]).toBe(200)
  })

  it('recycles packed buffers from the pool', () => {
    const pool = createNdiPackPool('uyvy')
    const src = rgbaFill(4, 2, 10, 20, 30).buffer
    const a = pool.pack(src, 4, 2)
    expect(a?.byteLength).toBe(4 * 2 * 2)
    pool.release(a!)
    const b = pool.pack(src, 4, 2)
    expect(b).toBe(a)
  })
})
