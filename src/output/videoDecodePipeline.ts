/**
 * Per-stream WebCodecs decode + presentation queue (Phase 17.2).
 *
 * PTS round-trip: demuxed 33-bit PES is unwrapped (TEL-01 convention) only to
 * set `EncodedVideoChunk.timestamp` (µs). Queued / presented `pts90k` is
 * `maskPts33` PES so LUT `toNtp` unwraps once (anchors vs decode start).
 * WebCodecs `frame.timestamp` is only a map key (nearest within
 * `PTS_TIMESTAMP_MATCH_US`) — never a 90 kHz PTS.
 * Annex-B config has **no** `description`.
 *
 * Hybrid present (pace on): every `present()` consumes queued `VideoFrame`s
 * via `onConsumeFrame` (must force GPU upload, e.g. `initTexture`), then
 * closes immediately. Retained PTS metadata drives pick; the wall-clock gate
 * only swaps the displayed ring slot. Overlay samples `toNtp(shownPts)` at
 * that swap, never newest at consume time.
 *
 * VideoDecoder is injectable — vitest-node has no WebCodecs.
 */

import { maskPts33, ptsDiff33 } from '../telemetry/ptsNtpMap.ts'
import {
  logDecodeErrorEvent,
  resetDecodeErrorDiagLossBaseline,
  summarizeNalTypes,
} from './diagDecodeError.ts'
import {
  type DemuxedAccessUnit,
  type ParamSetCache,
  type TsDemuxer,
  type VideoCodec,
  auHasParamSets,
  createPtsUnwrapper,
  createTsDemuxer,
  emptyParamSetCache,
  prependParamSets,
  pts90kToTimestampUs,
  resolveCodecString,
  updateParamSetCache,
} from './tsDemux.ts'

export const MIN_PRESENT_LATENCY_MS = 100
export const MAX_PRESENT_LATENCY_MS = 400
export const DEFAULT_QUEUE_CAP = 24
/**
 * When |NTP latency − PTS latency| exceeds max(this, ratio×PTS gap), trust PTS.
 * Live lock: tens-of-seconds PTS gap mapped to ~0 ms NTP (flat LUT fit).
 */
export const LATENCY_NTP_AGREE_MS = 50
export const LATENCY_NTP_AGREE_RATIO = 0.25
/**
 * Wall-clock pace inside `present()` (Option A). Invoked only on `studio:tick`.
 * Slack is derived from measured tick intervals (mean 17.41 ms, std 11.39 ms):
 * threshold = mean+1σ = 28.80 ms; slack = 1000/30 − 28.80 = 4.53 → 5 ms.
 */
export const PRESENT_PACE_FPS = 30
export const PRESENT_PACE_PERIOD_MS = 1000 / PRESENT_PACE_FPS
export const PRESENT_PACE_SLACK_MS = 5
/**
 * Floor between unique display swaps. Stops 0 ms double-ticks and leftover
 * phase after a long tick from emitting a &lt;20 ms unique interval.
 */
export const PRESENT_PACE_MIN_INTERVAL_MS = 20
/** Max |WebCodecs timestamp − stored key| (µs) still treated as the same AU. */
export const PTS_TIMESTAMP_MATCH_US = 32

export const HEVC_UNSUPPORTED_MESSAGE =
  'HEVC not supported on this GPU/driver — this studio PC cannot decode the DJI SRT'

export const HEVC_FFMPEG_H264_NOTE =
  'WebCodecs HEVC unavailable — ffmpeg decoding HEVC→H.264 (same as OBS, no Store pack)'

export function isHevcUnsupportedMessage(message: string): boolean {
  return message.startsWith('HEVC not supported')
}

export type PresentationMode = 'adaptive' | 'fixed'

export type VideoFrameLike = {
  timestamp: number
  codedWidth: number
  codedHeight: number
  displayWidth?: number
  displayHeight?: number
  close(): void
}

export type EncodedChunkLike = {
  type: 'key' | 'delta'
  timestamp: number
  data: BufferSource
}

export type DecoderConfigLike = {
  codec: string
  hardwareAcceleration?: string
  optimizeForLatency?: boolean
}

export type VideoDecoderLike = {
  configure(config: DecoderConfigLike): void
  decode(chunk: EncodedChunkLike): void
  reset(): void
  close(): void
  state: 'unconfigured' | 'configured' | 'closed'
}

export type VideoDecoderFactory = {
  isConfigSupported(
    config: DecoderConfigLike,
  ): Promise<{ supported: boolean }>
  create(init: {
    output: (frame: VideoFrameLike) => void
    error: (err: unknown) => void
  }): VideoDecoderLike
}

export type QueuedDecodeFrame = {
  frame: VideoFrameLike
  /** Demux 33-bit PES (`maskPts33`), or null if the timestamp map missed. */
  pts90k: number | null
  timestampUs: number
}

export type PresentationReason =
  | 'adaptive'
  | 'fixed'
  | 'stall-pin'
  | 'lut-miss-live'
  | 'min-clamp'
  | 'max-clamp'
  | 'repeat'
  /** Pick wanted a new PTS; wall-clock pace refused the swap this tick. */
  | 'pace-hold'

