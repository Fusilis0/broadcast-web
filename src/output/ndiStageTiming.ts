/**
 * Per-stage NDI / studio-tick timing (DSP-PRF-20260829-01).
 *
 * Measurement only — does not change caps, stagger, copies, or
 * `STUDIO_TICK_FPS`. Call sites add `performance.now` around existing work.
 */

import {
  createIntHistogram,
  createStageAccumulator,
  formatIntHistogram,
  tickIntervalBucketMs,
  type StageStats,
} from './perfCounters.ts'
import {
  debugSessionLog,
  type NdiChannelId,
  type NdiMainPerfSummary,
} from './studioBridge.ts'

export const NDI_STAGE_NAMES = [
  'present',
  'arFboRender',
  'arReadbackBegin',
  'arReadbackDrain',
  'arEnqueueIpc',
  '3dFboRender',
  '3dReadbackBegin',
  '3dReadbackDrain',
  '3dEnqueueIpc',
  '2dSchedule',
  '2dGrab',
  '2dSend',
  'totalTick',
] as const

export type NdiStageName = (typeof NDI_STAGE_NAMES)[number]

export type NdiSkipCause = 'rateCap' | 'stagger' | 'busy'

export type NdiSkipCounts = Record<NdiSkipCause, number>

export type NdiStageSnapshot = {
  windowMs: number
  stages: Record<NdiStageName, StageStats>
  skips: Record<NdiChannelId, NdiSkipCounts>
  captureTicks: Record<NdiChannelId, Record<string, number>>
  tickIntervalMs: Record<string, number>
  tickInterval: { count: number; meanMs: number; maxMs: number; over20ms: number }
  fallbacks: { syncReadback: boolean; sync2dCapture: boolean }
  main: NdiMainPerfSummary | null
  instrumentOverhead: { meanMs: number; maxMs: number; count: number }
}

const HZ_MS = 1000
const DUMP_WINDOW_MS = 10000
const CHANNELS: readonly NdiChannelId[] = ['ar', '3d', '2d']
const EMPTY_SKIPS = (): NdiSkipCounts => ({ rateCap: 0, stagger: 0, busy: 0 })

type StampMs = { at: number; ms: number }
type CaptureStamp = { at: number; channel: NdiChannelId; ticks: number }

const stages = Object.fromEntries(
  NDI_STAGE_NAMES.map((name) => [name, createStageAccumulator()]),
) as Record<NdiStageName, ReturnType<typeof createStageAccumulator>>

const skips1s: Record<NdiChannelId, NdiSkipCounts> = {
  ar: EMPTY_SKIPS(),
  '3d': EMPTY_SKIPS(),
  '2d': EMPTY_SKIPS(),
}

const hzRing: NdiStageSnapshot[] = []
let lastHzMs = 0
let tickSeq = 0
let lastTickMs: number | null = null
let lastCaptureTick: Record<NdiChannelId, number | null> = {
  ar: null,
  '3d': null,
  '2d': null,
}
let tickOpen = false
let tickStartMs = 0
const tickIntervals: StampMs[] = []
const captures: CaptureStamp[] = []
let syncReadback = false
let sync2dCapture = false
let mainSummary: NdiMainPerfSummary | null = null
let overheadSum = 0
let overheadCount = 0
let overheadMax = 0
let nowCostMs = 0
let calibrated = false
let dumpHookInstalled = false

function emptySkipMap(): Record<NdiChannelId, NdiSkipCounts> {
  return { ar: EMPTY_SKIPS(), '3d': EMPTY_SKIPS(), '2d': EMPTY_SKIPS() }
}

function calibrateNowCost(): void {
  if (calibrated) return
  calibrated = true
  const n = 2000
  const t0 = performance.now()
  for (let i = 0; i < n; i++) performance.now()
  nowCostMs = (performance.now() - t0) / n
}

function addOverhead(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return
  overheadSum += ms
  overheadCount += 1
  if (ms > overheadMax) overheadMax = ms
}

function pruneStamps(now: number): void {
  const cut = now - DUMP_WINDOW_MS
  while (tickIntervals.length > 0 && tickIntervals[0]!.at < cut) {
    tickIntervals.shift()
  }
  while (captures.length > 0 && captures[0]!.at < cut) {
    captures.shift()
  }
}

function tickIntervalSnapshot(now: number): {
  buckets: Record<string, number>
  count: number
  meanMs: number
  maxMs: number
  over20ms: number
} {
  pruneStamps(now)
  const buckets: Record<string, number> = {}
  let sum = 0
  let max = 0
  let over20 = 0
  for (const sample of tickIntervals) {
    const key = tickIntervalBucketMs(sample.ms)
    buckets[key] = (buckets[key] ?? 0) + 1
    sum += sample.ms
    if (sample.ms > max) max = sample.ms
    if (sample.ms > 20) over20 += 1
  }
  const count = tickIntervals.length
  return {
    buckets,
    count,
    meanMs: count > 0 ? sum / count : 0,
    maxMs: max,
    over20ms: over20,
  }
}

