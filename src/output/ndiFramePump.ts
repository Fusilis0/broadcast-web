import { createSendFpsCounter } from './perfCounters.ts'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { createNdiCaptureGate } from './ndiCaptureClock.ts'
import { createNdiDeferredSend, takeNdiArrayBuffer } from './ndiDeferredSend.ts'
import { createNdiAsyncReadback } from './ndiAsyncReadback.ts'
import { createNdiAirTargetPingPong } from './ndiAirTargetPingPong.ts'
import { peekLastPresentedPts90k } from './ndiPresentPts.ts'
import { applyNdiCaptureColorSpace } from './ndiCaptureColorSpace.ts'
import { NDI_CAPTURE_FLIPPED_BOTTOM_UP } from './ndiCaptureFlip.ts'
import { flipOwnedRgbaFrame } from './ndiFlipRows.ts'
import { createNdiPackPool } from './ndiUyvy.ts'
import { createNdiUyvyWorker } from './ndiUyvyBridge.ts'
import {
  releaseNdiHeavyCapture,
  tryClaimNdiHeavyCapture,
} from './ndiCaptureStagger.ts'
import { NdiDelayBuffer } from './ndiDelayBuffer.ts'
import {
  noteNdiSkip,
  recordNdiCapture,
  recordNdiStage,
  timeNdiStage,
} from './ndiStageTiming.ts'
import {
  restoreClearPass,
  snapshotClearPass,
  type ClearPassSnapshot,
} from './ndiOpaquePass.ts'
import {
  DEFAULT_NDI_CHANNEL,
  getStudioBridge,
  sendStudioNdiFrame,
  type NdiChannelId,
} from './studioBridge.ts'

/**
 * Temporary AR-plate clear for the air FBO (local 3D opaque screen, etc.).
 * Restored after capture so the ops preview keep its own clear.
 */
export type ArAirPlateClear = {
  color: number
  alpha: number
  opaqueClearSafe: boolean
}

export type NdiFramePumpOptions = {
  renderer: WebGLRenderer
  /**
   * Scene graph for the studio-tick air FBO. AR no longer captures from the
   * screen present (preview is rAF when visible — DSP-OUT-20260818-01).
   */
  scene: Object3D
  /**
   * Active POV camera for air / NDI. Free cam must not drive this capture.
   */
  getAirCamera?: () => Camera | null | undefined
  /**
   * SCN hook: orient ops billboards (tag distance-scale) for the air camera
   * before the FBO pass.
   */
  prepareCameraPass?: (camera: Camera) => void
  /**
   * Clear + opaque-safe gate for the AR air FBO (transparent plate vs
   * local 3D opaque screen).
   */
  getAirPlateClear?: () => ArAirPlateClear | null | undefined
  /** SCN: gate realistic sea/sky during AR air capture. */
  setEnvironmentOpaqueClearSafe?: (safe: boolean) => void
  getEnvironmentOpaqueClearSafe?: () => boolean
  /**
   * Target send rate. Default **30** (air path). Dropped when the phase gate
   * is not due, or when the sync-readback stagger refuses this tick.
   */
  fps?: number
  /** NDI source name (hostname is prepended by the SDK). Default `broadcast-web`. */
  sourceName?: string
  /**
   * Multi-sender channel. Air plate = `'ar'` (default). 3d/2d pumps land in
   * later dispatches — this pump only drives AR today.
   */
  channel?: NdiChannelId
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

export type NdiFramePumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  getDelayMs: () => number
  setDelayMs: (ms: number) => number
  /** Successful sends in the last 1 s (not staggered-away claims). */
  getSendFps: () => number
  isEnabled: () => boolean
  /** Pause/resume capture+send; does not dispose the pump. */
  setEnabled: (on: boolean) => void
  stop: () => void
}

/** Default AR NDI send rate — full studio air path. */
export const NDI_AR_DEFAULT_FPS = 30
const DEFAULT_NAME = 'broadcast-web'

/**
 * Electron-only: on each `studio:tick` (60 Hz), render the active POV into an
 * FBO, GPU Y-flip (WebGL2 blit, inverted dest Y), pack RGBA via WebGL2 PBO
 * (skip this capture if PBO cannot pack — never `readRenderTargetPixels` on
 * the live path), and push to the main-process NDI
 * sender. Packed bytes are top-down (`NDI_CAPTURE_FLIPPED_BOTTOM_UP`). One
 * frame of capture latency on the PBO path is expected.
 *
 * Does **not** monkey-patch `renderer.render` and does **not** subscribe to
 * rAF — ops preview stays rAF. On the PBO path AR and 3D may both capture in
 * the same tick. `tryClaimNdiHeavyCapture` is **sync-fallback only**. IPC
 * `sendFrame` is deferred off this tick (`createNdiDeferredSend`, depth 2).
 * Air FBO ping-pongs so PBO packs the previous plate (`flushAfterPack: false`).
 *
 * **Air lock:** capture is always the active POV (`getAirCamera`). Optional
 * `prepareCameraPass` re-orients SCN billboard scales for that camera.
 *
 * **Sidebar invariant (Phase 11):** NDI never reads ops sidebar / HUD DOM —
 * only WebGL FBO readback (`createNdiAsyncReadback`). Collapsing or growing
 * the ops sidebar must not change air pixels. Regression: `sidebar/sidebar.test.ts`.
 *
 * No-ops when `window.broadcastStudio` is missing (Chrome path).
 * Start **after** `startVisualTimecode` so the barcode is in the FBO pass
 * (this pump binds `renderer.render` at start — typically the timecode wrap).
 * Start **before** `startNdi3dChannelPump` (subscriber order unchanged).
 */
