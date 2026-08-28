import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  STREAM_TYPE_HEVC,
  TS_PACKET_SIZE,
  TS_SYNC_BYTE,
  writePts,
} from './tsDemux.ts'
import {
  HEVC_UNSUPPORTED_MESSAGE,
  type DecoderConfigLike,
  type EncodedChunkLike,
  type VideoDecoderFactory,
  type VideoDecoderLike,
  type VideoFrameLike,
} from './videoDecodePipeline.ts'
import {
  WARM_STREAM_CAP,
  startVideoStreamManager,
  type StreamTextureLike,
} from './videoStreamManager.ts'

const VIDEO_PID = 0x0100
const PMT_PID = 0x1000
const HEVC_IDR = new Uint8Array([0x26, 0x01, 0xaf, 0x00])
const HEVC_TRAIL = new Uint8Array([0x02, 0x01, 0xaf, 0x00])

function tsPacket(pid: number, payload: Uint8Array, pusi: boolean, cc: number): Uint8Array {
  const pkt = new Uint8Array(TS_PACKET_SIZE)
  pkt.fill(0xff)
  pkt[0] = TS_SYNC_BYTE
  pkt[1] = (pusi ? 0x40 : 0) | ((pid >> 8) & 0x1f)
  pkt[2] = pid & 0xff
  pkt[3] = (1 << 4) | (cc & 0x0f)
  pkt.set(payload.subarray(0, TS_PACKET_SIZE - 4), 4)
  return pkt
}

function annexB(nal: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + nal.length)
  out[3] = 1
  out.set(nal, 4)
  return out
}

function pes(pts90k: number, payload: Uint8Array): Uint8Array {
  const pts = writePts(pts90k)
  const packetLength = 3 + pts.length + payload.length
  const out = new Uint8Array(6 + packetLength)
  out[2] = 1
  out[3] = 0xe0
  out[4] = (packetLength >> 8) & 0xff
  out[5] = packetLength & 0xff
  out[6] = 0x80
  out[7] = 0x80
  out[8] = pts.length
  out.set(pts, 9)
  out.set(payload, 9 + pts.length)
  return out
}

function section(pid: number, tableId: number, rest: Uint8Array): Uint8Array {
  const payload = new Uint8Array(1 + 1 + rest.length)
  payload[1] = tableId
  payload.set(rest, 2)
  return tsPacket(pid, payload, true, 0)
}

function oneFrameTs(pts90k: number, key: boolean): Uint8Array {
  const pat = section(
    0,
    0x00,
    new Uint8Array([0xb0, 13, 0, 1, 0xc1, 0, 0, 0, 1, 0xe0 | ((PMT_PID >> 8) & 0x1f), PMT_PID & 0xff]),
  )
  const pmtBody = new Uint8Array([
    0xb0, 18, 0, 1, 0xc1, 0, 0,
    0xe0 | ((VIDEO_PID >> 8) & 0x1f), VIDEO_PID & 0xff,
    0xf0, 0,
    STREAM_TYPE_HEVC,
    0xe0 | ((VIDEO_PID >> 8) & 0x1f), VIDEO_PID & 0xff,
    0xf0, 0,
  ])
  const pmt = section(PMT_PID, 0x02, pmtBody)
  const nal = key ? HEVC_IDR : HEVC_TRAIL
  const body = pes(pts90k, annexB(nal))
  const packets = [pat, pmt]
  let cc = 0
  let offset = 0
  let first = true
  while (offset < body.length) {
    const slice = body.subarray(offset, offset + TS_PACKET_SIZE - 4)
    packets.push(tsPacket(VIDEO_PID, slice, first, cc))
    first = false
    offset += slice.length
    cc = (cc + 1) & 0x0f
  }
  const out = new Uint8Array(packets.length * TS_PACKET_SIZE)
  packets.forEach((p, i) => out.set(p, i * TS_PACKET_SIZE))
  return out
}

function fakeFactory(hevcSupported = true): {
  factory: VideoDecoderFactory
  closedDecoders: VideoDecoderLike[]
  frames: VideoFrameLike[]
} {
  const closedDecoders: VideoDecoderLike[] = []
  const frames: VideoFrameLike[] = []
  const factory: VideoDecoderFactory = {
    async isConfigSupported(config: DecoderConfigLike) {
      const hevc = config.codec.startsWith('hev1') || config.codec.startsWith('hvc1')
      return { supported: hevc ? hevcSupported : true }
    },
    create(init) {
      const handle: VideoDecoderLike = {
        state: 'unconfigured',
        configure() {
          handle.state = 'configured'
        },
        decode(chunk: EncodedChunkLike) {
          const frame: VideoFrameLike & { closed: boolean } = {
            timestamp: chunk.timestamp,
            codedWidth: 1920,
            codedHeight: 1080,
            displayWidth: 1920,
            displayHeight: 1080,
            closed: false,
            close() {
              if ((frame as { closed: boolean }).closed) {
                throw new Error('double close')
              }
              ;(frame as { closed: boolean }).closed = true
            },
          }
          frames.push(frame)
          init.output(frame)
        },
        reset() {
          handle.state = 'configured'
        },
        close() {
          handle.state = 'closed'
          closedDecoders.push(handle)
        },
      }
      return handle
    },
  }
  return { factory, closedDecoders, frames }
}

function fakeTexture(): StreamTextureLike {
  return {
    image: null,
    needsUpdate: false,
    colorSpace: 'srgb',
    dispose() {},
  }
}

