import type { WebGLRenderer, WebGLRenderTarget } from 'three'

/**
 * Pipelined GPU readback for NDI (DSP-OUT-20260828-01).
 *
 * **PBO path (WebGL2):** `PIXEL_PACK_BUFFER` + `fenceSync`. `begin()` issues the
 * pack without waiting; `poll()` copies **1+ frames later**. One frame of
 * capture latency is expected and OK. Layout is bottom-up (same as
 * `gl.readPixels` / Three.js `readRenderTargetPixels`).
 *
 * **Fallback:** if WebGL2 / PBO / fence is missing, `begin()` calls
 * `readRenderTargetPixels` immediately and `poll()` returns it on the same
 * tick. Logs {@link NDI_SYNC_READBACK_NOTE} once. NDI still sends — do not
 * pretend the path is async.
 *
 * Caps: AR 30 / 3D 30 / 2D on@30 / `STUDIO_TICK_FPS` 60 NDI-only
 * (DSP-OUT-20260828-04). Preview stays rAF.
 */

export type NdiReadbackMode = 'pbo' | 'sync'

/** Documented PBO pipeline depth — one studio tick of capture latency. */
export const NDI_ASYNC_READBACK_LATENCY_FRAMES = 1

/** Double-buffer so a new pack can start while the previous fence is polled. */
export const NDI_ASYNC_READBACK_PBO_COUNT = 2

/** Drop a stuck fence rather than `clientWaitSync` with a real timeout. */
export const NDI_ASYNC_READBACK_FENCE_MAX_MS = 250

/**
 * Ops-safe note when the async path is unavailable. Not an NDI error —
 * Send still works, UI may hitch like the pre-PBO pumps.
 */
export const NDI_SYNC_READBACK_NOTE =
  '[output] NDI readback: WebGL2 PBO unavailable — using sync readPixels (UI may hitch). Send fps unchanged.'

export type NdiReadbackPixels = {
  width: number
  height: number
  /** RGBA8, bottom-up. Owned by the helper until the next begin/poll reuse. */
  data: Uint8Array
}

export type NdiReadbackRenderer = Pick<
  WebGLRenderer,
  'getContext' | 'readRenderTargetPixels'
>

export type CreateNdiAsyncReadbackOptions = {
  renderer: NdiReadbackRenderer
  /** Test seam: override `renderer.getContext()`, or `null` to force sync. */
  gl?: unknown
  /** Test seam: skip PBO even if GL looks capable. */
  forceSync?: boolean
  /** Test seam: capture the fallback note instead of `console.warn`. */
  onFallbackNote?: (message: string) => void
}

export type NdiAsyncReadback = {
  readonly mode: NdiReadbackMode
  /** True while at least one PBO pack is in flight. Sync mode: false after poll. */
  isPending(): boolean
  /**
   * Issue a read. Call while the FBO is still bound (`setRenderTarget` after
   * the capture render, before restore). Returns false when both PBO slots
   * are in flight (drop this capture).
   *
   * Sync: pixels are ready for the next `poll()` on **this** tick.
   * PBO: `poll()` on a later tick.
   */
  begin(
    target: WebGLRenderTarget,
    width: number,
    height: number,
    nowMs?: number,
  ): boolean
  /**
   * Non-blocking. Returns the oldest completed pack, or null.
   * Caller must copy `data` before the next begin/poll that reuses the slot.
   */
  poll(nowMs?: number): NdiReadbackPixels | null
  dispose(): void
}

type Gl2Like = {
  PIXEL_PACK_BUFFER: number
  PIXEL_PACK_BUFFER_BINDING?: number
  STREAM_READ: number
  RGBA: number
  UNSIGNED_BYTE: number
  PACK_ALIGNMENT: number
  FRAMEBUFFER?: number
  FRAMEBUFFER_COMPLETE?: number
  SYNC_GPU_COMMANDS_COMPLETE: number
  CONDITION_SATISFIED?: number
  ALREADY_SIGNALED?: number
  TIMEOUT_EXPIRED?: number
  WAIT_FAILED?: number
  createBuffer: () => unknown
  bindBuffer: (target: number, buffer: unknown) => void
  bufferData: (target: number, size: number, usage: number) => void
  readPixels: (
    x: number,
    y: number,
    w: number,
    h: number,
    format: number,
    type: number,
    offset: number,
  ) => void
  fenceSync: (condition: number, flags: number) => unknown
  flush: () => void
  clientWaitSync: (sync: unknown, flags: number, timeout: number) => number
  deleteSync: (sync: unknown) => void
  getBufferSubData: (
    target: number,
    srcOffset: number,
    dest: ArrayBufferView,
  ) => void
  deleteBuffer: (buffer: unknown) => void
  getParameter: (pname: number) => unknown
  pixelStorei: (pname: number, param: number) => void
  checkFramebufferStatus?: (target: number) => number
}

