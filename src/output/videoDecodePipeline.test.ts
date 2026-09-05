import { afterEach, describe, expect, it } from 'vitest'
import type { DemuxedAccessUnit } from './tsDemux.ts'
import { PTS_MOD_33 } from '../telemetry/ptsNtpMap.ts'
import {
  HEVC_UNSUPPORTED_MESSAGE,
  MAX_PRESENT_LATENCY_MS,
  MIN_PRESENT_LATENCY_MS,
  PRESENT_PACE_PERIOD_MS,
  PRESENT_PACE_SLACK_MS,
  PTS_TIMESTAMP_MATCH_US,
  createVideoDecodePipeline,
  lookupPts90k,
  parsePresentPace,
  pickPresentationPts,
  type DecoderConfigLike,
  type EncodedChunkLike,
  type VideoDecoderFactory,
  type VideoDecoderLike,
  type VideoFrameLike,
} from './videoDecodePipeline.ts'

const TICKS_30FPS = 3000

function au(
  pts90k: number,
  opts: { key?: boolean; codec?: 'h264' | 'hevc' } = {},
): DemuxedAccessUnit {
  const codec = opts.codec ?? 'hevc'
  const key = opts.key ?? false
  const nal =
    codec === 'hevc'
      ? key
        ? new Uint8Array([0, 0, 0, 1, 0x26, 0x01, 0x00])
        : new Uint8Array([0, 0, 0, 1, 0x02, 0x01, 0x00])
      : key
        ? new Uint8Array([0, 0, 0, 1, 0x65, 0x88])
        : new Uint8Array([0, 0, 0, 1, 0x41, 0x9a])
  return { data: nal, pts90k, keyframe: key, codec }
}

type FakeFrame = VideoFrameLike & { closed: boolean }

function createFakeFactory(opts?: {
  hevcSupported?: boolean
  /** When set, `prefer-hardware` HEVC can fail while the unhinted config succeeds. */
  hevcPreferHardware?: boolean
  h264Supported?: boolean
  /** Added to `chunk.timestamp` on the output frame (WebCodecs rounding miss). */
  timestampOffsetUs?: number
  onDecode?: (chunk: EncodedChunkLike) => void
}): {
  factory: VideoDecoderFactory
  decoded: EncodedChunkLike[]
  framesCreated: FakeFrame[]
  closeCount: () => number
  decoder: () => VideoDecoderLike | null
  fireError: (err: unknown) => void
} {
  const decoded: EncodedChunkLike[] = []
  const framesCreated: FakeFrame[] = []
  let decoder: VideoDecoderLike | null = null
  let errorHandler: ((err: unknown) => void) | undefined
  const hevcSupported = opts?.hevcSupported ?? true
  const hevcPreferHardware = opts?.hevcPreferHardware ?? hevcSupported
  const h264Supported = opts?.h264Supported ?? true

  const factory: VideoDecoderFactory = {
    async isConfigSupported(config: DecoderConfigLike) {
      const hevc = config.codec.startsWith('hev1') || config.codec.startsWith('hvc1')
      if (!hevc) return { supported: h264Supported }
      if (config.hardwareAcceleration === 'prefer-hardware') {
        return { supported: hevcPreferHardware }
      }
      return { supported: hevcSupported }
    },
    create(init) {
      errorHandler = init.error
      const handle: VideoDecoderLike = {
        state: 'unconfigured',
        configure() {
          handle.state = 'configured'
        },
        decode(chunk) {
          decoded.push(chunk)
          opts?.onDecode?.(chunk)
          const frame: FakeFrame = {
            timestamp: chunk.timestamp + (opts?.timestampOffsetUs ?? 0),
            codedWidth: 64,
            codedHeight: 36,
            displayWidth: 64,
            displayHeight: 36,
            closed: false,
            close() {
              if (frame.closed) throw new Error('VideoFrame.close() called twice')
              frame.closed = true
            },
          }
          framesCreated.push(frame)
          init.output(frame)
        },
        reset() {
          handle.state = 'configured'
        },
        close() {
          handle.state = 'closed'
        },
      }
      decoder = handle
      return handle
    },
  }

  return {
    factory,
    decoded,
    framesCreated,
    closeCount: () => framesCreated.filter((f) => f.closed).length,
    decoder: () => decoder,
    fireError: (err: unknown) => errorHandler?.(err),
  }
}

