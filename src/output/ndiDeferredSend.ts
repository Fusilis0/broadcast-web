/**
 * Off-tick NDI `sendFrame` (DSP-OUT-20260829-04).
 *
 * `ipcRenderer.send` of an 8 MB RGBA frame is a synchronous structured clone.
 * Running it inside the `studio:tick` subscriber is why `totalTick` max was
 * 80 ms and the clock collapsed to ~50 Hz. Copy/steal pixels on the tick,
 * then `setTimeout(0)` the send so the tick returns after FBO + PBO begin/poll.
 *
 * Keep-newest: if a second frame is ready before the deferred send runs, the
 * older pending buffer is released and dropped.
 */

import { debugSessionLog } from './studioBridge.ts'

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
  /** Recycle the buffer after send, or when a newer frame replaces it. */
  release?: (data: ArrayBuffer) => void
  /**
   * How to leave the studio-tick stack. Default `setTimeout(0)` (macrotask)
   * so queued `studio:tick` IPC can run; `queueMicrotask` still delays the
   * next tick.
   */
  defer?: (fn: () => void) => void
}

export function deferNdiSendOffTick(fn: () => void): void {
  setTimeout(fn, 0)
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
  let pending: NdiDeferredFrame | null = null
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
      if (pending) {
        recycle(pending.data)
        pending = null
      }
      return
    }
    const frame = pending
    pending = null
    if (!frame) return
    try {
      // #region agent log
      const __sendT0 = performance.now()
      // #endregion
      options.send(frame)
      // #region agent log
      const __sendMs = performance.now() - __sendT0
      if (!(globalThis as { __ndiIpcLogAt?: number }).__ndiIpcLogAt ||
        performance.now() - ((globalThis as { __ndiIpcLogAt?: number }).__ndiIpcLogAt ?? 0) > 1000) {
        ;(globalThis as { __ndiIpcLogAt?: number }).__ndiIpcLogAt = performance.now()
        fetch('http://127.0.0.1:7438/ingest/7196fb84-148e-4d0c-af68-4fcb53313232',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'173fbb'},body:JSON.stringify({sessionId:'173fbb',runId:'pre-fix',hypothesisId:'H4',location:'ndiDeferredSend.ts:flush',message:'deferred sendFrame',data:{sendMs:__sendMs,bytes:frame.data.byteLength,w:frame.width,h:frame.height,bottomUp:frame.bottomUp},timestamp:Date.now()})}).catch(()=>{});
        // #region agent log
        debugSessionLog({
          hypothesisId: 'H4',
          location: 'ndiDeferredSend.ts:flush',
          message: 'deferred sendFrame',
          data: {
            sendMs: __sendMs,
            bytes: frame.data.byteLength,
            w: frame.width,
            h: frame.height,
            bottomUp: frame.bottomUp,
          },
        })
        // #endregion
      }
      // #endregion
    } finally {
      recycle(frame.data)
    }
  }

  return {
    enqueue(frame: NdiDeferredFrame): void {
      if (disposed) {
        recycle(frame.data)
        return
      }
      if (pending) recycle(pending.data)
      pending = frame
      if (scheduled) return
      scheduled = true
      defer(flush)
    },
    isScheduled(): boolean {
      return scheduled
    },
    dispose(): void {
      disposed = true
      if (pending) {
        recycle(pending.data)
        pending = null
      }
    },
  }
}
