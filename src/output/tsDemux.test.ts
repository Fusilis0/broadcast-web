import { describe, expect, it } from 'vitest'
import { PTS_MOD_33, ptsDiff33 } from '../telemetry/ptsNtpMap.ts'
import {
  STREAM_TYPE_H264,
  STREAM_TYPE_HEVC,
  TS_PACKET_SIZE,
  TS_SYNC_BYTE,
  createPtsUnwrapper,
  createTsDemuxer,
  isKeyframe,
  pts90kToTimestampUs,
  readPts,
  resolveCodecString,
  unescapeRbsp,
  writePts,
} from './tsDemux.ts'

const PMT_PID = 0x1000
const VIDEO_PID = 0x0100
const PAT_PID = 0

function tsPacket(
  pid: number,
  payload: Uint8Array,
  opts: { pusi?: boolean; cc?: number; discontinuity?: boolean } = {},
): Uint8Array {
  const pkt = new Uint8Array(TS_PACKET_SIZE)
  pkt.fill(0xff)
  pkt[0] = TS_SYNC_BYTE
  pkt[1] = (opts.pusi ? 0x40 : 0) | ((pid >> 8) & 0x1f)
  pkt[2] = pid & 0xff
  const withAf = opts.discontinuity === true
  const afc = withAf ? 3 : 1
  pkt[3] = (afc << 4) | ((opts.cc ?? 0) & 0x0f)
  let offset = 4
  if (withAf) {
    pkt[4] = 1
    pkt[5] = 0x80
    offset = 6
  }
  const room = TS_PACKET_SIZE - offset
  pkt.fill(0xff, offset)
  pkt.set(payload.subarray(0, room), offset)
  return pkt
}

function splitPackets(bytes: Uint8Array): Uint8Array {
  return bytes
}

function packPackets(packets: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(packets.length * TS_PACKET_SIZE)
  for (let i = 0; i < packets.length; i++) {
    out.set(packets[i]!, i * TS_PACKET_SIZE)
  }
  return out
}

function sectionPacket(pid: number, section: Uint8Array, cc = 0): Uint8Array {
  const payload = new Uint8Array(1 + section.length)
  payload[0] = 0
  payload.set(section, 1)
  return tsPacket(pid, payload, { pusi: true, cc })
}

function patSection(pmtPid = PMT_PID): Uint8Array {
  const body = new Uint8Array(8 + 4 + 4)
  body[0] = 0x00
  body[1] = 0xb0
  body[2] = 13
  body[3] = 0x00
  body[4] = 0x01
  body[5] = 0xc1
  body[6] = 0x00
  body[7] = 0x00
  body[8] = 0x00
  body[9] = 0x01
  body[10] = 0xe0 | ((pmtPid >> 8) & 0x1f)
  body[11] = pmtPid & 0xff
  return body
}

function pmtSection(
  videoPid = VIDEO_PID,
  streamType: number = STREAM_TYPE_HEVC,
): Uint8Array {
  const body = new Uint8Array(12 + 5 + 4)
  body[0] = 0x02
  body[1] = 0xb0
  body[2] = 18
  body[3] = 0x00
  body[4] = 0x01
  body[5] = 0xc1
  body[6] = 0x00
  body[7] = 0x00
  body[8] = 0xe0 | ((videoPid >> 8) & 0x1f)
  body[9] = videoPid & 0xff
  body[10] = 0xf0
  body[11] = 0x00
  body[12] = streamType
  body[13] = 0xe0 | ((videoPid >> 8) & 0x1f)
  body[14] = videoPid & 0xff
  body[15] = 0xf0
  body[16] = 0x00
  return body
}

function annexB(nals: Uint8Array[]): Uint8Array {
  let len = 0
  for (const n of nals) len += 4 + n.length
  const out = new Uint8Array(len)
  let o = 0
  for (const n of nals) {
    out[o] = 0
    out[o + 1] = 0
    out[o + 2] = 0
    out[o + 3] = 1
    out.set(n, o + 4)
    o += 4 + n.length
  }
  return out
}