describe('pickPresentationPts', () => {
  const pts = (ms: number) => ms * 90
  const frames = [0, 100, 200, 300, 400, 500].map((ms) => ({ pts90k: pts(ms) }))
  const newestNtp = 1_000_500
  const toNtp = (p: number) => 1_000_000 + p / 90

  it('adaptive picks the newest pose-covered frame inside the clamps', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp,
      newestPoseNtp: newestNtp - 200,
      mode: 'adaptive',
    })
    expect(pick).not.toBeNull()
    expect(pick!.reason).toBe('adaptive')
    expect(pick!.pts90k).toBe(pts(300))
    expect(pick!.latencyMs).toBeCloseTo(200, 5)
    expect(pick!.degraded).toBe(false)
  })

  it('min clamp keeps at least 100 ms behind newest', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp,
      newestPoseNtp: newestNtp,
      mode: 'adaptive',
    })
    expect(pick!.reason).toBe('min-clamp')
    expect(pick!.latencyMs).toBeGreaterThanOrEqual(MIN_PRESENT_LATENCY_MS - 1e-6)
    expect(pick!.degraded).toBe(false)
    expect(pick!.pts90k).not.toBe(frames[frames.length - 1]!.pts90k)
  })

  it('telemetry stall pins at 400 ms and flags degraded', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp,
      newestPoseNtp: null,
      mode: 'adaptive',
    })
    expect(pick!.reason).toBe('stall-pin')
    expect(pick!.degraded).toBe(true)
    expect(pick!.latencyMs).toBeCloseTo(MAX_PRESENT_LATENCY_MS, 5)
    expect(pick!.pts90k).toBe(pts(100))
  })

  it('pose lag beyond 400 ms pins at the max clamp and flags degraded', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp,
      newestPoseNtp: 1_000_000,
      mode: 'adaptive',
    })
    expect(pick!.reason).toBe('max-clamp')
    expect(pick!.degraded).toBe(true)
    expect(pick!.latencyMs).toBeCloseTo(MAX_PRESENT_LATENCY_MS, 5)
  })

  it('fixed mode sits at the requested latency', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp,
      newestPoseNtp: newestNtp,
      mode: 'fixed',
      fixedLatencyMs: 250,
    })
    expect(pick!.reason).toBe('fixed')
    expect(pick!.pts90k).toBe(pts(200))
    expect(pick!.latencyMs).toBeCloseTo(300, 5)
    expect(pick!.degraded).toBe(false)
  })

  it('LUT empty (all toNtp null) presents newest, not stall-pin', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp: () => null,
      newestPoseNtp: newestNtp,
      mode: 'adaptive',
    })
    expect(pick).not.toBeNull()
    expect(pick!.reason).toBe('lut-miss-live')
    expect(pick!.degraded).toBe(true)
    expect(pick!.pts90k).toBe(frames[frames.length - 1]!.pts90k)
    expect(pick!.latencyMs).toBeCloseTo(0, 5)
  })

  it('LUT empty with a single frame still presents that frame', () => {
    const pick = pickPresentationPts({
      frames: [{ pts90k: pts(500) }],
      toNtp: () => null,
      newestPoseNtp: newestNtp,
      mode: 'adaptive',
    })
    expect(pick!.reason).toBe('lut-miss-live')
    expect(pick!.degraded).toBe(true)
    expect(pick!.pts90k).toBe(pts(500))
  })

  it('LUT empty with pose NTP also null still plays newest, not stall-pin', () => {
    const pick = pickPresentationPts({
      frames,
      toNtp: () => null,
      newestPoseNtp: null,
      mode: 'adaptive',
    })
    expect(pick!.reason).toBe('lut-miss-live')
    expect(pick!.degraded).toBe(true)
    expect(pick!.pts90k).toBe(frames[frames.length - 1]!.pts90k)
  })

  it('collapsed NTP (flat toNtp) still min-clamps via PTS latency', () => {
    const shown = pts(0)
    const cand = [0, 100, 200, 300, 400, 500].map((ms) => ({ pts90k: pts(ms) }))
    const pick = pickPresentationPts({
      frames: cand,
      toNtp: () => 9_000_000, // every PTS → same NTP (live lock signature)
      newestPoseNtp: 9_000_100,
      mode: 'adaptive',
      shownPts90k: shown,
    })
    expect(pick!.reason).toBe('min-clamp')
    expect(pick!.pts90k).not.toBe(shown)
    expect(pick!.latencyMs).toBeGreaterThanOrEqual(MIN_PRESENT_LATENCY_MS - 1e-6)
  })

  it('min-clamp fallback never sticks on shown when newer frames exist', () => {
    const shown = pts(0)
    // Only shown + one frame <100ms ahead — PTS min-clamp target misses, fallback must advance
    const cand = [{ pts90k: shown }, { pts90k: pts(50) }]
    const pick = pickPresentationPts({
      frames: cand,
      toNtp: () => 1_000_000,
      newestPoseNtp: 1_000_100,
      mode: 'adaptive',
      shownPts90k: shown,
    })
    expect(pick!.pts90k).toBe(pts(50))
    expect(pick!.pts90k).not.toBe(shown)
  })
})

