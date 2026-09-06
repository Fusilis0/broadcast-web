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
 * VideoDecoder is injectable — vitest-node has no WebCodecs.
 */

import { maskPts33, ptsDiff33 } from '../telemetry/ptsNtpMap.ts'
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

function latencyMsOf(
  pts90k: number,
  newestPts90k: number,
  toNtp: (pts: number) => number | null,
): number {
  const ntp = toNtp(pts90k)
  const newestNtp = toNtp(newestPts90k)
  if (ntp !== null && newestNtp !== null) return newestNtp - ntp
  return (newestPts90k - pts90k) / 90
}

function frameAtLatency(
  frames: readonly { pts90k: number }[],
  newestPts90k: number,
  targetMs: number,
  toNtp: (pts: number) => number | null,
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
  return frames[0]!
}

/**
 * Adaptive (L4): newest pose-covered frame, clamped 100–400 ms behind newest.
 * Empty LUT (`toNtp` all null) presents the newest decoded frame (`lut-miss-live`)
 * so the plate keeps moving. Telemetry stall (`newestPoseNtp === null`) with a
 * working LUT still pins at 400 ms and flags degraded.
 */
export function pickPresentationPts(
  input: PresentationPolicyInput,
): PresentationPick | null {
  const frames = input.frames
  if (frames.length === 0) return null
  const newestPts90k = frames[frames.length - 1]!.pts90k
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

  if (input.mode === 'fixed') {
    const target = Math.min(
      maxL,
      Math.max(minL, input.fixedLatencyMs ?? 200),
    )
    return finish(
      frameAtLatency(frames, newestPts90k, target, toNtp).pts90k,
      'fixed',
      false,
    )
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
    return finish(
      frameAtLatency(frames, newestPts90k, maxL, toNtp).pts90k,
      'stall-pin',
      true,
    )
  }

  let covered: { pts90k: number } | null = null
  for (const f of frames) {
    const ntp = toNtp(f.pts90k)
    if (ntp === null) continue
    if (ntp <= poseNtp) covered = f
  }

  // Pose has not covered any mapped frame: pin at max latency.
  if (covered === null) {
    return finish(
      frameAtLatency(frames, newestPts90k, maxL, toNtp).pts90k,
      'stall-pin',
      true,
    )
  }

  const candidate = covered
  const L = latencyMsOf(candidate.pts90k, newestPts90k, toNtp)
  if (L < minL) {
    return finish(
      frameAtLatency(frames, newestPts90k, minL, toNtp).pts90k,
      'min-clamp',
      false,
    )
  }
  if (L > maxL) {
    return finish(
      frameAtLatency(frames, newestPts90k, maxL, toNtp).pts90k,
      'max-clamp',
      true,
    )
  }
  return finish(candidate.pts90k, 'adaptive', false)
}

/** Catch-up reasons may jump/skip; steady playback must not hole PTS. */
function allowsCatchUpSkip(reason: PresentationReason): boolean {
  return (
    reason === 'max-clamp' ||
    reason === 'stall-pin' ||
    reason === 'lut-miss-live'
  )
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

  const queue: QueuedDecodeFrame[] = []
  let presented: QueuedDecodeFrame | null = null
  let prevPresented: QueuedDecodeFrame | null = null
  let lastPick: PresentationPick | null = null
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
    try {
      decoder?.reset()
    } catch {
      /* already closed */
    }
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
      const poseNtp = options.getNewestPoseNtp
        ? options.getNewestPoseNtp()
        : null
      const candidates: { pts90k: number }[] = []
      for (const q of queue) {
        if (q.pts90k !== null) candidates.push({ pts90k: q.pts90k })
      }
      if (presented && presented.pts90k !== null) {
        const held = presented.pts90k
        const already = candidates.some((c) => c.pts90k === held)
        if (!already) candidates.unshift({ pts90k: held })
      }

      if (candidates.length === 0) {
        if (!presented || presented.pts90k === null) return null
        lastPick = {
          pts90k: presented.pts90k,
          latencyMs: lastPick?.latencyMs ?? 0,
          degraded: lastPick?.degraded ?? false,
          reason: 'repeat',
        }
        return {
          frame: presented.frame,
          pts90k: presented.pts90k,
          timestampUs: presented.timestampUs,
          pick: lastPick,
        }
      }

      let pick = pickPresentationPts({
        frames: candidates,
        toNtp,
        newestPoseNtp: poseNtp,
        mode,
        fixedLatencyMs,
        minLatencyMs,
        maxLatencyMs,
      })
      if (!pick) {
        if (!presented || presented.pts90k === null) return null
        lastPick = { ...lastPick!, reason: 'repeat' }
        return {
          frame: presented.frame,
          pts90k: presented.pts90k,
          timestampUs: presented.timestampUs,
          pick: lastPick,
        }
      }

      if (
        presented &&
        presented.pts90k !== null &&
        !allowsCatchUpSkip(pick.reason)
      ) {
        let nextUnique: QueuedDecodeFrame | null = null
        let nextDelta = Infinity
        for (const q of queue) {
          if (q.pts90k === null) continue
          const d = ptsDiff33(presented.pts90k, q.pts90k)
          if (d > 0 && d < nextDelta) {
            nextDelta = d
            nextUnique = q
          }
        }
        if (nextUnique && nextUnique.pts90k !== pick.pts90k) {
          const jump = ptsDiff33(presented.pts90k, pick.pts90k)
          if (jump > nextDelta) {
            const newestPts90k = candidates[candidates.length - 1]!.pts90k
            pick = {
              pts90k: nextUnique.pts90k,
              latencyMs: latencyMsOf(nextUnique.pts90k, newestPts90k, toNtp),
              degraded: pick.degraded,
              reason: pick.reason,
            }
          }
        }
      }

      lastPick = pick
      if (presented && presented.pts90k === pick.pts90k) {
        const stillQueued = queue.some((q) => q.pts90k === pick.pts90k)
        if (!stillQueued) lastPick = { ...pick, reason: 'repeat' }
        return {
          frame: presented.frame,
          pts90k: presented.pts90k,
          timestampUs: presented.timestampUs,
          pick: lastPick,
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
        return {
          frame: presented.frame,
          pts90k: presented.pts90k,
          timestampUs: presented.timestampUs,
          pick: lastPick,
        }
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
        if (prevPresented) dropQueued(prevPresented)
        prevPresented = presented
      }
      presented = next
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
      return {
        codec,
        framesDecoded,
        framesDropped,
        queueDepth: queue.length + (presented ? 1 : 0) + (prevPresented ? 1 : 0),
        outstandingFrames: outstanding,
        presentedPts90k: presented?.pts90k ?? null,
        presentedNtpMs:
          presented?.pts90k != null ? toNtp(presented.pts90k) : null,
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
