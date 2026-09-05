import { parseCssHexRgba, type LetterboxRect } from './letterboxRect.ts'

/**
 * RGBA8 → NDI UYVY / UYVA (4:2:2). Pack *before* IPC so the Electron
 * structured clone is 4 MB (UYVY) or 6 MB (UYVA) instead of 8 MB RGBA.
 *
 * Rec. 709 limited range (HD). UYVY has no alpha — use UYVA on the AR plate.
 */

export type NdiPackedFormat = 'uyvy' | 'uyva'

export const NDI_UYVY_BYTES_PER_PIXEL = 2
export const NDI_UYVA_BYTES_PER_PIXEL = 3

function clamp8(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n
}

/** Even width required by 4:2:2. Studio lock is 1920. */
export function evenPackWidth(width: number): number {
  return Math.max(0, width | 0) & ~1
}

export function packedFrameBytes(
  format: NdiPackedFormat,
  width: number,
  height: number,
): number {
  const w = evenPackWidth(width)
  const h = Math.max(0, height | 0)
  if (w < 2 || h < 1) return 0
  return format === 'uyva' ? w * h * 3 : w * h * 2
}

/** Rec. 709 limited: Y 16..235, C 16..240. */
function y709(r: number, g: number, b: number): number {
  return clamp8(16 + ((11966 * r + 40247 * g + 4065 * b) >> 16))
}

function u709(r: number, g: number, b: number): number {
  return clamp8(128 + ((-6600 * r - 22185 * g + 28784 * b) >> 16))
}

function v709(r: number, g: number, b: number): number {
  return clamp8(128 + ((28784 * r - 24105 * g - 4679 * b) >> 16))
}

type Rgba8 = Uint8Array | Uint8ClampedArray

/**
 * Pack top-down RGBA into UYVY (U Y0 V Y1 per pair).
 * Dest must be at least `packedFrameBytes('uyvy', w, h)`.
 */
export function rgbaToUyvy(
  rgba: Rgba8,
  width: number,
  height: number,
  dest: Uint8Array,
): number {
  const w = evenPackWidth(width)
  const h = Math.max(0, height | 0)
  const outBytes = w * h * 2
  if (w < 2 || h < 1 || dest.byteLength < outBytes) return 0
  const srcStride = Math.max(0, width | 0) * 4
  if (rgba.byteLength < srcStride * h) return 0

  let di = 0
  for (let y = 0; y < h; y++) {
    const row = y * srcStride
    for (let x = 0; x < w; x += 2) {
      const i0 = row + x * 4
      const i1 = i0 + 4
      const r0 = rgba[i0]!
      const g0 = rgba[i0 + 1]!
      const b0 = rgba[i0 + 2]!
      const r1 = rgba[i1]!
      const g1 = rgba[i1 + 1]!
      const b1 = rgba[i1 + 2]!
      dest[di] = (u709(r0, g0, b0) + u709(r1, g1, b1)) >> 1
      dest[di + 1] = y709(r0, g0, b0)
      dest[di + 2] = (v709(r0, g0, b0) + v709(r1, g1, b1)) >> 1
      dest[di + 3] = y709(r1, g1, b1)
      di += 4
    }
  }
  return outBytes
}

/** Pack one Rec.709 limited UYVY macropixel (two identical RGB samples). */
function uyvyPairFromRgb(r: number, g: number, b: number): number {
  const y = y709(r, g, b)
  const u = u709(r, g, b)
  const v = v709(r, g, b)
  return u | (y << 8) | (v << 16) | (y << 24)
}

/** Fill a UYVY buffer with a CSS hex matte (letterbox bars). */
export function fillUyvyFromCssHex(dest: Uint8Array, hex: string): void {
  const [r, g, b] = parseCssHexRgba(hex)
  const packed = uyvyPairFromRgb(r, g, b)
  if (dest.byteOffset % 4 === 0 && dest.byteLength % 4 === 0) {
    new Uint32Array(dest.buffer, dest.byteOffset, dest.byteLength >> 2).fill(
      packed,
    )
    return
  }
  const u = packed & 255
  const y = (packed >> 8) & 255
  const v = (packed >> 16) & 255
  for (let i = 0; i + 3 < dest.length; i += 4) {
    dest[i] = u
    dest[i + 1] = y
    dest[i + 2] = v
    dest[i + 3] = y
  }
}

