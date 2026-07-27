import { describe, expect, it } from 'vitest'
import {
  TIMECODE_BIT_COUNT,
  encodeVisualTimecodeBits,
  encodeVisualTimecodeRgba,
  writeVisualTimecodeRgba,
} from './visualTimecodeEncode.ts'

describe('encodeVisualTimecodeBits (Unity LSB layout)', () => {
  it('encodes 0 as all zeros', () => {
    const bits = encodeVisualTimecodeBits(0)
    expect(bits).toHaveLength(TIMECODE_BIT_COUNT)
    expect([...bits].every((b) => b === 0)).toBe(true)
  })

  it('places LSB at index 0 (ms = 1)', () => {
    const bits = encodeVisualTimecodeBits(1)
    expect(bits[0]).toBe(1)
    expect([...bits.slice(1)].every((b) => b === 0)).toBe(true)
  })

  it('places bit 1 at index 1 (ms = 2)', () => {
    const bits = encodeVisualTimecodeBits(2)
    expect(bits[0]).toBe(0)
    expect(bits[1]).toBe(1)
    expect([...bits.slice(2)].every((b) => b === 0)).toBe(true)
  })

  it('fills bottom row for ms = 255 (bits 0–7)', () => {
    const bits = encodeVisualTimecodeBits(255)
    expect([...bits.slice(0, 8)]).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expect([...bits.slice(8)].every((b) => b === 0)).toBe(true)
  })

  it('places bit 8 at index 8 (ms = 256) — start of row 1', () => {
    const bits = encodeVisualTimecodeBits(256)
    expect(bits[8]).toBe(1)
    expect(bits[0]).toBe(0)
    expect(bits[7]).toBe(0)
    expect(bits[9]).toBe(0)
  })

  it('places MSB at index 63 (1n << 63n)', () => {
    const bits = encodeVisualTimecodeBits(1n << 63n)
    expect(bits[63]).toBe(1)
    expect([...bits.slice(0, 63)].every((b) => b === 0)).toBe(true)
  })

  it('accepts bigint and truncates non-integers', () => {
    expect([...encodeVisualTimecodeBits(3n)]).toEqual([
      ...encodeVisualTimecodeBits(3),
    ])
    expect([...encodeVisualTimecodeBits(5.9)]).toEqual([
      ...encodeVisualTimecodeBits(5),
    ])
  })

  /**
   * Golden: known wall-clock-ish ms → sparse bit pattern.
   * 1_704_000_000_000n ≈ late 2023 epoch ms.
   * Decoder: scan bottom→top, left→right; index i = bit i.
   */
  it('golden fixture 1704000000000 matches expected set bits', () => {
    const ms = 1_704_000_000_000
    const bits = encodeVisualTimecodeBits(ms)
    const set: number[] = []
    for (let i = 0; i < TIMECODE_BIT_COUNT; i++) {
      if (bits[i] === 1) set.push(i)
    }
    // Cross-check against BigInt shifts (same contract as Unity).
    const expected: number[] = []
    const v = BigInt(ms)
    for (let i = 0; i < 64; i++) {
      if ((v >> BigInt(i)) & 1n) expected.push(i)
    }
    expect(set).toEqual(expected)
    // Sanity: LSB of this value is 0 (even).
    expect(bits[0]).toBe(0)
  })
})

describe('encodeVisualTimecodeRgba', () => {
  it('writes white/black RGBA with opaque alpha', () => {
    const rgba = encodeVisualTimecodeRgba(1)
    // index 0 → white
    expect([...rgba.slice(0, 4)]).toEqual([255, 255, 255, 255])
    // index 1 → black
    expect([...rgba.slice(4, 8)]).toEqual([0, 0, 0, 255])
  })

  it('writeVisualTimecodeRgba mutates buffer in place', () => {
    const buf = new Uint8Array(TIMECODE_BIT_COUNT * 4)
    writeVisualTimecodeRgba(2, buf)
    expect([...buf.slice(0, 4)]).toEqual([0, 0, 0, 255])
    expect([...buf.slice(4, 8)]).toEqual([255, 255, 255, 255])
  })
})
