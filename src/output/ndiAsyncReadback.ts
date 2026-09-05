import type { WebGLRenderer, WebGLRenderTarget } from 'three'
import { markNdiSyncReadback } from './ndiStageTiming.ts'

/**
 * Pipelined GPU readback for NDI (DSP-OUT-20260828-01 / 02-05).
 *
 * **Live WebGL2 path:** PBO `begin` / `poll` only. Send checked ⇒ pack that
 * RT. Spy `gl.bindFramebuffer` (once on this context, and again around
 * `setRenderTarget`) and PBO-read the last **non-null** DRAW/`FRAMEBUFFER`
 * handle Three bound — ANGLE `getParameter(DRAW)` is null and r178 does not
 * publish `__webglFramebuffer` / `__webglTexture`. If the spy sees only
 * null, keep the owned-READ texture attach, then skip **this tick**. Never
 * pack the default canvas FB. Skip is **one** busy tick — not skip-forever,
 * not `fallToSync` / `readRenderTargetPixels`. Caps stay AR/3D/2D **30**;
 * this slice is not 30×3.
 *
 * **Sync** (`forceSync` / missing WebGL2): debug/emergency only. Do not
 * mark {@link markNdiSyncReadback} at construct — only when `begin` actually
 * sync-reads. Layout is bottom-up (same as `gl.readPixels`).
 *
 * Caps: AR 30 / 3D 30 / 2D on@30 / `STUDIO_TICK_FPS` 60. Preview stays rAF.
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

/**
 * Per-frame skip when this tick has no spy DRAW FBO **and** no color texture
 * to attach to the owned READ FBO. Does **not** destroy PBO mode and does
 * **not** sync-read. Never pack the default canvas FB as UYVY. Skip ≠
 * policy: Send checked still sends once Three binds the RT FBO.
 */
export const NDI_PUBLIC_FBO_MISSING_NOTE =
  '[output] NDI readback: no RT FBO and no color texture — skip capture this tick'

export type NdiReadbackPixels = {
  width: number
  height: number
  /** RGBA8, bottom-up. Owned by the caller after `poll` until `release`. */
  data: Uint8Array
}

export type NdiReadbackRenderer = Pick<
  WebGLRenderer,
  'getContext' | 'readRenderTargetPixels'
> & {
  /**
   * Bind `target` as DRAW. Live Three r178 calls `gl.bindFramebuffer` with a
   * real handle but does not publish it (`properties` / RT / Texture hangs
   * are missing; ANGLE `getParameter(DRAW)` is null). `begin` spies that
   * bind and PBO-reads it as READ. Public FBO / texture attach remain
   * fallbacks. Null default canvas is never packed as UYVY.
   */
  setRenderTarget?: WebGLRenderer['setRenderTarget']
  /**
   * Runtime Three map (r178 `initGLContext`). Optional on the type so tests
   * and stubs work; live WebGL2 studio has it — do not treat as missing.
   */
  properties?: {
    get: (object: unknown) => unknown
  }
}

export type CreateNdiAsyncReadbackOptions = {
  renderer: NdiReadbackRenderer
  /** Test seam: override `renderer.getContext()`, or `null` to force sync. */
  gl?: unknown
  /** Test seam: skip PBO even if GL looks capable. */
  forceSync?: boolean
  /** Test seam: capture the fallback note instead of `console.warn`. */
  onFallbackNote?: (message: string) => void
}

/** Recycled RGBA CPU buffers — in-flight PBO + deferred IPC, no `slice`. */
export const NDI_PIXEL_RING_CAPACITY = 4

