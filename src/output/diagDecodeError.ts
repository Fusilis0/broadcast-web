/**
 * DIAG: decode-error / keyframe-wait freezes (item a).
 * Emits one structured console line per event; Electron main mirrors
 * `[diag:decode-error]` into `diag-srt-fps.log`.
 */

import {
  type VideoCodec,
  forEachNal,
  h264NalType,
  hevcNalType,
  type TsDemuxLossStats,
} from './tsDemux.ts'

export type DecodeErrorDiagEvent = {
  stage: 'decode-error'
  wallMs: number
  message: string
  codec: VideoCodec | null
  /** Frames successfully fed since the last keyframe feed. */
  framesSinceKeyframe: number
  lastFed: {
    keyframe: boolean
    pts90k: number
    byteLength: number
    nalTypes: number[]
    /** 90 kHz gap from previous fed AU (null if none). */
    ptsGap90k: number | null
  } | null
  demux: TsDemuxLossStats
  /** Deltas since previous decode-error (or session start). */
  demuxDelta: TsDemuxLossStats
  ingest: {
    bitrateKbps: number | null
    ipcDropCount: number | null
    ipcDropPerSec: number | null
    ffmpegDropFrames: string | null
  } | null
}

export type DecodeErrorIngestSnap = {
  bitrateKbps: number | null
  ipcDropCount: number | null
  ipcDropPerSec: number | null
  ffmpegDropFrames: string | null
}

let lastLoss: TsDemuxLossStats = {
  ccGaps: 0,
  syncResyncs: 0,
  adaptationDiscontinuities: 0,
  videoPackets: 0,
}

export function summarizeNalTypes(
  data: Uint8Array,
  codec: VideoCodec,
): number[] {
  const types: number[] = []
  forEachNal(data, (nal) => {
    const t = codec === 'h264' ? h264NalType(nal) : hevcNalType(nal)
    if (types.length < 16) types.push(t)
  })
  return types
}

export function logDecodeErrorEvent(
  partial: Omit<DecodeErrorDiagEvent, 'stage' | 'wallMs' | 'demuxDelta'> & {
    demux: TsDemuxLossStats
  },
): DecodeErrorDiagEvent {
  const demuxDelta: TsDemuxLossStats = {
    ccGaps: partial.demux.ccGaps - lastLoss.ccGaps,
    syncResyncs: partial.demux.syncResyncs - lastLoss.syncResyncs,
    adaptationDiscontinuities:
      partial.demux.adaptationDiscontinuities -
      lastLoss.adaptationDiscontinuities,
    videoPackets: partial.demux.videoPackets - lastLoss.videoPackets,
  }
  lastLoss = { ...partial.demux }
  const event: DecodeErrorDiagEvent = {
    stage: 'decode-error',
    wallMs: Date.now(),
    demuxDelta,
    ...partial,
  }
  console.info(`[diag:decode-error] ${JSON.stringify(event)}`)
  return event
}

export function resetDecodeErrorDiagLossBaseline(): void {
  lastLoss = {
    ccGaps: 0,
    syncResyncs: 0,
    adaptationDiscontinuities: 0,
    videoPackets: 0,
  }
}
