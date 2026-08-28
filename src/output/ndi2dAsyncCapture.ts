/**
 * Async 2D NDI pixel grab (DSP-OUT-20260828-07).
 *
 * **Happy path:** `createImageBitmap` + dedicated worker `OffscreenCanvas`
 * `getImageData`. The 1920×1080 RGBA buffer comes back transferred — no extra
 * `ArrayBuffer.slice` on the renderer thread.
 *
 * **Fallback:** sync canvas `getImageData` (today's path) plus one ops note.
 * NDI still sends. Do not pretend the path is async.
 *
 * 2D is CPU, not an FBO — do not occupy the AR/3D stagger slot.
 */

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
   * Letterbox `source` into outW×outH and return top-down RGBA.
   * Worker path: transferable buffer (caller must not slice again).
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
  const emit = onFallbackNote ?? ((m) => console.warn(m))
  emit(NDI_2D_SYNC_CAPTURE_NOTE)
}

function syncGrabPixels(
  frameCtx: CanvasRenderingContext2D,
  input: Ndi2dGrabInput,
): ArrayBuffer {
  const { source, outW, outH, box } = input
  frameCtx.fillStyle = NDI_2D_LETTERBOX_FILL
  frameCtx.fillRect(0, 0, outW, outH)
  frameCtx.drawImage(source, box.dx, box.dy, box.dw, box.dh)
  const imageData = frameCtx.getImageData(0, 0, outW, outH)
  const view = imageData.data
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  ) as ArrayBuffer
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

  let frameCanvas: HTMLCanvasElement | null = null
  let frameCtx: CanvasRenderingContext2D | null = null
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (data: ArrayBuffer) => void; reject: (err: Error) => void }
  >()
  let disposed = false
  let mode: Ndi2dCaptureMode = 'sync'

  function ensureFrameCtx(outW: number, outH: number): CanvasRenderingContext2D {
    if (
      frameCanvas &&
      frameCtx &&
      frameCanvas.width === outW &&
      frameCanvas.height === outH
    ) {
      return frameCtx
    }

    const hinted = document.createElement('canvas')
    hinted.width = outW
    hinted.height = outH
    const hintedCtx = hinted.getContext('2d', { willReadFrequently: true })
    if (hintedCtx) {
      frameCanvas = hinted
      frameCtx = hintedCtx
      return frameCtx
    }

    // happy-dom (and some test canvases) reject the willReadFrequently hint
    // and then refuse a second getContext on the same element.
    const plain = document.createElement('canvas')
    plain.width = outW
    plain.height = outH
    const plainCtx = plain.getContext('2d')
    if (!plainCtx) {
      throw new Error('2D NDI frame canvas 2d context unavailable')
    }
    frameCanvas = plain
    frameCtx = plainCtx
    return frameCtx
  }

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
    const bitmap = await createImageBitmapFn(input.source)
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
      if (mode === 'worker') {
        try {
          return await workerGrab(input)
        } catch {
          if (disposed) {
            throw new Error('2D NDI capture disposed')
          }
          failClosedToSync()
        }
      }
      return syncGrabPixels(ensureFrameCtx(input.outW, input.outH), input)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      rejectAll(new Error('2D NDI capture disposed'))
      dropWorker()
      if (frameCanvas) {
        frameCanvas.width = 0
        frameCanvas.height = 0
        frameCanvas = null
        frameCtx = null
      }
    },
  }
}
