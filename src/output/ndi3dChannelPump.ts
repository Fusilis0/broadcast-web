import { createSendFpsCounter } from './perfCounters.ts'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { createNdiAsyncReadback } from './ndiAsyncReadback.ts'
import { createNdiCaptureGate } from './ndiCaptureClock.ts'
import { applyNdiCaptureColorSpace } from './ndiCaptureColorSpace.ts'
import { NDI_CAPTURE_FLIPPED_BOTTOM_UP } from './ndiCaptureFlip.ts'
import { flipOwnedRgbaFrame } from './ndiFlipRows.ts'
import { createNdiPackPool } from './ndiUyvy.ts'
import { createNdiUyvyWorker } from './ndiUyvyBridge.ts'
import { NdiDelayBuffer } from './ndiDelayBuffer.ts'
import { createNdiDeferredSend, takeNdiArrayBuffer } from './ndiDeferredSend.ts'
import {
  applyOpaque3dPassState,
  NDI_3D_OPAQUE_CLEAR_COLOR,
  restoreClearPass,
  snapshotClearPass,
} from './ndiOpaquePass.ts'
import {
  noteNdiSkip,
  recordNdiCapture,
  recordNdiStage,
  timeNdiStage,
} from './ndiStageTiming.ts'
import {
  releaseNdiHeavyCapture,
  tryClaimNdiHeavyCapture,
} from './ndiCaptureStagger.ts'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'
import { debugSessionLog, getStudioBridge, sendStudioNdiFrame } from './studioBridge.ts'

export type Ndi3dChannelPumpOptions = {
  renderer: WebGLRenderer
  /** Same Three.js scene graph as AR (not a second graph). */
  scene: Object3D
  /**
   * Active POV camera — same air lock as AR. Free cam must not drive 3D NDI.
   */
  getAirCamera: () => Camera | null | undefined
  /**
   * SCN hook: orient ops billboards for the camera about to render.
   */
  prepareCameraPass?: (camera: Camera) => void
  /** SCN: gate realistic sea/sky for this pass. */
  setEnvironmentOpaqueClearSafe: (safe: boolean) => void
  getEnvironmentOpaqueClearSafe: () => boolean
  /**
   * Target send rate. Default **30** (DSP-OUT-20260828-04). Independent of
   * AR on the PBO path (DSP-OUT-20260829-04).
   */
  fps?: number
  /** NDI source name. Default `broadcast-web-3d`. */
  sourceName?: string
  /**
   * Initial NDI delay (ms). Default 0 — immediate send, no ring buffer.
   * Live changes via `setDelayMs` (clamped 0..30000).
   */
  delayMs?: number
  /**
   * Start sending immediately. Default **true**.
   * NDI tab hand toggle may pause this channel without tearing down the pump.
   */
  enabled?: boolean
}

/** Default 3D NDI send rate — 30 fps, always on (DSP-OUT-20260828-04). */
export const NDI_3D_DEFAULT_FPS = 30
const DEFAULT_3D_NAME = 'broadcast-web-3d'
const CHANNEL = '3d' as const

const _clearColor = new Color()

/**
 * Electron-only continuous **3D** NDI pump (`channel: '3d'`).
 *
 * Each studio tick: opaque clear + `opaqueClearSafe(true)` → render active POV
 * into an FBO → full-size RGBA PBO read (skip this capture if PBO cannot
 * pack — never `readRenderTargetPixels` on the live path) → UYVY pack on
 * the existing worker (CPU pool if the worker is missing) → `sendFrame({ channel:
 * '3d' })` → restore the previous clear / opaque-safe gate so the AR
 * transparent plate stays clean. Packed bytes are top-down.
 * One frame of PBO latency is OK. Do not PBO a half-width GPU dest.
 *
 * Does **not** monkey-patch `renderer.render`. Captures via `onStudioTick`
 * using the render function bound at start time (typically the visual-timecode
 * wrap). Start **after** `startVisualTimecode` and **after** `startNdiFramePump`.
 * On the PBO path this pump may render in the same tick as AR. Sync
 * `readPixels` still uses `tryClaimNdiHeavyCapture`. Preview rAF does not
 * drive this pump.
 *
 * No-ops when `window.broadcastStudio` is missing (Chrome path).
 */