function captureTickSnapshot(now: number): Record<NdiChannelId, Record<string, number>> {
  pruneStamps(now)
  const hists: Record<NdiChannelId, ReturnType<typeof createIntHistogram>> = {
    ar: createIntHistogram(6),
    '3d': createIntHistogram(6),
    '2d': createIntHistogram(6),
  }
  for (const sample of captures) {
    hists[sample.channel].record(sample.ticks)
  }
  return {
    ar: hists.ar.snapshot(),
    '3d': hists['3d'].snapshot(),
    '2d': hists['2d'].snapshot(),
  }
}

function stageSnapshot(): Record<NdiStageName, StageStats> {
  const out = {} as Record<NdiStageName, StageStats>
  for (const name of NDI_STAGE_NAMES) {
    out[name] = stages[name].snapshot()
  }
  return out
}

function cloneSkips(): Record<NdiChannelId, NdiSkipCounts> {
  return {
    ar: { ...skips1s.ar },
    '3d': { ...skips1s['3d'] },
    '2d': { ...skips1s['2d'] },
  }
}

function resetStagesAndSkips(): void {
  for (const name of NDI_STAGE_NAMES) stages[name].reset()
  skips1s.ar = EMPTY_SKIPS()
  skips1s['3d'] = EMPTY_SKIPS()
  skips1s['2d'] = EMPTY_SKIPS()
}

function rotateHz(now: number): void {
  if (lastHzMs === 0) {
    lastHzMs = now
    return
  }
  if (now - lastHzMs < HZ_MS) return
  const tick = tickIntervalSnapshot(now)
  const snap: NdiStageSnapshot = {
    windowMs: now - lastHzMs,
    stages: stageSnapshot(),
    skips: cloneSkips(),
    captureTicks: captureTickSnapshot(now),
    tickIntervalMs: tick.buckets,
    tickInterval: {
      count: tick.count,
      meanMs: tick.meanMs,
      maxMs: tick.maxMs,
      over20ms: tick.over20ms,
    },
    fallbacks: { syncReadback, sync2dCapture },
    main: mainSummary,
    instrumentOverhead: {
      meanMs: overheadCount > 0 ? overheadSum / overheadCount : 0,
      maxMs: overheadMax,
      count: overheadCount,
    },
  }
  hzRing.push(snap)
  while (hzRing.length > 10) hzRing.shift()
  // #region agent log
  const pick = (name: NdiStageName) => ({
    mean: snap.stages[name].meanMs,
    max: snap.stages[name].maxMs,
    n: snap.stages[name].count,
  })
  debugSessionLog({
    hypothesisId: 'H11',
    location: 'ndiStageTiming.ts:rotateHz',
    message: '1s stage window',
    data: {
      windowMs: snap.windowMs,
      tick: snap.tickInterval,
      arFbo: pick('arFboRender'),
      d3Fbo: pick('3dFboRender'),
      arBegin: pick('arReadbackBegin'),
      d3Begin: pick('3dReadbackBegin'),
      arIpc: pick('arEnqueueIpc'),
      d3Ipc: pick('3dEnqueueIpc'),
      grab2d: pick('2dGrab'),
      send2d: pick('2dSend'),
      present: pick('present'),
      totalTick: pick('totalTick'),
      skips: snap.skips,
    },
  })
  // #endregion
  resetStagesAndSkips()
  lastHzMs = now
}

function fmtMs(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n < 0.01) return n.toFixed(3)
  if (n < 1) return n.toFixed(2)
  return n.toFixed(1)
}

function phaseLockReading(hist: Record<string, number>): string {
  const two = hist['2'] ?? 0
  const three = hist['3'] ?? 0
  const four = hist['4'] ?? 0
  const total = Object.values(hist).reduce((a, b) => a + b, 0)
  if (total === 0) return 'no samples'
  if (two > 0 && three > 0 && two + three >= total * 0.7) {
    return '2-vs-3 split (phase-lock)'
  }
  if (three + four >= total * 0.7 && two < total * 0.2) {
    return 'cluster on 3/4 (phase-lock)'
  }
  if (two >= total * 0.8) return 'tight on 2 (healthy 30 fps)'
  return 'mixed'
}

function formatStageBlock(snap: NdiStageSnapshot): string {
  const lines = ['stages mean/max ms (count):']
  for (const name of NDI_STAGE_NAMES) {
    const s = snap.stages[name]
    const pad = name.padEnd(16, ' ')
    lines.push(
      `  ${pad} ${fmtMs(s.meanMs).padStart(6)} / ${fmtMs(s.maxMs).padStart(6)}  n=${s.count}`,
    )
  }
  return lines.join('\n')
}