/**
 * Nearest-neighbour blit of packed UYVY into a letterbox rect. Source and
 * dest widths are 4:2:2-even. Used so 2D NDI packs native map pixels (16:9
 * 1920×1080 source; `letterboxRect` identity into the studio lock).
 * instead of converting a full 1920×1080 RGBA intermediate.
 */
export function blitUyvyNearest(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dest: Uint8Array,
  destW: number,
  destH: number,
  box: LetterboxRect,
): void {
  const sw = evenPackWidth(srcW)
  const dw = evenPackWidth(destW)
  const sh = Math.max(0, srcH | 0)
  const dhFrame = Math.max(0, destH | 0)
  if (sw < 2 || dw < 2 || sh < 1 || dhFrame < 1) return
  const dx = Math.max(0, box.dx | 0) & ~1
  const dy = Math.max(0, box.dy | 0)
  const boxW = Math.max(0, Math.min(evenPackWidth(box.dw | 0), dw - dx))
  const boxH = Math.max(0, Math.min(box.dh | 0, dhFrame - dy))
  if (boxW < 2 || boxH < 1) return
  const srcStride = sw * 2
  const destStride = dw * 2
  if (src.byteLength < srcStride * sh || dest.byteLength < destStride * dhFrame) {
    return
  }

  if (boxW === sw && boxH === sh) {
    for (let y = 0; y < boxH; y++) {
      dest.set(
        src.subarray(y * srcStride, y * srcStride + srcStride),
        (dy + y) * destStride + dx * 2,
      )
    }
    return
  }

  for (let y = 0; y < boxH; y++) {
    const srcY = Math.min(sh - 1, Math.floor((y * sh) / boxH))
    const srcRow = srcY * srcStride
    const destRow = (dy + y) * destStride + dx * 2
    for (let x = 0; x < boxW; x += 2) {
      const srcX = Math.min(sw - 2, Math.floor((x * sw) / boxW) & ~1)
      const si = srcRow + srcX * 2
      dest.set(src.subarray(si, si + 4), destRow + x * 2)
    }
  }
}

/**
 * UYVY followed by a full-resolution 8-bit alpha plane (NDI UYVA).
 */
export function rgbaToUyva(
  rgba: Rgba8,
  width: number,
  height: number,
  dest: Uint8Array,
): number {
  const w = evenPackWidth(width)
  const h = Math.max(0, height | 0)
  const uyvyBytes = w * h * 2
  const outBytes = w * h * 3
  if (rgbaToUyvy(rgba, width, height, dest) !== uyvyBytes) return 0
  if (dest.byteLength < outBytes) return 0
  const srcStride = Math.max(0, width | 0) * 4
  let ai = uyvyBytes
  for (let y = 0; y < h; y++) {
    const row = y * srcStride
    for (let x = 0; x < w; x++) {
      dest[ai++] = rgba[row + x * 4 + 3]!
    }
  }
  return outBytes
}

export type NdiPackPool = {
  pack(rgba: ArrayBuffer, width: number, height: number): ArrayBuffer | null
  release(data: ArrayBuffer): void
}

const POOL_SLOTS = 3

export function createNdiPackPool(format: NdiPackedFormat): NdiPackPool {
  const free: ArrayBuffer[] = []
  let slotW = 0
  let slotH = 0

  function resetIfSizeChanged(width: number, height: number): void {
    if (width === slotW && height === slotH) return
    free.length = 0
    slotW = width
    slotH = height
  }

  return {
    pack(rgba, width, height) {
      const bytes = packedFrameBytes(format, width, height)
      if (bytes < 4) return null
      resetIfSizeChanged(width, height)
      const buf = free.pop() ?? new ArrayBuffer(bytes)
      const dest = new Uint8Array(buf)
      const src = new Uint8Array(rgba)
      const wrote =
        format === 'uyva'
          ? rgbaToUyva(src, width, height, dest)
          : rgbaToUyvy(src, width, height, dest)
      if (wrote !== bytes) {
        free.push(buf)
        return null
      }
      return buf
    },
    release(data) {
      if (
        data.byteLength === packedFrameBytes(format, slotW, slotH) &&
        free.length < POOL_SLOTS
      ) {
        free.push(data)
      }
    },
  }
}