export type NdiAsyncReadback = {
  readonly mode: NdiReadbackMode
  /** True while at least one PBO pack is in flight. Sync mode: false after poll. */
  isPending(): boolean
  /**
   * True when `begin` can accept a pack without dropping (free PBO slot, or
   * emergency sync). Check **before** the 1080p render so a failed begin cannot
   * waste a pass (DSP-OUT-20260829-04 burned-slot defect).
   */
  canBegin(): boolean
  /**
   * Issue a read of `target`. Live WebGL2: PBO only. Spies `bindFramebuffer`
   * around `setRenderTarget` (and once on this `gl`) and binds **READ** to
   * the last non-null DRAW/`FRAMEBUFFER` handle. Public `properties` / RT
   * hang / texture attach remain fallbacks. `begin() === false` is no slot /
   * fence / bad size / spy+texture missing this tick — not skip-forever.
   * Does not `readRenderTargetPixels`, does not leave PBO mode.
   * Never pack the default canvas FB as UYVY.
   * Returns false when both PBO slots are in flight (drop this capture).
   *
   * Sync (`forceSync` / no WebGL2): pixels ready for `poll()` on **this** tick.
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
   * `data` is **owned by the caller** — this helper will not overwrite it.
   * Recycle with {@link NdiAsyncReadback.release} after `sendFrame` returns.
   */
  poll(nowMs?: number): NdiReadbackPixels | null
  /**
   * Return a polled CPU buffer to the ring. Safe to call after IPC send
   * (structured clone has finished). Unknown / already-released buffers are
   * ignored.
   */
  release(data: Uint8Array | ArrayBuffer): void
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
  FRAMEBUFFER_BINDING?: number
  FRAMEBUFFER_COMPLETE?: number
  READ_FRAMEBUFFER?: number
  READ_FRAMEBUFFER_BINDING?: number
  DRAW_FRAMEBUFFER?: number
  DRAW_FRAMEBUFFER_BINDING?: number
  bindFramebuffer?: (target: number, framebuffer: unknown) => void
  createFramebuffer?: () => unknown
  deleteFramebuffer?: (framebuffer: unknown) => void
  framebufferTexture2D?: (
    target: number,
    attachment: number,
    textarget: number,
    texture: unknown,
    level: number,
  ) => void
  COLOR_ATTACHMENT0?: number
  TEXTURE_2D?: number
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
/** WebGL2 `READ_FRAMEBUFFER` — `readPixels` source (not DRAW). */
const GL_READ_FRAMEBUFFER = 0x8ca8
const GL_READ_FRAMEBUFFER_BINDING = 0x8caa
/** `FRAMEBUFFER` vs `DRAW_FRAMEBUFFER` — spy both; never READ. */
const GL_FRAMEBUFFER = 0x8d40
const GL_DRAW_FRAMEBUFFER = 0x8ca9
/** `FRAMEBUFFER_BINDING` / `DRAW_FRAMEBUFFER_BINDING` — same enum in WebGL2. */
const GL_FRAMEBUFFER_BINDING = 0x8ca6
const GL_COLOR_ATTACHMENT0 = 0x8ce0
const GL_TEXTURE_2D = 0x0de1

type BindFramebufferFn = (target: number, framebuffer: unknown) => void

function isDrawFramebufferBindTarget(gl: Gl2Like, target: number): boolean {
  const readEnum =
    typeof gl.READ_FRAMEBUFFER === 'number'
      ? gl.READ_FRAMEBUFFER
      : GL_READ_FRAMEBUFFER
  if (target === readEnum) return false
  const fbEnum =
    typeof gl.FRAMEBUFFER === 'number' ? gl.FRAMEBUFFER : GL_FRAMEBUFFER
  const drawEnum =
    typeof gl.DRAW_FRAMEBUFFER === 'number'
      ? gl.DRAW_FRAMEBUFFER
      : GL_DRAW_FRAMEBUFFER
  return target === fbEnum || target === drawEnum
}

type PackedReadOutcome = 'ok' | 'no-fbo' | 'fail'

function unwrapWebglFramebuffer(raw: unknown): unknown {
  if (raw == null) return null
  if (Array.isArray(raw)) return unwrapWebglFramebuffer(raw[0])
  return raw
}

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

function viewOf(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof ArrayBuffer ? new Uint8Array(data) : data
}

function createPixelRing(capacity: number): {
  acquire(bytes: number): Uint8Array
  release(data: Uint8Array | ArrayBuffer): void
  clear(): void
} {
  const free: Uint8Array[] = []
  return {
    acquire(bytes: number): Uint8Array {
      const i = free.findIndex((b) => b.byteLength === bytes)
      if (i >= 0) return free.splice(i, 1)[0]!
      return new Uint8Array(bytes)
    },
    release(data: Uint8Array | ArrayBuffer): void {
      const buf = viewOf(data)
      if (buf.byteLength < 4) return
      if (free.length >= capacity) return
      if (free.some((b) => b.buffer === buf.buffer && b.byteOffset === buf.byteOffset)) {
        return
      }
      free.push(buf)
    },
    clear(): void {
      free.length = 0
    },
  }
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
  let notedPublicFbo = false

  const slots: PboSlot[] = []
  let syncReady: NdiReadbackPixels | null = null
  const pixelRing = createPixelRing(NDI_PIXEL_RING_CAPACITY)
  /** OUT-owned READ FBO when Three's public RT FBO handle is null (ANGLE). */
  let ownedReadFbo: unknown = null
  let ownedReadTex: unknown = null
  /**
   * Last non-null DRAW/`FRAMEBUFFER` handle seen on `gl.bindFramebuffer`.
   * Three r178 may skip the bind inside `begin`'s `setRenderTarget` when its
   * cache already matches — the wrap-once still has the pump's bind.
   */
  let lastNonNullDrawFramebuffer: unknown = null
  /** This `begin` tick's spy result (window around `setRenderTarget`). */
  let tickSpiedDrawFramebuffer: unknown = null
  let drawSpyOrig: BindFramebufferFn | null = null
  let drawSpyWrapped: BindFramebufferFn | null = null
  let drawSpyInstalled = false

  function installDrawBindSpy(): void {
    if (!gl || typeof gl.bindFramebuffer !== 'function' || drawSpyInstalled) {
      return
    }
    drawSpyOrig = gl.bindFramebuffer
    drawSpyWrapped = function (
      this: unknown,
      target: number,
      framebuffer: unknown,
    ) {
      drawSpyOrig?.call(this ?? gl, target, framebuffer)
      if (framebuffer != null && isDrawFramebufferBindTarget(gl, target)) {
        lastNonNullDrawFramebuffer = unwrapWebglFramebuffer(framebuffer)
      }
    }
    gl.bindFramebuffer = drawSpyWrapped
    drawSpyInstalled = true
  }

  function uninstallDrawBindSpy(): void {
    if (!gl || !drawSpyInstalled) return
    if (drawSpyOrig && gl.bindFramebuffer === drawSpyWrapped) {
      gl.bindFramebuffer = drawSpyOrig
    }
    drawSpyInstalled = false
    drawSpyOrig = null
    drawSpyWrapped = null
    lastNonNullDrawFramebuffer = null
  }

  /**
   * Intercept `bindFramebuffer` only while `run` executes, then restore the
   * previous function. Do not touch DRAW bindings — restoring DRAW to a
   * `getParameter` null would unbind Three’s hidden FBO onto the canvas.
   */
  function spyDrawBindsDuring(run: () => void): unknown {
    if (!gl || typeof gl.bindFramebuffer !== 'function') {
      run()
      return lastNonNullDrawFramebuffer
    }
    const prevFn = gl.bindFramebuffer
    let windowLast: unknown = null
    gl.bindFramebuffer = function (
      this: unknown,
      target: number,
      framebuffer: unknown,
    ) {
      prevFn.call(this ?? gl, target, framebuffer)
      if (framebuffer != null && isDrawFramebufferBindTarget(gl, target)) {
        windowLast = unwrapWebglFramebuffer(framebuffer)
        lastNonNullDrawFramebuffer = windowLast
      }
    }
    try {
      run()
      return windowLast ?? lastNonNullDrawFramebuffer
    } finally {
      gl.bindFramebuffer = prevFn
    }
  }

  installDrawBindSpy()

  function ensureCpu(slot: { cpu: Uint8Array | null }, bytes: number): Uint8Array {
    if (!slot.cpu || slot.cpu.byteLength !== bytes) {
      slot.cpu = pixelRing.acquire(bytes)
    }
    return slot.cpu
  }

  function stealCpu(slot: { cpu: Uint8Array | null }): Uint8Array | null {
    const cpu = slot.cpu
    slot.cpu = null
    return cpu
  }

  function noteFallback(message: string = NDI_SYNC_READBACK_NOTE): void {
    if (notedFallback) return
    notedFallback = true
    markNdiSyncReadback()
    onFallbackNote(message)
  }

  /**
   * One-frame miss: no spy DRAW FBO **and** no RT color texture to attach.
   * Keep PBO mode and **skip** (do not sync-read). Not skip-forever —
   * the next tick retries. Do not light the SYNC READBACK banner.
   */
  function notePublicFboMissing(): void {
    if (notedPublicFbo) return
    notedPublicFbo = true
    onFallbackNote(NDI_PUBLIC_FBO_MISSING_NOTE)
  }

  function disposeOwnedReadFbo(): void {
    if (gl && ownedReadFbo && typeof gl.deleteFramebuffer === 'function') {
      try {
        gl.deleteFramebuffer(ownedReadFbo)
      } catch {
        /* ignore */
      }
    }
    ownedReadFbo = null
    ownedReadTex = null
  }

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
      if (slot.cpu) pixelRing.release(slot.cpu)
      slot.cpu = null
    }
    slots.length = 0
  }

  function webgl2HasSeparateReadFb(): boolean {
    return !!(
      gl &&
      typeof gl.READ_FRAMEBUFFER === 'number' &&
      typeof gl.bindFramebuffer === 'function'
    )
  }

  function readFramebufferBinding(): unknown {
    if (!gl) return null
    const pname =
      typeof gl.READ_FRAMEBUFFER_BINDING === 'number'
        ? gl.READ_FRAMEBUFFER_BINDING
        : GL_READ_FRAMEBUFFER_BINDING
    return gl.getParameter(pname)
  }

  function currentBoundDrawFramebuffer(): unknown {
    if (!gl) return null
    const tried = new Set<number>()
    const pnames: number[] = [
      typeof gl.FRAMEBUFFER_BINDING === 'number'
        ? gl.FRAMEBUFFER_BINDING
        : GL_FRAMEBUFFER_BINDING,
    ]
    if (typeof gl.DRAW_FRAMEBUFFER_BINDING === 'number') {
      pnames.push(gl.DRAW_FRAMEBUFFER_BINDING)
    } else {
      pnames.push(GL_FRAMEBUFFER_BINDING)
    }
    for (const pname of pnames) {
      if (tried.has(pname)) continue
      tried.add(pname)
      const fb = unwrapWebglFramebuffer(gl.getParameter(pname))
      if (fb != null) return fb
    }
    return null
  }

  /**
   * Three r178 assigns `_this.properties` in `initGLContext`. Call `get` with
   * the properties object as `this` in case a later Three uses a class method.
   * Not required on the TypeScript type — duck-type at runtime.
   */
  function rendererPropertiesGet(): ((object: unknown) => unknown) | null {
    try {
      const props = (
        renderer as { properties?: { get?: (object: unknown) => unknown } }
      ).properties
      const get = props?.get
      if (typeof get !== 'function') return null
      return (object: unknown) => get.call(props, object)
    } catch {
      return null
    }
  }

  function framebufferFromPropertiesEntry(entry: unknown): unknown {
    if (!entry || typeof entry !== 'object') return null
    const rec = entry as {
      __webglFramebuffer?: unknown
      __webglMultisampledFramebuffer?: unknown
    }
    const resolved = unwrapWebglFramebuffer(rec.__webglFramebuffer)
    if (resolved != null) return resolved
    return unwrapWebglFramebuffer(rec.__webglMultisampledFramebuffer)
  }

  /**
   * Prefer `properties.get(rt).__webglFramebuffer` (allocated by
   * `setRenderTarget`). Fall back to a hang on the RT (test seam).
   */
  function resolveTargetFramebuffer(target: WebGLRenderTarget): unknown {
    const get = rendererPropertiesGet()
    if (get) {
      try {
        const fromProps = framebufferFromPropertiesEntry(get(target))
        if (fromProps != null) return fromProps
      } catch {
        /* properties.get must not throw; ignore a broken stub */
      }
    }
    return unwrapWebglFramebuffer(
      (target as { __webglFramebuffer?: unknown }).__webglFramebuffer,
    )
  }

  function textureFromPropertiesEntry(entry: unknown): unknown {
    if (!entry || typeof entry !== 'object') return null
    return unwrapWebglFramebuffer(
      (entry as { __webglTexture?: unknown }).__webglTexture,
    )
  }

  /**
   * Color texture for an owned READ FBO. Prefer
   * `properties.get(rt.texture).__webglTexture` after `setRenderTarget`;
   * hang `__webglTexture` on the Texture is the Electron/test seam.
   */
  function resolveTargetTexture(target: WebGLRenderTarget): unknown {
    const tex = (target as { texture?: unknown }).texture
    if (tex == null) return null
    const get = rendererPropertiesGet()
    if (get) {
      try {
        const fromProps = textureFromPropertiesEntry(get(tex))
        if (fromProps != null) return fromProps
      } catch {
        /* ignore a broken stub */
      }
    }
    if (typeof tex === 'object') {
      return unwrapWebglFramebuffer(
        (tex as { __webglTexture?: unknown }).__webglTexture,
      )
    }
    return null
  }

  /**
   * FBO to bind on READ for PBO: test-seam / properties if present, else the
   * DRAW handle the spy captured during `setRenderTarget` (or earlier on this
   * `gl`), else a GL DRAW query. Null = try texture attach; still-null
   * default canvas is never packed as UYVY.
   */
  function resolveReadFramebuffer(target: WebGLRenderTarget): unknown {
    const fromTarget = resolveTargetFramebuffer(target)
    if (fromTarget != null) return fromTarget
    if (tickSpiedDrawFramebuffer != null) return tickSpiedDrawFramebuffer
    if (lastNonNullDrawFramebuffer != null) return lastNonNullDrawFramebuffer
    return currentBoundDrawFramebuffer()
  }

  /**
   * Attach `tex` to an OUT-owned FBO and bind it as READ. Does not touch DRAW
   * (restoring DRAW to null would unbind Three’s hidden FBO onto the canvas).
   */
  function ensureOwnedReadFramebuffer(tex: unknown): unknown | null {
    if (
      !gl ||
      typeof gl.createFramebuffer !== 'function' ||
      typeof gl.framebufferTexture2D !== 'function' ||
      typeof gl.bindFramebuffer !== 'function'
    ) {
      return null
    }
    if (!ownedReadFbo) {
      ownedReadFbo = gl.createFramebuffer()
      if (!ownedReadFbo) return null
      ownedReadTex = null
    }
    const readEnum = gl.READ_FRAMEBUFFER ?? GL_READ_FRAMEBUFFER
    const colorAttach = gl.COLOR_ATTACHMENT0 ?? GL_COLOR_ATTACHMENT0
    const tex2d = gl.TEXTURE_2D ?? GL_TEXTURE_2D
    gl.bindFramebuffer(readEnum, ownedReadFbo)
    if (ownedReadTex !== tex) {
      gl.framebufferTexture2D(readEnum, colorAttach, tex2d, tex, 0)
      ownedReadTex = tex
    }
    return ownedReadFbo
  }

  /**
   * Bind READ to a non-null FBO for PBO `readPixels` — public RT FBO, spy
   * DRAW copy, or owned FBO with the RT color texture attached.
   * False → do not pack (default FB); caller **skips this tick only**.
   * A resolved handle from `properties.get` is enough — do not fail closed on
   * `checkFramebufferStatus` (ANGLE READ of a DRAW FBO was OUT-05’s 8 fps lock).
   * Never bind DRAW to null to “restore” a `getParameter` miss.
   */
  function bindReadFramebufferToTarget(target: WebGLRenderTarget): boolean {
    if (!gl || !webgl2HasSeparateReadFb() || !gl.bindFramebuffer) return true
    const readEnum = gl.READ_FRAMEBUFFER ?? GL_READ_FRAMEBUFFER
    const fb = resolveReadFramebuffer(target)
    if (fb != null) {
      gl.bindFramebuffer(readEnum, fb)
      return true
    }
    const tex = resolveTargetTexture(target)
    if (tex == null) return false
    return ensureOwnedReadFramebuffer(tex) != null
  }

  function withPackedReadFramebuffer(
    target: WebGLRenderTarget,
    run: () => boolean,
  ): PackedReadOutcome {
    if (!gl) return run() ? 'ok' : 'fail'
    const bind = gl.bindFramebuffer
    const separate = webgl2HasSeparateReadFb() && typeof bind === 'function'
    const readEnum = gl.READ_FRAMEBUFFER ?? GL_READ_FRAMEBUFFER
    const prevRead = separate ? readFramebufferBinding() : undefined
    if (separate && !bindReadFramebufferToTarget(target)) {
      bind?.(readEnum, prevRead ?? null)
      return 'no-fbo'
    }
    try {
      return run() ? 'ok' : 'fail'
    } finally {
      if (separate) bind?.(readEnum, prevRead ?? null)
    }
  }

  function beginSync(target: WebGLRenderTarget, w: number, h: number): boolean {
    const bytes = byteLengthFor(w, h)
    if (bytes < 4) return false
    if (syncReady) {
      pixelRing.release(syncReady.data)
      syncReady = null
    }
    const buf = pixelRing.acquire(bytes)
    try {
      renderer.setRenderTarget?.(target)
      renderer.readRenderTargetPixels(target, 0, 0, w, h, buf)
    } catch {
      pixelRing.release(buf)
      return false
    }
    syncReady = { width: w, height: h, data: buf }
    return true
  }

  function packPbo(
    slot: PboSlot,
    target: WebGLRenderTarget,
    w: number,
    h: number,
    now: number,
  ): PackedReadOutcome {
    if (!gl) return 'fail'
    const g = gl
    return withPackedReadFramebuffer(target, () => {
      const bytes = byteLengthFor(w, h)
      const prevPack =
        typeof g.PIXEL_PACK_BUFFER_BINDING === 'number'
          ? g.getParameter(g.PIXEL_PACK_BUFFER_BINDING)
          : null
      const prevAlign =
        typeof g.PACK_ALIGNMENT === 'number'
          ? g.getParameter(g.PACK_ALIGNMENT)
          : 4

      if (
        !webgl2HasSeparateReadFb() &&
        typeof g.FRAMEBUFFER === 'number' &&
        g.checkFramebufferStatus
      ) {
        const fb = g.checkFramebufferStatus(g.FRAMEBUFFER)
        if (
          typeof g.FRAMEBUFFER_COMPLETE === 'number' &&
          fb !== g.FRAMEBUFFER_COMPLETE
        ) {
          return false
        }
      }

      try {
        g.bindBuffer(g.PIXEL_PACK_BUFFER, slot.buffer)
        if (slot.byteLength !== bytes) {
          g.bufferData(g.PIXEL_PACK_BUFFER, bytes, g.STREAM_READ)
          slot.byteLength = bytes
          if (slot.cpu) pixelRing.release(slot.cpu)
          slot.cpu = null
        }
        if (typeof g.PACK_ALIGNMENT === 'number') {
          g.pixelStorei(g.PACK_ALIGNMENT, 1)
        }
        g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, 0)
        const fence = g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0)
        g.flush()
        if (!fence) return false
        slot.fence = fence
        slot.width = w
        slot.height = h
        slot.capturedAtMs = now
        slot.inFlight = true
        return true
      } finally {
        g.bindBuffer(g.PIXEL_PACK_BUFFER, prevPack ?? null)
        if (typeof g.PACK_ALIGNMENT === 'number' && typeof prevAlign === 'number') {
          g.pixelStorei(g.PACK_ALIGNMENT, prevAlign)
        }
      }
    })
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
    const stolen = stealCpu(slot) ?? cpu
    return { width: slot.width, height: slot.height, data: stolen }
  }

  const handle: NdiAsyncReadback = {
    get mode() {
      return mode
    },
    isPending(): boolean {
      if (syncReady) return true
      if (mode === 'sync' || !gl) return false
      return slots.some((s) => s.inFlight)
    },
    canBegin(): boolean {
      if (disposed) return false
      if (mode === 'sync' || !gl) return true
      if (slots.length === 0) return true
      return slots.some((s) => !s.inFlight)
    },
    begin(target, width, height, capturedAt?: number): boolean {
      if (disposed) return false
      const w = Math.floor(width)
      const h = Math.floor(height)
      if (w < 1 || h < 1) return false

      if (mode === 'sync' || !gl) {
        // Emergency/debug only (`forceSync` / missing WebGL2). Not the live path.
        noteFallback()
        return beginSync(target, w, h)
      }

      if (!initSlots()) {
        return false
      }

      const free = slots.find((s) => !s.inFlight)
      if (!free) return false

      try {
        tickSpiedDrawFramebuffer = spyDrawBindsDuring(() => {
          renderer.setRenderTarget?.(target)
        })
        const packed = packPbo(free, target, w, h, nowMs(capturedAt))
        if (packed === 'ok') return true
        abandon(free)
        if (packed === 'no-fbo') {
          notePublicFboMissing()
        }
        return false
      } catch {
        abandon(free)
        return false
      } finally {
        tickSpiedDrawFramebuffer = null
      }
    },
    poll(explicitNow?: number): NdiReadbackPixels | null {
      if (disposed) return null
      if (syncReady) {
        const ready = syncReady
        syncReady = null
        return ready
      }
      if (mode === 'sync' || !gl) {
        return null
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
          continue
        }

        const satisfied =
          status === (gl.CONDITION_SATISFIED ?? CONDITION_SATISFIED) ||
          status === (gl.ALREADY_SIGNALED ?? ALREADY_SIGNALED)
        if (satisfied) {
          try {
            return completeSlot(slot)
          } catch {
            abandon(slot)
            return null
          }
        }

        const failed = status === (gl.WAIT_FAILED ?? WAIT_FAILED)
        const expired =
          status === (gl.TIMEOUT_EXPIRED ?? TIMEOUT_EXPIRED) &&
          now - slot.capturedAtMs > NDI_ASYNC_READBACK_FENCE_MAX_MS
        if (failed || expired) {
          abandon(slot)
          continue
        }
        // Oldest fence still pending — keep order; do not complete a newer slot.
        return null
      }
      return null
    },
    release(data: Uint8Array | ArrayBuffer): void {
      if (disposed) return
      pixelRing.release(data)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      if (syncReady) pixelRing.release(syncReady.data)
      syncReady = null
      disposeSlots()
      disposeOwnedReadFbo()
      uninstallDrawBindSpy()
      pixelRing.clear()
    },
  }

  return handle
}
