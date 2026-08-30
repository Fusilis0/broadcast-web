/**
 * Pure letterbox geometry + RGBA8 blit (DSP-OUT-20260830-01).
 *
 * Geometry matches `streamMapNdiPump.letterboxRect` (tested). The blit fills a
 * pooled dest with the matte, then copies source rows into that rect — 1:1
 * memcpy when sizes match, nearest-neighbour when the pump scaled the box.
 */

export type LetterboxRect = {
  dx: number
  dy: number
  dw: number
  dh: number
}

/** Pure: fit `src` into `dst` preserving aspect (letterbox / pillarbox). */
export function letterboxRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): LetterboxRect {
  const sw = Math.max(1, srcW)
  const sh = Math.max(1, srcH)
  const dw = Math.max(1, dstW)
  const dh = Math.max(1, dstH)
  const scale = Math.min(dw / sw, dh / sh)
  const outW = Math.max(1, Math.round(sw * scale))
  const outH = Math.max(1, Math.round(sh * scale))
  return {
    dx: Math.floor((dw - outW) / 2),
    dy: Math.floor((dh - outH) / 2),
    dw: outW,
    dh: outH,
  }
}

export function parseCssHexRgba(
  hex: string,
): [number, number, number, number] {
  const raw = hex.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw)
  if (short) {
    const n = parseInt(short[1], 16)
    const r = (n >> 8) & 0xf
    const g = (n >> 4) & 0xf
    const b = n & 0xf
    return [r * 17, g * 17, b * 17, 255]
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(raw)
  if (full) {
    const n = parseInt(full[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
  }
  return [0x0a, 0x10, 0x18, 255]
}

export function rgbaToPackedUint32(
  r: number,
  g: number,
  b: number,
  a: number,
): number {
  const bytes = new Uint8Array(4)
  bytes[0] = r
  bytes[1] = g
  bytes[2] = b
  bytes[3] = a
  return new Uint32Array(bytes.buffer)[0]
}

type RgbaBytes = Uint8Array | Uint8ClampedArray

export function fillRgbaBuffer(
  dest: RgbaBytes,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const packed = new Uint32Array(
    dest.buffer,
    dest.byteOffset,
    dest.byteLength >> 2,
  )
  packed.fill(rgbaToPackedUint32(r, g, b, a))
}

/**
 * Copy `src` (srcW×srcH RGBA8) into `dest` at `box`. Same-size boxes are a
 * row memcpy; otherwise nearest-neighbour into the pump's scaled rect.
 */
export function blitRgbaLetterbox(
  src: RgbaBytes,
  srcW: number,
  srcH: number,
  dest: RgbaBytes,
  destW: number,
  destH: number,
  box: LetterboxRect,
): void {
  const dx = Math.max(0, box.dx | 0)
  const dy = Math.max(0, box.dy | 0)
  const dw = Math.max(0, Math.min(box.dw | 0, destW - dx))
  const dh = Math.max(0, Math.min(box.dh | 0, destH - dy))
  if (dw < 1 || dh < 1 || srcW < 1 || srcH < 1) return

  const src32 = new Uint32Array(src.buffer, src.byteOffset, srcW * srcH)
  const dest32 = new Uint32Array(dest.buffer, dest.byteOffset, destW * destH)

  if (dw === srcW && dh === srcH) {
    for (let y = 0; y < dh; y++) {
      const srcOff = y * srcW
      dest32.set(src32.subarray(srcOff, srcOff + srcW), (dy + y) * destW + dx)
    }
    return
  }

  const xMap = new Int32Array(dw)
  for (let x = 0; x < dw; x++) {
    xMap[x] = Math.min(srcW - 1, Math.floor((x * srcW) / dw))
  }
  for (let y = 0; y < dh; y++) {
    const srcRow = Math.min(srcH - 1, Math.floor((y * srcH) / dh)) * srcW
    const destRow = (dy + y) * destW + dx
    for (let x = 0; x < dw; x++) {
      dest32[destRow + x] = src32[srcRow + xMap[x]]
    }
  }
}

export type RgbaFramePool = {
  acquire(outW: number, outH: number, fillCss: string): Uint8Array
  /** Detach the backing store for transfer / return to the caller. */
  take(): ArrayBuffer
}

/** Pooled dest buffer; matte is painted once per size / fill change. */
export function createRgbaFramePool(): RgbaFramePool {
  let buffer: ArrayBuffer | null = null
  let width = 0
  let height = 0
  let fillKey = ''

  return {
    acquire(outW: number, outH: number, fillCss: string): Uint8Array {
      const bytes = outW * outH * 4
      if (!buffer || buffer.byteLength !== bytes || width !== outW || height !== outH) {
        buffer = new ArrayBuffer(bytes)
        width = outW
        height = outH
        fillKey = ''
      }
      const view = new Uint8Array(buffer)
      if (fillKey !== fillCss) {
        const [r, g, b, a] = parseCssHexRgba(fillCss)
        fillRgbaBuffer(view, r, g, b, a)
        fillKey = fillCss
      }
      return view
    },
    take(): ArrayBuffer {
      const out = buffer
      buffer = null
      width = 0
      height = 0
      fillKey = ''
      if (!out) {
        throw new Error('2D NDI frame pool empty')
      }
      return out
    },
  }
}

/** Transfer the view's backing store; slice only when it is a subarray. */
export function transferableRgbaBuffer(
  view: RgbaBytes,
): ArrayBuffer {
  const buf = view.buffer
  if (
    buf instanceof ArrayBuffer &&
    view.byteOffset === 0 &&
    view.byteLength === buf.byteLength
  ) {
    return buf
  }
  return buf.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}