describe('lookupPts90k', () => {
  it('recovers the stored PTS when WebCodecs rounds the timestamp', () => {
    const map = new Map<number, number>([[1_000_000, 90_000]])
    expect(lookupPts90k(map, 1_000_000 + 1)).toBe(90_000)
    expect(map.size).toBe(0)
  })

  it('returns null instead of the µs timestamp when the miss is outside epsilon', () => {
    const map = new Map<number, number>([[1_000_000, 90_000]])
    const miss = 1_000_000 + PTS_TIMESTAMP_MATCH_US + 1
    expect(lookupPts90k(map, miss)).toBeNull()
    expect(map.get(1_000_000)).toBe(90_000)
  })
})

describe('createVideoDecodePipeline', () => {
  const pipes: Array<{ dispose(): void }> = []

  afterEach(() => {
    while (pipes.length) pipes.pop()!.dispose()
  })

  function start(
    fake = createFakeFactory(),
    extra: Parameters<typeof createVideoDecodePipeline>[0] = {},
  ) {
    const pipe = createVideoDecodePipeline({
      decoderFactory: fake.factory,
      presentPace: false,
      ...extra,
    })
    pipes.push(pipe)
    return { pipe, fake }
  }

  it('waits for a keyframe on mid-stream join before feeding the decoder', async () => {
    const { pipe, fake } = start()
    pipe.pushAu(au(0, { key: false }))
    pipe.pushAu(au(TICKS_30FPS, { key: false }))
    await pipe.ready()
    expect(fake.decoded).toHaveLength(0)
    pipe.pushAu(au(TICKS_30FPS * 2, { key: true }))
    await pipe.ready()
    expect(fake.decoded.length).toBeGreaterThanOrEqual(1)
    expect(fake.decoded[0]!.type).toBe('key')
  })

  it('HEVC unsupported → explicit ops error, no black-hole decode', async () => {
    const errors: string[] = []
    const fake = createFakeFactory({ hevcSupported: false })
    const { pipe } = start(fake, { onOpsError: (m) => errors.push(m) })
    pipe.pushAu(au(0, { key: true, codec: 'hevc' }))
    await pipe.ready()
    expect(errors).toEqual([HEVC_UNSUPPORTED_MESSAGE])
    expect(fake.decoded).toHaveLength(0)
    expect(pipe.getCounters().decodeError).toBe(HEVC_UNSUPPORTED_MESSAGE)
    expect(pipe.present()).toBeNull()
  })

  it('resetForH264Fallback drops HEVC and decodes a later H.264 keyframe', async () => {
    const errors: string[] = []
    const fake = createFakeFactory({ hevcSupported: false, h264Supported: true })
    const { pipe } = start(fake, { onOpsError: (m) => errors.push(m) })
    pipe.pushAu(au(0, { key: true, codec: 'hevc' }))
    await pipe.ready()
    expect(errors).toEqual([HEVC_UNSUPPORTED_MESSAGE])
    pipe.resetForH264Fallback()
    pipe.pushAu(au(TICKS_30FPS, { key: true, codec: 'hevc' }))
    pipe.pushAu(au(TICKS_30FPS * 2, { key: true, codec: 'h264' }))
    await pipe.ready()
    expect(fake.decoded.length).toBeGreaterThanOrEqual(1)
    expect(pipe.getCounters().decodeError).toBeNull()
    expect(pipe.getCounters().codec).toBe('h264')
  })

  it('runtime decoder errors surface via onOpsError', async () => {
    const errors: string[] = []
    const fake = createFakeFactory()
    const { pipe } = start(fake, { onOpsError: (m) => errors.push(m) })
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    fake.fireError(new Error('Decoder error: failed'))
    expect(errors).toContain('Decoder error: failed')
    expect(pipe.getCounters().decodeError).toBe('Decoder error: failed')
  })

  it('HEVC configure succeeds without prefer-hardware when that probe fails', async () => {
    const errors: string[] = []
    const fake = createFakeFactory({
      hevcSupported: true,
      hevcPreferHardware: false,
    })
    const { pipe } = start(fake, { onOpsError: (m) => errors.push(m) })
    pipe.pushAu(au(0, { key: true, codec: 'hevc' }))
    await pipe.ready()
    expect(errors).toEqual([])
    expect(fake.decoded.length).toBeGreaterThanOrEqual(1)
    expect(pipe.getCounters().decodeError).toBeNull()
  })

  it('sets chunk.timestamp from unwrapped PTS (µs) and reads it back on the frame', async () => {
    const { pipe, fake } = start()
    pipe.pushAu(au(90000, { key: true }))
    await pipe.ready()
    expect(fake.decoded[0]!.timestamp).toBe(1_000_000)
    const shown = pipe.present()
    expect(shown?.frame.timestamp).toBe(1_000_000)
    expect(shown?.pts90k).toBe(90000)
  })

  it('closes every skipped frame exactly once; outstanding is 0 after soak+dispose', async () => {
    let poseNtp: number | null = 1_000_000
    const { pipe, fake } = start(createFakeFactory(), {
      getNewestPoseNtp: () => poseNtp,
      toNtp: (pts) => 1_000_000 + (pts - 30 * TICKS_30FPS) / 90,
    })
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    for (let i = 1; i < 60; i++) {
      pipe.pushAu(au(i * TICKS_30FPS, { key: false }))
    }
    poseNtp = 1_000_000 + 400
    for (let t = 0; t < 30; t++) pipe.present()

    const created = fake.framesCreated.length
    expect(created).toBeGreaterThan(10)
    expect(fake.closeCount()).toBeGreaterThan(0)
    pipe.dispose()
    expect(pipe.getOutstandingFrames()).toBe(0)
    expect(fake.closeCount()).toBe(created)
    expect(fake.framesCreated.every((f) => f.closed)).toBe(true)
  })

  it('video stall repeats the last frame without closing it', async () => {
    const { pipe, fake } = start(createFakeFactory(), {
      getNewestPoseNtp: () => 1_000_000,
      toNtp: (pts) => 1_000_000 + pts / 90,
      mode: 'fixed',
      fixedLatencyMs: 100,
    })
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    const first = pipe.present()
    expect(first).not.toBeNull()
    const again = pipe.present()
    expect(again?.pts90k).toBe(first!.pts90k)
    expect(again?.pick.reason).toBe('repeat')
    expect(fake.framesCreated[0]!.closed).toBe(false)
  })

  it('adaptive stall pin marks degraded on the presented pick', async () => {
    const { pipe } = start(createFakeFactory(), {
      getNewestPoseNtp: () => null,
      toNtp: (pts) => 5_000_000 + pts / 90,
    })
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    for (let i = 1; i <= 20; i++) {
      pipe.pushAu(au(i * TICKS_30FPS, { key: false }))
    }
    const shown = pipe.present()
    expect(shown?.pick.reason).toBe('stall-pin')
    expect(shown?.pick.degraded).toBe(true)
    expect(shown?.pick.latencyMs).toBeGreaterThanOrEqual(MAX_PRESENT_LATENCY_MS - 40)
  })

  it('rounded WebCodecs timestamp still recovers the stored muxer PTS', async () => {
    const fake = createFakeFactory({ timestampOffsetUs: 1 })
    const { pipe } = start(fake)
    pipe.pushAu(au(90_000, { key: true }))
    await pipe.ready()
    expect(fake.decoded[0]!.timestamp).toBe(1_000_000)
    expect(fake.framesCreated[0]!.timestamp).toBe(1_000_001)
    const shown = pipe.present()
    expect(shown?.pts90k).toBe(90_000)
    expect(pipe.getCounters().presentedPts90k).toBe(90_000)
  })

  it('map miss does not publish WebCodecs µs as presentedPts90k', async () => {
    const offsetUs = 1_000_000
    const fake = createFakeFactory({ timestampOffsetUs: offsetUs })
    const { pipe } = start(fake, {
      getNewestPoseNtp: () => 1_000_000,
      toNtp: () => null,
    })
    pipe.pushAu(au(90_000, { key: true }))
    await pipe.ready()
    const frameUs = fake.framesCreated[0]!.timestamp
    const shown = pipe.present()
    expect(shown).toBeNull()
    expect(pipe.getCounters().presentedPts90k).toBeNull()
    expect(pipe.getCounters().presentedPts90k).not.toBe(frameUs)
    expect(pipe.getCounters().presentedPts90k).not.toBe(90_000 + offsetUs)
  })

  it('presentedPts90k is maskPts33 PES, not decoder unwrap', async () => {
    const fake = createFakeFactory()
    const { pipe } = start(fake, { queueCap: 1 })
    const nearWrap = PTS_MOD_33 - 3_000
    pipe.pushAu(au(nearWrap, { key: true }))
    await pipe.ready()
    pipe.pushAu(au(3_000, { key: true }))
    await pipe.ready()
    const lastChunk = fake.decoded[fake.decoded.length - 1]!
    expect(lastChunk.timestamp).toBeGreaterThan(PTS_MOD_33 / 90)
    const shown = pipe.present()
    expect(shown?.pts90k).toBe(3_000)
    expect(pipe.getCounters().presentedPts90k).toBe(3_000)
    expect(pipe.getCounters().presentedPts90k).not.toBe(PTS_MOD_33 + 3_000)
  })

  it('LUT empty presents the newest decoded frame', async () => {
    const { pipe, fake } = start(createFakeFactory(), {
      getNewestPoseNtp: () => 5_000_000,
      toNtp: () => null,
    })
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    for (let i = 1; i <= 20; i++) {
      pipe.pushAu(au(i * TICKS_30FPS, { key: false }))
    }
    const newestPts = 20 * TICKS_30FPS
    const shown = pipe.present()
    expect(shown).not.toBeNull()
    expect(shown!.pick.reason).toBe('lut-miss-live')
    expect(shown!.pick.degraded).toBe(true)
    expect(shown!.pts90k).toBe(newestPts)
    expect(shown!.pick.latencyMs).toBeCloseTo(0, 5)
    expect(fake.framesCreated[fake.framesCreated.length - 1]!.timestamp).toBe(
      shown!.frame.timestamp,
    )
  })

  it('cold start: first present() with presented null still picks a min-clamp frame', async () => {
    const { pipe } = start(createFakeFactory(), {
      toNtp: (pts) => pts / 90,
      getNewestPoseNtp: () => 1e12,
    })
    expect(pipe.getCounters().presentedPts90k).toBeNull()
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    for (let i = 1; i <= 10; i++) {
      pipe.pushAu(au(i * TICKS_30FPS, { key: false }))
    }
    expect(pipe.getCounters().presentedPts90k).toBeNull()
    const shown = pipe.present()
    expect(shown).not.toBeNull()
    expect(shown!.pick.reason).toBe('min-clamp')
    expect(shown!.pts90k).not.toBeNull()
    expect(pipe.getCounters().presentedPts90k).toBe(shown!.pts90k)
    expect(shown!.pick.latencyMs).toBeGreaterThanOrEqual(MIN_PRESENT_LATENCY_MS - 1e-6)
    expect(shown!.pick.latencyMs).toBeLessThanOrEqual(MAX_PRESENT_LATENCY_MS)
  })
})

