/**
 * Replay helpers for item-(a) decode-error / keyframe-wait freezes.
 *
 * Built from live drone sessions 2026-09-04 (`diag-decode-a-session{1,2}`).
 * Mechanism under test: IPC TS drops → MPEG-TS CC gaps → WebCodecs
 * `Decoding error.` → waitingForKeyframe until next IDR.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type DecodeErrorReplayEvent = {
  wallMs: number
  message: string
  framesSinceKeyframe: number
  demuxDeltaCcGaps: number
  demuxDeltaSyncResyncs: number
  ipcDropCount: number | null
  bitrateKbps: number | null
  ptsGap90k: number | null
  lastFedKeyframe: boolean | null
  nalTypes: number[] | null
}

export type DecodeErrorReplayFixture = {
  source: string
  mechanism: string
  sessions: Array<{
    id: string
    presentSecs: number
    decodeErrors: number
    ipcDrops: number
    errorsWithCcGap: number
    errorsWithin1_5sOfIpcDrop: number
    events: DecodeErrorReplayEvent[]
  }>
}

export function loadDecodeErrorReplayFixture(): DecodeErrorReplayFixture {
  const here = dirname(fileURLToPath(import.meta.url))
  const path = join(here, 'fixtures', 'decodeErrorReplay20260904.json')
  return JSON.parse(readFileSync(path, 'utf8')) as DecodeErrorReplayFixture
}

/** Falsifiable claim encoded in the fixture totals. */
export function assertIpcDropMechanism(fx: DecodeErrorReplayFixture): {
  totalErrors: number
  withCcGap: number
  withinIpcDropWindow: number
} {
  let totalErrors = 0
  let withCcGap = 0
  let withinIpcDropWindow = 0
  for (const s of fx.sessions) {
    totalErrors += s.decodeErrors
    withCcGap += s.errorsWithCcGap
    withinIpcDropWindow += s.errorsWithin1_5sOfIpcDrop
  }
  return { totalErrors, withCcGap, withinIpcDropWindow }
}