function formatSkipLine(skips: Record<NdiChannelId, NdiSkipCounts>): string {
  return CHANNELS.map((ch) => {
    const s = skips[ch]
    return `${ch} rateCap=${s.rateCap} stagger=${s.stagger} busy=${s.busy}`
  }).join('  ')
}

function formatMain(main: NdiMainPerfSummary | null): string {
  if (!main) return 'main: (no summary yet)'
  const parts = CHANNELS.map((ch) => {
    const c = main.channels[ch]
    return (
      `${ch} rgbaToBgra ${fmtMs(c.rgbaToBgra.meanMs)}/${fmtMs(c.rgbaToBgra.maxMs)} n=${c.rgbaToBgra.count}` +
      `  video ${fmtMs(c.video.meanMs)}/${fmtMs(c.video.maxMs)} n=${c.video.count}` +
      `  dropBusy=${c.dropBusy}`
    )
  })
  return `main:\n  ${parts.join('\n  ')}`
}

function installDumpHook(): void {
  if (dumpHookInstalled) return
  dumpHookInstalled = true
  if (typeof window === 'undefined') return
  window.__perfDump = formatNdiStageDump
}

/**
 * Call at the start of the first `studio:tick` listener (preview clock).
 * Records tick-interval distribution and total sync-handler duration via
 * `queueMicrotask` (after all other tick listeners, before deferred 2D grab).
 */
export function beginStudioTickTiming(nowMs?: number): void {
  calibrateNowCost()
  installDumpHook()
  const inst0 = performance.now()
  const now =
    typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : inst0
  rotateHz(now)

  if (lastTickMs != null) {
    tickIntervals.push({ at: now, ms: now - lastTickMs })
  }
  lastTickMs = now
  tickSeq += 1

  if (!tickOpen) {
    tickOpen = true
    tickStartMs = now
    queueMicrotask(() => {
      const elapsed = performance.now() - tickStartMs
      stages.totalTick.add(elapsed)
      tickOpen = false
    })
  }

  addOverhead(performance.now() - inst0 + nowCostMs)
}

export function recordNdiStage(name: NdiStageName, elapsedMs: number): void {
  const inst0 = performance.now()
  stages[name].add(elapsedMs)
  addOverhead(performance.now() - inst0 + 2 * nowCostMs)
}

export function timeNdiStage(name: NdiStageName, work: () => void): void {
  const t0 = performance.now()
  try {
    work()
  } finally {
    recordNdiStage(name, performance.now() - t0)
  }
}

export function noteNdiSkip(channel: NdiChannelId, cause: NdiSkipCause): void {
  skips1s[channel][cause] += 1
}

export function recordNdiCapture(channel: NdiChannelId, nowMs?: number): void {
  const now =
    typeof nowMs === 'number' && Number.isFinite(nowMs)
      ? nowMs
      : performance.now()
  const prev = lastCaptureTick[channel]
  if (prev != null) {
    captures.push({ at: now, channel, ticks: tickSeq - prev })
  }
  lastCaptureTick[channel] = tickSeq
}

export function markNdiSyncReadback(): void {
  syncReadback = true
}

export function markNdiSync2dCapture(): void {
  sync2dCapture = true
}

export function applyNdiMainPerfSummary(summary: NdiMainPerfSummary): void {
  mainSummary = summary
}

export function getNdiStageSnapshot(): NdiStageSnapshot {
  const now = performance.now()
  rotateHz(now)
  const latest = hzRing[hzRing.length - 1]
  if (latest) return latest
  const tick = tickIntervalSnapshot(now)
  return {
    windowMs: 0,
    stages: stageSnapshot(),
    skips: emptySkipMap(),
    captureTicks: captureTickSnapshot(now),
    tickIntervalMs: tick.buckets,
    tickInterval: {
      count: tick.count,
      meanMs: tick.meanMs,
      maxMs: tick.maxMs,
      over20ms: tick.over20ms,
    },
    fallbacks: { syncReadback, sync2dCapture },
    main: mainSummary,
    instrumentOverhead: {
      meanMs: overheadCount > 0 ? overheadSum / overheadCount : 0,
      maxMs: overheadMax,
      count: overheadCount,
    },
  }
}

