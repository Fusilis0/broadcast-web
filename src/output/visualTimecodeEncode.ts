/**
 * Unity-compatible 8×8 LSB visual timecode encode.
 *
 * Layout (matches VisualTimecodeGenerator.cs):
 *   index 0  = bit 0  (LSB) = bottom-left
 *   index 7  = bit 7         = bottom-right of row 0
 *   index 8  = bit 8         = start of row 1
 *   index 63 = bit 63 (MSB) = top-right
 *
 * Decoder must scan rows bottom→top, left→right.
 * White = bit 1, black = bit 0.
 */

export const TIMECODE_COLS = 8
export const TIMECODE_ROWS = 8
export const TIMECODE_BIT_COUNT = TIMECODE_COLS * TIMECODE_ROWS // 64

/** Normalize ms to bigint for full 64-bit shifts (Unity `long`). */
export function toTimecodeBigInt(ms: number | bigint): bigint {
  if (typeof ms === 'bigint') return ms
  if (!Number.isFinite(ms)) return 0n
  return BigInt(Math.trunc(ms))
}

/**
 * Encode timestamp ms as 64 bits, LSB at index 0.
 * Each entry is `0` or `1`.
 */
export function encodeVisualTimecodeBits(ms: number | bigint): Uint8Array {
  const value = toTimecodeBigInt(ms)
  const bits = new Uint8Array(TIMECODE_BIT_COUNT)
  for (let i = 0; i < TIMECODE_BIT_COUNT; i++) {
    bits[i] = Number((value >> BigInt(i)) & 1n)
  }
  return bits
}

/**
 * Pack bits into RGBA8888 for a Three `DataTexture` / WebGL upload.
 * Index order matches Unity `Color32[]` (bottom-left origin when flipY=false).
 */
export function encodeVisualTimecodeRgba(ms: number | bigint): Uint8Array {
  const bits = encodeVisualTimecodeBits(ms)
  const rgba = new Uint8Array(TIMECODE_BIT_COUNT * 4)
  for (let i = 0; i < TIMECODE_BIT_COUNT; i++) {
    const c = bits[i]! === 1 ? 255 : 0
    const o = i * 4
    rgba[o] = c
    rgba[o + 1] = c
    rgba[o + 2] = c
    rgba[o + 3] = 255
  }
  return rgba
}

/** Write bits into an existing RGBA buffer (no alloc when reusing). */
export function writeVisualTimecodeRgba(
  ms: number | bigint,
  rgba: Uint8Array,
): void {
  if (rgba.length < TIMECODE_BIT_COUNT * 4) {
    throw new Error(
      `RGBA buffer too small: need ${TIMECODE_BIT_COUNT * 4}, got ${rgba.length}`,
    )
  }
  const value = toTimecodeBigInt(ms)
  for (let i = 0; i < TIMECODE_BIT_COUNT; i++) {
    const c = Number((value >> BigInt(i)) & 1n) === 1 ? 255 : 0
    const o = i * 4
    rgba[o] = c
    rgba[o + 1] = c
    rgba[o + 2] = c
    rgba[o + 3] = 255
  }
}