export function startNdiFramePump(
  options: NdiFramePumpOptions,
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
    getAirPlateClear,
    setEnvironmentOpaqueClearSafe,
    getEnvironmentOpaqueClearSafe,
  } = options
  const fps =
    typeof options.fps === 'number' && options.fps > 0
      ? options.fps
      : NDI_AR_DEFAULT_FPS
  const captureGate = createNdiCaptureGate(fps)
  const sourceNameOpt = options.sourceName?.trim() || DEFAULT_NAME
  const channel: NdiChannelId = options.channel ?? DEFAULT_NDI_CHANNEL
  const delayBuffer = new NdiDelayBuffer()
  if (options.delayMs !== undefined) delayBuffer.setDelayMs(options.delayMs)
  const sendFps = createSendFpsCounter()

  // Timecode wrap (caller starts this pump after startVisualTimecode).
  const tickRender = renderer.render.bind(renderer)

  let stopped = false
  let enabled = options.enabled !== false
  let starting = false
  let unsubTick: (() => void) | null = null
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  const airTargets = createNdiAirTargetPingPong({
    create(w, h) {
      const target = new WebGLRenderTarget(w, h, {
        depthBuffer: true,
        stencilBuffer: false,
      })
      applyNdiCaptureColorSpace(target)
      return target
    },
    dispose: (target) => {
      target.dispose()
    },
  })
  const readback = createNdiAsyncReadback({ renderer, flushAfterPack: false })
  let lastCapturedContentPts: number | null = null

  const _clearColor = new Color()

  const clearReader = {
    getClearColorHex: () => {
      renderer.getClearColor(_clearColor)
      return _clearColor.getHex()
    },
    getClearAlpha: () => renderer.getClearAlpha(),
    getOpaqueClearSafe: () => getEnvironmentOpaqueClearSafe?.() ?? false,
  }

  const clearWriter = {
    setClearColor: (color: number, alpha: number) => {
      renderer.setClearColor(color, alpha)
    },
    setOpaqueClearSafe: (safe: boolean) => {
      setEnvironmentOpaqueClearSafe?.(safe)
    },
  }

  function preparePass(camera: Camera): void {
    try {
      prepareCameraPass?.(camera)
    } catch (err) {
      console.warn('[output] prepareCameraPass failed', err)
    }
  }

  /** Apply AR plate clear for air FBO; returns snapshot to restore (or null). */
  function beginAirPlateClear(): ClearPassSnapshot | null {
    const plate = getAirPlateClear?.()
    if (!plate) return null
    if (!setEnvironmentOpaqueClearSafe || !getEnvironmentOpaqueClearSafe) {
      const snapshot = snapshotClearPass(clearReader)
      renderer.setClearColor(plate.color, plate.alpha)
      return snapshot
    }
    const snapshot = snapshotClearPass(clearReader)
    clearWriter.setClearColor(plate.color, plate.alpha)
    clearWriter.setOpaqueClearSafe(plate.opaqueClearSafe)
    return snapshot
  }

  function endAirPlateClear(snapshot: ClearPassSnapshot | null): void {
    if (!snapshot) return
    if (!setEnvironmentOpaqueClearSafe || !getEnvironmentOpaqueClearSafe) {
      renderer.setClearColor(snapshot.color, snapshot.alpha)
      return
    }
    restoreClearPass(clearWriter, snapshot)
  }

  function sendFrameData(
    width: number,
    height: number,
    data: ArrayBuffer,
    bottomUp: boolean,
  ): void {
    try {
      timeNdiStage('arEnqueueIpc', () => {
        sendStudioNdiFrame(ndi, {
          channel,
          width,
          height,
          data,
          bottomUp,
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
    maxPending: 2,
    send: (frame) => {
      sendFrameData(frame.width, frame.height, frame.data, frame.bottomUp)
    },
    release: (data) => {
      packPool.release(data)
    },
  })

  function queueOwnedFrame(
    width: number,
    height: number,
    data: ArrayBuffer,
    bottomUp: boolean,
    capturedAtMs: number,
    nowMs: number,
  ): void {
    const ready = delayBuffer.push(
      {
        capturedAtMs,
        width,
        height,
        data,
        bottomUp,
      },
      nowMs,
    )
    for (const frame of ready) {
      ipc.enqueue({
        width: frame.width,
        height: frame.height,
        data: frame.data,
        bottomUp: frame.bottomUp,
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
        bottomUp: frame.bottomUp,
      })
    }
  }

  function enqueueRgba(
    w: number,
    h: number,
    buf: Uint8Array,
    bottomUp: boolean,
    nowMs: number,
  ): void {
    if (stopped || !enabled) {
      readback.release(takeNdiArrayBuffer(buf))
      return
    }
    const rgba = flipOwnedRgbaFrame(takeNdiArrayBuffer(buf), w, h)
    if (uyvyWorker) {
      void uyvyWorker
        .pack(rgba, w, h, 'uyvy')
        .then((owned) => {
          if (stopped || !enabled) {
            packPool.release(owned)
            return
          }
          queueOwnedFrame(w, h, owned, bottomUp, nowMs, performance.now())
        })
        .catch(() => {})
      return
    }
    const owned = packPool.pack(rgba, w, h)
    readback.release(rgba)
    if (!owned) return
    queueOwnedFrame(w, h, owned, bottomUp, nowMs, nowMs)
  }

  function drainReadback(nowMs: number): void {
    if (stopped || !enabled) return
    const t0 = performance.now()
    const pixels = readback.poll(nowMs)
    recordNdiStage('arReadbackDrain', performance.now() - t0)
    if (!pixels) return
    enqueueRgba(
      pixels.width,
      pixels.height,
      pixels.data,
      NDI_CAPTURE_FLIPPED_BOTTOM_UP,
      nowMs,
    )
  }

  function captureAirTarget(
    target: WebGLRenderTarget,
    w: number,
    h: number,
    nowMs: number,
    syncClaim: boolean,
  ): boolean {
    if (stopped || !enabled) return false
    const t0 = performance.now()
    const ok = readback.begin(target, w, h, nowMs)
    recordNdiStage('arReadbackBegin', performance.now() - t0)
    if (!ok) {
      if (syncClaim) releaseNdiHeavyCapture('ar', nowMs)
      noteNdiSkip('ar', 'busy')
      return false
    }
    const pts = peekLastPresentedPts90k()
    if (pts != null) lastCapturedContentPts = pts
    recordNdiCapture('ar', nowMs)
    drainReadback(nowMs)
    return true
  }

  function captureFrame(): void {
    if (stopped || !enabled) return
    const now = performance.now()
    flushDelay(now)
    drainReadback(now)
    if (stopped || !enabled) return
    const pts = peekLastPresentedPts90k()
    if (
      pts != null &&
      lastCapturedContentPts != null &&
      pts === lastCapturedContentPts
    ) {
      noteNdiSkip('ar', 'busy')
      return
    }

    const airCamera = getAirCamera?.() ?? null
    if (!airCamera) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return

    const syncClaim = readback.mode === 'sync'
    if (syncClaim) {
      if (!tryClaimNdiHeavyCapture('ar', now, { blocking: true })) {
        noteNdiSkip('ar', 'stagger')
        return
      }
    }
    if (!readback.canBegin()) {
      // Experiment B: no 1080 FBO when every PBO slot is in flight.
      if (syncClaim) releaseNdiHeavyCapture('ar', now)
      noteNdiSkip('ar', 'busy')
      return
    }
    if (!captureGate.tryAdmit(now)) {
      if (pts != null) {
        captureGate.forceAdmit(now)
      } else {
        if (syncClaim) releaseNdiHeavyCapture('ar', now)
        noteNdiSkip('ar', 'rateCap')
        return
      }
    }

    const plateSnap = beginAirPlateClear()
    const prevTarget = renderer.getRenderTarget()
    const prevXrEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    try {
      preparePass(airCamera)
      const { render, pack } = airTargets.acquire(w, h)
      renderer.setRenderTarget(render)
      timeNdiStage('arFboRender', () => {
        tickRender(sceneRoot, airCamera)
      })
      airTargets.advance()
      if (pack) captureAirTarget(pack, w, h, now, syncClaim)
    } finally {
      renderer.setRenderTarget(prevTarget)
      renderer.xr.enabled = prevXrEnabled
      endAirPlateClear(plateSnap)
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
      .start({ channel, name: sourceNameOpt })
      .then((res) => {
        starting = false
        if (stopped || !enabled) {
          if (res.ok) void ndi.stop({ channel }).catch(() => {})
          return
        }
        if (res.ok) {
          sourceName = res.sourceName ?? sourceNameOpt
          sdkVersion = res.sdkVersion ?? null
          error = null
          console.info(
            `[output] NDI[${channel}] send active: ${sourceName}` +
              (sdkVersion ? ` (${sdkVersion})` : '') +
              ' (air=active POV, studio-tick)',
          )
        } else {
          error = res.error ?? 'NDI start failed'
          console.warn(`[output] NDI[${channel}] start failed: ${error}`)
        }
      })
      .catch((err: unknown) => {
        starting = false
        error = err instanceof Error ? err.message : String(err)
        console.warn(`[output] NDI[${channel}] start error: ${error}`)
      })
  }

  function stopSender(): void {
    starting = false
    clearStatus()
    void ndi.stop({ channel }).catch(() => {
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
      airTargets.dispose()
      stopSender()
    },
  }
}
