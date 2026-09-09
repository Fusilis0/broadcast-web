import { CINEMATIC_FPS } from './constants.ts'

function clamp(t: number, lo: number, hi: number): number {
  if (!(t > lo)) return lo
  if (t > hi) return hi
  return t
}

/**
 * Snap sequence time to the locked frame grid so 60 rAF does not invent
 * in-between spline samples. `t = 0` and `t = duration` stay exact.
 */
export function quantizeCinematicTime(
  tSec: number,
  durationSec: number,
  fps = CINEMATIC_FPS,
): number {
  const dur = durationSec > 0 && Number.isFinite(durationSec) ? durationSec : 0
  const t = clamp(Number.isFinite(tSec) ? tSec : 0, 0, dur)
  if (t <= 0) return 0
  if (dur > 0 && t >= dur) return dur
  const frame = Math.round(t * fps)
  return clamp(frame / fps, 0, dur)
}

export type CinematicClockHandle = {
  setDuration: (durationSec: number) => void
  getDuration: () => number
  play: (nowMs?: number) => void
  pause: () => void
  seek: (tSec: number) => void
  isPlaying: () => boolean
  /** Unquantized transport time (seek target / wall-clock playhead). */
  getTimeSec: () => number
  /**
   * Advance from **wall clock**, not rAF dt. Returns the quantized sample time.
   */
  sync: (nowMs?: number) => number
  reset: () => void
}

/**
 * Play/pause/seek on a locked 30 Hz grid. Wall-clock elapsed time drives the
 * playhead so a 60 Hz preview cannot speed the spline.
 */
export function createCinematicClock(
  fps = CINEMATIC_FPS,
): CinematicClockHandle {
  let durationSec = 0
  let tSec = 0
  let playing = false
  let anchorMs = 0
  let anchorT = 0

  function now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
  }

  return {
    setDuration(next: number): void {
      durationSec = next > 0 && Number.isFinite(next) ? next : 0
      tSec = clamp(tSec, 0, durationSec)
    },
    getDuration: () => durationSec,
    play(nowMs = now()): void {
      playing = true
      anchorMs = nowMs
      anchorT = tSec
    },
    pause(): void {
      playing = false
    },
    seek(next: number): void {
      tSec = clamp(Number.isFinite(next) ? next : 0, 0, durationSec)
      if (playing) {
        anchorMs = now()
        anchorT = tSec
      }
    },
    isPlaying: () => playing,
    getTimeSec: () => tSec,
    sync(nowMs = now()): number {
      if (playing) {
        const elapsed = Math.max(0, (nowMs - anchorMs) / 1000)
        tSec = clamp(anchorT + elapsed, 0, durationSec)
        if (durationSec > 0 && tSec >= durationSec) {
          tSec = durationSec
          playing = false
        }
      }
      return quantizeCinematicTime(tSec, durationSec, fps)
    },
    reset(): void {
      playing = false
      tSec = 0
      durationSec = 0
      anchorMs = 0
      anchorT = 0
    },
  }
}