/** HEVC VPS NAL type 32 → first byte 0x40. */
const HEVC_VPS = new Uint8Array([0x40, 0x01, 0x0c, 0x01, 0xff, 0xff, 0x01, 0x60])
/** HEVC SPS NAL type 33 → 0x42. */
const HEVC_SPS = new Uint8Array([0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x03])
/** HEVC PPS NAL type 34 → 0x44. */
const HEVC_PPS = new Uint8Array([0x44, 0x01, 0xc0, 0x73, 0xc0, 0x4c, 0x90])
/** HEVC IDR_W_RADL (19) → 0x26. */
const HEVC_IDR = new Uint8Array([0x26, 0x01, 0xaf, 0x08, 0x00, 0x01, 0x02, 0x03])
/** HEVC TRAIL_R (1) → 0x02. */
const HEVC_TRAIL = new Uint8Array([0x02, 0x01, 0xaf, 0x08, 0x00, 0x01, 0x02, 0x03])

const H264_SPS = new Uint8Array([0x67, 0x64, 0x00, 0x28, 0xac, 0x2b])
const H264_PPS = new Uint8Array([0x68, 0xee, 0x3c, 0x80])
const H264_IDR = new Uint8Array([0x65, 0x88, 0x80, 0x10, 0x00])
const H264_NONIDR = new Uint8Array([0x41, 0x9a, 0x00, 0x10])

function pesPacket(
  pts90k: number,
  payload: Uint8Array,
  streamId = 0xe0,
): Uint8Array {
  const pts = writePts(pts90k)
  const headerLen = 3 + pts.length
  const packetLength = headerLen + payload.length
  const out = new Uint8Array(6 + packetLength)
  out[0] = 0x00
  out[1] = 0x00
  out[2] = 0x01
  out[3] = streamId
  out[4] = (packetLength >> 8) & 0xff
  out[5] = packetLength & 0xff
  out[6] = 0x80
  out[7] = 0x80
  out[8] = pts.length
  out.set(pts, 9)
  out.set(payload, 9 + pts.length)
  return out
}

function pesToTs(
  pes: Uint8Array,
  pid = VIDEO_PID,
  startCc = 0,
): Uint8Array[] {
  const packets: Uint8Array[] = []
  let offset = 0
  let cc = startCc
  let first = true
  while (offset < pes.length) {
    const room = TS_PACKET_SIZE - 4
    const slice = pes.subarray(offset, offset + room)
    packets.push(tsPacket(pid, slice, { pusi: first, cc }))
    first = false
    offset += slice.length
    cc = (cc + 1) & 0x0f
  }
  return packets
}

function programTs(
  frames: { pts90k: number; payload: Uint8Array }[],
  streamType: number = STREAM_TYPE_HEVC,
): Uint8Array {
  const packets = [
    sectionPacket(PAT_PID, patSection(), 0),
    sectionPacket(PMT_PID, pmtSection(VIDEO_PID, streamType), 0),
  ]
  let cc = 0
  for (const f of frames) {
    const pes = pesPacket(f.pts90k, f.payload)
    const ts = pesToTs(pes, VIDEO_PID, cc)
    packets.push(...ts)
    cc = (cc + ts.length) & 0x0f
  }
  return packPackets(packets)
}

describe('writePts / readPts', () => {
  it('round-trips exact 33-bit values including wrap-adjacent', () => {
    const samples = [0, 1, 3000, 90_000, 0x1ffffffff, PTS_MOD_33 - 1, PTS_MOD_33 - 100]
    for (const pts of samples) {
      const bytes = writePts(pts)
      expect(readPts(bytes, 0)).toBe(pts % PTS_MOD_33 === pts ? pts : pts % PTS_MOD_33)
      expect(readPts(bytes, 0)).toBe(pts < PTS_MOD_33 ? pts : pts % PTS_MOD_33)
    }
    expect(readPts(writePts(PTS_MOD_33 - 1), 0)).toBe(PTS_MOD_33 - 1)
    expect(readPts(writePts(0), 0)).toBe(0)
  })
})

