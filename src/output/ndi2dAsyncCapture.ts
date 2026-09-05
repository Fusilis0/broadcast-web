/**
 * Async 2D NDI pixel grab (DSP-OUT-20260830-01).
 *
 * **Happy path:** `createImageBitmap` of the source at native size, transferred
 * to a worker that `getImageData`s only that bitmap, letterboxes, and packs
 * UYVY. The dest buffer comes back transferred — no extra
 * `ArrayBuffer.slice` on the renderer thread.
 *
 * **Fallback:** the same native-size read + typed-array blit on this thread,
 * plus one ops note. Never `getImageData` of the 1080p destination.
 *
 * 2D is CPU, not an FBO — do not occupy the AR/3D stagger slot.
 */

import {
  blitRgbaLetterbox,
  createRgbaFramePool,
  transferableRgbaBuffer,
} from './letterboxRect.ts'
import { markNdiSync2dCapture } from './ndiStageTiming.ts'
import { diagMark2dGrabBitmap } from './ndiDeferredSend.ts'
import {
  hasNdiFboCanBeginProbes,
  isNdiFboReadbackPressured,
} from './ndiFboReadbackPressure.ts'
import { debugSessionLog } from './studioBridge.ts'

export type Ndi2dCaptureMode = 'worker' | 'sync'

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

type Ndi2dWorkerResponse =
  | { id: number; data: ArrayBuffer }
  | { id: number; error: string }


export type Ndi2dLetterboxBox = {
  dx: number
  dy: number
  dw: number
  dh: number
}

/** Letterbox matte — same as the pre-OUT-07 stream-map pump. */
export const NDI_2D_LETTERBOX_FILL = '#0a1018'

/**
 * Ops-safe note when the worker path is unavailable. Not an NDI error —
 * Send still works; UI may hitch like the pre-OUT-07 pump.
 */
export const NDI_2D_SYNC_CAPTURE_NOTE =
  '[output] NDI 2D capture: async worker unavailable — using sync getImageData (UI may hitch). Send fps unchanged.'

export type Ndi2dGrabInput = {
  source: HTMLCanvasElement
  outW: number
  outH: number
  box: Ndi2dLetterboxBox
}

export type CreateNdi2dAsyncCaptureOptions = {
  /** Test seam: skip worker even if the environment looks capable. */
  forceSync?: boolean
  /** Test seam: capture the fallback note instead of `console.warn`. */
  onFallbackNote?: (message: string) => void
  /** Test seam: override Worker construction. */
  createWorker?: () => Worker
  /** Test seam: override `createImageBitmap`. */
  createImageBitmapFn?: (
    source: HTMLCanvasElement,
  ) => Promise<ImageBitmap>
  /**
   * Test seam: how to leave the `studio:tick` stack.
   * Default `setTimeout(0)` so GL from this tick can submit first.
   */
  defer?: (fn: () => void) => void
}

export type Ndi2dAsyncCapture = {
  readonly mode: Ndi2dCaptureMode
  /** Run `fn` after the current `studio:tick` turn (macrotask). */
  defer(fn: () => void): void
  /**
   * Letterbox `source` into outW×outH. Worker path returns transferred
   * UYVY; sync fallback returns RGBA (pump packs on this thread).
   */
  grab(input: Ndi2dGrabInput): Promise<ArrayBuffer>
  dispose(): void
}

export function deferOffStudioTick(fn: () => void): void {
  if (typeof setTimeout === 'function') {
    setTimeout(fn, 0)
    return
  }
  queueMicrotask(fn)
}

export function probeNdi2dWorkerCapture(opts?: {
  WorkerCtor?: unknown
  OffscreenCanvasCtor?: unknown
  createImageBitmapFn?: unknown
}): boolean {
  const WorkerCtor =
    opts && 'WorkerCtor' in opts
      ? opts.WorkerCtor
      : typeof Worker !== 'undefined'
        ? Worker
        : undefined
  const OffscreenCanvasCtor =
    opts && 'OffscreenCanvasCtor' in opts
      ? opts.OffscreenCanvasCtor
      : typeof OffscreenCanvas !== 'undefined'
        ? OffscreenCanvas
        : undefined
  const createImageBitmapFn =
    opts && 'createImageBitmapFn' in opts
      ? opts.createImageBitmapFn
      : typeof createImageBitmap === 'function'
        ? createImageBitmap
        : undefined
  return (
    typeof WorkerCtor === 'function' &&
    typeof OffscreenCanvasCtor === 'function' &&
    typeof createImageBitmapFn === 'function'
  )
}

