/**
 * DIAG:srt-fps — wall-clock interval regularity for studio:tick vs unique
 * present() advances. Counts-per-second can be ~30 while cadence judders.
 */

export type DiagIntervalHist = {
  lt20: number
  b20_40: number
  b40_60: number
  gte60: number
}

export type DiagPaceWindow = {
  tickN: number
  tickMean: number
  tickStd: number
  tickMin: number
  tickMax: number
  tickHist: DiagIntervalHist
  advanceN: number
  advMean: number
  advStd: number
  advMin: number
  advMax: number
  advHist: DiagIntervalHist
  minClampN: number
  minClampMean: number
  minClampStd: number
  minClampHist: DiagIntervalHist
  /** Inter-arrival gaps for demux AUs pushed into the active POV pipe. */
  auArrivalN: number
  auArrivalMean: number
  auArrivalStd: number
  auArrivalMin: number
  auArrivalMax: number
  auArrivalHist: DiagIntervalHist
  ticksBetween: Record<string, number>
  advIntervals: number[]
}

const ADV_TAIL = 24

let lastTickAt = Number.NaN
let tickSeq = 0
let lastAdvAt = Number.NaN
let lastAdvTickSeq = 0
let lastMinClampAt = Number.NaN
let lastAuAt = Number.NaN
const tickGaps: number[] = []
const advGaps: number[] = []
const minClampGaps: number[] = []
const auArrivalGaps: number[] = []
const ticksBetween: Record<string, number> = {}

function emptyHist(): DiagIntervalHist {
  return { lt20: 0, b20_40: 0, b40_60: 0, gte60: 0 }
}

function bucket(ms: number, h: DiagIntervalHist): void {
  if (ms < 20) h.lt20 += 1
  else if (ms < 40) h.b20_40 += 1
  else if (ms < 60) h.b40_60 += 1
  else h.gte60 += 1
}

function summarize(xs: number[]): {
  n: number
  mean: number
  std: number
  min: number
  max: number
  hist: DiagIntervalHist
} {
  const hist = emptyHist()
  if (xs.length === 0) {
    return { n: 0, mean: 0, std: 0, min: 0, max: 0, hist }
  }
  let sum = 0
  let min = xs[0]!
  let max = xs[0]!
  for (const x of xs) {
    sum += x
    if (x < min) min = x
    if (x > max) max = x
    bucket(x, hist)
  }
  const mean = sum / xs.length
  let varSum = 0
  for (const x of xs) {
    const d = x - mean
    varSum += d * d
  }
  const std = Math.sqrt(varSum / xs.length)
  return { n: xs.length, mean, std, min, max, hist }
}

function betweenKey(n: number): string {
  if (n <= 0) return '0'
  if (n >= 4) return '4+'
  return String(n)
}

export function resetDiagPresentPace(): void {
  lastTickAt = Number.NaN
  tickSeq = 0
  lastAdvAt = Number.NaN
  lastAdvTickSeq = 0
  lastMinClampAt = Number.NaN
  lastAuAt = Number.NaN
  tickGaps.length = 0
  advGaps.length = 0
  minClampGaps.length = 0
  auArrivalGaps.length = 0
  for (const k of Object.keys(ticksBetween)) delete ticksBetween[k]
}

/** Call once per studio:tick `present()` entry. */
export function diagNotePaceTick(nowMs: number): void {
  tickSeq += 1
  if (Number.isFinite(lastTickAt)) tickGaps.push(nowMs - lastTickAt)
  lastTickAt = nowMs
}

/**
 * Call when the active POV’s presented PTS changes (visible texture change).
 * `reason` should be the present() pick reason (`min-clamp` vs others).
 */
export function diagNotePaceAdvance(
  nowMs: number,
  reason: string | null,
): void {
  if (Number.isFinite(lastAdvAt)) {
    advGaps.push(nowMs - lastAdvAt)
    const held = tickSeq - lastAdvTickSeq
    const key = betweenKey(held)
    ticksBetween[key] = (ticksBetween[key] ?? 0) + 1
  }
  lastAdvAt = nowMs
  lastAdvTickSeq = tickSeq
  if (reason === 'min-clamp') {
    if (Number.isFinite(lastMinClampAt)) minClampGaps.push(nowMs - lastMinClampAt)
    lastMinClampAt = nowMs
  }
}

/** Call once per demux AU fed into the active POV decode pipeline. */
export function diagNoteAuArrival(nowMs: number): void {
  if (Number.isFinite(lastAuAt)) auArrivalGaps.push(nowMs - lastAuAt)
  lastAuAt = nowMs
}

export function takeDiagPresentPaceWindow(): DiagPaceWindow {
  const tick = summarize(tickGaps)
  const adv = summarize(advGaps)
  const mc = summarize(minClampGaps)
  const au = summarize(auArrivalGaps)
  const tail = advGaps.slice(-ADV_TAIL).map((x) => Math.round(x * 10) / 10)
  const snap: DiagPaceWindow = {
    tickN: tick.n,
    tickMean: tick.mean,
    tickStd: tick.std,
    tickMin: tick.min,
    tickMax: tick.max,
    tickHist: tick.hist,
    advanceN: adv.n,
    advMean: adv.mean,
    advStd: adv.std,
    advMin: adv.min,
    advMax: adv.max,
    advHist: adv.hist,
    minClampN: mc.n,
    minClampMean: mc.mean,
    minClampStd: mc.std,
    minClampHist: mc.hist,
    auArrivalN: au.n,
    auArrivalMean: au.mean,
    auArrivalStd: au.std,
    auArrivalMin: au.min,
    auArrivalMax: au.max,
    auArrivalHist: au.hist,
    ticksBetween: { ...ticksBetween },
    advIntervals: tail,
  }
  // Keep last timestamps so the next window’s first gap is still valid.
  tickGaps.length = 0
  advGaps.length = 0
  minClampGaps.length = 0
  auArrivalGaps.length = 0
  for (const k of Object.keys(ticksBetween)) delete ticksBetween[k]
  return snap
}
