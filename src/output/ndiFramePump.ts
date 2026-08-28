import { createSendFpsCounter } from './perfCounters.ts'
import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { createNdiAsyncReadback } from './ndiAsyncReadback.ts'
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
   * Target send rate. Default **30** (air path). Dropped when previous IPC
   * is still busy, or when another NDI FBO already claimed this stagger window.
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
 * Electron-only: on each `studio:tick` (60 Hz NDI stagger clock), render the
 * active POV into an FBO, pack RGBA via WebGL2 PBO (sync
 * `readRenderTargetPixels` fallback), and push to the main-process NDI sender
 * (BGRA + alpha). One frame of capture latency on the PBO path is expected.
 *
 * Does **not** monkey-patch `renderer.render` and does **not** subscribe to
 * rAF — ops preview stays rAF. `tryClaimNdiHeavyCapture` is the FBO-render
 * slot: a true claim means this pump **will render** this tick. AR and 3D
 * alternate (~30 Send each). PBO drain/poll may still run on a skipped tick
 * (`DSP-OUT-20260828-04`).
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
  const minIntervalMs = 1000 / fps
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
  let lastCaptureMs = 0
  let busy = false
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
      sendFps.record(performance.now())
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
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

  function drainReadback(nowMs: number): void {
    if (stopped || busy) return
    const pixels = readback.poll(nowMs)
    if (!pixels) return
    enqueueRgba(pixels.width, pixels.height, pixels.data, true, nowMs)
  }

  function captureAirTarget(
    target: WebGLRenderTarget,
    w: number,
    h: number,
    nowMs: number,
  ): void {
    if (stopped || busy) return
    if (!readback.begin(target, w, h, nowMs)) return
    lastCaptureMs = nowMs
    drainReadback(nowMs)
  }

  function captureFrame(): void {
    if (stopped || busy) return
    const now = performance.now()
    flushDelay(now)
    drainReadback(now)
    if (stopped || busy) return
    if (now - lastCaptureMs < minIntervalMs) return

    const airCamera = getAirCamera?.() ?? null
    if (!airCamera) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return
    if (
      !tryClaimNdiHeavyCapture('ar', now, {
        blocking: readback.mode === 'sync',
      })
    ) {
      // Another FBO already rendered this window. Drain above still ran.
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
      tickRender(sceneRoot, airCamera)
      captureAirTarget(target, w, h, now)
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
      delayBuffer.clear()
      readback.dispose()
      airTarget?.dispose()
      airTarget = null
      void ndi.stop({ channel }).catch(() => {
        /* ignore */
      })
    },
  }
}