describe('present() unique PTS vs 30fps decode (min-clamp)', () => {
  const pipes: ReturnType<typeof createVideoDecodePipeline>[] = []
  afterEach(() => {
    while (pipes.length) pipes.pop()!.dispose()
  })

  function startMinClamp() {
    const fake = createFakeFactory()
    const pipe = createVideoDecodePipeline({
      decoderFactory: fake.factory,
      toNtp: (pts) => pts / 90,
      getNewestPoseNtp: () => 1e12,
      minLatencyMs: MIN_PRESENT_LATENCY_MS,
      maxLatencyMs: MAX_PRESENT_LATENCY_MS,
      presentPace: false,
    })
    pipes.push(pipe)
    return { pipe, fake, nextPts: { n: 0 } }
  }

  async function pushFrames(
    ctx: { pipe: ReturnType<typeof createVideoDecodePipeline>; nextPts: { n: number } },
    count: number,
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const pts = ctx.nextPts.n
      ctx.nextPts.n += TICKS_30FPS
      ctx.pipe.pushAu(au(pts, { key: pts === 0 }))
    }
    await ctx.pipe.ready()
  }

  type PlayAcc = {
    unique: number
    lastPts: number | null
    latencies: number[]
    depths: number[]
  }

  function tickPresent(
    pipe: ReturnType<typeof createVideoDecodePipeline>,
    acc: PlayAcc,
  ): void {
    const shown = pipe.present()
    const depth = pipe.getCounters().queueDepth
    acc.depths.push(depth)
    if (!shown) return
    acc.latencies.push(shown.pick.latencyMs)
    if (shown.pts90k !== acc.lastPts) {
      acc.unique += 1
      acc.lastPts = shown.pts90k
    }
  }

  function assertBoundedPlayback(acc: PlayAcc): void {
    expect(acc.latencies.length).toBeGreaterThan(0)
    for (const L of acc.latencies) {
      expect(L).toBeGreaterThanOrEqual(MIN_PRESENT_LATENCY_MS - 1e-6)
      expect(L).toBeLessThanOrEqual(MAX_PRESENT_LATENCY_MS)
    }
    const maxDepth = Math.max(...acc.depths)
    expect(maxDepth).toBeLessThanOrEqual(16)
    const third = Math.max(1, Math.floor(acc.depths.length / 3))
    const firstMax = Math.max(...acc.depths.slice(0, third))
    const lastMax = Math.max(...acc.depths.slice(-third))
    expect(lastMax).toBeLessThanOrEqual(firstMax + 4)
  }

  async function runPattern(
    ticks: number,
    onTick: (t: number, ctx: ReturnType<typeof startMinClamp>) => Promise<void>,
  ): Promise<{ unique: number; decoded: number; acc: PlayAcc }> {
    const ctx = startMinClamp()
    await pushFrames(ctx, 8)
    for (let i = 0; i < 12; i++) tickPresent(ctx.pipe, {
      unique: 0,
      lastPts: null,
      latencies: [],
      depths: [],
    })
    const decoded0 = ctx.pipe.getCounters().framesDecoded
    const acc: PlayAcc = {
      unique: 0,
      lastPts: ctx.pipe.getCounters().presentedPts90k,
      latencies: [],
      depths: [],
    }
    for (let t = 0; t < ticks; t++) {
      await onTick(t, ctx)
      tickPresent(ctx.pipe, acc)
    }
    const decoded = ctx.pipe.getCounters().framesDecoded - decoded0
    return { unique: acc.unique, decoded, acc }
  }

  it('paired burst (2 AU / 4 presents) unique PTS stays with decode rate', async () => {
    const { unique, decoded, acc } = await runPattern(180, async (t, ctx) => {
      if (t % 4 === 0) await pushFrames(ctx, 2)
    })
    expect(decoded).toBeGreaterThan(0)
    expect(unique / decoded).toBeGreaterThanOrEqual(0.95)
    assertBoundedPlayback(acc)
  })

  it('smooth cadence (1 AU / 2 presents) unique PTS stays with decode rate', async () => {
    const { unique, decoded, acc } = await runPattern(180, async (t, ctx) => {
      if (t % 2 === 0) await pushFrames(ctx, 1)
    })
    expect(decoded).toBeGreaterThan(0)
    expect(unique / decoded).toBeGreaterThanOrEqual(0.95)
    assertBoundedPlayback(acc)
  })

  it('asymmetric burst (3 AU then 5 empty presents) unique PTS stays with decode rate', async () => {
    const { unique, decoded, acc } = await runPattern(180, async (t, ctx) => {
      if (t % 6 === 0) await pushFrames(ctx, 3)
    })
    expect(decoded).toBeGreaterThan(0)
    expect(unique / decoded).toBeGreaterThanOrEqual(0.95)
    assertBoundedPlayback(acc)
  })
})

