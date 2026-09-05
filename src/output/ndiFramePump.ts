import { createSendFpsCounter } from './perfCounters.ts'
import { diagRegisterNdiSendFps } from './diagNdiPeek.ts'
import {
  diagNoteArCaptureBegin,
  diagNoteArSend,
  diagTakeArCaptureStamp,
  isNdiFrameDumpEnabled,
  peekArCaptureRunLen,
  peekLastPresentPts,
} from './diagNdiContent.ts'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { createNdiCaptureGate } from './ndiCaptureClock.ts'
import { createNdiDeferredSend, takeNdiArrayBuffer } from './ndiDeferredSend.ts'
import { createNdiAsyncReadback } from './ndiAsyncReadback.ts'
import { applyNdiCaptureColorSpace } from './ndiCaptureColorSpace.ts'
import { createNdiAirTargetPingPong } from './ndiAirTargetPingPong.ts'
import type { NdiReadbackProbe } from './diagNdiReadbackProbe.ts'
import { NDI_CAPTURE_FLIPPED_BOTTOM_UP } from './ndiCaptureFlip.ts'
import { flipOwnedRgbaFrame } from './ndiFlipRows.ts'
import { createNdiPackPool } from './ndiUyvy.ts'
import { createNdiUyvyWorker } from './ndiUyvyBridge.ts'
import {
  releaseNdiHeavyCapture,
  tryClaimNdiHeavyCapture,
} from './ndiCaptureStagger.ts'
import { registerNdiFboCanBeginProbe } from './ndiFboReadbackPressure.ts'
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
   * DIAG:ndi-readback-probe — `idle` | `early` only. Default omitted = off.
   * Revert with the probe helper after this diagnosis round.
   */
  readbackProbe?: NdiReadbackProbe
}

