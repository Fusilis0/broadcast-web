/**
 * Electron-only: stream-map canvas → NDI channel `'2d'` (`broadcast-web-2d`).
 *
 * **Resolution choice (DSP-OUT-20260812-03):** letterbox/scale the map canvas
 * into the studio lock **1920×1080** (same as AR/3D drawing buffer). The bridge
 * accepts arbitrary sizes, but a fixed broadcast frame keeps vMix inputs
 * consistent. Native map pixels stay ~520² for the PiP; NDI does not change
 * AR/3D resolution.
 *
 * **Visibility:** samples map canvas pixels after `ensureDrawn` — independent
 * of PiP / sidebar visibility (canvas 2D redraw still fills the bitmap when
 * `root.hidden`).
 *
 * No-ops when `window.broadcastStudio` is missing (Chrome path).
 */

import { NdiDelayBuffer } from './ndiDelayBuffer.ts'
import {
  getStudioBridge,
  type NdiChannelId,
} from './studioBridge.ts'
import {
  STUDIO_OUTPUT_HEIGHT,
  STUDIO_OUTPUT_WIDTH,
} from './studioOutput.ts'

export const STREAM_MAP_NDI_CHANNEL: NdiChannelId = '2d'
export const STREAM_MAP_NDI_DEFAULT_NAME = 'broadcast-web-2d'
/** Default 2D NDI send rate when enabled (perf dial — DSP-OUT-20260812-06). */
export const STREAM_MAP_NDI_DEFAULT_FPS = 10

export type LetterboxRect = {
  dx: number
  dy: number
  dw: number
  dh: number
}

/** Pure: fit `src` into `dst` preserving aspect (letterbox / pillarbox). */
export function letterboxRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): LetterboxRect {
  const sw = Math.max(1, srcW)
  const sh = Math.max(1, srcH)
  const dw = Math.max(1, dstW)
  const dh = Math.max(1, dstH)
  const scale = Math.min(dw / sw, dh / sh)
  const outW = Math.max(1, Math.round(sw * scale))
  const outH = Math.max(1, Math.round(sh * scale))
  return {
    dx: Math.floor((dw - outW) / 2),
    dy: Math.floor((dh - outH) / 2),
    dw: outW,
    dh: outH,
  }
}

export type StreamMapNdiPumpOptions = {
  /** Stream-map (or twin) canvas; may be hidden in the DOM. */
  getSourceCanvas: () => HTMLCanvasElement | null | undefined
  /** Force a redraw before capture (map stays fresh while PiP hidden). */
  ensureDrawn?: () => void
  /** Target send rate. Default **10** when enabled. */
  fps?: number
  /** NDI source name (hostname prepended by SDK). Default `broadcast-web-2d`. */
  sourceName?: string
  /** Output frame size. Default studio lock 1920×1080. */
  outputWidth?: number
  outputHeight?: number
  /**
   * Start sending immediately. Default **false** (ops enables in NDI tab).
   * Studio wires `enabled: false` at boot; toggle calls `setEnabled`.
   */
  enabled?: boolean
  /**
   * Initial NDI delay (ms). Default 0 — immediate send, no ring buffer.
   * Live changes via `setDelayMs` (clamped 0..30000).
   */
  delayMs?: number
}

export type StreamMapNdiPumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  getDelayMs: () => number
  setDelayMs: (ms: number) => number
  isEnabled: () => boolean
  setEnabled: (on: boolean) => void
  stop: () => void
}

/**
 * Start the 2D stream-map NDI pump. Returns null outside Electron studio.
 */
