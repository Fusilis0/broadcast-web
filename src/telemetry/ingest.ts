import { telemetryBus, type TelemetryBus } from './bus.ts'
import { MockTelemetrySource, type MockPacket } from './mockSource.ts'
import {
  classify,
  TelemetryWsMessageKind,
  tryParseStreamAnchor,
} from './router.ts'
import type {
  BoatTelemetry,
  TelemetryData,
  TelemetryMode,
} from './types.ts'

export type IngestHandle = {
  mode: TelemetryMode
  bus: TelemetryBus
  stop: () => void
}

type TelemetryConfigSlice = {
  telemetryMode?: string
}

function isTelemetryData(value: Record<string, unknown>): value is TelemetryData &
  Record<string, unknown> {
  return (
    typeof value.id === 'string' &&
    typeof value.ts === 'number' &&
    value.pos !== null &&
    typeof value.pos === 'object'
  )
}

function isBoatTelemetry(value: Record<string, unknown>): value is BoatTelemetry &
  Record<string, unknown> {
  return (
    typeof value.id === 'string' &&
    typeof value.lat === 'number' &&
    typeof value.lon === 'number' &&
    typeof value.time === 'number'
  )
}

/**
 * Route a mock/live JSON packet onto the bus.
 * Boat vs drone for non-anchor pose is decided by `channel` (connection context).
 */
export function ingestPacket(
  packet: MockPacket,
  bus: TelemetryBus = telemetryBus,
): void {
  const { kind, parsed } = classify(packet.jsonText)

  if (kind === TelemetryWsMessageKind.Invalid || parsed === null) {
    return
  }

  if (kind === TelemetryWsMessageKind.StreamAnchor) {
    const anchor = tryParseStreamAnchor(parsed)
    if (anchor !== null) {
      bus.emit('stream_anchor', anchor)
    }
    return
  }

  if (packet.channel === 'drone') {
    if (isTelemetryData(parsed)) {
      bus.emit('drone', parsed as TelemetryData)
    }
    return
  }

  if (isBoatTelemetry(parsed)) {
    bus.emit('boat', parsed as BoatTelemetry)
  }
}

async function resolveMode(
  explicitMode?: TelemetryMode,
): Promise<TelemetryMode> {
  if (explicitMode !== undefined) return explicitMode

  try {
    const res = await fetch('/config.json')
    if (!res.ok) return 'mock'
    const cfg = (await res.json()) as TelemetryConfigSlice
    const mode = cfg.telemetryMode
    if (mode === 'mock' || mode === 'replay' || mode === 'live') {
      return mode
    }
    return 'mock'
  } catch {
    return 'mock'
  }
}

/**
 * Starts telemetry ingest. For this DSP only `mock` is implemented;
 * replay/live resolve but do not connect (no-op stop).
 */
export async function startTelemetryIngest(options?: {
  mode?: TelemetryMode
  bus?: TelemetryBus
}): Promise<IngestHandle> {
  const bus = options?.bus ?? telemetryBus
  const mode = await resolveMode(options?.mode)

  if (mode !== 'mock') {
    console.warn(
      `[telemetry] mode "${mode}" not implemented yet; mock-only in DSP-TEL-20260722-01`,
    )
    return {
      mode,
      bus,
      stop: () => undefined,
    }
  }

  const source = new MockTelemetrySource({
    onPacket: (packet) => ingestPacket(packet, bus),
  })
  source.start()

  return {
    mode,
    bus,
    stop: () => source.stop(),
  }
}
