/**
 * Video-only MPEG-TS demuxer (Phase 17.2).
 *
 * Pure + synchronous: no WebCodecs, no Electron. PTS is the muxer's 33-bit
 * PES value — never rewritten. Unwrap uses TEL-01's shortest-signed 33-bit
 * convention (`maskPts33` / `ptsDiff33`).
 */

import { maskPts33, ptsDiff33 } from '../telemetry/ptsNtpMap.ts'

export const TS_PACKET_SIZE = 188
export const TS_SYNC_BYTE = 0x47
export const PTS_CLOCK_HZ = 90_000
export const TICKS_PER_MS = 90

/** H.264 / AVC in PMT `stream_type`. */
export const STREAM_TYPE_H264 = 0x1b
/** HEVC / H.265 in PMT `stream_type`. */
export const STREAM_TYPE_HEVC = 0x24
/** HEVC temporal video subset (rare). */
export const STREAM_TYPE_HEVC_TEMPORAL = 0x27

export type VideoCodec = 'h264' | 'hevc'

export type DemuxedAccessUnit = {
  data: Uint8Array
  /** Muxer PTS, unsigned 33-bit (wrapped). Exact PES header value. */
  pts90k: number
  keyframe: boolean
  codec: VideoCodec
}

export type TsDemuxer = {
  push(chunk: Uint8Array): DemuxedAccessUnit[]
  reset(): void
  videoPid(): number | null
  codec(): VideoCodec | null
}

export type PtsUnwrapper = {
  unwrap(pts90k: number): number
  reset(): void
}

const PID_PAT = 0
const PID_NULL = 0x1fff
const TABLE_PAT = 0x00
const TABLE_PMT = 0x02

/**
 * Stateful 33-bit unwrap. Same recurrence as `createPtsNtpMap` (TEL-01):
 * `unwrapped = lastUnwrapped + ptsDiff33(lastWrapped, masked)`.
 */
export function createPtsUnwrapper(): PtsUnwrapper {
  let lastWrapped: number | null = null
  let lastUnwrapped = 0

  return {
    unwrap(pts90k: number): number {
      const masked = maskPts33(pts90k)
      if (lastWrapped === null) {
        lastWrapped = masked
        lastUnwrapped = masked
        return masked
      }
      const unwrapped = lastUnwrapped + ptsDiff33(lastWrapped, masked)
      if (unwrapped >= lastUnwrapped) {
        lastWrapped = masked
        lastUnwrapped = unwrapped
      }
      return unwrapped
    },
    reset(): void {
      lastWrapped = null
      lastUnwrapped = 0
    },
  }
}

/** 90 kHz ticks → WebCodecs `EncodedVideoChunk.timestamp` (microseconds). */
export function pts90kToTimestampUs(ptsUnwrapped: number): number {
  return Math.round(ptsUnwrapped * (1_000_000 / PTS_CLOCK_HZ))
}