export type PresentationPick = {
  pts90k: number
  latencyMs: number
  degraded: boolean
  reason: PresentationReason
}

export type PresentationPolicyInput = {
  frames: readonly { pts90k: number }[]
  toNtp: (pts90k: number) => number | null
  newestPoseNtp: number | null
  mode: PresentationMode
  fixedLatencyMs?: number
  minLatencyMs?: number
  maxLatencyMs?: number
  /**
   * Currently displayed PTS (may be unshifted into `frames[0]`). When set,
   * clamp fallbacks must not freeze on it if any candidate is strictly ahead.
   */
  shownPts90k?: number | null
}

export type DecodeCounters = {
  codec: VideoCodec | null
  framesDecoded: number
  framesDropped: number
  queueDepth: number
  outstandingFrames: number
  presentedPts90k: number | null
  presentedNtpMs: number | null
  latencyMs: number | null
  /** PTS copies retained for pick after VideoFrame consume/close. */
  retainedDepth: number
  degraded: boolean
  reason: PresentationReason | null
  waitingForKeyframe: boolean
  decodeError: string | null
  /** MPEG-TS bytes pushed into the demuxer. */
  bytesPushed: number
  /** Video access units the demuxer emitted. */
  accessUnits: number
}

export type VideoDecodePipelineOptions = {
  decoderFactory?: VideoDecoderFactory
  toNtp?: (pts90k: number) => number | null
  getNewestPoseNtp?: () => number | null
  mode?: PresentationMode
  fixedLatencyMs?: number
  minLatencyMs?: number
  maxLatencyMs?: number
  queueCap?: number
  onOpsError?: (message: string) => void
  /**
   * Hybrid consume + paced display. Default **on**.
   * `?presentPace=off` disables via the stream manager.
   */
  presentPace?: boolean
  nowMs?: () => number
  pacePeriodMs?: number
  paceSlackMs?: number
  /**
   * Hybrid consume: called for every queued `VideoFrame` at the start of
   * `present()`, while the frame is still open. Must finish a real GPU
   * upload (e.g. `WebGLRenderer.initTexture`) before returning — the
   * pipeline closes the frame immediately after this callback.
   */
  onConsumeFrame?: (
    frame: VideoFrameLike,
    pts90k: number | null,
    timestampUs: number,
  ) => void
  /**
   * Latest SRT/IPC ingest proxies for decode-error correlation (item a).
   * `srtReader` does not expose libsrt packet-loss counters — callers pass
   * bitrate / ipcDrop / ffmpeg drop_frames instead.
   */
  getIngestDiag?: () => {
    bitrateKbps: number | null
    ipcDropCount: number | null
    ipcDropPerSec: number | null
    ffmpegDropFrames: string | null
  } | null
}

/**
 * Default **on**. `?presentPace=off` (or 0/false/no) disables hybrid pace.
 */
export function parsePresentPace(search: string | URLSearchParams): boolean {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const raw = (params.get('presentPace') ?? '').trim().toLowerCase()
  if (raw === 'off' || raw === '0' || raw === 'false' || raw === 'no') {
    return false
  }
  return true
}

function newestPts90kOf(frames: readonly { pts90k: number }[]): number {
  let newest = frames[0]!.pts90k
  for (const f of frames) {
    if (ptsDiff33(newest, f.pts90k) > 0) newest = f.pts90k
  }
  return newest
}

function oldestPts90kOf(frames: readonly { pts90k: number }[]): number {
  let oldest = frames[0]!.pts90k
  for (const f of frames) {
    if (ptsDiff33(f.pts90k, oldest) > 0) oldest = f.pts90k
  }
  return oldest
}

export type PresentResult = {
  frame: VideoFrameLike
  pts90k: number
  timestampUs: number
  pick: PresentationPick
}

export type VideoDecodePipeline = {
  pushBytes(chunk: Uint8Array): void
  pushAu(au: DemuxedAccessUnit): void
  present(): PresentResult | null
  setMode(mode: PresentationMode, fixedLatencyMs?: number): void
  getCounters(): DecodeCounters
  getOutstandingFrames(): number
  demux(): TsDemuxer
  /** Wait for an in-flight `isConfigSupported` probe (tests). */
  ready(): Promise<void>
  /**
   * After WebCodecs HEVC fails, drop leftover HEVC AUs and wait for H.264
   * (ffmpeg transcode). Recreates demux so a new TS can be parsed.
   */
  resetForH264Fallback(): void
  dispose(): void
}

type NativeVideoDecoderCtor = {
  isConfigSupported(config: DecoderConfigLike): Promise<{ supported: boolean }>
  new (init: {
    output: (frame: VideoFrameLike) => void
    error: (err: unknown) => void
  }): VideoDecoderLike & {
    decode(chunk: unknown): void
  }
}

