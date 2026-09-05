import { describe, expect, it } from 'vitest'
import {
  assertIpcDropMechanism,
  loadDecodeErrorReplayFixture,
} from './decodeErrorReplay.ts'
import {
  TS_PACKET_SIZE,
  TS_SYNC_BYTE,
  createTsDemuxer,
} from './tsDemux.ts'
import {
  createVideoDecodePipeline,
  type DecoderConfigLike,
  type EncodedChunkLike,
  type VideoDecoderFactory,
  type VideoDecoderLike,
  type VideoFrameLike,
} from './videoDecodePipeline.ts'
import type { DemuxedAccessUnit } from './tsDemux.ts'

const TICKS_30FPS = 3000
const VIDEO_PID = 0x0100

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

function createFakeFactory(): {
  factory: VideoDecoderFactory
  fireError: (err: unknown) => void
} {
  let errorHandler: ((err: unknown) => void) | undefined
  const factory: VideoDecoderFactory = {
    async isConfigSupported(_config: DecoderConfigLike) {
      return { supported: true }
    },
    create(init) {
      errorHandler = init.error
      const handle: VideoDecoderLike = {
        state: 'unconfigured',
        configure() {
          handle.state = 'configured'
        },
        decode(chunk: EncodedChunkLike) {
          const frame: VideoFrameLike = {
            timestamp: chunk.timestamp,
            codedWidth: 64,
            codedHeight: 36,
            close() {},
          }
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
    fireError: (err) => errorHandler?.(err),
  }
}

function tsPacket(
  pid: number,
  payload: Uint8Array,
  opts: { pusi?: boolean; cc?: number } = {},
): Uint8Array {
  const pkt = new Uint8Array(TS_PACKET_SIZE)
  pkt.fill(0xff)
  pkt[0] = TS_SYNC_BYTE
  pkt[1] = (opts.pusi ? 0x40 : 0) | ((pid >> 8) & 0x1f)
  pkt[2] = pid & 0xff
  pkt[3] = (1 << 4) | ((opts.cc ?? 0) & 0x0f)
  pkt.set(payload.subarray(0, TS_PACKET_SIZE - 4), 4)
  return pkt
}

describe('decodeErrorReplay fixture (item a)', () => {
  it('records IPC-drop → CC-gap mechanism on every live Decoding error.', () => {
    const fx = loadDecodeErrorReplayFixture()
    const { totalErrors, withCcGap, withinIpcDropWindow } =
      assertIpcDropMechanism(fx)
    expect(totalErrors).toBeGreaterThanOrEqual(10)
    // Live sessions: every error within 1.5s of an ipc-drop; ≥85% also show
    // a demux continuity gap in the inter-error delta.
    expect(withinIpcDropWindow).toBe(totalErrors)
    expect(withCcGap / totalErrors).toBeGreaterThanOrEqual(0.85)
    for (const s of fx.sessions) {
      for (const e of s.events) {
        expect(e.message).toBe('Decoding error.')
        expect(e.ptsGap90k).toBe(3000)
      }
    }
  })
})

describe('decode error → keyframe wait (item a freeze)', () => {
  it('forces waitingForKeyframe until the next IDR after Decoding error.', async () => {
    const errors: string[] = []
    const fake = createFakeFactory()
    const pipe = createVideoDecodePipeline({
      decoderFactory: fake.factory,
      presentPace: false,
      onOpsError: (m) => errors.push(m),
    })
    pipe.pushAu(au(0, { key: true }))
    await pipe.ready()
    pipe.pushAu(au(TICKS_30FPS, { key: false }))
    fake.fireError(new Error('Decoding error.'))
    expect(errors).toContain('Decoding error.')
    expect(pipe.getCounters().waitingForKeyframe).toBe(true)

    // Mid-GOP deltas must not clear the wait (this is the visible freeze).
    pipe.pushAu(au(TICKS_30FPS * 2, { key: false }))
    pipe.pushAu(au(TICKS_30FPS * 3, { key: false }))
    expect(pipe.getCounters().waitingForKeyframe).toBe(true)

    pipe.pushAu(au(TICKS_30FPS * 4, { key: true }))
    expect(pipe.getCounters().waitingForKeyframe).toBe(false)
    expect(pipe.getCounters().decodeError).toBeNull()
    pipe.dispose()
  })

  it('demux lossStats increments on CC skip (IPC-splice stand-in)', () => {
    const demux = createTsDemuxer()
    const a = tsPacket(VIDEO_PID, new Uint8Array([1, 2, 3]), {
      pusi: true,
      cc: 0,
    })
    const b = tsPacket(VIDEO_PID, new Uint8Array([4, 5, 6]), {
      pusi: false,
      cc: 2,
    })
    const buf = new Uint8Array(TS_PACKET_SIZE * 2)
    buf.set(a, 0)
    buf.set(b, TS_PACKET_SIZE)
    demux.push(buf)
    expect(demux.lossStats().ccGaps).toBeGreaterThanOrEqual(1)
  })
})
