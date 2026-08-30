/**
 * Native-size 2D NDI grab worker (DSP-OUT-20260830-01 / pack-native).
 *
 * Receives a transferred ImageBitmap of the stream-map source at native size,
 * reads those pixels only, packs Rec.709 UYVY at native size, then nearest-
 * neighbour letterboxes into a 1920×1080 UYVY frame (matte bars, not a 1080p
 * RGBA convert).
 */

import {
  blitUyvyNearest,
  fillUyvyFromCssHex,
  packedFrameBytes,
  rgbaToUyvy,
} from './ndiUyvy.ts'

type Ndi2dWorkerRequest = {
  id: number
  bitmap: ImageBitmap
  outW: number
  outH: number
  dx: number
  dy: number
  dw: number
  dh: number
  fill: string
}

type Ndi2dWorkerOk = { id: number; data: ArrayBuffer }
type Ndi2dWorkerErr = { id: number; error: string }

type WorkerScope = {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<Ndi2dWorkerRequest>) => void,
  ) => void
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

const scope = globalThis as unknown as WorkerScope

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let nativeUyvy: Uint8Array | null = null

function ensureNativeContext(
  width: number,
  height: number,
): OffscreenCanvasRenderingContext2D {
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    canvas = new OffscreenCanvas(width, height)
    const next = canvas.getContext('2d', { willReadFrequently: true })
    if (!next) {
      throw new Error('OffscreenCanvas 2d unavailable')
    }
    ctx = next
  }
  if (!ctx) {
    throw new Error('OffscreenCanvas 2d unavailable')
  }
  return ctx
}

scope.addEventListener('message', (event: MessageEvent<Ndi2dWorkerRequest>) => {
  const msg = event.data
  if (!msg || typeof msg.id !== 'number') return
  try {
    const srcW = msg.bitmap.width
    const srcH = msg.bitmap.height
    const context = ensureNativeContext(srcW, srcH)
    context.drawImage(msg.bitmap, 0, 0)
    msg.bitmap.close()
    const imageData = context.getImageData(0, 0, srcW, srcH)
    const nativeBytes = packedFrameBytes('uyvy', srcW, srcH)
    if (!nativeUyvy || nativeUyvy.byteLength !== nativeBytes) {
      nativeUyvy = new Uint8Array(nativeBytes)
    }
    const wroteNative = rgbaToUyvy(imageData.data, srcW, srcH, nativeUyvy)
    if (wroteNative !== nativeBytes) {
      throw new Error('2D native UYVY pack failed')
    }
    const uyvyBytes = packedFrameBytes('uyvy', msg.outW, msg.outH)
    const uyvy = new Uint8Array(uyvyBytes)
    fillUyvyFromCssHex(uyvy, msg.fill)
    blitUyvyNearest(nativeUyvy, srcW, srcH, uyvy, msg.outW, msg.outH, {
      dx: msg.dx,
      dy: msg.dy,
      dw: msg.dw,
      dh: msg.dh,
    })
    const data = uyvy.buffer
    scope.postMessage({ id: msg.id, data } satisfies Ndi2dWorkerOk, [data])
  } catch (err) {
    try {
      msg.bitmap.close()
    } catch {
      /* already closed or missing */
    }
    const error = err instanceof Error ? err.message : String(err)
    scope.postMessage({ id: msg.id, error } satisfies Ndi2dWorkerErr)
  }
})