export function createNativeDecoderFactory(): VideoDecoderFactory | null {
  const Ctor = (globalThis as unknown as { VideoDecoder?: NativeVideoDecoderCtor })
    .VideoDecoder
  if (typeof Ctor !== 'function') return null
  const Encoded = (
    globalThis as unknown as {
      EncodedVideoChunk?: new (init: EncodedChunkLike) => unknown
    }
  ).EncodedVideoChunk
  return {
    isConfigSupported: (config) => Ctor.isConfigSupported(config),
    create(init) {
      const decoder = new Ctor({
        output: init.output,
        error: init.error,
      })
      return {
        get state() {
          return decoder.state
        },
        configure(config) {
          decoder.configure(config)
        },
        decode(chunk) {
          if (typeof Encoded === 'function') {
            decoder.decode(new Encoded(chunk))
          } else {
            decoder.decode(chunk)
          }
        },
        reset() {
          decoder.reset()
        },
        close() {
          if (decoder.state !== 'closed') decoder.close()
        },
      }
    },
  }
}

/**
 * Recover muxer PTS from the chunk-timestamp map. Exact key first; else
 * nearest key within `epsilonUs`. Does not treat the WebCodecs µs value
 * as a 90 kHz PTS. Consumes the matched key so a later frame cannot reuse it.
 */
export function lookupPts90k(
  ptsByTimestamp: Map<number, number>,
  timestampUs: number,
  epsilonUs: number = PTS_TIMESTAMP_MATCH_US,
): number | null {
  const exact = ptsByTimestamp.get(timestampUs)
  if (exact !== undefined) {
    ptsByTimestamp.delete(timestampUs)
    return exact
  }
  let bestKey: number | undefined
  let bestPts: number | undefined
  let bestDist = Infinity
  for (const [key, pts] of ptsByTimestamp) {
    const dist = Math.abs(key - timestampUs)
    if (dist <= epsilonUs && dist < bestDist) {
      bestDist = dist
      bestPts = pts
      bestKey = key
    }
  }
  if (bestKey === undefined || bestPts === undefined) return null
  ptsByTimestamp.delete(bestKey)
  return bestPts
}

/** Media-time gap newest − pts (ms), 33-bit safe. */
export function ptsLatencyMs(pts90k: number, newestPts90k: number): number {
  return ptsDiff33(pts90k, newestPts90k) / 90
}

/**
 * Prefer NTP latency when it agrees with the PTS gap; otherwise PTS wins.
 * Prevents flat/drifting LUT fits from reporting L≈0 while retained is ahead.
 */
export function latencyMsOf(
  pts90k: number,
  newestPts90k: number,
  toNtp: (pts: number) => number | null,
): number {
  const ptsL = ptsLatencyMs(pts90k, newestPts90k)
  const ntp = toNtp(pts90k)
  const newestNtp = toNtp(newestPts90k)
  if (ntp === null || newestNtp === null) return ptsL
  const ntpL = newestNtp - ntp
  const agree = Math.max(LATENCY_NTP_AGREE_MS, LATENCY_NTP_AGREE_RATIO * Math.abs(ptsL))
  if (Math.abs(ntpL - ptsL) > agree) return ptsL
  return ntpL
}

function oldestAheadOf(
  frames: readonly { pts90k: number }[],
  shownPts90k: number,
): { pts90k: number } | null {
  let best: { pts90k: number } | null = null
  let bestDelta = Infinity
  for (const f of frames) {
    const d = ptsDiff33(shownPts90k, f.pts90k)
    if (d > 0 && d < bestDelta) {
      best = f
      bestDelta = d
    }
  }
  return best
}

function frameAtLatency(
  frames: readonly { pts90k: number }[],
  newestPts90k: number,
  targetMs: number,
  toNtp: (pts: number) => number | null,
  avoidPts90k?: number | null,
): { pts90k: number } {
  let best: { pts90k: number } | null = null
  let bestL = Infinity
  for (const f of frames) {
    const L = latencyMsOf(f.pts90k, newestPts90k, toNtp)
    if (L + 1e-9 >= targetMs && L < bestL) {
      best = f
      bestL = L
    }
  }
  if (best) return best
  if (avoidPts90k != null) {
    const ahead = oldestAheadOf(frames, avoidPts90k)
    if (ahead) return ahead
  }
  return frames[0]!
}

/**
 * Adaptive (L4): newest pose-covered frame, clamped 100–400 ms behind newest.
 * Empty LUT (`toNtp` all null) presents the newest decoded frame (`lut-miss-live`)
 * so the plate keeps moving. Telemetry stall (`newestPoseNtp === null`) with a
 * working LUT still pins at 400 ms and flags degraded.
 *
 * Latency uses PTS when NTP disagrees (flat/drifting fit). Clamp fallbacks never
 * stick on `shownPts90k` while a strictly newer candidate exists.
 */
