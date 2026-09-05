import { afterEach, describe, expect, it } from 'vitest'
import type { DemuxedAccessUnit } from './tsDemux.ts'
import {
  createVideoDecodePipeline,
  type DecoderConfigLike,
  type EncodedChunkLike,
  type VideoDecoderFactory,
  type VideoDecoderLike,
  type VideoFrameLike,
} from './videoDecodePipeline.ts'
import {
  intervalHistogram,
  loadPresentPaceReplay131s,
} from './presentPaceReplay.ts'

const TICKS_30FPS = 3000

function au(
  pts90k: number,
  opts: { key?: boolean } = {},
): DemuxedAccessUnit {
  const key = opts.key ?? false
  const nal = key
    ? new Uint8Array([0, 0, 0, 1, 0x26, 0x01, 0x00])
    : new Uint8Array([0, 0, 0, 1, 0x02, 0x01, 0x00])
  return { data: nal, pts90k, keyframe: key, codec: 'hevc' }
}

type FakeFrame = VideoFrameLike & { closed: boolean }

function createFakeFactory(): {
  factory: VideoDecoderFactory
  closeCount: () => number
} {
  const framesCreated: FakeFrame[] = []
  const factory: VideoDecoderFactory = {
    async isConfigSupported(_config: DecoderConfigLike) {
      return { supported: true }
    },
    create(init) {
      const handle: VideoDecoderLike = {
        state: 'unconfigured',
        configure() {
          handle.state = 'configured'
        },
        decode(chunk: EncodedChunkLike) {
          const frame: FakeFrame = {
            timestamp: chunk.timestamp,
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
      return handle
    },
  }
  return {
    factory,
    closeCount: () => framesCreated.filter((f) => f.closed).length,
  }
}

describe('hybrid present() 131s live replay (not a synthetic clock)', () => {
  const pipes: Array<{ dispose(): void }> = []
  afterEach(() => {
    while (pipes.length) pipes.pop()!.dispose()
  })

  it('records the failed live unique histogram as the before baseline', () => {
    const replay = loadPresentPaceReplay131s()
    expect(replay.seconds).toBe(131)
    expect(replay.tickN).toBe(7701)
    const live = intervalHistogram(replay.liveUniqueIntervalsMs)
    expect(live.meanMs).toBeGreaterThan(42)
    expect(live.meanMs).toBeLessThan(45)
    expect(live.pct.lt20).toBeLessThan(1)
    expect(live.pct.b20_40).toBeGreaterThan(40)
    expect(live.pct.b20_40).toBeLessThan(52)
    expect(live.pct.b40_60).toBeGreaterThan(40)
    expect(live.pct.gte60).toBeGreaterThan(7)
    const qd = replay.queueDepthBySecond.filter(
      (d): d is number => typeof d === 'number',
    )
    expect(qd.length).toBe(131)
    expect(qd.reduce((a, b) => a + b, 0) / qd.length).toBeGreaterThan(9)
    expect(Math.max(...qd)).toBeGreaterThanOrEqual(10)
  })

  it('hybrid consume + paced display on that tick/AU tape is ~33ms and does not park queueDepth at 10', async () => {
    const replay = loadPresentPaceReplay131s()
    const fake = createFakeFactory()
    let t = 0
    const pipe = createVideoDecodePipeline({
      decoderFactory: fake.factory,
      toNtp: (pts) => pts / 90,
      getNewestPoseNtp: () => 1e12,
      presentPace: true,
      nowMs: () => t,
    })
    pipes.push(pipe)

    const uniqueAt: number[] = []
    let lastPts: number | null = null
    let nextPts = 0
    let maxOutstanding = 0
    let maxQueueDepth = 0
    let stuckAtTen = 0
    const depths: number[] = []
    const reasons = new Map<string, number>()

    for (let i = 0; i < replay.tickN; i++) {
      const arrivals = replay.auPerTick[i] ?? 0
      for (let k = 0; k < arrivals; k++) {
        pipe.pushAu(au(nextPts, { key: nextPts === 0 }))
        nextPts += TICKS_30FPS
      }
      if (arrivals > 0) await pipe.ready()
      const shown = pipe.present()
      const c = pipe.getCounters()
      maxOutstanding = Math.max(maxOutstanding, c.outstandingFrames)
      maxQueueDepth = Math.max(maxQueueDepth, c.queueDepth)
      depths.push(c.queueDepth)
      if (c.queueDepth >= 10) stuckAtTen += 1
      if (shown) {
        reasons.set(shown.pick.reason, (reasons.get(shown.pick.reason) ?? 0) + 1)
        if (shown.pts90k !== lastPts) {
          uniqueAt.push(t)
          lastPts = shown.pts90k
        }
      }
      t += replay.tickIntervalMs[i] ?? 0
    }

    const intervals: number[] = []
    for (let i = 1; i < uniqueAt.length; i++) {
      intervals.push(uniqueAt[i]! - uniqueAt[i - 1]!)
    }
    const after = intervalHistogram(intervals)
    const live = intervalHistogram(replay.liveUniqueIntervalsMs)
    const meanDepth =
      depths.reduce((a, b) => a + b, 0) / Math.max(1, depths.length)

    console.info(
      `[present-pace-replay] ${JSON.stringify({
        live: {
          n: live.n,
          meanMs: Number(live.meanMs.toFixed(2)),
          pct: {
            lt20: Number(live.pct.lt20.toFixed(1)),
            b20_40: Number(live.pct.b20_40.toFixed(1)),
            b40_60: Number(live.pct.b40_60.toFixed(1)),
            gte60: Number(live.pct.gte60.toFixed(1)),
          },
        },
        hybrid: {
          n: after.n,
          meanMs: Number(after.meanMs.toFixed(2)),
          pct: {
            lt20: Number(after.pct.lt20.toFixed(1)),
            b20_40: Number(after.pct.b20_40.toFixed(1)),
            b40_60: Number(after.pct.b40_60.toFixed(1)),
            gte60: Number(after.pct.gte60.toFixed(1)),
          },
          maxOutstanding,
          maxQueueDepth,
          meanQueueDepth: Number(meanDepth.toFixed(2)),
          stuckAtTen,
        },
      })}`,
    )

    expect(after.n).toBeGreaterThan(live.n * 0.9)
    expect(after.pct.lt20).toBeLessThan(5)
    expect(after.pct.b20_40).toBeGreaterThan(70)
    expect(after.pct.b40_60).toBeLessThan(25)
    expect(after.pct.gte60).toBeLessThan(8)
    expect(after.meanMs).toBeGreaterThan(28)
    expect(after.meanMs).toBeLessThan(38)

    expect(maxOutstanding).toBeLessThan(8)
    expect(maxQueueDepth).toBeLessThan(8)
    expect(stuckAtTen).toBe(0)
    expect(meanDepth).toBeLessThan(4)

    expect(reasons.get('pace-hold') ?? 0).toBeGreaterThan(100)
    expect(reasons.get('pace-hold') ?? 0).toBeGreaterThan(
      reasons.get('repeat') ?? 0,
    )

    // Pose lock: presentedPts90k is the displayed PTS, not newest consumed.
    const newestPts = nextPts - TICKS_30FPS
    const shownPts = pipe.getCounters().presentedPts90k
    expect(shownPts).not.toBeNull()
    expect(shownPts).not.toBe(newestPts)
  })
})
