import { afterEach, describe, expect, it } from 'vitest'
import type { DemuxedAccessUnit } from './tsDemux.ts'
import { PTS_MOD_33 } from '../telemetry/ptsNtpMap.ts'
import {
  HEVC_UNSUPPORTED_MESSAGE,
  MAX_PRESENT_LATENCY_MS,
  MIN_PRESENT_LATENCY_MS,
  PTS_TIMESTAMP_MATCH_US,
  createVideoDecodePipeline,
  lookupPts90k,
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
})
