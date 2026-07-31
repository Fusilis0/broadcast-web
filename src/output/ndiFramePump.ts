import type { WebGLRenderer } from 'three'
import { getStudioBridge } from './studioBridge.ts'

export type NdiFramePumpOptions = {
  renderer: WebGLRenderer
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
 * No-ops when `window.broadcastStudio` is missing (Chrome path).
 * Start **after** `startVisualTimecode` so the barcode is in the framebuffer.
 */
export function startNdiFramePump(
  options: NdiFramePumpOptions,
): NdiFramePumpHandle | null {
  const studio = getStudioBridge()
  if (!studio) return null
  const ndi = studio.ndi

  const { renderer } = options
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

  const gl = renderer.getContext() as WebGLRenderingContext
  const originalRender = renderer.render.bind(renderer)

  function ensureBuffer(w: number, h: number): Uint8Array {
    if (!rgba || rgbaW !== w || rgbaH !== h) {
      rgba = new Uint8Array(w * h * 4)
      rgbaW = w
      rgbaH = h
    }
    return rgba
  }

  function capture(): void {
    if (stopped || busy) return
    const now = performance.now()
    if (now - lastSendMs < minIntervalMs) return

    const canvas = renderer.domElement
    const w = canvas.width
    const h = canvas.height
    if (w < 1 || h < 1) return

    const buf = ensureBuffer(w, h)
    try {
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      return
    }

    // Copy into a transferable ArrayBuffer (readPixels may use a pooled view).
    const copy = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer

    busy = true
    lastSendMs = now
    try {
      ndi.sendFrame({
        width: w,
        height: h,
        data: copy,
        bottomUp: true,
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      // Main drops if busy; allow next frame shortly either way.
      busy = false
    }
  }

  renderer.render = ((scene, camera) => {
    originalRender(scene, camera)
    if (stopped) return
    capture()
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
            (sdkVersion ? ` (${sdkVersion})` : ''),
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
      void ndi.stop().catch(() => {
        /* ignore */
      })
    },
  }
}