export function pickPresentationPts(
  input: PresentationPolicyInput,
): PresentationPick | null {
  const frames = input.frames
  if (frames.length === 0) return null
  const newestPts90k = newestPts90kOf(frames)
  const avoid = input.shownPts90k ?? null
  const toNtp = input.toNtp
  const minL = input.minLatencyMs ?? MIN_PRESENT_LATENCY_MS
  const maxL = input.maxLatencyMs ?? MAX_PRESENT_LATENCY_MS

  const finish = (
    pts90k: number,
    reason: PresentationReason,
    degraded: boolean,
  ): PresentationPick => ({
    pts90k,
    latencyMs: latencyMsOf(pts90k, newestPts90k, toNtp),
    degraded,
    reason,
  })

  const atLatency = (targetMs: number) =>
    frameAtLatency(frames, newestPts90k, targetMs, toNtp, avoid).pts90k

  if (input.mode === 'fixed') {
    const target = Math.min(
      maxL,
      Math.max(minL, input.fixedLatencyMs ?? 200),
    )
    return finish(atLatency(target), 'fixed', false)
  }

  let anyMapped = false
  for (const f of frames) {
    if (toNtp(f.pts90k) !== null) {
      anyMapped = true
      break
    }
  }

  // LUT empty: play newest so motion is obvious (OUT-08). Overlay freeze is TEL.
  if (!anyMapped) {
    return finish(newestPts90k, 'lut-miss-live', true)
  }

  const poseNtp = input.newestPoseNtp
  if (poseNtp === null) {
    return finish(atLatency(maxL), 'stall-pin', true)
  }

  // Among pose-covered frames, keep the newest by PTS (not array order) so a
  // flat NTP fit cannot leave "covered" stuck on an unshifted shown frame.
  let covered: { pts90k: number } | null = null
  for (const f of frames) {
    const ntp = toNtp(f.pts90k)
    if (ntp === null) continue
    if (ntp > poseNtp) continue
    if (
      covered == null ||
      ptsDiff33(covered.pts90k, f.pts90k) > 0
    ) {
      covered = f
    }
  }

  // Pose has not covered any mapped frame: pin at max latency.
  if (covered === null) {
    return finish(atLatency(maxL), 'stall-pin', true)
  }

  const candidate = covered
  const L = latencyMsOf(candidate.pts90k, newestPts90k, toNtp)
  if (L < minL) {
    return finish(atLatency(minL), 'min-clamp', false)
  }
  if (L > maxL) {
    return finish(atLatency(maxL), 'max-clamp', true)
  }
  return finish(candidate.pts90k, 'adaptive', false)
}

/** Catch-up reasons may jump/skip; steady playback must not hole PTS. */
function allowsCatchUpSkip(
  reason: PresentationReason,
  presentPace: boolean,
): boolean {
  if (reason === 'max-clamp' || reason === 'stall-pin') return true
  // LUT-empty + pace: play in order. Jump-to-newest re-triggers the L≈0 freeze.
  if (reason === 'lut-miss-live') return !presentPace
  return false
}

/**
 * When paced present would stick on newest (or has no shown yet) while a
 * backlog exists, land on the adaptive min-latency frame — not the oldest.
 * Unstick-to-oldest left connect bursts parked at ~queueCap/30 s latency
 * forever once produce≈unique rate (item a→jitter follow-up).
 */
export function unstickPaceTargetPts(
  frames: readonly { pts90k: number }[],
  newestPts90k: number,
  toNtp: (pts: number) => number | null,
  minLatencyMs: number,
): number {
  return frameAtLatency(frames, newestPts90k, minLatencyMs, toNtp, null).pts90k
}

function closeFrame(frame: VideoFrameLike, closed: WeakSet<object>): void {
  if (closed.has(frame)) return
  closed.add(frame)
  frame.close()
}