export type Ndi3dCpuPackSkipInput = {
  readW: number
  readH: number
  lastPackSrcW: number
  lastPackSrcH: number
  verifiedGpuPackRead: boolean
}

/**
 * Size alone (`readW * 2 === lastPackSrcW`) is **not** proof of GPU UYVY.
 * Half-width RGBA of the scene FBO looks the same size as packed dest.
 * Skip CPU pack only when PBO READ was bound to a verified packed dest.
 * Live 3D never sets `verifiedGpuPackRead` — it reads full-size scene RGBA.
 */
export function shouldSkipCpuUyvyPack(input: Ndi3dCpuPackSkipInput): boolean {
  if (!input.verifiedGpuPackRead) return false
  return (
    input.lastPackSrcW > 0 &&
    input.readW * 2 === input.lastPackSrcW &&
    input.readH === input.lastPackSrcH
  )
}

export function startNdi3dChannelPump(
  options: Ndi3dChannelPumpOptions,
): NdiFramePumpHandle | null {
  const studio = getStudioBridge()
  if (!studio) return null
  const bridge = studio
  const ndi = bridge.ndi

  const {
    renderer,
    scene: sceneRoot,
    getAirCamera,
    prepareCameraPass,
    setEnvironmentOpaqueClearSafe,
    getEnvironmentOpaqueClearSafe,
  } = options

  const fps =
    typeof options.fps === 'number' && options.fps > 0
      ? options.fps
      : NDI_3D_DEFAULT_FPS
  const captureGate = createNdiCaptureGate(fps)
  const sourceNameOpt = options.sourceName?.trim() || DEFAULT_3D_NAME
  const delayBuffer = new NdiDelayBuffer()
  if (options.delayMs !== undefined) delayBuffer.setDelayMs(options.delayMs)
  const sendFps = createSendFpsCounter()

  // Timecode wrap (caller starts this pump after startVisualTimecode).
  const directRender = renderer.render.bind(renderer)

  let stopped = false
  let enabled = options.enabled !== false
  let starting = false
  let unsubTick: (() => void) | null = null
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let target: WebGLRenderTarget | null = null
  let targetW = 0
  let targetH = 0
  const readback = createNdiAsyncReadback({ renderer })

  const clearReader = {
    getClearColorHex: () => {
      renderer.getClearColor(_clearColor)
      return _clearColor.getHex()
    },
    getClearAlpha: () => renderer.getClearAlpha(),
    getOpaqueClearSafe: () => getEnvironmentOpaqueClearSafe(),
  }

  const clearWriter = {
    setClearColor: (color: number, alpha: number) => {
      renderer.setClearColor(color, alpha)
    },
    setOpaqueClearSafe: (safe: boolean) => {
      setEnvironmentOpaqueClearSafe(safe)
    },
  }

  function preparePass(camera: Camera): void {
    try {
      prepareCameraPass?.(camera)
    } catch (err) {
      console.warn('[output] 3d prepareCameraPass failed', err)
    }
  }

  function ensureTarget(w: number, h: number): WebGLRenderTarget {
    if (!target || targetW !== w || targetH !== h) {
      target?.dispose()
      target = new WebGLRenderTarget(w, h, {
        depthBuffer: true,
        stencilBuffer: false,
      })
      applyNdiCaptureColorSpace(target)
      targetW = w
      targetH = h
    }
    return target
  }

  function sendFrameData(width: number, height: number, data: ArrayBuffer): void {
    try {
      timeNdiStage('3dEnqueueIpc', () => {
        sendStudioNdiFrame(ndi, {
          channel: CHANNEL,
          width,
          height,
          data,
          bottomUp: NDI_CAPTURE_FLIPPED_BOTTOM_UP,
          pixelFormat: 'uyvy',
        })
      })
      sendFps.record(performance.now())
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  const packPool = createNdiPackPool('uyvy')
  const uyvyWorker = createNdiUyvyWorker()
  const ipc = createNdiDeferredSend({
    send: (frame) => {
      sendFrameData(frame.width, frame.height, frame.data)
    },
    release: (data) => {
      packPool.release(data)
    },
  })

  function queueOwnedFrame(
    width: number,
    height: number,
    data: ArrayBuffer,
    nowMs: number,
  ): void {
    const ready = delayBuffer.push(
      {
        capturedAtMs: nowMs,
        width,
        height,
        data,
        bottomUp: NDI_CAPTURE_FLIPPED_BOTTOM_UP,
      },
      nowMs,
    )
    for (const frame of ready) {
      ipc.enqueue({
        width: frame.width,
        height: frame.height,
        data: frame.data,
        bottomUp: NDI_CAPTURE_FLIPPED_BOTTOM_UP,
      })
    }
  }

  function flushDelay(nowMs: number): void {
    if (stopped || delayBuffer.getDelayMs() <= 0) return
    for (const frame of delayBuffer.popReady(nowMs)) {
      ipc.enqueue({
        width: frame.width,
        height: frame.height,
        data: frame.data,
        bottomUp: NDI_CAPTURE_FLIPPED_BOTTOM_UP,
      })
    }
  }

  function enqueueRgba(w: number, h: number, buf: Uint8Array, nowMs: number): void {
    if (stopped || !enabled) {
      readback.release(takeNdiArrayBuffer(buf))
      return
    }
    // Never treat half-width RGBA as packed UYVY. Size (`w*2===srcW`) is not a
    // verified GPU dest — that skip advertised scene RGB as FourCC UYVY.
    if (
      shouldSkipCpuUyvyPack({
        readW: w,
        readH: h,
        lastPackSrcW: 0,
        lastPackSrcH: 0,
        verifiedGpuPackRead: false,
      })
    ) {
      return
    }
    const __flipT0 = performance.now()
    const rgba = flipOwnedRgbaFrame(takeNdiArrayBuffer(buf), w, h)
    const __flipMs = performance.now() - __flipT0
    if (uyvyWorker) {
      void uyvyWorker
        .pack(rgba, w, h, 'uyvy')
        .then((owned) => {
          if (stopped || !enabled) {
            packPool.release(owned)
            return
          }
          // #region agent log
          if (!(globalThis as { __ndi3dWorkerAt?: number }).__ndi3dWorkerAt ||
            performance.now() - ((globalThis as { __ndi3dWorkerAt?: number }).__ndi3dWorkerAt ?? 0) > 1000) {
            ;(globalThis as { __ndi3dWorkerAt?: number }).__ndi3dWorkerAt = performance.now()
            debugSessionLog({
              hypothesisId: 'H13',
              location: 'ndi3dChannelPump.ts:enqueueRgba',
              message: '3D worker UYVY pack',
              data: { w, h, flipMs: __flipMs, bytes: owned.byteLength },
            })
          }
          // #endregion
          queueOwnedFrame(w, h, owned, performance.now())
        })
        .catch(() => {})
      return
    }
    const owned = packPool.pack(rgba, w, h)
    readback.release(rgba)
    if (!owned) return
    // #region agent log
    if (!(globalThis as { __ndi3dFlipAt?: number }).__ndi3dFlipAt ||
      performance.now() - ((globalThis as { __ndi3dFlipAt?: number }).__ndi3dFlipAt ?? 0) > 1000) {
      ;(globalThis as { __ndi3dFlipAt?: number }).__ndi3dFlipAt = performance.now()
      debugSessionLog({
        hypothesisId: 'H9',
        location: 'ndi3dChannelPump.ts:enqueueRgba',
        message: '3D row-flip',
        data: { w, h, flipMs: __flipMs, bytes: owned.byteLength },
      })
    }
    // #endregion
    queueOwnedFrame(w, h, owned, nowMs)
  }

  function drainReadback(nowMs: number): void {
    if (stopped || !enabled) return
    const t0 = performance.now()
    const pixels = readback.poll(nowMs)
    recordNdiStage('3dReadbackDrain', performance.now() - t0)
    if (!pixels) return
    enqueueRgba(pixels.width, pixels.height, pixels.data, nowMs)
  }

  function captureFrame(): void {
    if (stopped || !enabled) return
    const now = performance.now()
    flushDelay(now)
    drainReadback(now)
    if (stopped || !enabled) return
    if (!captureGate.isDue(now)) {
      noteNdiSkip('3d', 'rateCap')
      return
    }

    const airCamera = getAirCamera() ?? null
    if (!airCamera) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return

    const syncClaim = readback.mode === 'sync'
    if (syncClaim) {
      if (!tryClaimNdiHeavyCapture('3d', now, { blocking: true })) {
        noteNdiSkip('3d', 'stagger')
        return
      }
    }
    if (!readback.canBegin()) {
      if (syncClaim) releaseNdiHeavyCapture('3d', now)
      return
    }
    if (!captureGate.tryAdmit(now)) {
      if (syncClaim) releaseNdiHeavyCapture('3d', now)
      noteNdiSkip('3d', 'rateCap')
      return
    }

    const snapshot = snapshotClearPass(clearReader)
    applyOpaque3dPassState(clearWriter, NDI_3D_OPAQUE_CLEAR_COLOR)

    const fbo = ensureTarget(w, h)
    const prevTarget = renderer.getRenderTarget()
    const prevXrEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    try {
      preparePass(airCamera)
      renderer.setRenderTarget(fbo)
      timeNdiStage('3dFboRender', () => {
        directRender(sceneRoot, airCamera)
      })
      // Full-size scene FBO (same RT just rendered). Do not GPU-pack then read
      // a half-width dest — READ often stays on the scene → stripes.
      const t0 = performance.now()
      const ok = readback.begin(fbo, w, h, now)
      recordNdiStage('3dReadbackBegin', performance.now() - t0)
      if (!ok) {
        if (syncClaim) releaseNdiHeavyCapture('3d', now)
        noteNdiSkip('3d', 'busy')
        return
      }
      recordNdiCapture('3d', now)
      drainReadback(now)
    } finally {
      renderer.setRenderTarget(prevTarget)
      renderer.xr.enabled = prevXrEnabled
      restoreClearPass(clearWriter, snapshot)
    }
  }

  function clearStatus(): void {
    sourceName = null
    sdkVersion = null
  }

  function startSender(): void {
    if (stopped || !enabled || starting) return
    if (sourceName) return
    starting = true
    void ndi
      .start({ channel: CHANNEL, name: sourceNameOpt })
      .then((res) => {
        starting = false
        if (stopped || !enabled) {
          if (res.ok) void ndi.stop({ channel: CHANNEL }).catch(() => {})
          return
        }
        if (res.ok) {
          sourceName = res.sourceName ?? sourceNameOpt
          sdkVersion = res.sdkVersion ?? null
          error = null
          console.info(
            `[output] NDI[${CHANNEL}] send active: ${sourceName}` +
              (sdkVersion ? ` (${sdkVersion})` : '') +
              ' (opaque + active POV)',
          )
        } else {
          error = res.error ?? 'NDI start failed'
          console.warn(`[output] NDI[${CHANNEL}] start failed: ${error}`)
        }
      })
      .catch((err: unknown) => {
        starting = false
        error = err instanceof Error ? err.message : String(err)
        console.warn(`[output] NDI[${CHANNEL}] start error: ${error}`)
      })
  }

  function stopSender(): void {
    starting = false
    clearStatus()
    void ndi.stop({ channel: CHANNEL }).catch(() => {
      /* ignore */
    })
  }

  function ensureTick(): void {
    if (stopped || !enabled || unsubTick) return
    unsubTick = bridge.onStudioTick(() => {
      if (stopped || !enabled) return
      captureFrame()
    })
  }

  function clearTick(): void {
    unsubTick?.()
    unsubTick = null
  }

  function setEnabled(on: boolean): void {
    if (stopped) return
    if (enabled === on) return
    enabled = on
    if (on) {
      startSender()
      ensureTick()
    } else {
      clearTick()
      delayBuffer.clear()
      stopSender()
    }
  }

  if (enabled) {
    startSender()
    ensureTick()
  }

  return {
    getSourceName: () => sourceName,
    getSdkVersion: () => sdkVersion,
    getError: () => error,
    getDelayMs: () => delayBuffer.getDelayMs(),
    setDelayMs: (ms: number) => delayBuffer.setDelayMs(ms),
    getSendFps: () => (enabled ? sendFps.getFps(performance.now()) : 0),
    isEnabled: () => enabled,
    setEnabled,
    stop(): void {
      if (stopped) return
      stopped = true
      enabled = false
      clearTick()
      ipc.dispose()
      delayBuffer.clear()
      uyvyWorker?.dispose()
      readback.dispose()
      target?.dispose()
      target = null
      stopSender()
    },
  }
}