export function startStreamMapNdiPump(
  options: StreamMapNdiPumpOptions,
): StreamMapNdiPumpHandle | null {
  const studio = getStudioBridge()
  if (!studio) return null
  const bridge = studio
  const ndi = bridge.ndi

  const fps =
    typeof options.fps === 'number' && options.fps > 0
      ? options.fps
      : STREAM_MAP_NDI_DEFAULT_FPS
  const minIntervalMs = 1000 / fps
  const outW =
    typeof options.outputWidth === 'number' && options.outputWidth > 0
      ? Math.floor(options.outputWidth)
      : STUDIO_OUTPUT_WIDTH
  const outH =
    typeof options.outputHeight === 'number' && options.outputHeight > 0
      ? Math.floor(options.outputHeight)
      : STUDIO_OUTPUT_HEIGHT
  const sourceNameOpt =
    options.sourceName?.trim() || STREAM_MAP_NDI_DEFAULT_NAME
  const channel = STREAM_MAP_NDI_CHANNEL
  const delayBuffer = new NdiDelayBuffer()
  if (options.delayMs !== undefined) delayBuffer.setDelayMs(options.delayMs)

  let disposed = false
  let enabled = options.enabled === true
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let lastCaptureMs = 0
  let busy = false
  let starting = false
  let unsubTick: (() => void) | null = null

  const frameCanvas = document.createElement('canvas')
  frameCanvas.width = outW
  frameCanvas.height = outH
  const frameCtx = frameCanvas.getContext('2d', {
    willReadFrequently: true,
  })

  function clearStatus(): void {
    sourceName = null
    sdkVersion = null
  }

  function startSender(): void {
    if (disposed || !enabled || starting) return
    if (sourceName) return
    starting = true
    void ndi
      .start({ channel, name: sourceNameOpt })
      .then((res) => {
        starting = false
        if (disposed || !enabled) {
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
              ' (stream map → 1920×1080 letterbox)',
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

  function sendFrameData(data: ArrayBuffer): void {
    busy = true
    try {
      // Canvas 2D is top-down RGBA — do not flip (unlike WebGL readPixels).
      ndi.sendFrame({
        channel,
        width: outW,
        height: outH,
        data,
        bottomUp: false,
      })
      error = null
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  function flushDelay(nowMs: number): void {
    if (disposed || !enabled || busy || delayBuffer.getDelayMs() <= 0) return
    for (const frame of delayBuffer.popReady(nowMs)) {
      sendFrameData(frame.data)
    }
  }

  function captureAndSend(): void {
    if (disposed || !enabled || busy || !frameCtx) return
    if (!sourceName) return
    const now = performance.now()
    flushDelay(now)
    if (now - lastCaptureMs < minIntervalMs) return

    try {
      options.ensureDrawn?.()
    } catch (err) {
      console.warn('[output] stream map ensureDrawn failed', err)
    }

    const src = options.getSourceCanvas()
    if (!src || src.width < 1 || src.height < 1) return

    frameCtx.fillStyle = '#0a1018'
    frameCtx.fillRect(0, 0, outW, outH)
    const box = letterboxRect(src.width, src.height, outW, outH)
    try {
      frameCtx.drawImage(src, box.dx, box.dy, box.dw, box.dh)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      return
    }

    let imageData: ImageData
    try {
      imageData = frameCtx.getImageData(0, 0, outW, outH)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      return
    }

    const buf = imageData.data
    const copy = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer

    lastCaptureMs = now
    const ready = delayBuffer.push(
      {
        capturedAtMs: now,
        width: outW,
        height: outH,
        data: copy,
        bottomUp: false,
      },
      now,
    )
    for (const frame of ready) {
      sendFrameData(frame.data)
    }
  }

  function ensureTick(): void {
    if (disposed || !enabled || unsubTick) return
    unsubTick = bridge.onStudioTick(() => {
      captureAndSend()
    })
  }

  function clearTick(): void {
    unsubTick?.()
    unsubTick = null
  }

  function setEnabled(on: boolean): void {
    if (disposed) return
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
    isEnabled: () => enabled,
    setEnabled,
    stop(): void {
      if (disposed) return
      disposed = true
      enabled = false
      clearTick()
      delayBuffer.clear()
      stopSender()
      frameCanvas.width = 0
      frameCanvas.height = 0
    },
  }
}
