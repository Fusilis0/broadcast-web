import type { StreamAnchorMessage } from './types.ts'

/** MPEG-TS PTS modulus (33-bit). Do not use JS bitwise `&` — ToInt32 truncates. */
export const PTS_MOD_33 = 2 ** 33
const PTS_HALF_33 = 2 ** 32
const TICKS_PER_MS = 90

const PACING_KINDS = new Set(['dji', 'periodic', 'gopro'])

export const DEFAULT_WINDOW_MS = 30_000
export const DEFAULT_EXTRAPOLATE_MAX_MS = 2_000
export const DEFAULT_MAX_PACING_COUNT = 64
export const DEFAULT_MAX_FRAME_COUNT = 512
/** Residual gate after the first OLS pass. 1 s still rejects “seconds off”; see module doc. */
export const DEFAULT_OUTLIER_RESIDUAL_MS = 1_000
export const DEFAULT_CLOCK_STEP_MS = 1_000
/**
 * Healthy PTS→NTP slope is ~1 (ms NTP per ms media). Flat/drifting fits from
 * the live lock mapped tens of seconds of PTS to ~0 ms NTP — reject those.
 */
export const MIN_HEALTHY_SLOPE = 0.5
export const MAX_HEALTHY_SLOPE = 2.0

export type PtsNtpMode = 'interpolated' | 'extrapolated' | 'unavailable'

export type PtsNtpResult = {
  ntpMs: number | null
  mode: PtsNtpMode
  extrapolatedByMs: number
}

export type PtsNtpRejectedCounts = {
  ntpUnsynced: number
  ntpNotFinite: number
  ptsUnusable: number
  unknownKind: number
  wrongStream: number
  clockStep: number
}

export type PtsNtpHealth = {
  pacingCount: number
  frameCount: number
  slope: number | null
  lastAnchorNtpMs: number | null
  lastAnchorAgeMs?: number
  /** 33-bit PES of the last pacing sample — compare with presented PTS. */
  lastPacingPts90k: number | null
  rejected: PtsNtpRejectedCounts
  residualMs: number | null
}

export type PtsNtpMapOptions = {
  streamId?: string
  windowMs?: number
  maxPacingCount?: number
  maxFrameCount?: number
  extrapolateMaxMs?: number
  outlierResidualMs?: number
  clockStepMs?: number
  /** Liveness only (`health().lastAnchorAgeMs`). Matching never uses the PC clock. */
  nowMs?: () => number
}

export type PtsNtpMap = {
  addAnchor(anchor: StreamAnchorMessage): void
  toNtp(pts90k: number): PtsNtpResult
  health(): PtsNtpHealth
  reset(): void
  dispose(): void
}

type Sample = {
  ptsUnwrapped: number
  ntpMs: number
}

type LineFit = {
  slope: number
  intercept: number
}

const registry = new Map<string, PtsNtpMap>()

function emptyRejected(): PtsNtpRejectedCounts {
  return {
    ntpUnsynced: 0,
    ntpNotFinite: 0,
    ptsUnusable: 0,
    unknownKind: 0,
    wrongStream: 0,
    clockStep: 0,
  }
}

/** Unsigned 33-bit PTS. JS `&` is 32-bit; use modulo. */
export function maskPts33(pts: number): number {
  const m = pts % PTS_MOD_33
  return m < 0 ? m + PTS_MOD_33 : m
}

/**
 * Shortest signed 33-bit difference `to - from` (ntp-matching.md §4.a, JS-safe).
 * Range (−2^32, 2^32].
 */
export function ptsDiff33(from: number, to: number): number {
  let d = maskPts33(to - from)
  if (d >= PTS_HALF_33) d -= PTS_MOD_33
  return d
}

function pickPts(anchor: StreamAnchorMessage): number | null {
  if (anchor.pts_90khz != null && Number.isFinite(anchor.pts_90khz)) {
    return anchor.pts_90khz
  }
  if (anchor.pts_basis_90khz != null && Number.isFinite(anchor.pts_basis_90khz)) {
    return anchor.pts_basis_90khz
  }
  return null
}

function fitLine(samples: Sample[]): LineFit | null {
  if (samples.length < 2) return null
  const n = samples.length
  let sumX = 0
  let sumY = 0
  const xs = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const x = samples[i]!.ptsUnwrapped / TICKS_PER_MS
    xs[i] = x
    sumX += x
    sumY += samples[i]!.ntpMs
  }
  const meanX = sumX / n
  const meanY = sumY / n
  let xx = 0
  let xy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    xx += dx * dx
    xy += dx * (samples[i]!.ntpMs - meanY)
  }
  if (!(xx > 0) || !Number.isFinite(xx) || !Number.isFinite(xy)) return null
  const slope = xy / xx
  if (!Number.isFinite(slope)) return null
  const intercept = meanY - slope * meanX
  if (!Number.isFinite(intercept)) return null
  return { slope, intercept }
}

