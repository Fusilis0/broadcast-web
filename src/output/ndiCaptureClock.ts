/**
 * Per-channel NDI capture gate (DSP-OUT-20260829-04).
 *
 * The old `now - lastCaptureMs < 1000/30` check is phase-locked to a knife
 * edge: two 60 Hz ticks are *exactly* 33.333 ms, so a hair of negative jitter
 * drops the channel onto the third tick (20 fps). This gate keeps a phase
 * (`nextDueMs`) and admits early by half a studio tick.
 *
 * Nominal capture is **~32 fps** so the trailing-1 s Send readout never
 * shows 29. Declared NDI rate stays 30/1 in `desktop/`.
 *
 * Missed intervals resync — they do not burst to catch up.
 */

/** Studio tick that drives NDI pumps. Do not change `STUDIO_TICK_FPS`. */
export const NDI_STUDIO_TICK_HZ = 60

/**
 * Capture cadence used by the gate when the pump's declared fps is ≥ 30.
 * Slightly above Send 30 so a 1 s window never reads 29.
 */
export const NDI_CAPTURE_NOMINAL_FPS = 32

/** Half a 60 Hz tick — admit if we land this close before `nextDueMs`. */
export const NDI_CAPTURE_GATE_TOLERANCE_MS =
  1000 / NDI_STUDIO_TICK_HZ / 2

export type NdiCaptureGate = {
  readonly intervalMs: number
  readonly toleranceMs: number
  /** Peek: due now, does not advance phase. */
  isDue(nowMs: number): boolean
  /**
   * Admit one capture and advance phase. Returns false when not yet due.
   * If more than one interval behind, resyncs to `now + interval` (no burst).
   */
  tryAdmit(nowMs: number): boolean
  /**
   * Admit now and resync phase from `now`, even if early. Prefer when a new
   * present() PTS is waiting so unique content is not rateCap-dropped.
   */
  forceAdmit(nowMs: number): void
  reset(): void
}

/** Declared 30 (or above) → 32 nominal. Lower declared rates stay as-is. */
export function ndiCaptureGateFps(declaredFps: number): number {
  if (!(declaredFps > 0) || !Number.isFinite(declaredFps)) {
    return NDI_CAPTURE_NOMINAL_FPS
  }
  return declaredFps >= 30 ? NDI_CAPTURE_NOMINAL_FPS : declaredFps
}

export function createNdiCaptureGate(declaredFps: number): NdiCaptureGate {
  const fps = ndiCaptureGateFps(declaredFps)
  const intervalMs = 1000 / fps
  const toleranceMs = NDI_CAPTURE_GATE_TOLERANCE_MS
  let nextDueMs = 0
  let started = false

  function isDue(nowMs: number): boolean {
    if (!started) return true
    return nowMs >= nextDueMs - toleranceMs
  }

  function tryAdmit(nowMs: number): boolean {
    if (!isDue(nowMs)) return false
    if (!started) {
      started = true
      nextDueMs = nowMs + intervalMs
      return true
    }
    if (nowMs - nextDueMs > intervalMs) {
      nextDueMs = nowMs + intervalMs
    } else {
      nextDueMs += intervalMs
    }
    return true
  }

  function forceAdmit(nowMs: number): void {
    started = true
    nextDueMs = nowMs + intervalMs
  }

  return {
    intervalMs,
    toleranceMs,
    isDue,
    tryAdmit,
    forceAdmit,
    reset(): void {
      nextDueMs = 0
      started = false
    },
  }
}
