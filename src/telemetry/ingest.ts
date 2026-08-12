import { telemetryBus, type TelemetryBus } from './bus.ts'
import {
  LiveTelemetrySource,
  type LiveStatusSnapshot,
  type LiveWsStatus,
} from './liveSource.ts'
import { buildLiveWsUrlsForIds, stripLiveWsId } from './liveWsUrl.ts'
import {
  DEFAULT_MOCK_BOAT_IDS,
  DEFAULT_MOCK_POV_IDS,
  MockTelemetrySource,
  type MockChannel,
  type MockPacket,
} from './mockSource.ts'
import {
  DEFAULT_REPLAY_URL,
  loadReplayFixture,
} from './replayFixture.ts'
import {
  ReplayTelemetrySource,
  type ReplayStatus,
} from './replaySource.ts'
import {
  classify,
  TelemetryWsMessageKind,
  tryParseStreamAnchor,
} from './router.ts'
import type {
  BoatTelemetry,
  BuoyTelemetry,
  TelemetryData,
  TelemetryMode,
} from './types.ts'

/** @deprecated Prefer `LiveStatusSnapshot` (includes per-id + last packet). */
export type LiveStatusMap = LiveStatusSnapshot

export type IngestHandle = {
  mode: TelemetryMode
  bus: TelemetryBus
  stop: () => void
  /**
   * Live mode only: snapshot of drone/boat WebSocket status (aggregate + per-id).
   * Absent for mock/replay (HUD should show `ws=n/a (mode)`).
   */
  getLiveStatus?: () => LiveStatusSnapshot
  /**
   * Live mode only: subscribe to status transitions.
   * Returns unsubscribe. Absent for mock/replay.
   */
  onLiveStatus?: (
    listener: (channel: MockChannel, status: LiveWsStatus) => void,
  ) => () => void
  /**
   * Replay mode only: playback snapshot (`idle` | `playing` | `ended` | `error`).
   * Absent for mock/live. Not wired to SCN HUD in this slice.
   */
  getReplayStatus?: () => ReplayStatus
}

type TelemetryConfigSlice = {
  telemetryMode?: string
  replayUrl?: string
  /** Optional override of fixture.loop (boolean). */
  replayLoop?: unknown
  wsUrl?: string
  wsBoatUrl?: string
  boatIds?: unknown
  povIds?: unknown
  buoyIds?: unknown
}

export type StartTelemetryIngestOptions = {
  mode?: TelemetryMode
  replayUrl?: string
  /**
   * Override fixture.loop when set. Omit → use fixture.loop (committed samples
   * use `true`). Explicit `true` / `false` forces loop / one-shot.
   */
  replayLoop?: boolean
  /** Drone / primary live WS URL. If omitted, resolve via env then config. */
  wsUrl?: string
  /** Boat live WS URL. If omitted, resolve via env then config. */
  wsBoatUrl?: string
  /**
   * Boat ids for mock multi-emit. If omitted, resolve from config then
   * default `["21","22","23","24"]`.
   */
  boatIds?: readonly string[]
  /**
   * POV / drone+cam ids for mock multi-emit and live per-id sockets.
   * If omitted, resolve from config then default `["1","2"]`.
   */
  povIds?: readonly string[]
  /**
   * Buoy ids (boat-shaped packets, own bus/pose kind). Empty/absent → no buoy
   * channel. Must not overlap `boatIds`. Live: same boat WS base + subscribe.
   */
  buoyIds?: readonly string[]
  bus?: TelemetryBus
  /** Injectable WebSocket for tests (live mode only). */
  WebSocketImpl?: typeof WebSocket
}

export type IngestPacketOptions = {
  /**
   * Ids treated as buoys when a boat-shaped packet arrives on the `boat`
   * channel (live sockets share the boat WS). Explicit `channel: 'buoy'`
   * always emits `buoy` regardless of this set.
   */
  buoyIds?: readonly string[]
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
 * Soft-normalize boat ids for ingest (TEL). Prefer arch band `21–52`.
 * Explicit array (including `[]`) is preserved — empty means no boat sockets
 * in live mode (do not fall back to the four-id default).
 * Omitted / non-array → four-id default. Full validation: `normalizeBoatIds`.
 */
function resolveBoatIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = []
    for (const item of raw) {
      if (typeof item !== 'string') continue
      const id = item.trim()
      if (id === '') continue
      const n = Number(id)
      if (!Number.isInteger(n) || n < 21 || n > 52) continue
      if (!out.includes(id)) out.push(id)
    }
    return out
  }
  return [...DEFAULT_MOCK_BOAT_IDS]
}

