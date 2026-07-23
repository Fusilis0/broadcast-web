import { telemetryBus, type TelemetryBus } from './bus.ts'
import { MockTelemetrySource, type MockPacket } from './mockSource.ts'
import {
  DEFAULT_REPLAY_URL,
  loadReplayFixture,
} from './replayFixture.ts'
import { ReplayTelemetrySource } from './replaySource.ts'
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
  replayUrl?: string
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
 * Route a mock/replay/live JSON packet onto the bus.
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

async function resolveConfigSlice(options?: {
  mode?: TelemetryMode
  replayUrl?: string
}): Promise<{ mode: TelemetryMode; replayUrl: string }> {
  let mode = options?.mode
  let replayUrl = options?.replayUrl

  if (mode === undefined || replayUrl === undefined) {
    try {
      const res = await fetch('/config.json')
      if (res.ok) {
        const cfg = (await res.json()) as TelemetryConfigSlice
        if (mode === undefined) {
          const m = cfg.telemetryMode
          if (m === 'mock' || m === 'replay' || m === 'live') {
            mode = m
          }
        }
        if (replayUrl === undefined && typeof cfg.replayUrl === 'string') {
          replayUrl = cfg.replayUrl
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  return {
    mode: mode ?? 'mock',
    replayUrl:
      replayUrl !== undefined && replayUrl.trim() !== ''
        ? replayUrl
        : DEFAULT_REPLAY_URL,
  }
}

/**
 * Starts telemetry ingest for `mock` | `replay`.
 * `live` resolves but does not connect (TEL 1.9).
 */
export async function startTelemetryIngest(options?: {
  mode?: TelemetryMode
  replayUrl?: string
  bus?: TelemetryBus
}): Promise<IngestHandle> {
  const bus = options?.bus ?? telemetryBus
  const { mode, replayUrl } = await resolveConfigSlice(options)

  if (mode === 'live') {
    console.warn(
      '[telemetry] mode "live" not implemented yet (TEL 1.9); no WebSocket',
    )
    return {
      mode,
      bus,
      stop: () => undefined,
    }
  }

  if (mode === 'replay') {
    const loaded = await loadReplayFixture(replayUrl)
    if (!loaded.ok) {
      console.warn(`[telemetry] replay fixture failed: ${loaded.error}`)
      return {
        mode,
        bus,
        stop: () => undefined,
      }
    }

    const source = new ReplayTelemetrySource({
      fixture: loaded.fixture,
      onPacket: (packet) => ingestPacket(packet, bus),
    })
    source.start()

    return {
      mode,
      bus,
      stop: () => source.stop(),
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