function evalFit(fit: LineFit, ptsUnwrapped: number): number {
  return fit.intercept + fit.slope * (ptsUnwrapped / TICKS_PER_MS)
}

function robustFit(samples: Sample[], outlierResidualMs: number): LineFit | null {
  const first = fitLine(samples)
  if (!first) return null
  if (samples.length < 3) return first
  const inliers = samples.filter(
    (s) => Math.abs(evalFit(first, s.ptsUnwrapped) - s.ntpMs) <= outlierResidualMs,
  )
  if (inliers.length < 2 || inliers.length === samples.length) return first
  return fitLine(inliers) ?? first
}

function meanAbsResidual(fit: LineFit, samples: Sample[]): number | null {
  if (samples.length === 0) return null
  let sum = 0
  for (const s of samples) {
    sum += Math.abs(evalFit(fit, s.ptsUnwrapped) - s.ntpMs)
  }
  return sum / samples.length
}

function trimSeries(series: Sample[], newestNtp: number, windowMs: number, maxCount: number): Sample[] {
  let next = series.filter((s) => newestNtp - s.ntpMs <= windowMs)
  if (next.length > maxCount) next = next.slice(next.length - maxCount)
  return next
}

const UNAVAILABLE: PtsNtpResult = { ntpMs: null, mode: 'unavailable', extrapolatedByMs: 0 }

/**
 * Per-`stream_id` PTS→NTP map: sliding-window robust linear fit over the
 * pacing series (`dji` / `periodic` / `gopro`). `kind:frame` is a truth
 * series (health residual) when a real pacing fit exists (≥2 samples). If
 * pacing has fewer than 2 samples, `kind:frame` is the fit series (same OLS,
 * unwrap, 2 s extra) so a live DJI that only emits per-AU frames can still
 * map PTS→NTP.
 *
 * Departure from ntp-matching.md §4.a: live frames are always newer than the
 * last ~1 Hz periodic anchor, so we extrapolate the fit (bounded) instead of
 * rejecting after the last sample. See ar-video-underlay-ntp-sync.md §4.2.
 */
