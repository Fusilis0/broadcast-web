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
 * **Tick (DSP-OUT-20260828-07 / DSP-OUT-20260829-04):** `onStudioTick` only
 * *schedules* capture. Gate and send are independent of AR/3D. `ensureDrawn` /
 * grab run after the FBO pumps (`setTimeout(0)`). Happy path: worker +
 * transferable buffer. Fail closed to sync `getImageData`. 2D does **not**
 * occupy the FBO stagger slot. Do not rewrite the grab helper here.
 *
 * No-ops when `window.broadcastStudio` is missing (Chrome path).
 */

import {
  createNdi2dAsyncCapture,
  type CreateNdi2dAsyncCaptureOptions,
} from './ndi2dAsyncCapture.ts'
import { createNdiCaptureGate } from './ndiCaptureClock.ts'
import { createNdiDeferredSend } from './ndiDeferredSend.ts'
import { NdiDelayBuffer } from './ndiDelayBuffer.ts'
import { createSendFpsCounter } from './perfCounters.ts'
import {
  noteNdiSkip,
  recordNdiCapture,
  recordNdiStage,
  timeNdiStage,
} from './ndiStageTiming.ts'
import {
  debugSessionLog,
  getStudioBridge,
  type NdiChannelId,
} from './studioBridge.ts'
import {
  STUDIO_OUTPUT_HEIGHT,
  STUDIO_OUTPUT_WIDTH,
} from './studioOutput.ts'
import { createNdiPackPool, packedFrameBytes } from './ndiUyvy.ts'

export const STREAM_MAP_NDI_CHANNEL: NdiChannelId = '2d'
export const STREAM_MAP_NDI_DEFAULT_NAME = 'broadcast-web-2d'
/** Default 2D NDI send rate (always-on @ 30 — DSP-OUT-20260828-04). */
export const STREAM_MAP_NDI_DEFAULT_FPS = 30

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
  /** Target send rate. Default **30**. */
  fps?: number
  /** NDI source name (hostname prepended by SDK). Default `broadcast-web-2d`. */
  sourceName?: string
  /** Output frame size. Default studio lock 1920×1080. */
  outputWidth?: number
  outputHeight?: number
  /**
   * Start sending immediately. Default **true** (DSP-OUT-20260828-02).
   * NDI tab toggle may stop **only** this sender; AR/3D stay on.
   */
  enabled?: boolean
  /**
   * Initial NDI delay (ms). Default 0 — immediate send, no ring buffer.
   * Live changes via `setDelayMs` (clamped 0..30000).
   */
  delayMs?: number
  /** Test seam (DSP-OUT-20260828-07): deferral + worker vs sync grab. */
  ndi2dCapture?: CreateNdi2dAsyncCaptureOptions
}

