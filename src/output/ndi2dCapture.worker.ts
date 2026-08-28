/**
 * Canvas-2D NDI grab worker (DSP-OUT-20260828-07).
 *
 * Receives a transferred ImageBitmap of the stream-map source, letterboxes it
 * into the studio lock (typically 1920×1080) on an OffscreenCanvas, then
 * transfers the RGBA buffer back. `getImageData` stays off the renderer tick.
 */

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

function ensureContext(
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

function transferablePixels(imageData: ImageData): ArrayBuffer {
  const view = imageData.data
  const buf = view.buffer
  if (
    buf instanceof ArrayBuffer &&
    view.byteOffset === 0 &&
    view.byteLength === buf.byteLength
  ) {
    return buf
  }
  return buf.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  ) as ArrayBuffer
}

scope.addEventListener('message', (event: MessageEvent<Ndi2dWorkerRequest>) => {
  const msg = event.data
  if (!msg || typeof msg.id !== 'number') return
  try {
    const context = ensureContext(msg.outW, msg.outH)
    context.fillStyle = msg.fill
    context.fillRect(0, 0, msg.outW, msg.outH)
    context.drawImage(msg.bitmap, msg.dx, msg.dy, msg.dw, msg.dh)
    msg.bitmap.close()
    const imageData = context.getImageData(0, 0, msg.outW, msg.outH)
    const data = transferablePixels(imageData)
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