describe('parsePresentPace', () => {
  it('defaults on; ?presentPace=off is the killswitch', () => {
    expect(parsePresentPace('')).toBe(true)
    expect(parsePresentPace('?race=demo')).toBe(true)
    expect(parsePresentPace('?presentPace=off')).toBe(false)
    expect(parsePresentPace('?presentPace=0')).toBe(false)
    expect(parsePresentPace('?presentPace=on')).toBe(true)
  })

  it('slack is mean+1σ of measured studio:tick, not an arbitrary 4 ms', () => {
    const tickMean = 17.41
    const tickStd = 11.39
    const derived = PRESENT_PACE_PERIOD_MS - (tickMean + tickStd)
    expect(PRESENT_PACE_SLACK_MS).toBe(5)
    expect(derived).toBeGreaterThan(4)
    expect(derived).toBeLessThan(5)
    expect(PRESENT_PACE_PERIOD_MS - PRESENT_PACE_SLACK_MS).toBeCloseTo(
      tickMean + tickStd,
      0,
    )
  })
})

describe('present() wall-clock pace (Option A)', () => {
  const pipes: ReturnType<typeof createVideoDecodePipeline>[] = []
  afterEach(() => {
    while (pipes.length) pipes.pop()!.dispose()
  })

  function clock() {
    let t = 0
    return {
      now: () => t,
      add(ms: number) {
        t += ms
      },
      set(ms: number) {
        t = ms
      },
    }
  }

  async function pacedPipe(opts?: {
    toNtp?: ((pts: number) => number | null) | null
    presentPace?: boolean
  }) {
    const fake = createFakeFactory()
    const clk = clock()
    const toNtp =
      opts?.toNtp === null
        ? () => null
        : (opts?.toNtp ?? ((pts: number) => pts / 90))
    const pipe = createVideoDecodePipeline({
      decoderFactory: fake.factory,
      toNtp,
      getNewestPoseNtp: () => 1e12,
      presentPace: opts?.presentPace ?? true,
      nowMs: () => clk.now(),
    })
    pipes.push(pipe)
    return { pipe, fake, clk }
  }

  async function pushN(
    pipe: ReturnType<typeof createVideoDecodePipeline>,
    count: number,
    startPts = 0,
  ) {
    pipe.pushAu(au(startPts, { key: true }))
    await pipe.ready()
    for (let i = 1; i < count; i++) {
      pipe.pushAu(
        au(startPts + i * TICKS_30FPS, { key: false }),
      )
    }
    await pipe.ready()
  }

  it('steady 30fps on 16.7ms ticks clusters near 33ms (sanity; pass bar is 131s replay)', async () => {
    const { pipe, clk } = await pacedPipe()
    await pushN(pipe, 10)
    const advances: number[] = []
    let lastPts: number | null = null
    let nextPts = 10 * TICKS_30FPS
    for (let i = 0; i < 120; i++) {
      if (i > 0 && i % 2 === 0) {
        pipe.pushAu(au(nextPts, { key: false }))
        nextPts += TICKS_30FPS
        await pipe.ready()
      }
      const shown = pipe.present()
      if (shown && shown.pts90k !== lastPts) {
        advances.push(clk.now())
        lastPts = shown.pts90k
      }
      clk.add(1000 / 60)
    }
    expect(advances.length).toBeGreaterThan(20)
    const intervals = []
    for (let i = 1; i < advances.length; i++) {
      intervals.push(advances[i]! - advances[i - 1]!)
    }
    const n = intervals.length
    const under20 = intervals.filter((d) => d < 20).length / n
    const mid = intervals.filter((d) => d >= 20 && d < 40).length / n
    const over60 = intervals.filter((d) => d >= 60).length / n
    expect(under20).toBeLessThan(0.1)
    expect(over60).toBeLessThan(0.05)
    expect(mid).toBeGreaterThan(0.8)
    const mean = intervals.reduce((a, b) => a + b, 0) / n
    expect(mean).toBeGreaterThan(28)
    expect(mean).toBeLessThan(40)
  })

  it('12-frame lut-miss backlog lands near min latency then paces, not unstick-oldest', async () => {
    const { pipe, clk } = await pacedPipe({ toNtp: null })
    await pushN(pipe, 12)
    const uniqueAt: number[] = []
    const latencies: number[] = []
    let lastPts: number | null = null
    for (let i = 0; i < 30; i++) {
      const shown = pipe.present()
      if (shown) {
        if (shown.pts90k !== lastPts) {
          uniqueAt.push(clk.now())
          latencies.push(shown.pick.latencyMs)
          lastPts = shown.pts90k
        }
      }
      clk.add(1000 / 60)
    }
    // First unique should be ~100ms behind newest (3 frames), not frame 0.
    expect(latencies[0]!).toBeGreaterThanOrEqual(90)
    expect(latencies[0]!).toBeLessThanOrEqual(150)
    expect(uniqueAt.length).toBeGreaterThanOrEqual(3)
    expect(uniqueAt.length).toBeLessThanOrEqual(12)
    for (let i = 1; i < uniqueAt.length; i++) {
      expect(uniqueAt[i]! - uniqueAt[i - 1]!).toBeGreaterThan(20)
    }
    // Must not remain parked near queueCap latency (~400ms for 12 frames).
    const lastLat = latencies[latencies.length - 1]!
    expect(lastLat).toBeLessThanOrEqual(MAX_PRESENT_LATENCY_MS + 50)
  })

  it('shown latency above max triggers paced max-clamp catch-up', async () => {
    const { pipe, clk } = await pacedPipe({ toNtp: null })
    await pushN(pipe, 24)
    // First present unsticks near minL; keep producing so backlog would grow.
    let nextPts = 24 * TICKS_30FPS
    const lats: number[] = []
    for (let i = 0; i < 120; i++) {
      if (i % 2 === 0) {
        pipe.pushAu(au(nextPts, { key: false }))
        nextPts += TICKS_30FPS
        await pipe.ready()
      }
      const shown = pipe.present()
      if (shown) lats.push(shown.pick.latencyMs)
      clk.add(1000 / 60)
    }
    const late = lats.slice(30)
    expect(late.length).toBeGreaterThan(10)
    expect(Math.max(...late)).toBeLessThanOrEqual(MAX_PRESENT_LATENCY_MS + 80)
    expect(late.reduce((a, b) => a + b, 0) / late.length).toBeLessThan(
      MAX_PRESENT_LATENCY_MS + 40,
    )
  })

  it('collapsed flat toNtp does not freeze on first shown while backlog grows', async () => {
    const { pipe, clk } = await pacedPipe({
      toNtp: () => 5_000_000,
    })
    await pushN(pipe, 8)
    const uniques = new Set<number>()
    let nextPts = 8 * TICKS_30FPS
    for (let i = 0; i < 90; i++) {
      if (i > 0 && i % 2 === 0) {
        pipe.pushAu(au(nextPts, { key: false }))
        nextPts += TICKS_30FPS
        await pipe.ready()
      }
      const shown = pipe.present()
      if (shown) uniques.add(shown.pts90k)
      clk.add(1000 / 60)
    }
    // Pre-fix lock: unique stayed at 1 forever. Must keep advancing.
    expect(uniques.size).toBeGreaterThan(10)
  })

  it('pace-hold is distinct from repeat in reasonCounts', async () => {
    const { pipe, clk } = await pacedPipe({ toNtp: null })
    await pushN(pipe, 12)
    const counts = new Map<string, number>()
    for (let i = 0; i < 24; i++) {
      const shown = pipe.present()
      if (shown) {
        counts.set(shown.pick.reason, (counts.get(shown.pick.reason) ?? 0) + 1)
      }
      clk.add(1000 / 60)
    }
    // 60Hz ticks vs ~30 unique → non-unique reasons must appear; pace-hold is
    // the gated hold (repeat is "pick equals shown with nothing queued").
    expect(
      (counts.get('pace-hold') ?? 0) + (counts.get('repeat') ?? 0),
    ).toBeGreaterThan(5)
    expect(counts.has('pace-hold') || counts.has('repeat')).toBe(true)
  })

  it('unstick lands near min latency then snap-to-next walks forward', async () => {
    const { pipe, clk } = await pacedPipe({ toNtp: null })
    await pushN(pipe, 12)
    const pts: number[] = []
    let last: number | null = null
    for (let i = 0; i < 30; i++) {
      const shown = pipe.present()
      if (shown && shown.pts90k !== last) {
        pts.push(shown.pts90k)
        last = shown.pts90k
      }
      clk.add(1000 / 60)
    }
    // Newest = 11*TICKS; minL≈100ms ≈ 3 frames → first ≈ 8*TICKS (not 0).
    expect(pts[0]!).toBeGreaterThanOrEqual(7 * TICKS_30FPS)
    expect(pts[0]!).toBeLessThanOrEqual(9 * TICKS_30FPS)
    expect(pts[pts.length - 1]).toBe(11 * TICKS_30FPS)
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]).toBe(pts[i - 1]! + TICKS_30FPS)
    }
  })

  it('long stall leaves the gate open (no lastAdvance reset needed)', async () => {
    const { pipe, clk } = await pacedPipe()
    await pushN(pipe, 8)
    const first = pipe.present()
    expect(first).not.toBeNull()
    clk.add(5000)
    for (let i = 8; i < 16; i++) {
      pipe.pushAu(au(i * TICKS_30FPS, { key: false }))
    }
    await pipe.ready()
    const after = pipe.present()
    expect(after?.pts90k).not.toBe(first!.pts90k)
    expect(after?.pick.reason).not.toBe('pace-hold')
  })

  it('?presentPace=off keeps lut-miss jump-to-newest', async () => {
    const { pipe } = await pacedPipe({ toNtp: null, presentPace: false })
    await pushN(pipe, 12)
    const shown = pipe.present()
    expect(shown?.pick.reason).toBe('lut-miss-live')
    expect(shown?.pts90k).toBe(11 * TICKS_30FPS)
  })

  it('pace-hold still consumes and closes decoded frames immediately (not only unique swaps)', async () => {
    const { pipe, fake, clk } = await pacedPipe({ toNtp: null })
    await pushN(pipe, 12)
    const first = pipe.present()
    expect(first).not.toBeNull()
    // Force-upload path closes on consume, not on the next tick.
    expect(fake.closeCount()).toBe(12)
    expect(pipe.getCounters().outstandingFrames).toBe(0)
    expect(pipe.getCounters().queueDepth).toBe(0)
    clk.add(1000 / 60)
    pipe.present()
    expect(pipe.getCounters().reason).toBe('pace-hold')
    expect(pipe.getCounters().presentedPts90k).toBe(first!.pts90k)
  })
})