export type StreamMapNdiPumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  getDelayMs: () => number
  setDelayMs: (ms: number) => number
  getSendFps: () => number
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
  const captureGate = createNdiCaptureGate(fps)
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
  const sendFps = createSendFpsCounter()

  let disposed = false
  let enabled = options.enabled !== false
  let sourceName: string | null = null
  let sdkVersion: string | null = null
  let error: string | null = null
  let busy = false
  let grabbing = false
  let queued = false
  let starting = false
  let unsubTick: (() => void) | null = null
  const capture = createNdi2dAsyncCapture(options.ndi2dCapture)
  const packPool = createNdiPackPool('uyvy')

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
    timeNdiStage('2dSend', () => {
      busy = true
      try {
        // Canvas 2D is top-down RGBA — do not flip (unlike WebGL readPixels).
        ndi.sendFrame({
          channel,
          width: outW,
          height: outH,
          data,
          bottomUp: false,
          pixelFormat: 'uyvy',
        })
        sendFps.record(performance.now())
        error = null
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      } finally {
        busy = false
      }
    })
  }

  const ipc = createNdiDeferredSend({
    send: (frame) => {
      sendFrameData(frame.data)
    },
    release: (data) => {
      packPool.release(data)
    },
  })

  function flushDelay(nowMs: number): void {
    if (disposed || !enabled || delayBuffer.getDelayMs() <= 0) return
    for (const frame of delayBuffer.popReady(nowMs)) {
      ipc.enqueue({
        width: frame.width,
        height: frame.height,
        data: frame.data,
        bottomUp: false,
      })
    }
  }

  function deliverPixels(data: ArrayBuffer, now: number): void {
    if (!captureGate.tryAdmit(now)) {
      noteNdiSkip('2d', 'rateCap')
      return
    }
    recordNdiCapture('2d', now)
    const alreadyPacked =
      data.byteLength === packedFrameBytes('uyvy', outW, outH)
    const packed = alreadyPacked ? data : packPool.pack(data, outW, outH)
    if (!packed) return
    // #region agent log
    if (!(globalThis as { __ndi2dPackAt?: number }).__ndi2dPackAt ||
      performance.now() - ((globalThis as { __ndi2dPackAt?: number }).__ndi2dPackAt ?? 0) > 1000) {
      ;(globalThis as { __ndi2dPackAt?: number }).__ndi2dPackAt = performance.now()
      debugSessionLog({
        hypothesisId: 'H14',
        location: 'streamMapNdiPump.ts:deliverPixels',
        message: '2D pack path',
        data: { alreadyPacked, inBytes: data.byteLength, outBytes: packed.byteLength },
      })
    }
    // #endregion
    const ready = delayBuffer.push(
      {
        capturedAtMs: now,
        width: outW,
        height: outH,
        data: packed,
        bottomUp: false,
      },
      now,
    )
    for (const frame of ready) {
      ipc.enqueue({
        width: frame.width,
        height: frame.height,
        data: frame.data,
        bottomUp: false,
      })
    }
  }

  async function runCapture(): Promise<void> {
    if (disposed || !enabled) return
    if (busy || grabbing) {
      noteNdiSkip('2d', 'busy')
      return
    }
    if (!sourceName) return
    const now = performance.now()
    if (!captureGate.isDue(now)) {
      noteNdiSkip('2d', 'rateCap')
      return
    }

    try {
      options.ensureDrawn?.()
    } catch (err) {
      console.warn('[output] stream map ensureDrawn failed', err)
    }

    const src = options.getSourceCanvas()
    if (!src || src.width < 1 || src.height < 1) return

    const box = letterboxRect(src.width, src.height, outW, outH)
    grabbing = true
    try {
      const t0 = performance.now()
      try {
        const data = await capture.grab({ source: src, outW, outH, box })
        recordNdiStage('2dGrab', performance.now() - t0)
        if (disposed || !enabled) return
        deliverPixels(data, performance.now())
      } catch (err) {
        recordNdiStage('2dGrab', performance.now() - t0)
        if (!disposed) {
          error = err instanceof Error ? err.message : String(err)
        }
      }
    } finally {
      grabbing = false
    }
  }

  function scheduleCapture(): void {
    timeNdiStage('2dSchedule', () => {
      if (disposed || !enabled) return
      if (busy || grabbing || queued) {
        noteNdiSkip('2d', 'busy')
        return
      }
      if (!sourceName) return
      const now = performance.now()
      flushDelay(now)
      if (!captureGate.isDue(now)) {
        noteNdiSkip('2d', 'rateCap')
        return
      }
      queued = true
      capture.defer(() => {
        queued = false
        void runCapture()
      })
    })
  }

  function ensureTick(): void {
    if (disposed || !enabled || unsubTick) return
    unsubTick = bridge.onStudioTick(() => {
      scheduleCapture()
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
    getSendFps: () => (enabled ? sendFps.getFps(performance.now()) : 0),
    isEnabled: () => enabled,
    setEnabled,
    stop(): void {
      if (disposed) return
      disposed = true
      enabled = false
      queued = false
      grabbing = false
      clearTick()
      ipc.dispose()
      delayBuffer.clear()
      stopSender()
      capture.dispose()
    },
  }
}