export function createPtsNtpMap(options: PtsNtpMapOptions = {}): PtsNtpMap {
  const streamId = options.streamId
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const maxPacingCount = options.maxPacingCount ?? DEFAULT_MAX_PACING_COUNT
  const maxFrameCount = options.maxFrameCount ?? DEFAULT_MAX_FRAME_COUNT
  const extrapolateMaxMs = options.extrapolateMaxMs ?? DEFAULT_EXTRAPOLATE_MAX_MS
  const outlierResidualMs = options.outlierResidualMs ?? DEFAULT_OUTLIER_RESIDUAL_MS
  const clockStepMs = options.clockStepMs ?? DEFAULT_CLOCK_STEP_MS
  const nowMs = options.nowMs ?? Date.now

  let pacing: Sample[] = []
  let frames: Sample[] = []
  let fit: LineFit | null = null
  let rejected = emptyRejected()
  let lastWrappedPts: number | null = null
  let lastUnwrappedPts = 0
  let lastPacingNtpMs: number | null = null
  let lastPacingPts90k: number | null = null
  let lastReceivedAtMs: number | null = null

  function unwrapPts(masked: number): number {
    if (lastWrappedPts === null) return masked
    return lastUnwrappedPts + ptsDiff33(lastWrappedPts, masked)
  }

  function notePts(masked: number, unwrapped: number): void {
    if (lastWrappedPts === null || unwrapped >= lastUnwrappedPts) {
      lastWrappedPts = masked
      lastUnwrappedPts = unwrapped
    }
  }

  /**
   * OLS input: real pacing when it has ≥2 samples, else `kind:frame` when
   * that series has ≥2. Frames stay out of the `pacing` array.
   */
  function fitSeries(): Sample[] {
    if (pacing.length >= 2) return pacing
    if (frames.length >= 2) return frames
    return pacing
  }

  function rebuildFit(): void {
    fit = robustFit(fitSeries(), outlierResidualMs)
  }

  function trimAndFit(): void {
    const newestPacing = pacing.length > 0 ? pacing[pacing.length - 1]!.ntpMs : null
    const newestFrame = frames.length > 0 ? frames[frames.length - 1]!.ntpMs : null
    const newest =
      newestPacing !== null && newestFrame !== null
        ? Math.max(newestPacing, newestFrame)
        : (newestPacing ?? newestFrame)
    if (newest !== null) {
      pacing = trimSeries(pacing, newest, windowMs, maxPacingCount)
      frames = trimSeries(frames, newest, windowMs, maxFrameCount)
    }
    rebuildFit()
  }

  function dropWindow(): void {
    pacing = []
    frames = []
    fit = null
    lastPacingNtpMs = null
    lastPacingPts90k = null
    rejected.clockStep += 1
  }

  const handle: PtsNtpMap = {
    addAnchor(anchor: StreamAnchorMessage): void {
      if (streamId !== undefined && anchor.stream_id !== streamId) {
        rejected.wrongStream += 1
        return
      }

      const kind = typeof anchor.kind === 'string' ? anchor.kind : ''
      const isPacing = PACING_KINDS.has(kind)
      const isFrame = kind === 'frame'
      if (!isPacing && !isFrame) {
        rejected.unknownKind += 1
        return
      }

      if (anchor.ntp_synced === false) {
        rejected.ntpUnsynced += 1
        return
      }

      const ntp = anchor.ntp_capture_ms
      if (!Number.isFinite(ntp)) {
        rejected.ntpNotFinite += 1
        return
      }

      const rawPts = pickPts(anchor)
      if (rawPts === null) {
        rejected.ptsUnusable += 1
        return
      }

      const masked = maskPts33(rawPts)
      const unwrapped = unwrapPts(masked)
      const frameFillsFit = isFrame && pacing.length < 2

      // Clock step is NTP going backwards vs the fit (or last pacing NTP
      // before a line exists). PTS unwrap is kept — the muxer did not wrap.
      // Frame-only live path uses the same gate while frames are the fit.
      if (isPacing || frameFillsFit) {
        const predicted = fit ? evalFit(fit, unwrapped) : lastPacingNtpMs
        if (predicted !== null && predicted - ntp > clockStepMs) {
          dropWindow()
        }
      }

      notePts(masked, unwrapped)
      const stored: Sample = { ptsUnwrapped: unwrapped, ntpMs: ntp }

      if (isPacing) {
        pacing.push(stored)
        lastPacingNtpMs = ntp
        lastPacingPts90k = masked
        lastReceivedAtMs = nowMs()
        trimAndFit()
      } else {
        frames.push(stored)
        lastReceivedAtMs = nowMs()
        if (pacing.length < 2) {
          lastPacingNtpMs = ntp
          lastPacingPts90k = masked
        }
        trimAndFit()
      }
    },

    toNtp(pts90k: number): PtsNtpResult {
      const series = fitSeries()
      if (!Number.isFinite(pts90k) || !fit || series.length < 2) return UNAVAILABLE

      if (
        fit.slope < MIN_HEALTHY_SLOPE ||
        fit.slope > MAX_HEALTHY_SLOPE
      ) {
        return UNAVAILABLE
      }

      const queryUnwrapped = unwrapPts(maskPts33(pts90k))
      let minPts = series[0]!.ptsUnwrapped
      let maxPts = series[0]!.ptsUnwrapped
      for (let i = 1; i < series.length; i++) {
        const p = series[i]!.ptsUnwrapped
        if (p < minPts) minPts = p
        if (p > maxPts) maxPts = p
      }

      if (queryUnwrapped < minPts) return UNAVAILABLE

      const ntpMs = evalFit(fit, queryUnwrapped)
      if (!Number.isFinite(ntpMs)) return UNAVAILABLE

      if (queryUnwrapped <= maxPts) {
        return { ntpMs, mode: 'interpolated', extrapolatedByMs: 0 }
      }

      const extrapolatedByMs = (queryUnwrapped - maxPts) / TICKS_PER_MS
      if (extrapolatedByMs > extrapolateMaxMs) {
        return { ntpMs: null, mode: 'unavailable', extrapolatedByMs }
      }
      return { ntpMs, mode: 'extrapolated', extrapolatedByMs }
    },

    health(): PtsNtpHealth {
      const age =
        lastReceivedAtMs !== null ? Math.max(0, nowMs() - lastReceivedAtMs) : undefined
      return {
        pacingCount: fitSeries().length,
        frameCount: frames.length,
        slope: fit ? fit.slope : null,
        lastAnchorNtpMs: lastPacingNtpMs,
        lastPacingPts90k,
        ...(age !== undefined ? { lastAnchorAgeMs: age } : {}),
        rejected: { ...rejected },
        residualMs: fit ? meanAbsResidual(fit, frames) : null,
      }
    },

    reset(): void {
      pacing = []
      frames = []
      fit = null
      rejected = emptyRejected()
      lastWrappedPts = null
      lastUnwrappedPts = 0
      lastPacingNtpMs = null
      lastPacingPts90k = null
      lastReceivedAtMs = null
    },

    dispose(): void {
      handle.reset()
      if (streamId !== undefined && registry.get(streamId) === handle) {
        registry.delete(streamId)
      }
    },
  }

  return handle
}

export function getPtsNtpMap(streamId: string, options?: PtsNtpMapOptions): PtsNtpMap {
  let map = registry.get(streamId)
  if (!map) {
    map = createPtsNtpMap({ ...options, streamId })
    registry.set(streamId, map)
  }
  return map
}

export function clearPtsNtpMaps(): void {
  for (const map of registry.values()) {
    map.reset()
  }
  registry.clear()
}