export function createTsDemuxer(): TsDemuxer {
  let leftover = new Uint8Array(0)
  let pmtPid: number | null = null
  let videoPid: number | null = null
  let codec: VideoCodec | null = null
  const pesByPid = new Map<number, PesAssembler>()
  const sectionByPid = new Map<number, Uint8Array>()

  function resetState(): void {
    leftover = new Uint8Array(0)
    pmtPid = null
    videoPid = null
    codec = null
    pesByPid.clear()
    sectionByPid.clear()
  }

  function assembler(pid: number): PesAssembler {
    let a = pesByPid.get(pid)
    if (!a) {
      a = createPesAssembler()
      pesByPid.set(pid, a)
    }
    return a
  }

  function noteStreamType(streamType: number): void {
    if (streamType === STREAM_TYPE_H264) codec = 'h264'
    else if (
      streamType === STREAM_TYPE_HEVC ||
      streamType === STREAM_TYPE_HEVC_TEMPORAL
    ) {
      codec = 'hevc'
    }
  }

  function parsePat(section: Uint8Array): void {
    if (section.length < 8 || section[0] !== TABLE_PAT) return
    const sectionLength = ((section[1]! & 0x0f) << 8) | section[2]!
    const end = Math.min(section.length, 3 + sectionLength)
    // header: table_id(1) + syntax/len(2) + ts_id(2) + ver(1) + sec(1) + last(1)
    let i = 8
    while (i + 4 <= end - 4) {
      const programNumber = (section[i]! << 8) | section[i + 1]!
      const pid = ((section[i + 2]! & 0x1f) << 8) | section[i + 3]!
      i += 4
      if (programNumber !== 0) pmtPid = pid
    }
  }

  function parsePmt(section: Uint8Array): void {
    if (section.length < 12 || section[0] !== TABLE_PMT) return
    const sectionLength = ((section[1]! & 0x0f) << 8) | section[2]!
    const end = Math.min(section.length, 3 + sectionLength)
    const programInfoLen = ((section[10]! & 0x0f) << 8) | section[11]!
    let i = 12 + programInfoLen
    while (i + 5 <= end - 4) {
      const streamType = section[i]!
      const pid = ((section[i + 1]! & 0x1f) << 8) | section[i + 2]!
      const esInfoLen = ((section[i + 3]! & 0x0f) << 8) | section[i + 4]!
      i += 5 + esInfoLen
      if (
        streamType === STREAM_TYPE_H264 ||
        streamType === STREAM_TYPE_HEVC ||
        streamType === STREAM_TYPE_HEVC_TEMPORAL
      ) {
        videoPid = pid
        noteStreamType(streamType)
        return
      }
    }
  }

  function pushSection(pid: number, payload: Uint8Array, pusi: boolean): void {
    if (pusi) {
      if (payload.length < 1) return
      const pointer = payload[0]!
      const start = 1 + pointer
      if (start >= payload.length) return
      sectionByPid.set(pid, payload.subarray(start))
    } else {
      const prev = sectionByPid.get(pid)
      if (!prev) return
      const next = new Uint8Array(prev.length + payload.length)
      next.set(prev)
      next.set(payload, prev.length)
      sectionByPid.set(pid, next)
    }
    const section = sectionByPid.get(pid)
    if (!section || section.length < 3) return
    const sectionLength = ((section[1]! & 0x0f) << 8) | section[2]!
    if (section.length < 3 + sectionLength) return
    if (pid === PID_PAT) parsePat(section)
    else if (pmtPid !== null && pid === pmtPid) parsePmt(section)
    sectionByPid.delete(pid)
  }

  function emitFromPes(
    pes: PesPacket,
    fallbackCodec: VideoCodec | null,
  ): DemuxedAccessUnit | null {
    if (pes.pts90k === null || pes.payload.length === 0) return null
    const sniffed = sniffCodec(pes.payload)
    const auCodec = fallbackCodec ?? sniffed
    if (!auCodec) return null
    return {
      data: pes.payload,
      pts90k: maskPts33(pes.pts90k),
      keyframe: isKeyframe(pes.payload, auCodec),
      codec: auCodec,
    }
  }

  function handlePesPayload(
    pid: number,
    payload: Uint8Array,
    pusi: boolean,
    discontinuity: boolean,
    out: DemuxedAccessUnit[],
  ): void {
    if (videoPid !== null && pid !== videoPid) return

    const a = assembler(pid)
    if (discontinuity) a.reset()
    const finished = a.push(payload, pusi)
    for (const pes of finished) {
      if (!isVideoStreamId(pes.streamId)) continue
      if (videoPid === null) videoPid = pid
      const au = emitFromPes(pes, codec)
      if (au) {
        if (!codec) codec = au.codec
        out.push(au)
      }
    }
  }

  function handlePacket(pkt: Uint8Array, out: DemuxedAccessUnit[]): void {
    if (pkt[0] !== TS_SYNC_BYTE) return
    const tei = (pkt[1]! & 0x80) !== 0
    if (tei) return
    const pusi = (pkt[1]! & 0x40) !== 0
    const pid = ((pkt[1]! & 0x1f) << 8) | pkt[2]!
    if (pid === PID_NULL) return
    const adaptation = (pkt[3]! >> 4) & 0x03
    if (adaptation === 0) return

    let offset = 4
    let discontinuity = false
    if (adaptation === 2 || adaptation === 3) {
      const afLen = pkt[offset]!
      offset += 1
      if (afLen > 0 && offset < pkt.length) {
        discontinuity = (pkt[offset]! & 0x80) !== 0
      }
      offset += afLen
    }
    if (adaptation === 2) return
    if (offset >= TS_PACKET_SIZE) return
    const payload = pkt.subarray(offset, TS_PACKET_SIZE)
    if (payload.length === 0) return

    if (pid === PID_PAT || (pmtPid !== null && pid === pmtPid)) {
      pushSection(pid, payload, pusi)
      return
    }

    handlePesPayload(pid, payload, pusi, discontinuity, out)
  }

  return {
    push(chunk: Uint8Array): DemuxedAccessUnit[] {
      const out: DemuxedAccessUnit[] = []
      const buf =
        leftover.length === 0
          ? chunk
          : concatBytes(leftover, chunk)
      leftover = new Uint8Array(0)

      let i = 0
      while (i + TS_PACKET_SIZE <= buf.length) {
        if (buf[i] !== TS_SYNC_BYTE) {
          const next = findSync(buf, i)
          if (next < 0) {
            leftover = buf.subarray(i)
            return out
          }
          i = next
          if (i + TS_PACKET_SIZE > buf.length) break
        }
        handlePacket(buf.subarray(i, i + TS_PACKET_SIZE), out)
        i += TS_PACKET_SIZE
      }
      leftover = i < buf.length ? buf.subarray(i) : new Uint8Array(0)
      return out
    },
    reset: resetState,
    videoPid: () => videoPid,
    codec: () => codec,
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

function findSync(buf: Uint8Array, start: number): number {
  for (let i = start; i + TS_PACKET_SIZE < buf.length; i++) {
    if (buf[i] === TS_SYNC_BYTE && buf[i + TS_PACKET_SIZE] === TS_SYNC_BYTE) {
      return i
    }
  }
  for (let i = start; i + TS_PACKET_SIZE <= buf.length; i++) {
    if (buf[i] === TS_SYNC_BYTE) return i
  }
  return -1
}

function isVideoStreamId(id: number): boolean {
  return id >= 0xe0 && id <= 0xef
}

type PesPacket = {
  streamId: number
  pts90k: number | null
  payload: Uint8Array
}

type PesAssembler = {
  push(payload: Uint8Array, pusi: boolean): PesPacket[]
  reset(): void
}

function createPesAssembler(): PesAssembler {
  let buf = new Uint8Array(0)

  function flushComplete(): PesPacket[] {
    const out: PesPacket[] = []
    while (true) {
      const parsed = parsePes(buf)
      if (!parsed) break
      if (parsed.needed > buf.length) break
      out.push(parsed.packet)
      buf = buf.subarray(parsed.needed)
    }
    return out
  }

  return {
    push(payload: Uint8Array, pusi: boolean): PesPacket[] {
      const out: PesPacket[] = []
      if (pusi) {
        if (buf.length > 0) {
          const last = parsePes(buf, true)
          if (last) out.push(last.packet)
        }
        buf = payload.slice()
      } else if (buf.length > 0) {
        buf = concatBytes(buf, payload)
      } else {
        return out
      }
      out.push(...flushComplete())
      return out
    },
    reset(): void {
      buf = new Uint8Array(0)
    },
  }
}

/**
 * Parse one PES packet. `force` emits whatever we have on the next PUSI
 * (unbounded PES, `packet_length === 0`).
 */
function parsePes(
  buf: Uint8Array,
  force = false,
): { packet: PesPacket; needed: number } | null {
  if (buf.length < 6) return force ? null : null
  if (buf[0] !== 0x00 || buf[1] !== 0x00 || buf[2] !== 0x01) return null
  const streamId = buf[3]!
  const packetLength = (buf[4]! << 8) | buf[5]!
  const headerStart = 6
  let needed: number
  if (packetLength > 0) {
    needed = 6 + packetLength
    if (buf.length < needed && !force) return null
  } else {
    if (!force) return null
    needed = buf.length
  }
  const available = Math.min(buf.length, needed)
  if (available <= headerStart) return null

  let payloadOffset = headerStart
  let pts90k: number | null = null
  const hasOptionalHeader =
    streamId !== 0xbe &&
    streamId !== 0xbf &&
    streamId !== 0xf0 &&
    streamId !== 0xf1 &&
    streamId !== 0xff &&
    streamId !== 0xf2 &&
    streamId !== 0xf8

  if (hasOptionalHeader && available >= headerStart + 3) {
    const flags2 = buf[headerStart + 1]!
    const headerDataLen = buf[headerStart + 2]!
    payloadOffset = headerStart + 3 + headerDataLen
    const ptsDts = (flags2 >> 6) & 0x03
    if ((ptsDts & 0x02) !== 0 && headerStart + 3 + 5 <= available) {
      pts90k = readPts(buf, headerStart + 3)
    }
  }

  if (payloadOffset > available) {
    if (!force) return null
    payloadOffset = available
  }
  const payload = buf.subarray(payloadOffset, available)
  return {
    packet: { streamId, pts90k, payload: payload.slice() },
    needed: packetLength > 0 ? needed : available,
  }
}

/** MPEG-TS / PES 33-bit PTS at `offset` (5 bytes). */
export function readPts(buf: Uint8Array, offset: number): number {
  const b0 = buf[offset]!
  const b1 = buf[offset + 1]!
  const b2 = buf[offset + 2]!
  const b3 = buf[offset + 3]!
  const b4 = buf[offset + 4]!
  const pts32_30 = (b0 >> 1) & 0x07
  const pts29_15 = (b1 << 7) | (b2 >> 1)
  const pts14_0 = (b3 << 7) | (b4 >> 1)
  // bits 32–30 live at 2^30, not 2^31. JS `<<` is 32-bit — use multiply.
  return maskPts33(pts32_30 * 0x40000000 + pts29_15 * 0x8000 + pts14_0)
}

export function writePts(pts90k: number): Uint8Array {
  const p = maskPts33(pts90k)
  const pts32_30 = Math.floor(p / 0x40000000) & 0x07
  const pts29_15 = Math.floor(p / 0x8000) & 0x7fff
  const pts14_0 = p & 0x7fff
  const out = new Uint8Array(5)
  out[0] = 0x20 | (pts32_30 << 1) | 0x01
  out[1] = (pts29_15 >> 7) & 0xff
  out[2] = ((pts29_15 << 1) & 0xfe) | 0x01
  out[3] = (pts14_0 >> 7) & 0xff
  out[4] = ((pts14_0 << 1) & 0xfe) | 0x01
  return out
}

export function forEachNal(
  data: Uint8Array,
  cb: (nal: Uint8Array) => void,
): void {
  let i = 0
  const n = data.length
  while (i + 3 < n) {
    let sc = -1
    let scLen = 0
    for (let j = i; j + 3 < n; j++) {
      if (data[j] === 0 && data[j + 1] === 0) {
        if (data[j + 2] === 1) {
          sc = j
          scLen = 3
          break
        }
        if (j + 3 < n && data[j + 2] === 0 && data[j + 3] === 1) {
          sc = j
          scLen = 4
          break
        }
      }
    }
    if (sc < 0) return
    const nalStart = sc + scLen
    let next = n
    for (let j = nalStart; j + 3 < n; j++) {
      if (data[j] === 0 && data[j + 1] === 0) {
        if (data[j + 2] === 1 || (j + 3 < n && data[j + 2] === 0 && data[j + 3] === 1)) {
          next = j
          break
        }
      }
    }
    if (nalStart < next) cb(data.subarray(nalStart, next))
    i = next
  }
}

export function h264NalType(nal: Uint8Array): number {
  if (nal.length < 1) return 0
  return nal[0]! & 0x1f
}

export function hevcNalType(nal: Uint8Array): number {
  if (nal.length < 1) return 0
  return (nal[0]! >> 1) & 0x3f
}

export function isKeyframe(data: Uint8Array, codec: VideoCodec): boolean {
  let key = false
  forEachNal(data, (nal) => {
    if (codec === 'h264') {
      if (h264NalType(nal) === 5) key = true
    } else if (hevcNalType(nal) >= 16 && hevcNalType(nal) <= 23) {
      key = true
    }
  })
  return key
}

function sniffCodec(data: Uint8Array): VideoCodec | null {
  let h264 = false
  let hevc = false
  forEachNal(data, (nal) => {
    if (nal.length < 1) return
    const h264Type = h264NalType(nal)
    const hevcType = hevcNalType(nal)
    if (h264Type === 7 || h264Type === 8 || h264Type === 5 || h264Type === 1) {
      h264 = true
    }
    if (
      hevcType === 32 ||
      hevcType === 33 ||
      hevcType === 34 ||
      (hevcType >= 16 && hevcType <= 23) ||
      hevcType === 1 ||
      hevcType === 0
    ) {
      hevc = true
    }
  })
  if (hevc && !h264) return 'hevc'
  if (h264 && !hevc) return 'h264'
  if (hevc) return 'hevc'
  if (h264) return 'h264'
  return null
}

/** Cached in-band parameter-set NALs (Annex-B, with start codes). */
export type ParamSetCache = {
  vps: Uint8Array | null
  sps: Uint8Array | null
  pps: Uint8Array | null
}

export function emptyParamSetCache(): ParamSetCache {
  return { vps: null, sps: null, pps: null }
}

function withStartCode(nal: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + nal.length)
  out[0] = 0
  out[1] = 0
  out[2] = 0
  out[3] = 1
  out.set(nal, 4)
  return out
}

export function updateParamSetCache(
  data: Uint8Array,
  codec: VideoCodec,
  cache: ParamSetCache,
): void {
  forEachNal(data, (nal) => {
    if (codec === 'h264') {
      const t = h264NalType(nal)
      if (t === 7) cache.sps = withStartCode(nal)
      else if (t === 8) cache.pps = withStartCode(nal)
    } else {
      const t = hevcNalType(nal)
      if (t === 32) cache.vps = withStartCode(nal)
      else if (t === 33) cache.sps = withStartCode(nal)
      else if (t === 34) cache.pps = withStartCode(nal)
    }
  })
}

export function auHasParamSets(data: Uint8Array, codec: VideoCodec): boolean {
  let sps = false
  let pps = false
  let vps = codec === 'h264'
  forEachNal(data, (nal) => {
    if (codec === 'h264') {
      const t = h264NalType(nal)
      if (t === 7) sps = true
      if (t === 8) pps = true
    } else {
      const t = hevcNalType(nal)
      if (t === 32) vps = true
      if (t === 33) sps = true
      if (t === 34) pps = true
    }
  })
  return sps && pps && vps
}

export function prependParamSets(
  data: Uint8Array,
  codec: VideoCodec,
  cache: ParamSetCache,
): Uint8Array {
  if (auHasParamSets(data, codec)) return data
  const parts: Uint8Array[] = []
  if (codec === 'hevc' && cache.vps) parts.push(cache.vps)
  if (cache.sps) parts.push(cache.sps)
  if (cache.pps) parts.push(cache.pps)
  if (parts.length === 0) return data
  let len = 0
  for (const p of parts) len += p.length
  const out = new Uint8Array(len + data.length)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  out.set(data, o)
  return out
}

/**
 * H.264/HEVC RBSP unescape: drop `0x03` after `0x0000` (emulation prevention).
 * Without this, DJI SPS `0x000003` bytes leak into `hev1.*` and WebCodecs
 * reports unsupported even when the GPU can decode Main HEVC.
 */
export function unescapeRbsp(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  let o = 0
  let zeros = 0
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    if (zeros >= 2 && b === 0x03) {
      zeros = 0
      continue
    }
    out[o++] = b
    zeros = b === 0 ? zeros + 1 : 0
  }
  return out.subarray(0, o)
}