describe('createPtsUnwrapper', () => {
  it('matches TEL-01 shortest-signed wrap (continuous unwrapped PTS)', () => {
    const unwrap = createPtsUnwrapper()
    const nearWrap = PTS_MOD_33 - 100
    expect(unwrap.unwrap(nearWrap)).toBe(nearWrap)
    const after = unwrap.unwrap(50)
    expect(after).toBe(nearWrap + ptsDiff33(nearWrap, 50))
    expect(after).toBe(PTS_MOD_33 + 50)
    expect(unwrap.unwrap(3050)).toBe(PTS_MOD_33 + 3050)
  })
})

describe('createTsDemuxer', () => {
  it('emits HEVC AUs with exact PES PTS', () => {
    const idr = annexB([HEVC_VPS, HEVC_SPS, HEVC_PPS, HEVC_IDR])
    const trail = annexB([HEVC_TRAIL])
    const ts = programTs(
      [
        { pts90k: 0, payload: idr },
        { pts90k: 3000, payload: trail },
        { pts90k: 6000, payload: trail },
      ],
      STREAM_TYPE_HEVC,
    )
    const demux = createTsDemuxer()
    const aus = demux.push(ts)
    expect(aus).toHaveLength(3)
    expect(aus.map((a) => a.pts90k)).toEqual([0, 3000, 6000])
    expect(aus.every((a) => a.codec === 'hevc')).toBe(true)
    expect(aus[0]!.keyframe).toBe(true)
    expect(aus[1]!.keyframe).toBe(false)
    expect(aus[2]!.keyframe).toBe(false)
    expect(demux.videoPid()).toBe(VIDEO_PID)
    expect(demux.codec()).toBe('hevc')
  })

  it('emits H.264 IDR vs non-IDR with exact PTS', () => {
    const idr = annexB([H264_SPS, H264_PPS, H264_IDR])
    const p = annexB([H264_NONIDR])
    const ts = programTs(
      [
        { pts90k: 90000, payload: idr },
        { pts90k: 93000, payload: p },
      ],
      STREAM_TYPE_H264,
    )
    const aus = createTsDemuxer().push(ts)
    expect(aus.map((a) => a.pts90k)).toEqual([90000, 93000])
    expect(aus[0]!.codec).toBe('h264')
    expect(aus[0]!.keyframe).toBe(true)
    expect(aus[1]!.keyframe).toBe(false)
    expect(isKeyframe(aus[0]!.data, 'h264')).toBe(true)
  })

  it('preserves PTS when a PES is split across chunk boundaries', () => {
    const idr = annexB([HEVC_VPS, HEVC_SPS, HEVC_PPS, HEVC_IDR])
    const ts = programTs([{ pts90k: 123456, payload: idr }], STREAM_TYPE_HEVC)
    expect(ts.length).toBeGreaterThan(TS_PACKET_SIZE * 2)

    const splitAt = TS_PACKET_SIZE + 40
    const demux = createTsDemuxer()
    const first = demux.push(ts.subarray(0, splitAt))
    const second = demux.push(ts.subarray(splitAt))
    const aus = [...first, ...second]
    expect(aus).toHaveLength(1)
    expect(aus[0]!.pts90k).toBe(123456)
    expect(aus[0]!.keyframe).toBe(true)
  })

  it('preserves PTS when the split is inside the PES header', () => {
    const payload = annexB([HEVC_IDR])
    const pes = pesPacket(777000, payload)
    const packets = [
      sectionPacket(PAT_PID, patSection(), 0),
      sectionPacket(PMT_PID, pmtSection(), 0),
      ...pesToTs(pes),
    ]
    const ts = packPackets(packets)
    const headerBytes = 2 * TS_PACKET_SIZE + 10
    const demux = createTsDemuxer()
    expect(demux.push(ts.subarray(0, headerBytes))).toEqual([])
    const aus = demux.push(ts.subarray(headerBytes))
    expect(aus).toHaveLength(1)
    expect(aus[0]!.pts90k).toBe(777000)
  })

  it('unwraps 33-bit wrap across AUs to TEL-01 convention', () => {
    const idr = annexB([HEVC_VPS, HEVC_SPS, HEVC_PPS, HEVC_IDR])
    const trail = annexB([HEVC_TRAIL])
    const near = PTS_MOD_33 - 3000
    const ts = programTs(
      [
        { pts90k: near, payload: idr },
        { pts90k: 0, payload: trail },
        { pts90k: 3000, payload: trail },
      ],
      STREAM_TYPE_HEVC,
    )
    const aus = createTsDemuxer().push(ts)
    expect(aus.map((a) => a.pts90k)).toEqual([near, 0, 3000])
    const unwrap = createPtsUnwrapper()
    const unwrapped = aus.map((a) => unwrap.unwrap(a.pts90k))
    expect(unwrapped[0]).toBe(near)
    expect(unwrapped[1]).toBe(PTS_MOD_33)
    expect(unwrapped[2]).toBe(PTS_MOD_33 + 3000)
  })

  it('joins mid-stream (no PAT yet) once a video PES arrives', () => {
    const trail = annexB([HEVC_TRAIL])
    const idr = annexB([HEVC_IDR])
    const latePat = programTs(
      [{ pts90k: 9000, payload: idr }],
      STREAM_TYPE_HEVC,
    )
    const earlyPes = packPackets(pesToTs(pesPacket(3000, trail)))
    const demux = createTsDemuxer()
    const early = demux.push(earlyPes)
    expect(early).toHaveLength(1)
    expect(early[0]!.pts90k).toBe(3000)
    const later = demux.push(latePat)
    expect(later.some((a) => a.pts90k === 9000)).toBe(true)
  })

  it('survives a discontinuity flag and keeps later PTS exact', () => {
    const idr = annexB([HEVC_IDR])
    const pes = pesPacket(12000, idr)
    const disc = tsPacket(VIDEO_PID, pes.subarray(0, 20), {
      pusi: true,
      discontinuity: true,
      cc: 3,
    })
    const rest = pesToTs(pes)
    const ts = packPackets([
      sectionPacket(PAT_PID, patSection()),
      sectionPacket(PMT_PID, pmtSection()),
      disc,
      ...rest,
    ])
    const aus = createTsDemuxer().push(ts)
    expect(aus.some((a) => a.pts90k === 12000)).toBe(true)
  })
})

