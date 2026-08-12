import type { Camera, Object3D, WebGLRenderer } from 'three'
import { Color, WebGLRenderTarget } from 'three'
import { NdiDelayBuffer } from './ndiDelayBuffer.ts'
import {
  applyOpaque3dPassState,
  NDI_3D_OPAQUE_CLEAR_COLOR,
  restoreClearPass,
  snapshotClearPass,
} from './ndiOpaquePass.ts'
import { tryClaimNdiHeavyCapture } from './ndiCaptureStagger.ts'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'
import { getStudioBridge } from './studioBridge.ts'

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
   * Target send rate. Default **10** (perf: sync readPixels stalls UI;
   * AR stays at 30 — DSP-OUT-20260812-06).
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

/** Default 3D NDI send rate — capped to keep Electron UI usable. */
export const NDI_3D_DEFAULT_FPS = 10
const DEFAULT_3D_NAME = 'broadcast-web-3d'
const CHANNEL = '3d' as const

const _clearColor = new Color()

/**
 * Electron-only continuous **3D** NDI pump (`channel: '3d'`).
 *
 * Each studio tick: opaque clear + `opaqueClearSafe(true)` → render active POV
 * into an FBO → `readPixels` → `sendFrame({ channel: '3d' })` → restore the
 * previous clear / opaque-safe gate so the AR transparent plate stays clean.
 *
 * Does **not** monkey-patch `renderer.render` (AR pump owns that). Captures via
 * `onStudioTick` using the render function bound at start time (typically the
 * visual-timecode wrap). Start **after** `startVisualTimecode` and **before**
 * `startNdiFramePump` so this handle keeps a reference that bypasses the AR
 * override.
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
  const minIntervalMs = 1000 / fps
  const sourceNameOpt = options.sourceName?.trim() || DEFAULT_3D_NAME
  const delayBuffer = new NdiDelayBuffer()
  if (options.delayMs !== undefined) delayBuffer.setDelayMs(options.delayMs)

  // Bind before AR pump patches `renderer.render` (caller start order).
  const directRender = renderer.render.bind(renderer)

  let stopped = false
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let lastCaptureMs = 0
  let busy = false
  let rgba: Uint8Array | null = null
  let rgbaW = 0
  let rgbaH = 0
  let target: WebGLRenderTarget | null = null
  let targetW = 0
  let targetH = 0

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

  function ensureBuffer(w: number, h: number): Uint8Array {
    if (!rgba || rgbaW !== w || rgbaH !== h) {
      rgba = new Uint8Array(w * h * 4)
      rgbaW = w
      rgbaH = h
    }
    return rgba
  }

  function ensureTarget(w: number, h: number): WebGLRenderTarget {
    if (!target || targetW !== w || targetH !== h) {
      target?.dispose()
      target = new WebGLRenderTarget(w, h, {
        depthBuffer: true,
        stencilBuffer: false,
      })
      targetW = w
      targetH = h
    }
    return target
  }

  function sendFrameData(width: number, height: number, data: ArrayBuffer): void {
    busy = true
    try {
      ndi.sendFrame({
        channel: CHANNEL,
        width,
        height,
        data,
        bottomUp: true,
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  function flushDelay(nowMs: number): void {
    if (stopped || busy || delayBuffer.getDelayMs() <= 0) return
    for (const frame of delayBuffer.popReady(nowMs)) {
      sendFrameData(frame.width, frame.height, frame.data)
    }
  }

  function enqueueRgba(w: number, h: number, buf: Uint8Array, nowMs: number): void {
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
        bottomUp: true,
      },
      nowMs,
    )
    for (const frame of ready) {
      sendFrameData(frame.width, frame.height, frame.data)
    }
  }

  function captureFrame(): void {
    if (stopped || busy) return
    const now = performance.now()
    flushDelay(now)
    if (now - lastCaptureMs < minIntervalMs) return

    const airCamera = getAirCamera() ?? null
    if (!airCamera) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return
    // Yield when AR already readback this tick; AR will yield next tick.
    if (!tryClaimNdiHeavyCapture('3d', now)) return

    const snapshot = snapshotClearPass(clearReader)
    applyOpaque3dPassState(clearWriter, NDI_3D_OPAQUE_CLEAR_COLOR)

    const fbo = ensureTarget(w, h)
    const prevTarget = renderer.getRenderTarget()
    const prevXrEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    try {
      preparePass(airCamera)
      renderer.setRenderTarget(fbo)
      directRender(sceneRoot, airCamera)

      const buf = ensureBuffer(w, h)
      try {
        renderer.readRenderTargetPixels(fbo, 0, 0, w, h, buf)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
        return
      }
      lastCaptureMs = now
      enqueueRgba(w, h, buf, now)
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
    stop(): void {
      if (stopped) return
      stopped = true
      unsubTick()
      delayBuffer.clear()
      rgba = null
      target?.dispose()
      target = null
      void ndi.stop({ channel: CHANNEL }).catch(() => {
        /* ignore */
      })
    },
  }
}
