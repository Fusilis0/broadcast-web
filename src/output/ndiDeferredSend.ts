/**
 * Off-tick NDI `sendFrame` (DSP-OUT-20260829-04).
 *
 * `ipcRenderer.send` of a packed frame is a synchronous structured clone.
 * Running it inside the `studio:tick` subscriber stalls the clock.
 * Copy/steal pixels on the tick, then `setTimeout(0)` the send.
 *
 * Hold up to `maxPending` frames in arrival order. Overflow drops the oldest.
 * When the deferred timer fires, drain the short queue oldest-first.
 * Default N=1 (legacy latest-wins). AR/3D/2D live pumps use N=2.
 */

export type NdiDeferredFrame = {
  width: number
  height: number
  data: ArrayBuffer
  bottomUp: boolean
  pixelFormat?: 'rgba' | 'uyvy' | 'uyva'
}

export type NdiDeferredSend = {
  /** Queue a frame. Tick-safe: does not call `send`. */
  enqueue(frame: NdiDeferredFrame): void
  /** True while a macrotask send is scheduled (not while send is running). */
  isScheduled(): boolean
  dispose(): void
}

export type CreateNdiDeferredSendOptions = {
  send: (frame: NdiDeferredFrame) => void
  /** Recycle the buffer after send, or when overflow drops the oldest. */
  release?: (data: ArrayBuffer) => void
  /**
   * How to leave the studio-tick stack. Default `setTimeout(0)` (macrotask)
   * so queued `studio:tick` IPC can run; `queueMicrotask` still delays the
   * next tick.
   */
  defer?: (fn: () => void) => void
  /**
   * Pending frames before overflow drops the oldest. Clamped to 1 or 2.
   * Default 1.
   */
  maxPending?: number
}

export function deferNdiSendOffTick(fn: () => void): void {
  setTimeout(fn, 0)
}

function resolveMaxPending(requested: number | undefined): 1 | 2 {
  return requested != null && requested >= 2 ? 2 : 1
}

/**
 * Take the underlying ArrayBuffer without `ArrayBuffer.slice`.
 * Pixel-ring views are whole buffers; a non-full view is copied via `set`.
 */
export function takeNdiArrayBuffer(buf: Uint8Array): ArrayBuffer {
  const raw = buf.buffer
  if (
    buf.byteOffset === 0 &&
    raw instanceof ArrayBuffer &&
    buf.byteLength === raw.byteLength
  ) {
    return raw
  }
  const copy = new Uint8Array(buf.byteLength)
  copy.set(buf)
  return copy.buffer
}

export function createNdiDeferredSend(
  options: CreateNdiDeferredSendOptions,
): NdiDeferredSend {
  const defer = options.defer ?? deferNdiSendOffTick
  const maxPending = resolveMaxPending(options.maxPending)
  const pending: NdiDeferredFrame[] = []
  let scheduled = false
  let disposed = false

  function recycle(data: ArrayBuffer): void {
    try {
      options.release?.(data)
    } catch {
      /* ignore */
    }
  }

  function flush(): void {
    scheduled = false
    if (disposed) {
      while (pending.length > 0) {
        const dropped = pending.shift()
        if (dropped) recycle(dropped.data)
      }
      return
    }
    const batch = pending.splice(0, pending.length)
    for (const frame of batch) {
      try {
        options.send(frame)
      } finally {
        recycle(frame.data)
      }
    }
  }

  return {
    enqueue(frame: NdiDeferredFrame): void {
      if (disposed) {
        recycle(frame.data)
        return
      }
      pending.push(frame)
      while (pending.length > maxPending) {
        const dropped = pending.shift()
        if (dropped) recycle(dropped.data)
      }
      if (scheduled) return
      scheduled = true
      defer(flush)
    },
    isScheduled(): boolean {
      return scheduled
    },
    dispose(): void {
      disposed = true
      while (pending.length > 0) {
        const dropped = pending.shift()
        if (dropped) recycle(dropped.data)
      }
    },
  }
}
