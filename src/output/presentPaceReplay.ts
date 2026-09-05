/**
 * Replay helpers for the 131 s live pacing window.
 *
 * Tick intervals and AU-per-tick counts are reconstructed from the 1 Hz
 * `diag-srt-fps` rows (tickHist / tickMean / auDeltaPerPresent), not from a
 * synthetic 16.7 ms clock. `liveUniqueIntervalsMs` is the concatenated
 * recorded unique-present intervals from that same window (the failed gate).
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type IntervalHistogram = {
  n: number
  meanMs: number
  lt20: number
  b20_40: number
  b40_60: number
  gte60: number
  pct: {
    lt20: number
    b20_40: number
    b40_60: number
    gte60: number
  }
}

export type PresentPaceReplay131s = {
  source: string
  reconstruction: string
  seconds: number
  tickN: number
  liveUnique: {
    n: number
    meanMs: number
    histPct: {
      lt20: number
      b20_40: number
      b40_60: number
      gte60: number
    }
  }
  queueDepthBySecond: number[]
  tickIntervalMs: number[]
  auPerTick: number[]
  liveUniqueIntervalsMs: number[]
}

export function intervalHistogram(xs: readonly number[]): IntervalHistogram {
  const n = xs.length
  if (n === 0) {
    return {
      n: 0,
      meanMs: 0,
      lt20: 0,
      b20_40: 0,
      b40_60: 0,
      gte60: 0,
      pct: { lt20: 0, b20_40: 0, b40_60: 0, gte60: 0 },
    }
  }
  let sum = 0
  let lt20 = 0
  let b20_40 = 0
  let b40_60 = 0
  let gte60 = 0
  for (const x of xs) {
    sum += x
    if (x < 20) lt20 += 1
    else if (x < 40) b20_40 += 1
    else if (x < 60) b40_60 += 1
    else gte60 += 1
  }
  return {
    n,
    meanMs: sum / n,
    lt20,
    b20_40,
    b40_60,
    gte60,
    pct: {
      lt20: (100 * lt20) / n,
      b20_40: (100 * b20_40) / n,
      b40_60: (100 * b40_60) / n,
      gte60: (100 * gte60) / n,
    },
  }
}

export function loadPresentPaceReplay131s(): PresentPaceReplay131s {
  const here = dirname(fileURLToPath(import.meta.url))
  const raw = readFileSync(
    join(here, 'fixtures/presentPaceReplay131s.json'),
    'utf8',
  )
  return JSON.parse(raw) as PresentPaceReplay131s
}