function defaultCreateWorker(): Worker {
  return new Worker(new URL('./ndi2dCapture.worker.ts', import.meta.url), {
    type: 'module',
    name: 'ndi-2d-capture',
  })
}

function defaultCreateImageBitmap(source: HTMLCanvasElement): Promise<ImageBitmap> {
  return createImageBitmap(source)
}

function warnFallback(
  onFallbackNote: ((message: string) => void) | undefined,
  alreadyNoted: { value: boolean },
): void {
  if (alreadyNoted.value) return
  alreadyNoted.value = true
  markNdiSync2dCapture()
  const emit = onFallbackNote ?? ((m) => console.warn(m))
  emit(NDI_2D_SYNC_CAPTURE_NOTE)
}

function readSourceRgba(
  source: HTMLCanvasElement,
  scratch: { canvas: HTMLCanvasElement | null; ctx: CanvasRenderingContext2D | null },
): Uint8ClampedArray {
  const srcW = source.width
  const srcH = source.height
  const direct = source.getContext('2d')
  if (direct) {
    return direct.getImageData(0, 0, srcW, srcH).data
  }

  if (
    !scratch.canvas ||
    !scratch.ctx ||
    scratch.canvas.width !== srcW ||
    scratch.canvas.height !== srcH
  ) {
    const hinted = document.createElement('canvas')
    hinted.width = srcW
    hinted.height = srcH
    const hintedCtx = hinted.getContext('2d', { willReadFrequently: true })
    if (hintedCtx) {
      scratch.canvas = hinted
      scratch.ctx = hintedCtx
    } else {
      const plain = document.createElement('canvas')
      plain.width = srcW
      plain.height = srcH
      const plainCtx = plain.getContext('2d')
      if (!plainCtx) {
        throw new Error('2D NDI source canvas 2d context unavailable')
      }
      scratch.canvas = plain
      scratch.ctx = plainCtx
    }
  }
  scratch.ctx.drawImage(source, 0, 0)
  return scratch.ctx.getImageData(0, 0, srcW, srcH).data
}

function syncGrabPixels(
  input: Ndi2dGrabInput,
  pool: ReturnType<typeof createRgbaFramePool>,
  scratch: { canvas: HTMLCanvasElement | null; ctx: CanvasRenderingContext2D | null },
): ArrayBuffer {
  const { source, outW, outH, box } = input
  const srcW = source.width
  const srcH = source.height
  const srcPixels = readSourceRgba(source, scratch)
  const dest = pool.acquire(outW, outH, NDI_2D_LETTERBOX_FILL)
  blitRgbaLetterbox(srcPixels, srcW, srcH, dest, outW, outH, box)
  const data = transferableRgbaBuffer(dest)
  pool.take()
  return data
}

/**
 * Start a 2D capture helper. Worker construction failure fails closed to sync.
 */