export type NdiFramePumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  getDelayMs: () => number
  setDelayMs: (ms: number) => number
  /** Successful sends in the last 1 s (not staggered-away claims). */
  getSendFps: () => number
  /**
   * DIAG:ndi-readback-probe=early — pack previous AR FBO. Caller must
   * invoke this from a `studio:tick` listener registered **before**
   * `present()`.
   */
  diagEarlyPack: () => void
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
  const readbackProbe: NdiReadbackProbe = options.readbackProbe ?? 'off'
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
  /* DIAG:srt-fps — same counter the AR Send HUD reads. */
  const unregSendFps = diagRegisterNdiSendFps(channel, () =>
    sendFps.getFps(performance.now()),
  )

  // Timecode wrap (caller starts this pump after startVisualTimecode).
  const tickRender = renderer.render.bind(renderer)

  let stopped = false
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
  const unregFboPressure = registerNdiFboCanBeginProbe(() => readback.canBegin())
  /* DIAG:ndi-readback-probe — separate PBO so idle begin cannot steal AR slots. */
  const idleReadback =
    readbackProbe === 'idle'
      ? createNdiAsyncReadback({ renderer, flushAfterPack: false })
      : null
  let idleTarget: WebGLRenderTarget | null = null
  let packedEarlyThisTick = false
  let loggedProbe = false
  /** Last AR-captured present PTS — freshness gate skips same-PTS re-captures. */
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
    channel,
    // Measured: AR drop is awaitingMacrotask keep-newest (healthy ~6–8 evict/s).
    // Depth 2 holds the late slot-1 frame; recovered frames can be ~31 ms older.
    maxPending: 2,
    send: (frame) => {
      diagNoteArSend({
        pts90k: frame.contentPts90k ?? null,
        reason: frame.contentReason ?? null,
        povId: null,
      })
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
    contentPts90k: number | null,
    contentReason: string | null,
  ): void {
    const ready = delayBuffer.push(
      {
        capturedAtMs,
        width,
        height,
        data,
        bottomUp,
        contentPts90k,
        contentReason,
      },
      nowMs,
    )
    for (const frame of ready) {
      ipc.enqueue({
        width: frame.width,
        height: frame.height,
        data: frame.data,
        bottomUp: frame.bottomUp,
        contentPts90k: frame.contentPts90k,
        contentReason: frame.contentReason,
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
        contentPts90k: frame.contentPts90k,
        contentReason: frame.contentReason,
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
    const stamp = diagTakeArCaptureStamp()
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
          queueOwnedFrame(
            w,
            h,
            owned,
            bottomUp,
            nowMs,
            performance.now(),
            stamp.pts90k,
            stamp.reason,
          )
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
    queueOwnedFrame(
      w,
      h,
      owned,
      bottomUp,
      nowMs,
      nowMs,
      stamp.pts90k,
      stamp.reason,
    )
  }

  function shouldSkipStalePresent(): boolean {
    const pts = peekLastPresentPts()
    if (pts == null) return false
    if (lastCapturedContentPts == null) return false
    return pts === lastCapturedContentPts
  }

  function markCapturedPresent(): void {
    const pts = peekLastPresentPts()
    if (pts != null) lastCapturedContentPts = pts
  }

  function drainReadback(nowMs: number): void {
    if (stopped) return
    const t0 = performance.now()
    const pixels = readback.poll(nowMs)
    recordNdiStage('arReadbackDrain', performance.now() - t0)
    if (!pixels) return
    if (isNdiFrameDumpEnabled() && peekArCaptureRunLen() >= 2) {
      const { width: w, height: h, data } = pixels
      const at = (x: number, y: number): number[] => {
        const i = (y * w + x) * 4
        return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, data[i + 3] ?? 0]
      }
      console.info(
        `[diag:frame-id] ${JSON.stringify({
          stage: 'ar-frame-sample',
          runLen: peekArCaptureRunLen(),
          w,
          h,
          corners: {
            tl: at(0, 0),
            tr: at(w - 1, 0),
            bl: at(0, h - 1),
            br: at(w - 1, h - 1),
            c: at((w / 2) | 0, (h / 2) | 0),
          },
        })}`,
      )
    }
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
    diagNoteArCaptureBegin()
    markCapturedPresent()
    recordNdiCapture('ar', nowMs)
    drainReadback(nowMs)
    return true
  }

  function logProbeOnce(): void {
    if (loggedProbe || readbackProbe === 'off') return
    loggedProbe = true
    const gl = renderer.getContext() as WebGL2RenderingContext | null
    let attributes: unknown = null
    let unmaskedRenderer: string | null = null
    let unmaskedVendor: string | null = null
    try {
      attributes = gl?.getContextAttributes?.() ?? null
      const ext = gl?.getExtension?.('WEBGL_debug_renderer_info') as {
        UNMASKED_RENDERER_WEBGL: number
        UNMASKED_VENDOR_WEBGL: number
      } | null
      if (gl && ext) {
        const r = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        const v = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
        unmaskedRenderer = typeof r === 'string' ? r : null
        unmaskedVendor = typeof v === 'string' ? v : null
      }
    } catch {
      /* ignore */
    }
    console.info(
      `[diag:srt-fps] ${JSON.stringify({
        stage: 'ndi-readback-probe',
        probe: readbackProbe,
        attributes,
        unmaskedVendor,
        unmaskedRenderer,
        idlePx: readbackProbe === 'idle' ? 16 : null,
      })}`,
    )
  }

  function ensureIdleTarget(): WebGLRenderTarget {
    if (idleTarget) return idleTarget
    idleTarget = new WebGLRenderTarget(16, 16, {
      depthBuffer: false,
      stencilBuffer: false,
    })
    applyNdiCaptureColorSpace(idleTarget)
    const prev = renderer.getRenderTarget()
    renderer.setRenderTarget(idleTarget)
    renderer.clear()
    renderer.setRenderTarget(prev)
    return idleTarget
  }

  /** Idle pack after this tick's composite, before the real AR pack. Do not poll (that Finish()s). */
  function probeIdleBegin(): void {
    if (readbackProbe !== 'idle' || !idleReadback) return
    if (!idleReadback.canBegin()) {
      idleReadback.poll(performance.now())
      if (!idleReadback.canBegin()) return
    }
    const target = ensureIdleTarget()
    renderer.setRenderTarget(target)
    const t0 = performance.now()
    idleReadback.begin(target, 16, 16, t0)
    recordNdiStage('arIdleReadbackBegin', performance.now() - t0)
  }

  function probeIdleDrain(): void {
    if (!idleReadback) return
    const pixels = idleReadback.poll(performance.now())
    if (pixels) idleReadback.release(pixels.data)
  }

  function diagEarlyPack(): void {
    if (stopped || readbackProbe !== 'early') return
    packedEarlyThisTick = false
    logProbeOnce()
    const now = performance.now()
    flushDelay(now)
    drainReadback(now)
    if (stopped) return
    if (shouldSkipStalePresent()) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return
    if (!captureGate.isDue(now)) return
    if (!readback.canBegin()) return

    const { pack } = airTargets.acquire(w, h)
    if (!pack) return
    if (!captureGate.tryAdmit(now)) return

    const syncClaim = readback.mode === 'sync'
    packedEarlyThisTick = captureAirTarget(pack, w, h, now, syncClaim)
  }

  function captureFrame(): void {
    if (stopped) return
    logProbeOnce()
    const now = performance.now()
    const earlyPacked = packedEarlyThisTick
    packedEarlyThisTick = false

    if (!earlyPacked) {
      flushDelay(now)
      drainReadback(now)
      probeIdleDrain()
      if (stopped) return
      if (shouldSkipStalePresent()) {
        noteNdiSkip('ar', 'freshness')
        return
      }
      // Fresh present PTS: skip rateCap early-out — unique content beats
      // knife-edge phase (forceAdmit after canBegin if tryAdmit fails).
    } else {
      flushDelay(now)
      drainReadback(now)
      probeIdleDrain()
      if (stopped) return
    }

    const airCamera = getAirCamera?.() ?? null
    if (!airCamera) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return

    const syncClaim = readback.mode === 'sync'
    if (!earlyPacked) {
      if (syncClaim) {
        if (!tryClaimNdiHeavyCapture('ar', now, { blocking: true })) {
          noteNdiSkip('ar', 'stagger')
          return
        }
      }
      if (!readback.canBegin()) {
        if (syncClaim) releaseNdiHeavyCapture('ar', now)
        noteNdiSkip('ar', 'busy')
        return
      }
      if (!captureGate.tryAdmit(now)) {
        // New present PTS already passed freshness — do not drop it.
        captureGate.forceAdmit(now)
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
      if (earlyPacked) return
      if (readbackProbe === 'idle') probeIdleBegin()
      if (pack) captureAirTarget(pack, w, h, now, syncClaim)
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
    diagEarlyPack,
    stop(): void {
      if (stopped) return
      stopped = true
      unregSendFps()
      unregFboPressure()
      unsubTick()
      ipc.dispose()
      delayBuffer.clear()
      uyvyWorker?.dispose()
      readback.dispose()
      idleReadback?.dispose()
      idleTarget?.dispose()
      idleTarget = null
      airTargets.dispose()
      void ndi.stop({ channel }).catch(() => {
        /* ignore */
      })
    },
  }
}