type PboSlot = {
  buffer: unknown
  fence: unknown
  width: number
  height: number
  byteLength: number
  capturedAtMs: number
  cpu: Uint8Array | null
  inFlight: boolean
}

const CONDITION_SATISFIED = 0x911c
const ALREADY_SIGNALED = 0x911a
const TIMEOUT_EXPIRED = 0x911b
const WAIT_FAILED = 0x911d
const FENCE_FAIL_LIMIT = 3

/** Duck-type WebGL2 PBO + fence. Avoid `instanceof` so tests can inject a fake. */
export function probeNdiPboReadback(gl: unknown): gl is Gl2Like {
  if (!gl || typeof gl !== 'object') return false
  const g = gl as Gl2Like
  return (
    typeof g.createBuffer === 'function' &&
    typeof g.bindBuffer === 'function' &&
    typeof g.bufferData === 'function' &&
    typeof g.readPixels === 'function' &&
    typeof g.fenceSync === 'function' &&
    typeof g.clientWaitSync === 'function' &&
    typeof g.getBufferSubData === 'function' &&
    typeof g.deleteSync === 'function' &&
    typeof g.deleteBuffer === 'function' &&
    typeof g.flush === 'function' &&
    typeof g.PIXEL_PACK_BUFFER === 'number' &&
    typeof g.STREAM_READ === 'number' &&
    typeof g.RGBA === 'number' &&
    typeof g.UNSIGNED_BYTE === 'number' &&
    typeof g.SYNC_GPU_COMMANDS_COMPLETE === 'number'
  )
}

function nowMs(explicit?: number): number {
  return typeof explicit === 'number' && Number.isFinite(explicit)
    ? explicit
    : performance.now()
}

function byteLengthFor(w: number, h: number): number {
  return Math.max(0, w) * Math.max(0, h) * 4
}

function ensureCpu(slot: { cpu: Uint8Array | null }, bytes: number): Uint8Array {
  if (!slot.cpu || slot.cpu.byteLength !== bytes) {
    slot.cpu = new Uint8Array(bytes)
  }
  return slot.cpu
}

/**
 * Create a pipelined readback helper bound to one renderer / GL context.
 */