export function formatNdiStageHud(snap?: NdiStageSnapshot): string {
  const s = snap ?? getNdiStageSnapshot()
  const tick = s.tickInterval
  const lines = [
    `tick ${fmtMs(tick.meanMs)}ms mean  max ${fmtMs(tick.maxMs)}  n=${tick.count}  >20ms=${tick.over20ms}`,
    `tickIntervalMs  ${formatIntHistogram(s.tickIntervalMs)}`,
    `captureTicks ar  ${formatIntHistogram(s.captureTicks.ar)}  (${phaseLockReading(s.captureTicks.ar)})`,
    `captureTicks 3d ${formatIntHistogram(s.captureTicks['3d'])}  (${phaseLockReading(s.captureTicks['3d'])})`,
    `captureTicks 2d ${formatIntHistogram(s.captureTicks['2d'])}  (${phaseLockReading(s.captureTicks['2d'])})`,
    `skips/s  ${formatSkipLine(s.skips)}`,
    `overhead ${fmtMs(s.instrumentOverhead.meanMs)} ms/sample  max ${fmtMs(s.instrumentOverhead.maxMs)}`,
  ]
  for (const name of NDI_STAGE_NAMES) {
    const st = s.stages[name]
    lines.push(
      `${name}  ${fmtMs(st.meanMs)}/${fmtMs(st.maxMs)}  n=${st.count}`,
    )
  }
  if (s.main) {
    for (const ch of CHANNELS) {
      const c = s.main.channels[ch]
      lines.push(
        `main ${ch}  bgra ${fmtMs(c.rgbaToBgra.meanMs)}/${fmtMs(c.rgbaToBgra.maxMs)}` +
          `  video ${fmtMs(c.video.meanMs)}/${fmtMs(c.video.maxMs)}  dropBusy=${c.dropBusy}`,
      )
    }
  }
  return lines.join('\n')
}

export function formatNdiStageDump(): string {
  installDumpHook()
  const now = performance.now()
  rotateHz(now)
  const tick = tickIntervalSnapshot(now)
  const capture = captureTickSnapshot(now)
  const overhead =
    overheadCount > 0
      ? { meanMs: overheadSum / overheadCount, maxMs: overheadMax, count: overheadCount }
      : { meanMs: 0, maxMs: 0, count: 0 }

  const lines = [
    '=== NDI stage timing dump (DSP-PRF-20260829-01) ===',
    `window ~${DUMP_WINDOW_MS / 1000}s  ticks=${tick.count}  mean=${fmtMs(tick.meanMs)}ms  max=${fmtMs(tick.maxMs)}ms  >20ms=${tick.over20ms}`,
    `tickIntervalMs  ${formatIntHistogram(tick.buckets)}`,
    `captureTicks ar  ${formatIntHistogram(capture.ar)}  ${phaseLockReading(capture.ar)}`,
    `captureTicks 3d ${formatIntHistogram(capture['3d'])}  ${phaseLockReading(capture['3d'])}`,
    `captureTicks 2d ${formatIntHistogram(capture['2d'])}  ${phaseLockReading(capture['2d'])}`,
    `fallbacks  syncReadback=${syncReadback}  sync2dCapture=${sync2dCapture}`,
    `instrument overhead  mean ${fmtMs(overhead.meanMs)} ms/sample  max ${fmtMs(overhead.maxMs)}  n=${overhead.count}  nowCost=${fmtMs(nowCostMs)}ms`,
    formatMain(mainSummary),
  ]

  if (hzRing.length === 0) {
    const live: NdiStageSnapshot = {
      windowMs: 0,
      stages: stageSnapshot(),
      skips: cloneSkips(),
      captureTicks: capture,
      tickIntervalMs: tick.buckets,
      tickInterval: {
        count: tick.count,
        meanMs: tick.meanMs,
        maxMs: tick.maxMs,
        over20ms: tick.over20ms,
      },
      fallbacks: { syncReadback, sync2dCapture },
      main: mainSummary,
      instrumentOverhead: overhead,
    }
    lines.push('--- current 1s (ring empty) ---')
    lines.push(formatStageBlock(live))
    lines.push(`skips  ${formatSkipLine(live.skips)}`)
  } else {
    hzRing.forEach((row, i) => {
      lines.push(`--- 1s snapshot ${i + 1}/${hzRing.length} (${fmtMs(row.windowMs)}ms) ---`)
      lines.push(formatStageBlock(row))
      lines.push(`skips  ${formatSkipLine(row.skips)}`)
    })
  }

  lines.push('=== end dump ===')
  return lines.join('\n')
}

export function fallbackHudFlags(): {
  syncReadback: boolean
  sync2dCapture: boolean
} {
  return { syncReadback, sync2dCapture }
}

/** Test helper — clears accumulators, histograms, and fallback flags. */
export function resetNdiStageTiming(): void {
  resetStagesAndSkips()
  hzRing.length = 0
  lastHzMs = 0
  tickSeq = 0
  lastTickMs = null
  lastCaptureTick = { ar: null, '3d': null, '2d': null }
  tickOpen = false
  tickStartMs = 0
  tickIntervals.length = 0
  captures.length = 0
  syncReadback = false
  sync2dCapture = false
  mainSummary = null
  overheadSum = 0
  overheadCount = 0
  overheadMax = 0
}

declare global {
  interface Window {
    __perfDump?: () => string
  }
}