describe('pts90kToTimestampUs', () => {
  it('converts 90 kHz to microseconds without rewriting the tick', () => {
    expect(pts90kToTimestampUs(0)).toBe(0)
    expect(pts90kToTimestampUs(90_000)).toBe(1_000_000)
    expect(pts90kToTimestampUs(3000)).toBe(Math.round(3000 * (1e6 / 9e4)))
  })
})

describe('splitPackets helper', () => {
  it('keeps generator packets 188 bytes', () => {
    const pkt = tsPacket(1, new Uint8Array([1, 2, 3]), { pusi: true })
    expect(pkt.length).toBe(TS_PACKET_SIZE)
    expect(pkt[0]).toBe(TS_SYNC_BYTE)
    expect(splitPackets(pkt)).toBe(pkt)
  })
})

describe('unescapeRbsp / HEVC codec string', () => {
  it('drops emulation-prevention 0x03 after 0x0000', () => {
    expect(
      [...unescapeRbsp(new Uint8Array([0x00, 0x00, 0x03, 0x01]))],
    ).toEqual([0x00, 0x00, 0x01])
  })

  it('does not put 000003 into hev1 when SPS RBSP contains EPB', () => {
    const sps = new Uint8Array([
      0x42, 0x01, 0x01, 0x01, 0x60, 0x00, 0x00, 0x03, 0x00, 0xb0, 0x00, 0x00,
      0x03, 0x00, 0x00, 0x03, 0x00, 0x78, 0x90,
    ])
    const str = resolveCodecString(annexB([sps]), 'hevc')
    expect(str.startsWith('hev1.')).toBe(true)
    expect(str.includes('000003')).toBe(false)
  })
})
