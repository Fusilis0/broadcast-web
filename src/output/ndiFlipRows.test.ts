import { describe, expect, it } from 'vitest'
import { flipRgbaRowsInPlace } from './ndiFlipRows.ts'

describe('flipRgbaRowsInPlace', () => {
  it('swaps first and last rows', () => {
    const w = 2
    const h = 3
    const buf = new Uint8Array([
      1, 0, 0, 255, 1, 0, 0, 255,
      0, 1, 0, 255, 0, 1, 0, 255,
      0, 0, 1, 255, 0, 0, 1, 255,
    ])
    flipRgbaRowsInPlace(buf, w, h)
    expect([...buf.subarray(0, 8)]).toEqual([0, 0, 1, 255, 0, 0, 1, 255])
    expect([...buf.subarray(16, 24)]).toEqual([1, 0, 0, 255, 1, 0, 0, 255])
  })
})