describe('startVideoStreamManager', () => {
  const managers: Array<{ dispose(): void }> = []
  afterEach(() => {
    while (managers.length) managers.pop()!.dispose()
  })

  it('decodes 4 streams without PTS crosstalk and swaps texture with no null bind', async () => {
    const fake = fakeFactory()
    const bound: StreamTextureLike[] = []
    const textures: StreamTextureLike[] = []
    const mgr = startVideoStreamManager({
      setTexture: (tex) => {
        if (tex === null) bound.push(tex as unknown as StreamTextureLike)
        else bound.push(tex)
      },
      decoderFactory: fake.factory,
      createTexture: () => {
        const t = fakeTexture()
        textures.push(t)
        return t
      },
      getNewestPoseNtp: () => null,
      warmCap: 4,
    })
    managers.push(mgr)

    const ids = ['a', 'b', 'c', 'd']
    for (const id of ids) {
      mgr.pushBytes(id, oneFrameTs(id.charCodeAt(0) * 3000, true))
    }
    await mgr.ready()
    mgr.setActivePov('a')
    mgr.present()
    expect(mgr.listPovIds().sort()).toEqual(ids)
    expect(bound.every((t) => t !== null)).toBe(true)

    const ptsA = mgr.getCounters('a')?.presentedPts90k
    const ptsB = mgr.getCounters('b')?.presentedPts90k
    expect(ptsA).not.toBe(ptsB)
    expect(ptsA).toBe('a'.charCodeAt(0) * 3000)
    expect(ptsB).toBe('b'.charCodeAt(0) * 3000)

    const before = bound[bound.length - 1]
    mgr.setActivePov('c')
    mgr.present()
    const after = bound[bound.length - 1]
    expect(after).not.toBe(before)
    expect(after).not.toBeNull()
    expect(mgr.getActiveCounters()?.povId).toBe('c')
  })

  it('LRU-evicts beyond the warm cap and closes the decoder', async () => {
    const fake = fakeFactory()
    const mgr = startVideoStreamManager({
      setTexture: () => {},
      decoderFactory: fake.factory,
      createTexture: fakeTexture,
      warmCap: WARM_STREAM_CAP,
      nowMs: (() => {
        let t = 0
        return () => {
          t += 1
          return t
        }
      })(),
    })
    managers.push(mgr)

    for (const id of ['1', '2', '3', '4']) {
      mgr.pushBytes(id, oneFrameTs(0, true))
    }
    await mgr.ready()
    mgr.setActivePov('4')
    mgr.pushBytes('5', oneFrameTs(0, true))
    await mgr.ready()
    expect(mgr.listPovIds()).toHaveLength(4)
    expect(mgr.listPovIds()).toContain('5')
    expect(mgr.listPovIds()).not.toContain('1')
    expect(mgr.listPovIds()).toContain('4')
    expect(fake.closedDecoders.length).toBeGreaterThanOrEqual(1)
  })

  it('HEVC-unsupported surfaces the ops error on that stream only', async () => {
    const errors: Array<{ povId: string; message: string }> = []
    const fake = fakeFactory(false)
    const mgr = startVideoStreamManager({
      setTexture: () => {},
      decoderFactory: fake.factory,
      createTexture: fakeTexture,
      onOpsError: (povId, message) => errors.push({ povId, message }),
    })
    managers.push(mgr)
    mgr.pushBytes('cam', oneFrameTs(0, true))
    await mgr.ready()
    expect(errors).toEqual([
      { povId: 'cam', message: HEVC_UNSUPPORTED_MESSAGE },
    ])
    expect(mgr.getCounters('cam')?.decodeError).toBe(HEVC_UNSUPPORTED_MESSAGE)
  })

  it('dispose leaves zero outstanding frames and no leaked decoders', async () => {
    const fake = fakeFactory()
    const mgr = startVideoStreamManager({
      setTexture: () => {},
      decoderFactory: fake.factory,
      createTexture: fakeTexture,
    })
    mgr.pushBytes('x', oneFrameTs(0, true))
    await mgr.ready()
    mgr.setActivePov('x')
    mgr.present()
    const outstanding = mgr.getCounters('x')!.outstandingFrames
    expect(outstanding).toBeGreaterThan(0)
    mgr.dispose()
    expect(mgr.listPovIds()).toEqual([])
    expect(fake.closedDecoders.length).toBeGreaterThanOrEqual(1)
    expect(fake.frames.every((f) => (f as { closed?: boolean }).closed)).toBe(
      true,
    )
  })
})

describe('main.ts wiring (DSP-OUT-06)', () => {
  it('starts the stream manager below startVideoBackground and tears it down first', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    const bg = main.indexOf('startVideoBackground')
    const mgr = main.indexOf('startVideoStreamManager')
    expect(bg).toBeGreaterThan(0)
    expect(mgr).toBeGreaterThan(bg)
    const dispose = main.indexOf('videoStreamManager?.dispose()')
    const stopBg = main.indexOf('videoBackground?.stop()')
    expect(dispose).toBeGreaterThan(0)
    expect(stopBg).toBeGreaterThan(dispose)
    expect(main).toContain('transcodeToH264: true')
    expect(main).toContain('resetForH264Fallback')
    expect(main).toContain('maybeFallbackSrtDecodeStall')
    expect(main).toContain('beginFfmpegH264Fallback')
    expect(main).toContain('getPtsNtpMap(lutId).reset()')
    expect(main).toContain('getPtsNtpMap(povId).reset()')
  })
})
