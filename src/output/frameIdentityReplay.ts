/**
 * Replay helpers for round-4 AR frame-identity duplicate-runs (2026-09-04).
 *
 * Mechanism under test: AR NDI re-captures/sends the same present() PTS on
 * consecutive ticks (~5–7 dup-run pairs/s). 2dGrab overlaps many baseline runs
 * but is not the primary cause (2D-off still ~5.3 capture dup-runs/s).
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type FrameIdentityDupStats = {
  n: number
  maxLen: number
  overlap2d: number
  overlapPct: number
  meanLen: number
  meanSpanMs: number
  perSec: number
}

export type FrameIdentityCondition = {
  id: 'baseline' | '2d-off' | '3d-off'
  healthySecs: number
  sendSamePts: number
  sendNewPts: number
  sendSamePct: number
  uniquePresentPerSec: number
  capturePerSec: number
  captureDupRuns: FrameIdentityDupStats
  sendDupRuns: FrameIdentityDupStats
}

export type FrameIdentityReplayFixture = {
  source: string
  mechanism: string
  date: string
  conditions: FrameIdentityCondition[]
  /** Pre-fix baseline capture dup-run rate (falsifiable gate). */
  baselineCaptureDupPerSec: number
  /** 2D-off still leaves most of the rate — 2dGrab not primary. */
  twoDOffCaptureDupPerSec: number
  /** 3D-off control: similar rate reduction, not a cure. */
  threeDOffCaptureDupPerSec: number
  /** Live verify after AR freshness gate. */
  postFix?: {
    healthySecs: number
    captureDupPerSec: number
    sendDupPerSec: number
    captureDupMaxLen: number
    sendSamePct: number
    freshnessSkipPerSec: number
    uniquePresentPerSec: number
    capturePerSec: number
  }
}

export function loadFrameIdentityReplayFixture(): FrameIdentityReplayFixture {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = join(here, 'fixtures', 'frameIdentityReplay20260904.json')
  return JSON.parse(readFileSync(path, 'utf8')) as FrameIdentityReplayFixture
}

/** Falsifiable claim: 2D-off cuts <40% of baseline capture dup rate. */
export function assertTwoDNotPrimary(
  fx: FrameIdentityReplayFixture,
): { baseline: number; twoDOff: number; reductionPct: number } {
  const baseline = fx.baselineCaptureDupPerSec
  const twoDOff = fx.twoDOffCaptureDupPerSec
  const reductionPct = baseline <= 0 ? 0 : (100 * (baseline - twoDOff)) / baseline
  return { baseline, twoDOff, reductionPct }
}