/**
 * RFC 6381 codec string from in-band SPS (and VPS for HEVC).
 * Annex-B → `avc1.*` / `hev1.*` (in-band; no `description` on VideoDecoder).
 */
export function codecStringFromParamSets(
  data: Uint8Array,
  codec: VideoCodec,
): string | null {
  if (codec === 'h264') {
    let found: string | null = null
    forEachNal(data, (nal) => {
      if (found || h264NalType(nal) !== 7 || nal.length < 4) return
      const profile = nal[1]!.toString(16).padStart(2, '0')
      const compat = nal[2]!.toString(16).padStart(2, '0')
      const level = nal[3]!.toString(16).padStart(2, '0')
      found = `avc1.${profile}${compat}${level}`.toLowerCase()
    })
    return found
  }

  let fromSps: string | null = null
  let fromVps: string | null = null
  forEachNal(data, (nal) => {
    const t = hevcNalType(nal)
    if (t === 33 && !fromSps) fromSps = hevcCodecFromSps(nal)
    if (t === 32 && !fromVps) fromVps = hevcCodecFromVps(nal)
  })
  return fromSps ?? fromVps
}

/** DJI-typical 1080p30 Main HEVC — used only if SPS parse fails. */
export const DEFAULT_HEVC_CODEC = 'hev1.1.6.L120.90'
export const DEFAULT_H264_CODEC = 'avc1.640028'

