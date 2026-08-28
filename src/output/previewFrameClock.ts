/**
 * Dual frame clock (DSP-OUT-20260818-01): ops WebGL preview vs NDI.
 *
 * Visible window: preview subscribers fire from rAF (~display refresh).
 * Hidden / minimized: preview falls back to the main-process `studio:tick`
 * (60 Hz NDI stagger clock) so Chromium rAF throttle cannot freeze the local
 * present. Preview is still rAF when visible — `STUDIO_TICK_FPS = 60` does
 * not mean preview is 60 from that constant.
 *
 * NDI subscribers always fire from `studio:tick` — never from rAF. One FBO
 * render per tick (AR vs 3D stagger). Do not also render two FBOs on one tick.
 */

import { HITCH_DT_MS_33, HITCH_DT_MS_50 } from './perfCounters.ts'

export type ClockUnsubscribe = () => void

export type SubscribeClock = (onTick: () => void) => ClockUnsubscribe

export type DualFrameClockOptions = {
  /** Main-process `studio:tick` (60 Hz NDI stagger; not throttled when minimized). */
  subscribeStudioTick: SubscribeClock
  /** Default `document.hidden`. */
  isHidden?: () => boolean
  raf?: (cb: FrameRequestCallback) => number
  caf?: (id: number) => void
  nowMs?: () => number
  /** Smoothed preview-fps window. Default 1000 ms. */
  fpsWindowMs?: number
}

export type PreviewHitchCounts = {
  /** Frames in the window whose dt was > 33 ms. */
  over33: number
  /** Frames in the window whose dt was > 50 ms. */
  over50: number
}

export type DualFrameClock = {
  /** Preview present: rAF when visible, studio tick when hidden. */
  subscribePreview: SubscribeClock
  /** NDI pumps: always studio tick. */
  subscribeNdi: SubscribeClock
  /** Smoothed preview fps over the window (0 until two samples). */
  getPreviewFps: () => number
  /** Hitch counts over the same 1 s window. Does not replace average fps. */
  getHitchCounts: () => PreviewHitchCounts
  stop: () => void
}

const DEFAULT_FPS_WINDOW_MS = 1000

export function startDualFrameClock(
  options: DualFrameClockOptions,
): DualFrameClock {
  const isHidden = options.isHidden ?? (() => document.hidden)
  const raf =
    options.raf ??
    ((cb: FrameRequestCallback) => requestAnimationFrame(cb))
  const caf =
    options.caf ?? ((id: number) => cancelAnimationFrame(id))
  const nowMs = options.nowMs ?? (() => performance.now())
  const fpsWindowMs =
    typeof options.fpsWindowMs === 'number' && options.fpsWindowMs > 0
      ? options.fpsWindowMs
      : DEFAULT_FPS_WINDOW_MS

  const previewSubs = new Set<() => void>()
  const ndiSubs = new Set<() => void>()
  const previewStamps: number[] = []
  const hitchOver33: number[] = []
  const hitchOver50: number[] = []
  let lastPreviewMs: number | null = null
  let rafId = 0
  let stopped = false

  function notify(subs: Set<() => void>): void {
    for (const cb of subs) cb()
  }

  function pruneWindow(stamps: number[], now: number): void {
    const cut = now - fpsWindowMs
    while (stamps.length > 0 && stamps[0]! < cut) {
      stamps.shift()
    }
  }

  function recordPreviewTick(now: number): void {
    if (lastPreviewMs != null) {
      const dt = now - lastPreviewMs
      if (dt > HITCH_DT_MS_33) hitchOver33.push(now)
      if (dt > HITCH_DT_MS_50) hitchOver50.push(now)
    }
    lastPreviewMs = now
    previewStamps.push(now)
    pruneWindow(previewStamps, now)
    pruneWindow(hitchOver33, now)
    pruneWindow(hitchOver50, now)
  }

  function firePreview(): void {
    const now = nowMs()
    recordPreviewTick(now)
    notify(previewSubs)
  }

  function onRaf(): void {
    if (stopped) return
    rafId = raf(onRaf)
    if (isHidden()) return
    firePreview()
  }

  const unsubStudio = options.subscribeStudioTick(() => {
    if (stopped) return
    notify(ndiSubs)
    if (!isHidden()) return
    firePreview()
  })

  rafId = raf(onRaf)

  return {
    subscribePreview(cb) {
      previewSubs.add(cb)
      return () => {
        previewSubs.delete(cb)
      }
    },
    subscribeNdi(cb) {
      ndiSubs.add(cb)
      return () => {
        ndiSubs.delete(cb)
      }
    },
    getPreviewFps() {
      const now = nowMs()
      pruneWindow(previewStamps, now)
      if (previewStamps.length < 2) return 0
      const dt = now - previewStamps[0]!
      if (dt <= 0) return 0
      return ((previewStamps.length - 1) / dt) * 1000
    },
    getHitchCounts() {
      const now = nowMs()
      pruneWindow(hitchOver33, now)
      pruneWindow(hitchOver50, now)
      return { over33: hitchOver33.length, over50: hitchOver50.length }
    },
    stop() {
      if (stopped) return
      stopped = true
      unsubStudio()
      if (rafId) caf(rafId)
      rafId = 0
      previewSubs.clear()
      ndiSubs.clear()
      previewStamps.length = 0
      hitchOver33.length = 0
      hitchOver50.length = 0
      lastPreviewMs = null
    },
  }
}