/**
 * Soft-normalize POV ids for ingest (TEL). Band `1–12`.
 * Explicit array (including `[]`) is preserved — empty means no drone sockets
 * in live mode. Omitted / non-array → `["1","2"]`. Full validation: `normalizePovIds`.
 */
function resolvePovIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = []
    for (const item of raw) {
      if (typeof item !== 'string') continue
      const id = item.trim()
      if (id === '') continue
      const n = Number(id)
      if (!Number.isInteger(n) || n < 1 || n > 12) continue
      if (!out.includes(id)) out.push(id)
    }
    return out
  }
  return [...DEFAULT_MOCK_POV_IDS]
}

/**
 * Soft-normalize buoy ids for ingest (TEL).
 * Explicit array (including `[]`) preserved. Omitted / non-array → `[]`
 * (no buoy channel — fully backward compatible). No numeric band: buoys are a
 * separate id namespace from race boats; avoid colliding with `boatIds`.
 */
function resolveBuoyIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (id === '') continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

function buoyIdSet(ids: readonly string[] | undefined): Set<string> {
  return new Set(ids ?? [])
}

/**
 * Route a mock/replay/live JSON packet onto the bus.
 * Boat vs drone for non-anchor pose is decided by `channel` (connection context).
 * Buoy vs boat: `channel: 'buoy'` **or** boat-shaped packet whose `id` is in
 * `options.buoyIds` (live boat WS + allow-list). Same wire DTO either way.
 */
