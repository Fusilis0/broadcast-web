import type { Camera, Object3D, WebGLRenderer } from 'three'
import { WebGLRenderTarget } from 'three'
import { planNdiCapture } from './airCameraLock.ts'
import { getStudioBridge } from './studioBridge.ts'

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
   * Target send rate. Default 30. Dropped when previous IPC is still busy
   * (main process signals via sendFrame fire-and-forget + local gate).
   */
  fps?: number
  /** NDI source name (hostname is prepended by the SDK). Default `broadcast-web`. */
  sourceName?: string
}

export type NdiFramePumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  stop: () => void
}

const DEFAULT_FPS = 30
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

  const { renderer, getAirCamera, prepareCameraPass } = options
  const fps =
    typeof options.fps === 'number' && options.fps > 0
      ? options.fps
      : DEFAULT_FPS
  const minIntervalMs = 1000 / fps
  const sourceNameOpt = options.sourceName?.trim() || DEFAULT_NAME

  let stopped = false
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let lastSendMs = 0
  let busy = false
  let rgba: Uint8Array | null = null
  let rgbaW = 0
  let rgbaH = 0
  let airTarget: WebGLRenderTarget | null = null
  let airTargetW = 0
  let airTargetH = 0

  const originalRender = renderer.render.bind(renderer)

  function preparePass(camera: Camera): void {
    try {
      prepareCameraPass?.(camera)
    } catch (err) {
      console.warn('[output] prepareCameraPass failed', err)
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

  function sendRgba(w: number, h: number, buf: Uint8Array, bottomUp: boolean): void {
    const copy = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer

    busy = true
    lastSendMs = performance.now()
    try {
      ndi.sendFrame({
        width: w,
        height: h,
        data: copy,
        bottomUp,
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      // Main drops if busy; allow next frame shortly either way.
      busy = false
    }
  }

  function captureDefaultFb(): void {
    if (stopped || busy) return
    const now = performance.now()
    if (now - lastSendMs < minIntervalMs) return

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

    sendRgba(w, h, buf, true)
  }

  function captureAirTarget(target: WebGLRenderTarget, w: number, h: number): void {
    if (stopped || busy) return
    const now = performance.now()
    if (now - lastSendMs < minIntervalMs) return

    const buf = ensureBuffer(w, h)
    try {
      // Same origin as gl.readPixels: bottom-left row first (WebGL / Three).
      renderer.readRenderTargetPixels(target, 0, 0, w, h, buf)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      return
    }

    // Match captureDefaultFb — sender flips bottom-up RGBA → top-down BGRA.
    sendRgba(w, h, buf, true)
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
    const plan = planNdiCapture({
      renderCamera: camera,
      airCamera,
    })

    if (plan.mode === 'framebuffer') {
      originalRender(sceneRoot, camera)
      captureDefaultFb()
      return
    }

    // Preview ≠ air: NDI from active POV FBO; screen shows preview camera.
    // Re-orient billboards per pass so tags scale to the camera being drawn.
    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w >= 1 && h >= 1 && airCamera) {
      preparePass(airCamera)
      const target = renderAirToTarget(sceneRoot, airCamera, w, h)
      captureAirTarget(target, w, h)
    }
    preparePass(camera)
    originalRender(sceneRoot, camera)
  }) as typeof renderer.render

  void ndi
    .start({ name: sourceNameOpt })
    .then((res) => {
      if (stopped) return
      if (res.ok) {
        sourceName = res.sourceName ?? sourceNameOpt
        sdkVersion = res.sdkVersion ?? null
        error = null
        console.info(
          `[output] NDI send active: ${sourceName}` +
            (sdkVersion ? ` (${sdkVersion})` : '') +
            ' (air=active POV)',
        )
      } else {
        error = res.error ?? 'NDI start failed'
        console.warn(`[output] NDI start failed: ${error}`)
      }
    })
    .catch((err: unknown) => {
      error = err instanceof Error ? err.message : String(err)
      console.warn(`[output] NDI start error: ${error}`)
    })

  return {
    getSourceName: () => sourceName,
    getSdkVersion: () => sdkVersion,
    getError: () => error,
    stop(): void {
      if (stopped) return
      stopped = true
      renderer.render = originalRender as typeof renderer.render
      rgba = null
      airTarget?.dispose()
      airTarget = null
      void ndi.stop().catch(() => {
        /* ignore */
      })
    },
  }
}
