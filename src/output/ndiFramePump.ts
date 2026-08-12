import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { planNdiCapture } from './airCameraLock.ts'
import { tryClaimNdiHeavyCapture } from './ndiCaptureStagger.ts'
import { NdiDelayBuffer } from './ndiDelayBuffer.ts'
import {
  restoreClearPass,
  snapshotClearPass,
  type ClearPassSnapshot,
} from './ndiOpaquePass.ts'
import {
  DEFAULT_NDI_CHANNEL,
  getStudioBridge,
  type NdiChannelId,
} from './studioBridge.ts'

/**
 * Temporary AR-plate clear for an air-target capture when the **screen**
 * clear differs (e.g. local 3D focus is opaque). Restored after capture.
 */
export type ArAirPlateClear = {
  color: number
  alpha: number
  opaqueClearSafe: boolean
}

export type NdiFramePumpOptions = {
  renderer: WebGLRenderer
  /**
   * Active POV camera for air / NDI. When the screen `renderer.render`
   * camera differs (ops free cam), NDI dual-renders this camera to an
   * offscreen target and captures that — never the free-cam framebuffer.
   */
  getAirCamera?: () => Camera | null | undefined
  /**
   * SCN hook: orient ops billboards (tag distance-scale) for the camera
   * about to render. Required for dual-render so air/NDI tags match active
   * POV while the screen keeps preview (free cam) scales.
   */
  prepareCameraPass?: (camera: Camera) => void
  /**
   * When true (local 3D opaque screen, etc.), always capture via air FBO
   * and apply `getAirPlateClear` for that pass so AR alpha stays correct.
   */
  forceAirTargetCapture?: () => boolean
  /**
   * Clear + opaque-safe gate for the AR air FBO when forced (or when
   * free-cam dual-render runs under a non-AR screen clear).
   */
  getAirPlateClear?: () => ArAirPlateClear | null | undefined
  /** SCN: gate realistic sea/sky during AR air capture. */
  setEnvironmentOpaqueClearSafe?: (safe: boolean) => void
  getEnvironmentOpaqueClearSafe?: () => boolean
  /**
   * Target send rate. Default **30** (air path). Dropped when previous IPC
   * is still busy, or when staggered behind a deferred 3D capture.
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
  stop: () => void
}

/** Default AR NDI send rate — full studio air path. */
export const NDI_AR_DEFAULT_FPS = 30
const DEFAULT_NAME = 'broadcast-web'

/**
 * Electron-only: after each WebGL present (including visual timecode wrap),
 * read RGBA pixels and push to main-process NDI sender (BGRA + alpha).
 *
 * **Air lock:** capture is always the active POV (`getAirCamera`). If the
 * screen render used another camera, a second pass renders air into an FBO
 * for readback so ops free cam cannot hijack NDI. Optional `prepareCameraPass`
 * re-orients SCN billboard scales for each camera before that pass.
 *
 * **Sidebar invariant (Phase 11):** NDI never reads ops sidebar / HUD DOM —
 * only `readRenderTargetPixels` on the WebGL path. Collapsing or growing the
 * ops sidebar must not change air pixels. Regression: `sidebar/sidebar.test.ts`.
 *
 * No-ops when `window.broadcastStudio` is missing (Chrome path).
 * Start **after** `startVisualTimecode` so the barcode is in the framebuffer.
 */
export function startNdiFramePump(
  options: NdiFramePumpOptions,
): NdiFramePumpHandle | null {
  const studio = getStudioBridge()
  if (!studio) return null
  const ndi = studio.ndi

  const {
    renderer,
    getAirCamera,
    prepareCameraPass,
    forceAirTargetCapture,
    getAirPlateClear,
    setEnvironmentOpaqueClearSafe,
    getEnvironmentOpaqueClearSafe,
  } = options
  const fps =
    typeof options.fps === 'number' && options.fps > 0
      ? options.fps
      : NDI_AR_DEFAULT_FPS
  const minIntervalMs = 1000 / fps
  const sourceNameOpt = options.sourceName?.trim() || DEFAULT_NAME
  const channel: NdiChannelId = options.channel ?? DEFAULT_NDI_CHANNEL
  const delayBuffer = new NdiDelayBuffer()
  if (options.delayMs !== undefined) delayBuffer.setDelayMs(options.delayMs)

  let stopped = false
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let lastCaptureMs = 0
  let busy = false
  let rgba: Uint8Array | null = null
  let rgbaW = 0
  let rgbaH = 0
  let airTarget: WebGLRenderTarget | null = null
  let airTargetW = 0
  let airTargetH = 0

  const originalRender = renderer.render.bind(renderer)
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
      // Still apply clear color/alpha without opaque gate when SCN hooks absent.
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

  function ensureBuffer(w: number, h: number): Uint8Array {
    if (!rgba || rgbaW !== w || rgbaH !== h) {
      rgba = new Uint8Array(w * h * 4)
      rgbaW = w
      rgbaH = h
    }
    return rgba
  }

  function ensureAirTarget(w: number, h: number): WebGLRenderTarget {
    if (!airTarget || airTargetW !== w || airTargetH !== h) {
      airTarget?.dispose()
      airTarget = new WebGLRenderTarget(w, h, {
        depthBuffer: true,
        stencilBuffer: false,
      })
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
    busy = true
    try {
      ndi.sendFrame({
        channel,
        width,
        height,
        data,
        bottomUp,
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      // Main drops if busy; allow next frame shortly either way.
      busy = false
    }
  }

  function flushDelay(nowMs: number): void {
    if (stopped || busy || delayBuffer.getDelayMs() <= 0) return
    for (const frame of delayBuffer.popReady(nowMs)) {
      sendFrameData(frame.width, frame.height, frame.data, frame.bottomUp)
    }
  }

  function enqueueRgba(
    w: number,
    h: number,
    buf: Uint8Array,
    bottomUp: boolean,
    nowMs: number,
  ): void {
    const copy = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer
    const ready = delayBuffer.push(
      {
        capturedAtMs: nowMs,
        width: w,
        height: h,
        data: copy,
        bottomUp,
      },
      nowMs,
    )
    for (const frame of ready) {
      sendFrameData(frame.width, frame.height, frame.data, frame.bottomUp)
    }
  }

  function beginCaptureSlot(): number | null {
    if (stopped || busy) return null
    const now = performance.now()
    flushDelay(now)
    if (now - lastCaptureMs < minIntervalMs) return null
    if (!tryClaimNdiHeavyCapture('ar', now)) return null
    return now
  }

  function captureDefaultFb(): void {
    const now = beginCaptureSlot()
    if (now === null) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return

    const buf = ensureBuffer(w, h)
    const gl = renderer.getContext() as WebGLRenderingContext
    try {
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      return
    }

    lastCaptureMs = now
    enqueueRgba(w, h, buf, true, now)
  }

  function captureAirTarget(
    target: WebGLRenderTarget,
    w: number,
    h: number,
    nowMs: number,
  ): void {
    if (stopped || busy) return

    const buf = ensureBuffer(w, h)
    try {
      // Same origin as gl.readPixels: bottom-left row first (WebGL / Three).
      renderer.readRenderTargetPixels(target, 0, 0, w, h, buf)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      return
    }

    // Match captureDefaultFb — sender flips bottom-up RGBA → top-down BGRA.
    lastCaptureMs = nowMs
    enqueueRgba(w, h, buf, true, nowMs)
  }

  function renderAirToTarget(
    sceneRoot: Object3D,
    airCamera: Camera,
    w: number,
    h: number,
  ): WebGLRenderTarget {
    const target = ensureAirTarget(w, h)
    const prevTarget = renderer.getRenderTarget()
    const prevXrEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    try {
      renderer.setRenderTarget(target)
      originalRender(sceneRoot, airCamera)
    } finally {
      renderer.setRenderTarget(prevTarget)
      renderer.xr.enabled = prevXrEnabled
    }
    return target
  }

  renderer.render = ((sceneRoot, camera) => {
    if (stopped) {
      originalRender(sceneRoot, camera)
      return
    }

    const airCamera = getAirCamera?.() ?? null
    const forceAir = forceAirTargetCapture?.() === true
    const plan = planNdiCapture({
      renderCamera: camera,
      airCamera,
    })
    const useAirTarget = forceAir || plan.mode === 'air-target'

    if (!useAirTarget) {
      originalRender(sceneRoot, camera)
      captureDefaultFb()
      return
    }

    // Air FBO path: free cam ≠ POV, and/or local screen clear ≠ AR plate
    // (e.g. local 3D opaque focus). Apply AR clear only for the air pass.
    // Claim before the expensive dual-render so a 3D-yield tick skips it.
    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    const captureNow =
      w >= 1 && h >= 1 && airCamera ? beginCaptureSlot() : null
    if (captureNow !== null && airCamera) {
      const plateSnap = beginAirPlateClear()
      try {
        preparePass(airCamera)
        const target = renderAirToTarget(sceneRoot, airCamera, w, h)
        captureAirTarget(target, w, h, captureNow)
      } finally {
        endAirPlateClear(plateSnap)
      }
    }
    preparePass(camera)
    originalRender(sceneRoot, camera)
  }) as typeof renderer.render

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
            ' (air=active POV)',
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
    stop(): void {
      if (stopped) return
      stopped = true
      renderer.render = originalRender as typeof renderer.render
      delayBuffer.clear()
      rgba = null
      airTarget?.dispose()
      airTarget = null
      void ndi.stop({ channel }).catch(() => {
        /* ignore */
      })
    },
  }
}