export function createVideoDecodePipeline(
  options: VideoDecodePipelineOptions = {},
): VideoDecodePipeline {
  const factory = options.decoderFactory ?? createNativeDecoderFactory()
  let demux = createTsDemuxer()
  let unwrap = createPtsUnwrapper()
  let paramCache: ParamSetCache = emptyParamSetCache()
  const closedFrames = new WeakSet<object>()
  const ptsByTimestamp = new Map<number, number>()

  let mode: PresentationMode = options.mode ?? 'adaptive'
  let fixedLatencyMs = options.fixedLatencyMs ?? 200
  const minLatencyMs = options.minLatencyMs ?? MIN_PRESENT_LATENCY_MS
  const maxLatencyMs = options.maxLatencyMs ?? MAX_PRESENT_LATENCY_MS
  const queueCap = options.queueCap ?? DEFAULT_QUEUE_CAP
  const presentPace = options.presentPace !== false
  const nowMs = options.nowMs ?? (() => performance.now())
  const pacePeriodMs = options.pacePeriodMs ?? PRESENT_PACE_PERIOD_MS
  const paceSlackMs = options.paceSlackMs ?? PRESENT_PACE_SLACK_MS
  const paceThresholdMs = pacePeriodMs - paceSlackMs

  type RetainedPts = {
    pts90k: number
    timestampUs: number
    codedWidth: number
    codedHeight: number
    displayWidth?: number
    displayHeight?: number
  }

  const queue: QueuedDecodeFrame[] = []
  const retained: RetainedPts[] = []
  let presented: QueuedDecodeFrame | null = null
  let presentedMeta: RetainedPts | null = null
  let prevPresented: QueuedDecodeFrame | null = null
  let lastPick: PresentationPick | null = null
  let lastAdvanceWallMs: number | null = null
  let lastTickWallMs: number | null = null
  let pacePhaseMs = 0
  let outstanding = 0
  let framesDecoded = 0
  let framesDropped = 0
  let bytesPushed = 0
  let accessUnits = 0
  let codec: VideoCodec | null = null
  let decodeError: string | null = null
  let waitingForKeyframe = true
  let decoder: VideoDecoderLike | null = null
  let probing: Promise<void> | null = null
  let pendingAus: DemuxedAccessUnit[] = []
  let disposed = false
  let dropHevcUntilH264 = false
  /** AUs fed to WebCodecs since the last keyframe feed (GOP position). */
  let framesSinceKeyframe = 0
  let lastFedPts90k: number | null = null
  let lastFedAu: {
    keyframe: boolean
    pts90k: number
    byteLength: number
    nalTypes: number[]
    ptsGap90k: number | null
  } | null = null

  function toNtp(pts90k: number): number | null {
    return options.toNtp ? options.toNtp(pts90k) : null
  }

  function bumpOutstanding(delta: number): void {
    outstanding += delta
    if (outstanding < 0) outstanding = 0
  }

  function dropQueued(frame: QueuedDecodeFrame): void {
    closeFrame(frame.frame, closedFrames)
    bumpOutstanding(-1)
    framesDropped += 1
    ptsByTimestamp.delete(frame.timestampUs)
  }

  function trimQueue(): void {
    while (queue.length > queueCap) {
      const old = queue.shift()
      if (old) dropQueued(old)
    }
  }

  function viewOf(meta: RetainedPts): VideoFrameLike {
    return {
      timestamp: meta.timestampUs,
      codedWidth: meta.codedWidth,
      codedHeight: meta.codedHeight,
      displayWidth: meta.displayWidth,
      displayHeight: meta.displayHeight,
      close() {
        /* GPU already holds the copy; VideoFrame closed right after onConsumeFrame. */
      },
    }
  }

  function presentedView(): PresentResult | null {
    if (presentPace) {
      if (!presentedMeta || lastPick == null) return null
      return {
        frame: viewOf(presentedMeta),
        pts90k: presentedMeta.pts90k,
        timestampUs: presentedMeta.timestampUs,
        pick: lastPick,
      }
    }
    if (!presented || presented.pts90k === null || lastPick == null) return null
    return {
      frame: presented.frame,
      pts90k: presented.pts90k,
      timestampUs: presented.timestampUs,
      pick: lastPick,
    }
  }

  function trimRetained(): void {
    while (retained.length > queueCap) {
      const shown = presentedMeta?.pts90k
      const idx = retained.findIndex((r) => r.pts90k !== shown)
      if (idx < 0) break
      retained.splice(idx, 1)
    }
    // Bound by presentation latency (NDI-style depth), not only slot count:
    // keep frames within maxLatency of newest so produce≈unique cannot park
    // shown at ~queueCap/30s after a connect burst.
    if (retained.length === 0) return
    const newest = newestPts90kOf(retained)
    const shown = presentedMeta?.pts90k ?? null
    const keep: RetainedPts[] = []
    for (const r of retained) {
      if (shown != null && r.pts90k === shown) {
        keep.push(r)
        continue
      }
      if (ptsLatencyMs(r.pts90k, newest) <= maxLatencyMs + 1e-9) keep.push(r)
    }
    retained.length = 0
    retained.push(...keep)
  }

  function consumeQueuedArrivals(): void {
    if (!presentPace) return
    for (const q of queue) {
      // Caller must GPU-upload before return (initTexture). Close immediately
      // after — do not wait for a scene draw of an off-screen ring slot.
      options.onConsumeFrame?.(q.frame, q.pts90k, q.timestampUs)
      closeFrame(q.frame, closedFrames)
      bumpOutstanding(-1)
      if (q.pts90k !== null) {
        retained.push({
          pts90k: q.pts90k,
          timestampUs: q.timestampUs,
          codedWidth: q.frame.codedWidth,
          codedHeight: q.frame.codedHeight,
          displayWidth: q.frame.displayWidth,
          displayHeight: q.frame.displayHeight,
        })
      }
    }
    queue.length = 0
    trimRetained()
  }

  function noteTickWall(): number {
    const now = nowMs()
    if (presentPace && lastTickWallMs != null) {
      pacePhaseMs += Math.max(0, now - lastTickWallMs)
    }
    lastTickWallMs = now
    return now
  }

  function allowsDisplaySwap(now: number, rewind: boolean): boolean {
    if (!presentPace || rewind) return true
    if (lastAdvanceWallMs == null) return true
    if (now - lastAdvanceWallMs < PRESENT_PACE_MIN_INTERVAL_MS) return false
    return pacePhaseMs >= paceThresholdMs
  }

  function commitDisplaySwap(now: number): void {
    lastAdvanceWallMs = now
    if (!presentPace) return
    pacePhaseMs -= pacePeriodMs
    if (pacePhaseMs < 0) pacePhaseMs = 0
  }

  function retainAt(pts90k: number): RetainedPts | null {
    for (const r of retained) {
      if (r.pts90k === pts90k) return r
    }
    if (presentedMeta?.pts90k === pts90k) return presentedMeta
    return null
  }

  function onFrame(frame: VideoFrameLike): void {
    if (disposed) {
      closeFrame(frame, closedFrames)
      return
    }
    bumpOutstanding(1)
    framesDecoded += 1
    const timestampUs = frame.timestamp
    const pts90k = lookupPts90k(ptsByTimestamp, timestampUs)
    queue.push({ frame, pts90k, timestampUs })
    trimQueue()
  }

  function onDecoderError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err)
    decodeError = msg
    waitingForKeyframe = true
    options.onOpsError?.(msg)
    const loss = demux.lossStats()
    logDecodeErrorEvent({
      message: msg,
      codec,
      framesSinceKeyframe,
      lastFed: lastFedAu,
      demux: loss,
      ingest: options.getIngestDiag?.() ?? null,
    })
    try {
      decoder?.reset()
    } catch {
      /* already closed */
    }
    // Drop in-flight decode outputs — they are unreliable after reset.
    for (const q of queue) dropQueued(q)
    queue.length = 0
    pendingAus = []
    probing = null
    ptsByTimestamp.clear()
  }

  function ensureDecoder(): VideoDecoderLike | null {
    if (!factory) {
      decodeError =
        'WebCodecs VideoDecoder is not available in this runtime'
      options.onOpsError?.(decodeError)
      return null
    }
    if (decoder && decoder.state !== 'closed') return decoder
    decoder = factory.create({
      output: onFrame,
      error: onDecoderError,
    })
    return decoder
  }

  async function probeAndConfigure(au: DemuxedAccessUnit): Promise<boolean> {
    const dec = ensureDecoder()
    if (!dec || !factory) return false
    const codecStr = resolveCodecString(au.data, au.codec)
    const hwConfig: DecoderConfigLike = {
      codec: codecStr,
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true,
    }
    const annexConfig: DecoderConfigLike = {
      codec: codecStr,
      optimizeForLatency: true,
    }

    if (au.codec === 'hevc') {
      const hw = await factory.isConfigSupported(hwConfig)
      if (hw.supported) {
        if (dec.state === 'closed') return false
        dec.configure(hwConfig)
        decodeError = null
        return true
      }
      // Electron/Chromium often reports prefer-hardware unsupported even when
      // the platform decoder will take the same codec string without the hint.
      const platform = await factory.isConfigSupported(annexConfig)
      if (!platform.supported) {
        decodeError = HEVC_UNSUPPORTED_MESSAGE
        options.onOpsError?.(HEVC_UNSUPPORTED_MESSAGE)
        return false
      }
      if (dec.state === 'closed') return false
      dec.configure(annexConfig)
      decodeError = null
      return true
    }

    const hw = await factory.isConfigSupported(hwConfig)
    const use = hw.supported ? hwConfig : annexConfig
    if (!hw.supported) {
      const sw = await factory.isConfigSupported(annexConfig)
      if (!sw.supported) {
        decodeError = `H.264 codec ${codecStr} is not supported`
        options.onOpsError?.(decodeError)
        return false
      }
    }
    if (dec.state === 'closed') return false
    dec.configure(use)
    decodeError = null
    return true
  }

  function feedAu(au: DemuxedAccessUnit): void {
    if (disposed) return
    accessUnits += 1
    if (dropHevcUntilH264) {
      if (au.codec === 'hevc') return
      dropHevcUntilH264 = false
    }
    if (decodeError === HEVC_UNSUPPORTED_MESSAGE) return
    codec = au.codec
    updateParamSetCache(au.data, au.codec, paramCache)

    if (waitingForKeyframe && !au.keyframe) return

    const dec = decoder
    if (!dec || dec.state !== 'configured') {
      pendingAus.push(au)
      if (!probing) {
        probing = probeAndConfigure(au)
          .then((ok) => {
            probing = null
            if (!ok || disposed) {
              pendingAus = []
              return
            }
            waitingForKeyframe = true
            const buffered = pendingAus
            pendingAus = []
            for (const p of buffered) feedConfigured(p)
          })
          .catch((err: unknown) => {
            probing = null
            onDecoderError(err)
            pendingAus = []
          })
      }
      return
    }
    feedConfigured(au)
  }

  function feedConfigured(au: DemuxedAccessUnit): void {
    if (disposed) return
    const dec = decoder
    if (!dec || dec.state !== 'configured') return
    if (waitingForKeyframe && !au.keyframe) return

    let data = au.data
    if (au.keyframe && !auHasParamSets(data, au.codec)) {
      data = prependParamSets(data, au.codec, paramCache)
    }

    const pesPts33 = maskPts33(au.pts90k)
    const ptsUnwrapped = unwrap.unwrap(au.pts90k)
    const timestampUs = pts90kToTimestampUs(ptsUnwrapped)
    ptsByTimestamp.set(timestampUs, pesPts33)

    try {
      dec.decode({
        type: au.keyframe ? 'key' : 'delta',
        timestamp: timestampUs,
        data,
      })
      const ptsGap90k =
        lastFedPts90k == null ? null : ptsDiff33(lastFedPts90k, pesPts33)
      lastFedAu = {
        keyframe: au.keyframe,
        pts90k: pesPts33,
        byteLength: data.byteLength,
        nalTypes: summarizeNalTypes(data, au.codec),
        ptsGap90k,
      }
      lastFedPts90k = pesPts33
      if (au.keyframe) {
        framesSinceKeyframe = 0
        decodeError = null
      } else {
        framesSinceKeyframe += 1
      }
      waitingForKeyframe = false
    } catch (err) {
      onDecoderError(err)
    }
  }

  const handle: VideoDecodePipeline = {
    pushBytes(chunk: Uint8Array): void {
      if (disposed) return
      bytesPushed += chunk.byteLength
      for (const au of demux.push(chunk)) handle.pushAu(au)
    },
    pushAu(au: DemuxedAccessUnit): void {
      feedAu(au)
    },
    present(): PresentResult | null {
      if (disposed) return null
      const now = noteTickWall()
      consumeQueuedArrivals()

      const poseNtp = options.getNewestPoseNtp
        ? options.getNewestPoseNtp()
        : null
      const shownPts = presentPace
        ? presentedMeta?.pts90k ?? null
        : presented?.pts90k ?? null
      const candidates: { pts90k: number }[] = []
      if (presentPace) {
        for (const r of retained) candidates.push({ pts90k: r.pts90k })
      } else {
        for (const q of queue) {
          if (q.pts90k !== null) candidates.push({ pts90k: q.pts90k })
        }
      }
      if (shownPts != null) {
        const already = candidates.some((c) => c.pts90k === shownPts)
        if (!already) candidates.unshift({ pts90k: shownPts })
      }

      if (candidates.length === 0) {
        if (shownPts == null) return null
        lastPick = {
          pts90k: shownPts,
          latencyMs: lastPick?.latencyMs ?? 0,
          degraded: lastPick?.degraded ?? false,
          reason: 'repeat',
        }
        return presentedView()
      }

      let pick = pickPresentationPts({
        frames: candidates,
        toNtp,
        newestPoseNtp: poseNtp,
        mode,
        fixedLatencyMs,
        minLatencyMs,
        maxLatencyMs,
        shownPts90k: shownPts,
      })
      if (!pick) {
        if (shownPts == null) return null
        lastPick = { ...lastPick!, reason: 'repeat' }
        return presentedView()
      }

      const newestPts = newestPts90kOf(candidates)
      const oldestPts = oldestPts90kOf(candidates)
      if (
        presentPace &&
        pick.pts90k === newestPts &&
        oldestPts !== newestPts &&
        (shownPts == null || shownPts === newestPts)
      ) {
        const targetPts = unstickPaceTargetPts(
          candidates,
          newestPts,
          toNtp,
          minLatencyMs,
        )
        pick = {
          pts90k: targetPts,
          latencyMs: latencyMsOf(targetPts, newestPts, toNtp),
          degraded: pick.degraded,
          reason: 'min-clamp',
        }
      }

      // If shown itself is stuck beyond max latency (kept by trim), allow one
      // catch-up jump to the max-clamp target. Hysteresis avoids fighting the
      // pace gate every tick at the L≈maxL boundary (live: 57% ≥60ms intervals).
      if (shownPts != null && presentPace) {
        const shownL = latencyMsOf(shownPts, newestPts, toNtp)
        if (shownL > maxLatencyMs + 50) {
          const catchPts = frameAtLatency(
            candidates,
            newestPts,
            maxLatencyMs,
            toNtp,
            shownPts,
          ).pts90k
          pick = {
            pts90k: catchPts,
            latencyMs: latencyMsOf(catchPts, newestPts, toNtp),
            degraded: true,
            reason: 'max-clamp',
          }
        }
      }

      if (shownPts != null && !allowsCatchUpSkip(pick.reason, presentPace)) {
        let nextPts: number | null = null
        let nextDelta = Infinity
        const snapSource = presentPace
          ? retained
          : queue.filter((q) => q.pts90k !== null)
        for (const q of snapSource) {
          const pts = q.pts90k
          if (pts == null) continue
          const d = ptsDiff33(shownPts, pts)
          if (d > 0 && d < nextDelta) {
            nextDelta = d
            nextPts = pts
          }
        }
        if (nextPts != null && nextPts !== pick.pts90k) {
          const jump = ptsDiff33(shownPts, pick.pts90k)
          if (jump > nextDelta) {
            pick = {
              pts90k: nextPts,
              latencyMs: latencyMsOf(nextPts, newestPts, toNtp),
              degraded: pick.degraded,
              reason: pick.reason,
            }
          }
        }
      }

      if (shownPts === pick.pts90k) {
        const stillQueued = presentPace
          ? retained.some((r) => r.pts90k === pick.pts90k)
          : queue.some((q) => q.pts90k === pick.pts90k)
        lastPick = stillQueued ? pick : { ...pick, reason: 'repeat' }
        return presentedView()
      }

      const rewind =
        shownPts != null && ptsDiff33(pick.pts90k, shownPts) > 0
      if (!allowsDisplaySwap(now, rewind)) {
        lastPick = {
          pts90k: shownPts!,
          latencyMs: latencyMsOf(shownPts!, newestPts, toNtp),
          degraded: lastPick?.degraded ?? pick.degraded,
          reason: 'pace-hold',
        }
        return presentedView()
      }

      if (presentPace) {
        const nextMeta = retainAt(pick.pts90k)
        if (!nextMeta) {
          if (shownPts == null) return null
          lastPick = { ...pick, reason: 'repeat' }
          return presentedView()
        }
        const keep: RetainedPts[] = []
        for (const r of retained) {
          if (ptsDiff33(r.pts90k, pick.pts90k) > 0) continue
          if (r.pts90k === pick.pts90k) continue
          keep.push(r)
        }
        retained.length = 0
        retained.push(...keep)
        if (rewind && presentedMeta) retained.push(presentedMeta)
        presentedMeta = nextMeta
        lastPick = pick
        commitDisplaySwap(now)
        return {
          frame: viewOf(presentedMeta),
          pts90k: pick.pts90k,
          timestampUs: presentedMeta.timestampUs,
          pick,
        }
      }

      const idx = queue.findIndex((q) => q.pts90k === pick.pts90k)
      let next: QueuedDecodeFrame | null = idx >= 0 ? queue[idx]! : null
      if (!next && presented && presented.pts90k === pick.pts90k) {
        next = presented
      }
      if (!next) {
        if (!presented || presented.pts90k === null) return null
        lastPick = { ...pick, reason: 'repeat' }
        return presentedView()
      }

      const skip: QueuedDecodeFrame[] = []
      const keep: QueuedDecodeFrame[] = []
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i]!
        if (q.pts90k === null || ptsDiff33(q.pts90k, pick.pts90k) > 0) {
          skip.push(q)
        } else if (q.pts90k === pick.pts90k) {
          /* becomes presented */
        } else keep.push(q)
      }
      for (const s of skip) dropQueued(s)
      queue.length = 0
      queue.push(...keep)

      if (presented && presented !== next) {
        const goingBack =
          presented.pts90k != null &&
          next.pts90k != null &&
          ptsDiff33(next.pts90k, presented.pts90k) > 0
        if (goingBack) {
          queue.push(presented)
        } else {
          if (prevPresented) dropQueued(prevPresented)
          prevPresented = presented
        }
      }
      presented = next
      lastPick = pick
      commitDisplaySwap(now)
      return {
        frame: presented.frame,
        pts90k: pick.pts90k,
        timestampUs: presented.timestampUs,
        pick,
      }
    },
    setMode(nextMode, nextFixed): void {
      mode = nextMode
      if (typeof nextFixed === 'number' && Number.isFinite(nextFixed)) {
        fixedLatencyMs = nextFixed
      }
    },
    getCounters(): DecodeCounters {
      const shownPts = presentPace
        ? presentedMeta?.pts90k ?? null
        : presented?.pts90k ?? null
      return {
        codec,
        framesDecoded,
        framesDropped,
        queueDepth: presentPace
          ? queue.length
          : queue.length + (presented ? 1 : 0) + (prevPresented ? 1 : 0),
        outstandingFrames: outstanding,
        retainedDepth: presentPace
          ? retained.length + (presentedMeta ? 1 : 0)
          : queue.length + (presented ? 1 : 0),
        presentedPts90k: shownPts,
        presentedNtpMs: shownPts != null ? toNtp(shownPts) : null,
        latencyMs: lastPick?.latencyMs ?? null,
        degraded: lastPick?.degraded ?? false,
        reason: lastPick?.reason ?? null,
        waitingForKeyframe,
        decodeError,
        bytesPushed,
        accessUnits,
      }
    },
    getOutstandingFrames: () => outstanding,
    demux: () => demux,
    async ready(): Promise<void> {
      while (probing) await probing
    },
    resetForH264Fallback(): void {
      if (disposed) return
      dropHevcUntilH264 = true
      decodeError = null
      codec = null
      waitingForKeyframe = true
      framesSinceKeyframe = 0
      lastFedPts90k = null
      lastFedAu = null
      resetDecodeErrorDiagLossBaseline()
      pendingAus = []
      probing = null
      demux = createTsDemuxer()
      unwrap = createPtsUnwrapper()
      paramCache = emptyParamSetCache()
      bytesPushed = 0
      accessUnits = 0
      framesDecoded = 0
      ptsByTimestamp.clear()
      for (const q of queue) dropQueued(q)
      queue.length = 0
      retained.length = 0
      presentedMeta = null
      if (prevPresented) {
        dropQueued(prevPresented)
        prevPresented = null
      }
      if (presented) {
        dropQueued(presented)
        presented = null
      }
      try {
        decoder?.close()
      } catch {
        /* ignore */
      }
      decoder = null
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      pendingAus = []
      for (const q of queue) dropQueued(q)
      queue.length = 0
      retained.length = 0
      presentedMeta = null
      if (prevPresented) {
        dropQueued(prevPresented)
        prevPresented = null
      }
      if (presented) {
        dropQueued(presented)
        presented = null
      }
      try {
        decoder?.close()
      } catch {
        /* ignore */
      }
      decoder = null
      demux.reset()
      unwrap.reset()
      ptsByTimestamp.clear()
    },
  }

  return handle
}