export function createNdiAsyncReadback(
  options: CreateNdiAsyncReadbackOptions,
): NdiAsyncReadback {
  const { renderer } = options
  const onFallbackNote =
    options.onFallbackNote ??
    ((message: string) => {
      console.warn(message)
    })

  const glRaw =
    options.gl !== undefined ? options.gl : renderer.getContext()
  const probed = !options.forceSync && probeNdiPboReadback(glRaw)
  const gl: Gl2Like | null = probed ? glRaw : null

  let mode: NdiReadbackMode = gl ? 'pbo' : 'sync'
  let disposed = false
  let notedFallback = false
  let fenceFails = 0

  const slots: PboSlot[] = []
  let syncReady: NdiReadbackPixels | null = null
  const syncStore: { cpu: Uint8Array | null } = { cpu: null }

  function noteFallback(): void {
    if (notedFallback) return
    notedFallback = true
    onFallbackNote(NDI_SYNC_READBACK_NOTE)
  }

  function fallToSync(): void {
    if (mode === 'sync') return
    mode = 'sync'
    noteFallback()
    disposeSlots()
  }

  if (!gl) noteFallback()

  function initSlots(): boolean {
    if (!gl || slots.length > 0) return slots.length > 0
    for (let i = 0; i < NDI_ASYNC_READBACK_PBO_COUNT; i++) {
      const buffer = gl.createBuffer()
      if (!buffer) {
        disposeSlots()
        return false
      }
      slots.push({
        buffer,
        fence: null,
        width: 0,
        height: 0,
        byteLength: 0,
        capturedAtMs: 0,
        cpu: null,
        inFlight: false,
      })
    }
    return true
  }

  function disposeSlots(): void {
    if (!gl) {
      slots.length = 0
      return
    }
    for (const slot of slots) {
      if (slot.fence) {
        try {
          gl.deleteSync(slot.fence)
        } catch {
          /* ignore */
        }
        slot.fence = null
      }
      try {
        gl.deleteBuffer(slot.buffer)
      } catch {
        /* ignore */
      }
      slot.inFlight = false
      slot.cpu = null
    }
    slots.length = 0
  }

  function beginSync(target: WebGLRenderTarget, w: number, h: number): boolean {
    const bytes = byteLengthFor(w, h)
    if (bytes < 4) return false
    const buf = ensureCpu(syncStore, bytes)
    try {
      renderer.readRenderTargetPixels(target, 0, 0, w, h, buf)
    } catch {
      return false
    }
    syncReady = { width: w, height: h, data: buf }
    return true
  }

  function packPbo(slot: PboSlot, w: number, h: number, now: number): boolean {
    if (!gl) return false
    const bytes = byteLengthFor(w, h)
    const prevPack =
      typeof gl.PIXEL_PACK_BUFFER_BINDING === 'number'
        ? gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)
        : null
    const prevAlign =
      typeof gl.PACK_ALIGNMENT === 'number'
        ? gl.getParameter(gl.PACK_ALIGNMENT)
        : 4

    if (typeof gl.FRAMEBUFFER === 'number' && gl.checkFramebufferStatus) {
      const fb = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      if (
        typeof gl.FRAMEBUFFER_COMPLETE === 'number' &&
        fb !== gl.FRAMEBUFFER_COMPLETE
      ) {
        return false
      }
    }

    try {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.buffer)
      if (slot.byteLength !== bytes) {
        gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ)
        slot.byteLength = bytes
        slot.cpu = null
      }
      if (typeof gl.PACK_ALIGNMENT === 'number') {
        gl.pixelStorei(gl.PACK_ALIGNMENT, 1)
      }
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0)
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      gl.flush()
      if (!fence) return false
      slot.fence = fence
      slot.width = w
      slot.height = h
      slot.capturedAtMs = now
      slot.inFlight = true
      return true
    } finally {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, prevPack ?? null)
      if (typeof gl.PACK_ALIGNMENT === 'number' && typeof prevAlign === 'number') {
        gl.pixelStorei(gl.PACK_ALIGNMENT, prevAlign)
      }
    }
  }

  function abandon(slot: PboSlot): void {
    if (gl && slot.fence) {
      try {
        gl.deleteSync(slot.fence)
      } catch {
        /* ignore */
      }
    }
    slot.fence = null
    slot.inFlight = false
  }

  function completeSlot(slot: PboSlot): NdiReadbackPixels | null {
    if (!gl) return null
    const bytes = byteLengthFor(slot.width, slot.height)
    const cpu = ensureCpu(slot, bytes)
    const prevPack =
      typeof gl.PIXEL_PACK_BUFFER_BINDING === 'number'
        ? gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)
        : null
    try {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.buffer)
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, cpu)
    } finally {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, prevPack ?? null)
      if (slot.fence) {
        try {
          gl.deleteSync(slot.fence)
        } catch {
          /* ignore */
        }
      }
      slot.fence = null
      slot.inFlight = false
    }
    return { width: slot.width, height: slot.height, data: cpu }
  }

  const handle: NdiAsyncReadback = {
    get mode() {
      return mode
    },
    isPending(): boolean {
      if (mode === 'sync') return syncReady !== null
      return slots.some((s) => s.inFlight)
    },
    begin(target, width, height, capturedAt?: number): boolean {
      if (disposed) return false
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (w < 1 || h < 1) return false

      if (mode === 'sync' || !gl) {
        return beginSync(target, w, h)
      }

      if (!initSlots()) {
        fallToSync()
        return beginSync(target, w, h)
      }

      const free = slots.find((s) => !s.inFlight)
      if (!free) return false

      try {
        if (!packPbo(free, w, h, nowMs(capturedAt))) {
          abandon(free)
          fallToSync()
          return beginSync(target, w, h)
        }
        return true
      } catch {
        abandon(free)
        fallToSync()
        return beginSync(target, w, h)
      }
    },
    poll(explicitNow?: number): NdiReadbackPixels | null {
      if (disposed) return null
      if (mode === 'sync' || !gl) {
        const ready = syncReady
        syncReady = null
        return ready
      }

      const now = nowMs(explicitNow)
      const inFlight = slots
        .filter((s) => s.inFlight)
        .sort((a, b) => a.capturedAtMs - b.capturedAtMs)

      for (const slot of inFlight) {
        if (!slot.fence) {
          abandon(slot)
          continue
        }
        let status: number
        try {
          status = gl.clientWaitSync(slot.fence, 0, 0)
        } catch {
          abandon(slot)
          fenceFails += 1
          if (fenceFails >= FENCE_FAIL_LIMIT) fallToSync()
          continue
        }

        const satisfied =
          status === (gl.CONDITION_SATISFIED ?? CONDITION_SATISFIED) ||
          status === (gl.ALREADY_SIGNALED ?? ALREADY_SIGNALED)
        if (satisfied) {
          fenceFails = 0
          try {
            return completeSlot(slot)
          } catch {
            abandon(slot)
            fenceFails += 1
            if (fenceFails >= FENCE_FAIL_LIMIT) fallToSync()
            return null
          }
        }

        const failed = status === (gl.WAIT_FAILED ?? WAIT_FAILED)
        const expired =
          status === (gl.TIMEOUT_EXPIRED ?? TIMEOUT_EXPIRED) &&
          now - slot.capturedAtMs > NDI_ASYNC_READBACK_FENCE_MAX_MS
        if (failed || expired) {
          abandon(slot)
          fenceFails += 1
          if (fenceFails >= FENCE_FAIL_LIMIT) fallToSync()
          continue
        }
        // Oldest fence still pending — keep order; do not complete a newer slot.
        return null
      }
      return null
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      syncReady = null
      syncStore.cpu = null
      disposeSlots()
    },
  }

  return handle
}