export function createNdi2dAsyncCapture(
  options: CreateNdi2dAsyncCaptureOptions = {},
): Ndi2dAsyncCapture {
  const noted = { value: false }
  const deferFn = options.defer ?? deferOffStudioTick
  const createImageBitmapFn =
    options.createImageBitmapFn ?? defaultCreateImageBitmap

  const pool = createRgbaFramePool()
  const scratch: {
    canvas: HTMLCanvasElement | null
    ctx: CanvasRenderingContext2D | null
  } = { canvas: null, ctx: null }
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (data: ArrayBuffer) => void; reject: (err: Error) => void }
  >()
  let disposed = false
  let mode: Ndi2dCaptureMode = 'sync'

  function rejectAll(reason: Error): void {
    for (const entry of pending.values()) {
      entry.reject(reason)
    }
    pending.clear()
  }

  function dropWorker(reason?: Error): void {
    if (worker) {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
      worker = null
    }
    if (pending.size > 0) {
      rejectAll(reason ?? new Error('2D NDI worker dropped'))
    }
    mode = 'sync'
  }

  function failClosedToSync(): void {
    dropWorker()
    warnFallback(options.onFallbackNote, noted)
  }

  const canWorker =
    !options.forceSync &&
    (typeof options.createWorker === 'function' || probeNdi2dWorkerCapture())

  if (canWorker) {
    try {
      const created = (options.createWorker ?? defaultCreateWorker)()
      created.onmessage = (event: MessageEvent<Ndi2dWorkerResponse>) => {
        const msg = event.data
        if (!msg || typeof msg.id !== 'number') return
        const entry = pending.get(msg.id)
        if (!entry) return
        pending.delete(msg.id)
        if ('error' in msg && msg.error) {
          entry.reject(new Error(msg.error))
          return
        }
        if ('data' in msg && msg.data) {
          entry.resolve(msg.data)
          return
        }
        entry.reject(new Error('2D NDI worker returned no pixels'))
      }
      created.onerror = () => {
        failClosedToSync()
      }
      worker = created
      mode = 'worker'
    } catch {
      failClosedToSync()
    }
  } else {
    warnFallback(options.onFallbackNote, noted)
    mode = 'sync'
  }

  async function workerGrab(input: Ndi2dGrabInput): Promise<ArrayBuffer> {
    const active = worker
    if (!active) {
      throw new Error('2D NDI worker missing')
    }
    // #region agent log
    const __bitT0 = performance.now()
    // #endregion
    diagMark2dGrabBitmap(true)
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmapFn(input.source)
    } finally {
      diagMark2dGrabBitmap(false)
    }
    // #region agent log
    ;(globalThis as { __ndi2dBitMs?: number }).__ndi2dBitMs = performance.now() - __bitT0
    // #endregion
    const id = nextId++
    const request: Ndi2dWorkerRequest = {
      id,
      bitmap,
      outW: input.outW,
      outH: input.outH,
      dx: input.box.dx,
      dy: input.box.dy,
      dw: input.box.dw,
      dh: input.box.dh,
      fill: NDI_2D_LETTERBOX_FILL,
    }
    return new Promise<ArrayBuffer>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      try {
        active.postMessage(request, [bitmap])
      } catch (err) {
        pending.delete(id)
        try {
          bitmap.close()
        } catch {
          /* ignore */
        }
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  return {
    get mode() {
      return mode
    },
    defer(fn: () => void): void {
      deferFn(fn)
    },
    async grab(input: Ndi2dGrabInput): Promise<ArrayBuffer> {
      if (disposed) {
        throw new Error('2D NDI capture disposed')
      }
      const __grabT0 = performance.now()
      if (mode === 'worker') {
        try {
          const data = await workerGrab(input)
          if (
            !(globalThis as { __ndi2dLogAt?: number }).__ndi2dLogAt ||
            performance.now() -
              ((globalThis as { __ndi2dLogAt?: number }).__ndi2dLogAt ?? 0) >
              1000
          ) {
            ;(globalThis as { __ndi2dLogAt?: number }).__ndi2dLogAt =
              performance.now()
            debugSessionLog({
              hypothesisId: 'H6',
              location: 'ndi2dAsyncCapture.ts:grab',
              message: '2d grab path',
              data: {
                path: 'worker',
                has2dContext: false,
                srcW: input.source.width,
                srcH: input.source.height,
                outW: input.outW,
                outH: input.outH,
                totalMs: performance.now() - __grabT0,
                bitmapMs:
                  (globalThis as { __ndi2dBitMs?: number }).__ndi2dBitMs ?? -1,
                bytes: data.byteLength,
              },
            })
          }
          return data
        } catch (err) {
          if (disposed) {
            throw new Error('2D NDI capture disposed')
          }
          // Per-grab failures must not silently reappear as sync getImageData
          // under load (SRT round 5). Permanent sync only via worker.onerror.
          if (worker) {
            throw err instanceof Error ? err : new Error(String(err))
          }
          failClosedToSync()
        }
      }
      // Sync path: refuse while AR/3D FBO pumps are live (or pressured).
      if (hasNdiFboCanBeginProbes()) {
        throw new Error(
          '2D NDI sync grab disabled while AR/3D NDI readback is active',
        )
      }
      if (isNdiFboReadbackPressured()) {
        throw new Error('2D NDI sync grab skipped under FBO readback pressure')
      }
      return syncGrabPixels(input, pool, scratch)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      rejectAll(new Error('2D NDI capture disposed'))
      dropWorker()
      if (scratch.canvas) {
        scratch.canvas.width = 0
        scratch.canvas.height = 0
        scratch.canvas = null
        scratch.ctx = null
      }
    },
  }
}
