import type { FlagPhaseState } from './types.ts'

export type FlagPhaseThresholds = {
  whiteRaiseMinutes: number
  orangeRaiseMinutes: number
  blueWhiteRaiseMinutes: number
  blueWhiteLowerMinutes: number
}

/**
 * Unity CountdownFlagController visibility from remaining seconds.
 * `minutes = remainingSeconds / 60` (same as Unity float division).
 *
 * - White @ P1: `minutes <= whiteRaise`
 * - Orange @ P2: `minutes <= orangeRaise`
 * - Blue-white @ P2: `blueWhiteRaise >= minutes > blueWhiteLower`
 *
 * Callers freeze visibility after 0 by not re-evaluating once finished.
 */
export function flagPhasesFromRemaining(
  remainingSeconds: number,
  thresholds: FlagPhaseThresholds,
): FlagPhaseState {
  const minutes = remainingSeconds / 60
  return {
    white: minutes <= thresholds.whiteRaiseMinutes,
    orange: minutes <= thresholds.orangeRaiseMinutes,
    blueWhite:
      minutes <= thresholds.blueWhiteRaiseMinutes &&
      minutes > thresholds.blueWhiteLowerMinutes,
  }
}

/** Format remaining time as `MM:SS` (Unity CeilToInt spirit). */
export function formatCountdownMmSs(remainingSeconds: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingSeconds))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
