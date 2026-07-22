import type { StreamAnchorMessage } from './types.ts'

/** Port of Unity `TelemetryWsMessageKind`. */
export const TelemetryWsMessageKind = {
  Invalid: 'Invalid',
  StreamAnchor: 'StreamAnchor',
  DroneOrCameraTelemetry: 'DroneOrCameraTelemetry',
} as const

export type TelemetryWsMessageKind =
  (typeof TelemetryWsMessageKind)[keyof typeof TelemetryWsMessageKind]

export type ClassifyResult = {
  kind: TelemetryWsMessageKind
  /** Parsed object when kind is not Invalid; otherwise null. */
  parsed: Record<string, unknown> | null
}

/**
 * Classifies WebSocket JSON text before typed parse.
 * Port of Unity `TelemetryWsJsonRouter.Classify`.
 * Boat pose JSON also lands in `DroneOrCameraTelemetry`; boat vs drone is source context.
 */
export function classify(jsonText: string): ClassifyResult {
  if (jsonText.trim() === '') {
    return { kind: TelemetryWsMessageKind.Invalid, parsed: null }
  }

  try {
    const value: unknown = JSON.parse(jsonText)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { kind: TelemetryWsMessageKind.Invalid, parsed: null }
    }

    const parsed = value as Record<string, unknown>
    const t = parsed.type
    if (typeof t === 'string' && t === 'stream_anchor') {
      return { kind: TelemetryWsMessageKind.StreamAnchor, parsed }
    }

    return { kind: TelemetryWsMessageKind.DroneOrCameraTelemetry, parsed }
  } catch {
    return { kind: TelemetryWsMessageKind.Invalid, parsed: null }
  }
}

/**
 * Port of Unity `TelemetryWsJsonRouter.TryDeserializeAnchor`.
 * Returns null on missing/invalid shape; does not throw.
 */
export function tryParseStreamAnchor(
  parsed: Record<string, unknown> | null,
): StreamAnchorMessage | null {
  if (parsed === null) return null

  try {
    const streamId = parsed.stream_id
    if (typeof streamId !== 'string' || streamId === '') return null

    const type = typeof parsed.type === 'string' ? parsed.type : 'stream_anchor'
    const kind = typeof parsed.kind === 'string' ? parsed.kind : ''
    const fps = typeof parsed.fps === 'number' ? parsed.fps : 0
    const ntpCapture =
      typeof parsed.ntp_capture_ms === 'number' ? parsed.ntp_capture_ms : 0
    const ntpSynced =
      typeof parsed.ntp_synced === 'boolean' ? parsed.ntp_synced : false
    const ntpErr =
      typeof parsed.ntp_err_ms === 'number' ? parsed.ntp_err_ms : 0

    const anchor: StreamAnchorMessage = {
      type,
      stream_id: streamId,
      kind,
      fps,
      ntp_capture_ms: ntpCapture,
      ntp_synced: ntpSynced,
      ntp_err_ms: ntpErr,
    }

    if (
      parsed.pts_basis_90khz === null ||
      typeof parsed.pts_basis_90khz === 'number'
    ) {
      anchor.pts_basis_90khz = parsed.pts_basis_90khz as number | null
    }
    if (parsed.pts_90khz === null || typeof parsed.pts_90khz === 'number') {
      anchor.pts_90khz = parsed.pts_90khz as number | null
    }

    return anchor
  } catch {
    return null
  }
}
