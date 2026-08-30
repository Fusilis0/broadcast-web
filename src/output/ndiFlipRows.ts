/**
 * Top-down pack for native RGBA NDI. WebGL `readPixels` is bottom-up;
 * `grandi` rejects a negative line stride, and the GPU `blitFramebuffer`
 * dest-Y invert was a no-op (or a 20 ms stall) on the studio GPU.
 * Row swaps are memcpy of 1080 lines, not a per-pixel walk.
 */

let scratchRow: Uint8Array | null = null

function rowScratch(stride: number): Uint8Array {
  if (!scratchRow || scratchRow.byteLength < stride) {
    scratchRow = new Uint8Array(stride)
  }
  return scratchRow
}

export function flipRgbaRowsInPlace(
  buf: Uint8Array,
  width: number,
  height: number,
): void {
  const w = Math.max(0, width | 0)
  const h = Math.max(0, height | 0)
  const stride = w * 4
  if (stride < 4 || h < 2 || buf.byteLength < stride * h) return
  const tmp = rowScratch(stride)
  const mid = h >> 1
  for (let y = 0; y < mid; y++) {
    const top = y * stride
    const bot = (h - 1 - y) * stride
    tmp.set(buf.subarray(top, top + stride))
    buf.copyWithin(top, bot, bot + stride)
    buf.set(tmp.subarray(0, stride), bot)
  }
}

export function flipOwnedRgbaFrame(
  data: ArrayBuffer,
  width: number,
  height: number,
): ArrayBuffer {
  flipRgbaRowsInPlace(new Uint8Array(data), width, height)
  return data
}