export function ingestPacket(
  packet: MockPacket,
  bus: TelemetryBus = telemetryBus,
  options?: IngestPacketOptions,
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

  if (!isBoatTelemetry(parsed)) {
    return
  }

  const boatShaped = parsed as BoatTelemetry
  const asBuoy =
    packet.channel === 'buoy' || buoyIdSet(options?.buoyIds).has(boatShaped.id)

  if (asBuoy) {
    bus.emit('buoy', boatShaped as BuoyTelemetry)
  } else {
    bus.emit('boat', boatShaped)
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
 *
 * `replayLoop`: explicit option, else config boolean when present, else unset
 * (fixture.loop wins).
 */
async function resolveConfigSlice(options?: {
  mode?: TelemetryMode
  replayUrl?: string
  replayLoop?: boolean
  wsUrl?: string
  wsBoatUrl?: string
  boatIds?: readonly string[]
  povIds?: readonly string[]
  buoyIds?: readonly string[]
}): Promise<{
  mode: TelemetryMode
  replayUrl: string
  replayLoop: boolean | undefined
  wsUrl: string
  wsBoatUrl: string
  boatIds: string[]
  povIds: string[]
  buoyIds: string[]
}> {
  let mode = options?.mode
  let replayUrl = options?.replayUrl
  let replayLoop = options?.replayLoop
  let wsUrl = options?.wsUrl
  let wsBoatUrl = options?.wsBoatUrl
  let boatIds =
    options?.boatIds !== undefined ? resolveBoatIds(options.boatIds) : undefined
  let povIds =
    options?.povIds !== undefined ? resolvePovIds(options.povIds) : undefined
  let buoyIds =
    options?.buoyIds !== undefined ? resolveBuoyIds(options.buoyIds) : undefined

  let cfgWsUrl: string | undefined
  let cfgWsBoatUrl: string | undefined
  let cfgBoatIds: unknown
  let cfgPovIds: unknown
  let cfgBuoyIds: unknown

  if (
    mode === undefined ||
    replayUrl === undefined ||
    wsUrl === undefined ||
    wsBoatUrl === undefined ||
    boatIds === undefined ||
    povIds === undefined ||
    buoyIds === undefined
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
        if (replayLoop === undefined && typeof cfg.replayLoop === 'boolean') {
          replayLoop = cfg.replayLoop
        }
        if (typeof cfg.wsUrl === 'string') cfgWsUrl = cfg.wsUrl
        if (typeof cfg.wsBoatUrl === 'string') cfgWsBoatUrl = cfg.wsBoatUrl
        if (boatIds === undefined) cfgBoatIds = cfg.boatIds
        if (povIds === undefined) cfgPovIds = cfg.povIds
        if (buoyIds === undefined) cfgBuoyIds = cfg.buoyIds
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
  if (boatIds === undefined) {
    boatIds = resolveBoatIds(cfgBoatIds)
  }
  if (povIds === undefined) {
    povIds = resolvePovIds(cfgPovIds)
  }
  if (buoyIds === undefined) {
    buoyIds = resolveBuoyIds(cfgBuoyIds)
  }

  return {
    mode: mode ?? 'mock',
    replayUrl:
      replayUrl !== undefined && replayUrl.trim() !== ''
        ? replayUrl
        : DEFAULT_REPLAY_URL,
    replayLoop,
    wsUrl: wsUrl.trim(),
    wsBoatUrl: wsBoatUrl.trim(),
    boatIds,
    povIds,
    buoyIds,
  }
}

/**
 * Starts telemetry ingest for `mock` | `replay` | `live`.
 * Live connects only when mode is `live` and at least one enabled id resolves
 * to a URL. Mock emits one `drone` packet per `povIds`, one `boat` per
 * `boatIds`, and one `buoy` per `buoyIds` each pose tick. Live: base `wsUrl` /
 * `wsBoatUrl` + one socket per **enabled** `povIds` / (`boatIds` ∪ `buoyIds`)
 * (`?type=client&subscribe=<id>`). Empty id lists open **no** sockets for that
 * channel (no legacy base-only fallback). Empty `buoyIds` → no buoy channel.
 */
export async function startTelemetryIngest(
  options?: StartTelemetryIngestOptions,
): Promise<IngestHandle> {
  const bus = options?.bus ?? telemetryBus
  const {
    mode,
    replayUrl,
    replayLoop,
    wsUrl,
    wsBoatUrl,
    boatIds,
    povIds,
    buoyIds,
  } = await resolveConfigSlice(options)

  const routePacket = (packet: MockPacket) =>
    ingestPacket(packet, bus, { buoyIds })

  if (mode === 'live') {
    const statusListeners = new Set<
      (channel: MockChannel, status: LiveWsStatus) => void
    >()
    const droneBase = stripLiveWsId(wsUrl)
    const boatBase = stripLiveWsId(wsBoatUrl)
    // Enabled-id sockets only — empty list ⇒ no sockets for that channel.
    const droneUrls =
      droneBase !== '' && povIds.length > 0
        ? buildLiveWsUrlsForIds(droneBase, povIds)
        : []
    // Buoys share the boat GPS WS base; classify onto `buoy` via allow-list.
    const boatSubscribeIds = [...new Set([...boatIds, ...buoyIds])]
    const boatUrls =
      boatBase !== '' && boatSubscribeIds.length > 0
        ? buildLiveWsUrlsForIds(boatBase, boatSubscribeIds)
        : []
    const source = new LiveTelemetrySource({
      droneUrls,
      boatUrls,
      onPacket: routePacket,
      onStatus: (channel, status) => {
        for (const listener of statusListeners) {
          listener(channel, status)
        }
      },
      WebSocketImpl: options?.WebSocketImpl,
    })
    source.start()

    return {
      mode,
      bus,
      stop: () => {
        statusListeners.clear()
        source.stop()
      },
      getLiveStatus: () => source.getStatus(),
      onLiveStatus: (listener) => {
        statusListeners.add(listener)
        return () => {
          statusListeners.delete(listener)
        }
      },
    }
  }

  if (mode === 'replay') {
    const loaded = await loadReplayFixture(replayUrl)
    if (!loaded.ok) {
      console.warn(
        `[telemetry] replay: cannot start — ${loaded.error}`,
      )
      return {
        mode,
        bus,
        stop: () => undefined,
        getReplayStatus: () => 'error',
      }
    }

    const source = new ReplayTelemetrySource({
      fixture: loaded.fixture,
      loop: replayLoop,
      onPacket: routePacket,
    })
    source.start()

    return {
      mode,
      bus,
      stop: () => source.stop(),
      getReplayStatus: () => source.getStatus(),
    }
  }

  const source = new MockTelemetrySource({
    povIds,
    boatIds,
    buoyIds,
    onPacket: routePacket,
  })
  source.start()

  return {
    mode,
    bus,
    stop: () => source.stop(),
  }
}