export function resolveCodecString(
  data: Uint8Array,
  codec: VideoCodec,
): string {
  return (
    codecStringFromParamSets(data, codec) ??
    (codec === 'hevc' ? DEFAULT_HEVC_CODEC : DEFAULT_H264_CODEC)
  )
}

function hevcCodecFromSps(nal: Uint8Array): string | null {
  if (nal.length < 3) return null
  const rbsp = unescapeRbsp(nal.subarray(2))
  const br = createBitReader(rbsp)
  br.read(4)
  const maxSubLayersMinus1 = br.read(3)
  br.read(1)
  return readHevcProfileTierLevel(br, maxSubLayersMinus1)
}

function hevcCodecFromVps(nal: Uint8Array): string | null {
  if (nal.length < 3) return null
  const rbsp = unescapeRbsp(nal.subarray(2))
  const br = createBitReader(rbsp)
  br.read(4)
  br.read(2)
  br.read(6)
  const maxSubLayersMinus1 = br.read(3)
  br.read(1)
  br.read(16)
  return readHevcProfileTierLevel(br, maxSubLayersMinus1)
}

function readHevcProfileTierLevel(
  br: BitReader,
  maxSubLayersMinus1: number,
): string | null {
  const generalProfileSpace = br.read(2)
  const generalTierFlag = br.read(1)
  const generalProfileIdc = br.read(5)
  let compat = 0
  for (let i = 0; i < 32; i++) {
    if (br.read(1)) compat |= 1 << i
  }
  const constraints = new Uint8Array(6)
  for (let i = 0; i < 48; i++) {
    const bit = br.read(1)
    if (bit) constraints[Math.floor(i / 8)]! |= 1 << (7 - (i % 8))
  }
  const generalLevelIdc = br.read(8)
  if (br.ended) return null

  if (maxSubLayersMinus1 > 0) {
    const present = new Array<boolean>(8).fill(false)
    for (let i = 0; i < maxSubLayersMinus1; i++) {
      present[i] = br.read(1) === 1
      br.read(1)
    }
    if (maxSubLayersMinus1 > 0) {
      for (let i = maxSubLayersMinus1; i < 8; i++) br.read(2)
    }
    for (let i = 0; i < maxSubLayersMinus1; i++) {
      if (!present[i]) continue
      br.read(2 + 1 + 5 + 32 + 48 + 8)
    }
  }

  let reversed = 0
  for (let i = 0; i < 32; i++) {
    if ((compat >> i) & 1) reversed |= 1 << (31 - i)
  }
  const space =
    generalProfileSpace === 0
      ? ''
      : String.fromCharCode(0x40 + generalProfileSpace)
  let constraintHex = ''
  for (const b of constraints) constraintHex += b.toString(16).padStart(2, '0')
  constraintHex = constraintHex.replace(/00+$/, '')
  if (constraintHex.length === 0) constraintHex = '0'
  const tier = generalTierFlag ? 'H' : 'L'
  return `hev1.${space}${generalProfileIdc}.${reversed.toString(16)}.${tier}${generalLevelIdc}.${constraintHex}`
}

type BitReader = {
  read(n: number): number
  ended: boolean
}

function createBitReader(data: Uint8Array): BitReader {
  let bit = 0
  const handle: BitReader = {
    ended: false,
    read(n: number): number {
      let v = 0
      for (let i = 0; i < n; i++) {
        const byteIndex = bit >> 3
        if (byteIndex >= data.length) {
          handle.ended = true
          return v
        }
        const b = data[byteIndex]!
        const shift = 7 - (bit & 7)
        v = (v << 1) | ((b >> shift) & 1)
        bit += 1
      }
      return v
    },
  }
  return handle
}
