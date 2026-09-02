import { createSendFpsCounter } from './perfCounters.ts'
import { diagRegisterNdiSendFps } from './diagNdiPeek.ts'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { createNdiGpuUyvyPack } from './ndiGpuUyvy.ts'
import { createNdiAsyncReadback } from './ndiAsyncReadback.ts'
import { createNdiCaptureGate } from './ndiCaptureClock.ts'
import { applyNdiCaptureColorSpace } from './ndiCaptureColorSpace.ts'
import { NDI_CAPTURE_FLIPPED_BOTTOM_UP } from './ndiCaptureFlip.ts'
import { flipOwnedRgbaFrame } from './ndiFlipRows.ts'
import { createNdiPackPool } from './ndiUyvy.ts'
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
 * into an FBO → GPU UYVY pack (Y-flip in shader) → PBO of the half-width
 * target (sync `readRenderTargetPixels` fallback) → `sendFrame({ channel:
 * '3d' })` → restore the previous clear / opaque-safe gate so the AR
 * transparent plate stays clean. Packed bytes are top-down.
 * One frame of PBO latency is OK.
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
export function startNdi3dChannelPump(
  options: Ndi3dChannelPumpOptions,
): NdiFramePumpHandle | null {
  const studio = getStudioBridge()
  if (!studio) return null
  const ndi = studio.ndi

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
  /* DIAG:srt-fps */
  const unregSendFps = diagRegisterNdiSendFps(CHANNEL, () =>
    sendFps.getFps(performance.now()),
  )

  // Timecode wrap (caller starts this pump after startVisualTimecode).
  const directRender = renderer.render.bind(renderer)

  let stopped = false
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let target: WebGLRenderTarget | null = null
  let targetW = 0
  let targetH = 0
  const readback = createNdiAsyncReadback({ renderer })
  const gpuPack = createNdiGpuUyvyPack(renderer)
  let lastPackSrcW = 0
  let lastPackSrcH = 0

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
  const gpuPackedBuffers = new Set<ArrayBuffer>()
  const ipc = createNdiDeferredSend({
    send: (frame) => {
      sendFrameData(frame.width, frame.height, frame.data)
    },
    release: (data) => {
      if (gpuPackedBuffers.delete(data)) {
        readback.release(data)
        return
      }
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
    if (
      lastPackSrcW > 0 &&
      w * 2 === lastPackSrcW &&
      h === lastPackSrcH
    ) {
      const owned = takeNdiArrayBuffer(buf)
      gpuPackedBuffers.add(owned)
      // #region agent log
      if (!(globalThis as { __ndi3dGpuAt?: number }).__ndi3dGpuAt ||
        performance.now() - ((globalThis as { __ndi3dGpuAt?: number }).__ndi3dGpuAt ?? 0) > 1000) {
        ;(globalThis as { __ndi3dGpuAt?: number }).__ndi3dGpuAt = performance.now()
        debugSessionLog({
          hypothesisId: 'H12',
          location: 'ndi3dChannelPump.ts:enqueueRgba',
          message: '3D GPU UYVY skip CPU pack',
          data: { readW: w, readH: h, srcW: lastPackSrcW, srcH: lastPackSrcH, bytes: owned.byteLength },
        })
      }
      // #endregion
      queueOwnedFrame(lastPackSrcW, lastPackSrcH, owned, nowMs)
      return
    }
    const __flipT0 = performance.now()
    const rgba = flipOwnedRgbaFrame(takeNdiArrayBuffer(buf), w, h)
    const __flipMs = performance.now() - __flipT0
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
    if (stopped) return
    const t0 = performance.now()
    const pixels = readback.poll(nowMs)
    recordNdiStage('3dReadbackDrain', performance.now() - t0)
    if (!pixels) return
    enqueueRgba(pixels.width, pixels.height, pixels.data, nowMs)
  }

  function captureFrame(): void {
    if (stopped) return
    const now = performance.now()
    flushDelay(now)
    drainReadback(now)
    if (stopped) return
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
      const packed = gpuPack.pack(fbo, w, h)
      const readTarget = packed ?? fbo
      const readW = packed ? packed.width : w
      const readH = packed ? packed.height : h
      if (packed) {
        lastPackSrcW = w
        lastPackSrcH = h
      }

      const t0 = performance.now()
      const ok = readback.begin(readTarget, readW, readH, now)
      recordNdiStage('3dReadbackBegin', performance.now() - t0)
      if (!ok) {
        if (syncClaim) releaseNdiHeavyCapture('3d', now)
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

  const unsubTick = studio.onStudioTick(() => {
    if (stopped) return
    captureFrame()
  })

  void ndi
    .start({ channel: CHANNEL, name: sourceNameOpt })
    .then((res) => {
      if (stopped) return
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
      error = err instanceof Error ? err.message : String(err)
      console.warn(`[output] NDI[${CHANNEL}] start error: ${error}`)
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
      unregSendFps()
      unsubTick()
      ipc.dispose()
      delayBuffer.clear()
      readback.dispose()
      gpuPack.dispose()
      gpuPackedBuffers.clear()
      target?.dispose()
      target = null
      void ndi.stop({ channel: CHANNEL }).catch(() => {
        /* ignore */
      })
    },
  }
}
