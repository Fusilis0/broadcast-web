import { createSendFpsCounter } from './perfCounters.ts'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { createNdiCaptureGate } from './ndiCaptureClock.ts'
import { createNdiDeferredSend, takeNdiArrayBuffer } from './ndiDeferredSend.ts'
import { createNdiAsyncReadback } from './ndiAsyncReadback.ts'
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
  debugSessionLog,
  getStudioBridge,
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
}

export type NdiFramePumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  getDelayMs: () => number
  setDelayMs: (ms: number) => number
  /** Successful sends in the last 1 s (not staggered-away claims). */
  getSendFps: () => number
  stop: () => void
}

/** Default AR NDI send rate — full studio air path. */
export const NDI_AR_DEFAULT_FPS = 30
const DEFAULT_NAME = 'broadcast-web'

/**
 * Electron-only: on each `studio:tick` (60 Hz), render the active POV into an
 * FBO, GPU Y-flip (WebGL2 blit, inverted dest Y), pack RGBA via WebGL2 PBO
 * (sync `readRenderTargetPixels` fallback), and push to the main-process NDI
 * sender. Packed bytes are top-down (`NDI_CAPTURE_FLIPPED_BOTTOM_UP`). One
 * frame of capture latency on the PBO path is expected.
 *
 * Does **not** monkey-patch `renderer.render` and does **not** subscribe to
 * rAF — ops preview stays rAF. On the PBO path AR and 3D may both capture in
 * the same tick. `tryClaimNdiHeavyCapture` is **sync-fallback only**. IPC
 * `sendFrame` is deferred off this tick (`createNdiDeferredSend`).
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
  const ndi = studio.ndi

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
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let airTarget: WebGLRenderTarget | null = null
  let airTargetW = 0
  let airTargetH = 0
  const readback = createNdiAsyncReadback({ renderer })

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

  function ensureAirTarget(w: number, h: number): WebGLRenderTarget {
    if (!airTarget || airTargetW !== w || airTargetH !== h) {
      airTarget?.dispose()
      airTarget = new WebGLRenderTarget(w, h, {
        depthBuffer: true,
        stencilBuffer: false,
      })
      applyNdiCaptureColorSpace(airTarget)
      airTargetW = w
      airTargetH = h
    }
    return airTarget
  }

  function sendFrameData(
    width: number,
    height: number,
    data: ArrayBuffer,
    bottomUp: boolean,
  ): void {
    try {
      timeNdiStage('arEnqueueIpc', () => {
        ndi.sendFrame({
          channel,
          width,
          height,
          data,
          bottomUp,
          pixelFormat: 'uyva',
        })
      })
      sendFps.record(performance.now())
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  const packPool = createNdiPackPool('uyva')
  const uyvyWorker = createNdiUyvyWorker()
  const ipc = createNdiDeferredSend({
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
    const __flipT0 = performance.now()
    const rgba = flipOwnedRgbaFrame(takeNdiArrayBuffer(buf), w, h)
    const __flipMs = performance.now() - __flipT0
    if (uyvyWorker) {
      void uyvyWorker
        .pack(rgba, w, h, 'uyva')
        .then((owned) => {
          if (stopped) {
            packPool.release(owned)
            return
          }
          // #region agent log
          if (!(globalThis as { __ndiArWorkerAt?: number }).__ndiArWorkerAt ||
            performance.now() - ((globalThis as { __ndiArWorkerAt?: number }).__ndiArWorkerAt ?? 0) > 1000) {
            ;(globalThis as { __ndiArWorkerAt?: number }).__ndiArWorkerAt = performance.now()
            debugSessionLog({
              hypothesisId: 'H13',
              location: 'ndiFramePump.ts:enqueueRgba',
              message: 'AR worker UYVA pack',
              data: { w, h, flipMs: __flipMs, bytes: owned.byteLength, bottomUp },
            })
          }
          // #endregion
          queueOwnedFrame(w, h, owned, bottomUp, nowMs, performance.now())
        })
        .catch(() => {})
      return
    }
    const owned = packPool.pack(rgba, w, h)
    readback.release(rgba)
    if (!owned) return
    // #region agent log
    if (!(globalThis as { __ndiRowFlipAt?: number }).__ndiRowFlipAt ||
      performance.now() - ((globalThis as { __ndiRowFlipAt?: number }).__ndiRowFlipAt ?? 0) > 1000) {
      ;(globalThis as { __ndiRowFlipAt?: number }).__ndiRowFlipAt = performance.now()
      fetch('http://127.0.0.1:7438/ingest/7196fb84-148e-4d0c-af68-4fcb53313232',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'173fbb'},body:JSON.stringify({sessionId:'173fbb',runId:'post-fix',hypothesisId:'H1',location:'ndiFramePump.ts:enqueueRgba',message:'AR row-flip after PBO (no GPU blit)',data:{w,h,bytes:owned.byteLength,bottomUp},timestamp:Date.now()})}).catch(()=>{});
      debugSessionLog({
        hypothesisId: 'H9',
        location: 'ndiFramePump.ts:enqueueRgba',
        message: 'AR row-flip',
        data: { w, h, flipMs: __flipMs, bytes: owned.byteLength, bottomUp },
      })
    }
    // #endregion
    queueOwnedFrame(w, h, owned, bottomUp, nowMs, nowMs)
  }

  function drainReadback(nowMs: number): void {
    if (stopped) return
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
    if (stopped) return false
    renderer.setRenderTarget(target)
    const t0 = performance.now()
    const ok = readback.begin(target, w, h, nowMs)
    recordNdiStage('arReadbackBegin', performance.now() - t0)
    if (!ok) {
      if (syncClaim) releaseNdiHeavyCapture('ar', nowMs)
      return false
    }
    recordNdiCapture('ar', nowMs)
    drainReadback(nowMs)
    return true
  }

  function captureFrame(): void {
    if (stopped) return
    const now = performance.now()
    flushDelay(now)
    drainReadback(now)
    if (stopped) return
    if (!captureGate.isDue(now)) {
      noteNdiSkip('ar', 'rateCap')
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
      if (syncClaim) releaseNdiHeavyCapture('ar', now)
      return
    }
    if (!captureGate.tryAdmit(now)) {
      if (syncClaim) releaseNdiHeavyCapture('ar', now)
      noteNdiSkip('ar', 'rateCap')
      return
    }

    const plateSnap = beginAirPlateClear()
    const prevTarget = renderer.getRenderTarget()
    const prevXrEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    try {
      preparePass(airCamera)
      const target = ensureAirTarget(w, h)
      renderer.setRenderTarget(target)
      timeNdiStage('arFboRender', () => {
        tickRender(sceneRoot, airCamera)
      })
      captureAirTarget(target, w, h, now, syncClaim)
    } finally {
      renderer.setRenderTarget(prevTarget)
      renderer.xr.enabled = prevXrEnabled
      endAirPlateClear(plateSnap)
    }
  }

  const unsubTick = studio.onStudioTick(() => {
    if (stopped) return
    captureFrame()
  })

  void ndi
    .start({ channel, name: sourceNameOpt })
    .then((res) => {
      if (stopped) return
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
      error = err instanceof Error ? err.message : String(err)
      console.warn(`[output] NDI[${channel}] start error: ${error}`)
    })

  return {
    getSourceName: () => sourceName,
    getSdkVersion: () => sdkVersion,
    getError: () => error,
    getDelayMs: () => delayBuffer.getDelayMs(),
    setDelayMs: (ms: number) => delayBuffer.setDelayMs(ms),
    getSendFps: () => sendFps.getFps(performance.now()),
    stop(): void {
      if (stopped) return
      stopped = true
      unsubTick()
      ipc.dispose()
      delayBuffer.clear()
      uyvyWorker?.dispose()
      readback.dispose()
      airTarget?.dispose()
      airTarget = null
      void ndi.stop({ channel }).catch(() => {
        /* ignore */
      })
    },
  }
}
