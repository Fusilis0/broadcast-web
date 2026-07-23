import { telemetryBus, type TelemetryBus } from './bus.ts'
import { LiveTelemetrySource } from './liveSource.ts'
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
  wsUrl?: string
  wsBoatUrl?: string
}

export type StartTelemetryIngestOptions = {
  mode?: TelemetryMode
  replayUrl?: string
  /** Drone / primary live WS URL. If omitted, resolve via env then config. */
  wsUrl?: string
  /** Boat live WS URL. If omitted, resolve via env then config. */
  wsBoatUrl?: string
  bus?: TelemetryBus
  /** Injectable WebSocket for tests (live mode only). */
  WebSocketImpl?: typeof WebSocket
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

function readViteWsUrl(key: 'VITE_WS_URL' | 'VITE_WS_BOAT_URL'): string | undefined {
  try {
    const env = import.meta.env as Record<string, string | undefined>
    const v = env[key]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  } catch {
    // non-Vite / test hosts
  }
  return undefined
}

/**
 * Live URL resolution (documented in `src/telemetry/README.md`):
 * 1. Explicit options to `startTelemetryIngest` (including `""` to force off)
 * 2. `import.meta.env.VITE_WS_URL` / `VITE_WS_BOAT_URL` when non-empty
 * 3. `public/config.json` `wsUrl` / `wsBoatUrl`
 */
async function resolveConfigSlice(options?: {
  mode?: TelemetryMode
  replayUrl?: string
  wsUrl?: string
  wsBoatUrl?: string
}): Promise<{
  mode: TelemetryMode
  replayUrl: string
  wsUrl: string
  wsBoatUrl: string
}> {
  let mode = options?.mode
  let replayUrl = options?.replayUrl
  let wsUrl = options?.wsUrl
  let wsBoatUrl = options?.wsBoatUrl

  let cfgWsUrl: string | undefined
  let cfgWsBoatUrl: string | undefined

  if (
    mode === undefined ||
    replayUrl === undefined ||
    wsUrl === undefined ||
    wsBoatUrl === undefined
  ) {
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
        if (typeof cfg.wsUrl === 'string') cfgWsUrl = cfg.wsUrl
        if (typeof cfg.wsBoatUrl === 'string') cfgWsBoatUrl = cfg.wsBoatUrl
      }
    } catch {
      // fall through to defaults
    }
  }

  if (wsUrl === undefined) {
    wsUrl = readViteWsUrl('VITE_WS_URL') ?? cfgWsUrl ?? ''
  }
  if (wsBoatUrl === undefined) {
    wsBoatUrl = readViteWsUrl('VITE_WS_BOAT_URL') ?? cfgWsBoatUrl ?? ''
  }

  return {
    mode: mode ?? 'mock',
    replayUrl:
      replayUrl !== undefined && replayUrl.trim() !== ''
        ? replayUrl
        : DEFAULT_REPLAY_URL,
    wsUrl: wsUrl.trim(),
    wsBoatUrl: wsBoatUrl.trim(),
  }
}

/**
 * Starts telemetry ingest for `mock` | `replay` | `live`.
 * Live connects only when mode is `live` and at least one URL resolves.
 */
export async function startTelemetryIngest(
  options?: StartTelemetryIngestOptions,
): Promise<IngestHandle> {
  const bus = options?.bus ?? telemetryBus
  const { mode, replayUrl, wsUrl, wsBoatUrl } = await resolveConfigSlice(options)

  if (mode === 'live') {
    const source = new LiveTelemetrySource({
      droneUrl: wsUrl,
      boatUrl: wsBoatUrl,
      onPacket: (packet) => ingestPacket(packet, bus),
      WebSocketImpl: options?.WebSocketImpl,
    })
    source.start()

    return {
      mode,
      bus,
      stop: () => source.stop(),
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
