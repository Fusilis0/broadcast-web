/**
 * Replay helpers for round-5 2dGrab / AR Send contention (2026-09-04).
 *
 * Mechanism under test: with freshness gate on, uniquePresent≈30 but
 * sendNewPts≈26 because AR `busy` (PBO canBegin false) tracks long 2dGrab
 * walls — not sync getImageData on main (worker path already exists).
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type GrabContentionWindow = {
  sendNewPts: number
  uniquePresentN: number
  arBusy: number
  arFreshness: number
  grab2dN: number
  grab2dMeanMs: number
}

export type GrabContentionReplayFixture = {
  source: string
  mechanism: string
  date: string
  /** Post–round-4 freshness, pre–round-5 schedule fix (2D+3D on). */
  baseline: {
    healthySecs: number
    meanSendNewPts: number
    meanUniquePresentN: number
    meanArBusy: number
    meanGrab2dMeanMs: number
    windows: GrabContentionWindow[]
  }
  /** Acceptance: sustained unique-PTS AR Send ≥30 with 2D+3D on. */
  acceptanceSendNewPtsMin: number
}

export function loadGrabContentionReplayFixture(): GrabContentionReplayFixture {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = join(here, 'fixtures', 'grabContentionReplay20260904.json')
  return JSON.parse(readFileSync(path, 'utf8')) as GrabContentionReplayFixture
}

/** Falsifiable: busy explains most of the uniquePresent−sendNewPts gap. */
export function assertBusyExplainsSendGap(
  fx: GrabContentionReplayFixture,
): { gap: number; busy: number; busyCoversGap: boolean } {
  const gap = fx.baseline.meanUniquePresentN - fx.baseline.meanSendNewPts
  const busy = fx.baseline.meanArBusy
  return {
    gap,
    busy,
    busyCoversGap: busy >= gap * 0.7,
  }
}

/** High grab wall windows have lower sendNewPts than low wall windows. */
export function assertGrabWallTracksSend(
  fx: GrabContentionReplayFixture,
): { highWallMeanSend: number; lowWallMeanSend: number } {
  const high = fx.baseline.windows.filter((w) => w.grab2dMeanMs >= 90)
  const low = fx.baseline.windows.filter((w) => w.grab2dMeanMs <= 65)
  const mean = (xs: GrabContentionWindow[]) =>
    xs.length === 0
      ? 0
      : xs.reduce((a, w) => a + w.sendNewPts, 0) / xs.length
  return {
    highWallMeanSend: mean(high),
    lowWallMeanSend: mean(low),
  }
}
