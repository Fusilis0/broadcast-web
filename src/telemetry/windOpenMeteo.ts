/**
 * Open-Meteo wind provider (Phase 14.3b). Polls forecast at the GEO origin and
 * `publish`es `source: 'api'` onto `windBus`. Operator hold beats API.
 *
 * Data: Open-Meteo CC BY 4.0. Free tier is non-commercial (studio/dev OK).
 * `wind_speed_unit=ms` — default API unit is km/h; we store SI on the bus.
 */
import { windBus, type WindBus } from './windBus.ts'
import { normalizeDirectionFromDeg } from './windDirection.ts'
import type { WindFrame } from './windTypes.ts'

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_MARINE_URL =
  'https://marine-api.open-meteo.com/v1/marine'

/** Forecast updates ~hourly; 10 min is well inside the free-tier budget. */
export const WIND_POLL_INTERVAL_MS = 10 * 60 * 1000
export const ORIGIN_DEBOUNCE_MS = 750
/** Operator entry / Hold wins until this age, or until Follow API. */
export const OPERATOR_HOLD_MS = 30 * 60 * 1000

export type WindHoldMode = 'operator' | 'api'

export type WindOrigin = { lat: number; lon: number }

export type OpenMeteoWindOptions = {
  origin: WindOrigin
  bus?: WindBus
  fetchImpl?: typeof fetch
  pollIntervalMs?: number
  originDebounceMs?: number
  operatorHoldMs?: number
  now?: () => number
  /** Fetch once on start (default true). Tests set false and call `pollNow`. */
  pollOnStart?: boolean
}

export type OpenMeteoWindHandle = {
  setOrigin: (origin: WindOrigin) => void
  pollNow: () => Promise<void>
  stop: () => void
}

type HoldListener = (mode: WindHoldMode) => void

let holdMode: WindHoldMode = 'api'
const holdListeners = new Set<HoldListener>()
let activeHandle: OpenMeteoWindHandle | null = null

export function getWindHoldMode(): WindHoldMode {
  return holdMode
}

export function setWindHoldMode(mode: WindHoldMode): void {
  if (holdMode === mode) return
  holdMode = mode
  for (const listener of holdListeners) listener(mode)
}

export function subscribeWindHoldMode(listener: HoldListener): () => void {
  holdListeners.add(listener)
  listener(holdMode)
  return () => {
    holdListeners.delete(listener)
  }
}

/** Restore follow-API + drop listeners (tests). */
export function resetWindHoldForTests(): void {
  holdMode = 'api'
  holdListeners.clear()
}

export function requestOpenMeteoPoll(): void {
  void activeHandle?.pollNow()
}

export function isValidWindOrigin(origin: WindOrigin): boolean {
  return (
    Number.isFinite(origin.lat) &&
    origin.lat >= -90 &&
    origin.lat <= 90 &&
    Number.isFinite(origin.lon) &&
    origin.lon >= -180 &&
    origin.lon <= 180
  )
}

export function buildOpenMeteoForecastUrl(origin: WindOrigin): string {
  const q = new URLSearchParams({
    latitude: String(origin.lat),
    longitude: String(origin.lon),
    current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'ms',
    timezone: 'UTC',
  })
  return `${OPEN_METEO_FORECAST_URL}?${q}`
}

export function buildOpenMeteoMarineUrl(origin: WindOrigin): string {
  const q = new URLSearchParams({
    latitude: String(origin.lat),
    longitude: String(origin.lon),
    current: 'wave_height,wave_direction,wave_period',
    timezone: 'UTC',
  })
  return `${OPEN_METEO_MARINE_URL}?${q}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function currentBlock(json: unknown): Record<string, unknown> | null {
  const root = asRecord(json)
  if (!root) return null
  return asRecord(root.current)
}

/**
 * Map Open-Meteo forecast `current` → `WindFrame`. Missing/non-finite speed or
 * direction → `null` (caller keeps last snapshot). Marine fields are additive.
 */
export function mapOpenMeteoForecastToWindFrame(
  forecastJson: unknown,
  nowMs: number,
  marineJson?: unknown,
): WindFrame | null {
  const current = currentBlock(forecastJson)
  if (!current) return null
  const speedMs = finiteNumber(current.wind_speed_10m)
  const directionFromDeg = finiteNumber(current.wind_direction_10m)
  if (speedMs === null || speedMs < 0 || directionFromDeg === null) return null
  const gustMs = finiteNumber(current.wind_gusts_10m)

  const frame: WindFrame = {
    directionFromDeg: normalizeDirectionFromDeg(directionFromDeg),
    speedMs,
    source: 'api',
    updatedAtMs: nowMs,
  }
  if (gustMs !== null && gustMs >= 0) frame.gustMs = gustMs

  const marine = currentBlock(marineJson)
  if (marine) {
    const waveHeightM = finiteNumber(marine.wave_height)
    const waveDirectionFromDeg = finiteNumber(marine.wave_direction)
    const wavePeriodS = finiteNumber(marine.wave_period)
    if (waveHeightM !== null && waveHeightM >= 0) frame.waveHeightM = waveHeightM
    if (waveDirectionFromDeg !== null) {
      frame.waveDirectionFromDeg = normalizeDirectionFromDeg(
        waveDirectionFromDeg,
      )
    }
    if (wavePeriodS !== null && wavePeriodS >= 0) frame.wavePeriodS = wavePeriodS
  }

  return frame
}

export function operatorHoldBlocksApi(
  snapshot: WindFrame | null,
  nowMs: number,
  holdMs = OPERATOR_HOLD_MS,
): boolean {
  if (holdMode !== 'operator') return false
  if (!snapshot || snapshot.source !== 'operator') return false
  return nowMs - snapshot.updatedAtMs < holdMs
}

async function readJson(
  fetchImpl: typeof fetch,
  url: string,
  signal: AbortSignal,
): Promise<unknown | null> {
  try {
    const res = await fetchImpl(url, { signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Test-friendly provider. Does not register the app singleton — use
 * `startOpenMeteoWind` from boot.
 */
export function createOpenMeteoWindProvider(
  options: OpenMeteoWindOptions,
): OpenMeteoWindHandle {
  const bus = options.bus ?? windBus
  const fetchImpl = options.fetchImpl ?? fetch
  const pollIntervalMs = options.pollIntervalMs ?? WIND_POLL_INTERVAL_MS
  const originDebounceMs = options.originDebounceMs ?? ORIGIN_DEBOUNCE_MS
  const operatorHoldMs = options.operatorHoldMs ?? OPERATOR_HOLD_MS
  const now = options.now ?? Date.now

  let origin: WindOrigin = { lat: options.origin.lat, lon: options.origin.lon }
  let stopped = false
  let inFlight: AbortController | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function pollNow(): Promise<void> {
    if (stopped) return
    if (!isValidWindOrigin(origin)) return

    inFlight?.abort()
    const ac = new AbortController()
    inFlight = ac

    const forecastUrl = buildOpenMeteoForecastUrl(origin)
    const marineUrl = buildOpenMeteoMarineUrl(origin)
    const [forecastJson, marineJson] = await Promise.all([
      readJson(fetchImpl, forecastUrl, ac.signal),
      readJson(fetchImpl, marineUrl, ac.signal),
    ])

    if (stopped || ac.signal.aborted) return
    if (forecastJson === null) {
      console.warn(
        '[wind] Open-Meteo forecast failed; keeping last snapshot',
      )
      return
    }

    const frame = mapOpenMeteoForecastToWindFrame(
      forecastJson,
      now(),
      marineJson ?? undefined,
    )
    if (!frame) {
      console.warn(
        '[wind] Open-Meteo forecast unreadable; keeping last snapshot',
      )
      return
    }

    const snap = bus.getSnapshot()
    if (operatorHoldBlocksApi(snap, now(), operatorHoldMs)) return
    if (holdMode === 'operator' && snap?.source === 'operator') {
      setWindHoldMode('api')
    }
    bus.publish(frame)
  }

  function setOrigin(next: WindOrigin): void {
    if (stopped) return
    if (
      origin.lat === next.lat &&
      origin.lon === next.lon &&
      isValidWindOrigin(origin)
    ) {
      return
    }
    origin = { lat: next.lat, lon: next.lon }
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void pollNow()
    }, originDebounceMs)
  }

  function stop(): void {
    stopped = true
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    inFlight?.abort()
    inFlight = null
    if (activeHandle === handle) activeHandle = null
  }

  const handle: OpenMeteoWindHandle = { setOrigin, pollNow, stop }

  if (options.pollOnStart !== false && isValidWindOrigin(origin)) {
    void pollNow()
  }
  pollTimer = setInterval(() => {
    void pollNow()
  }, pollIntervalMs)

  return handle
}

/** App singleton: first call starts, later calls debounce-refetch on origin. */
export function startOpenMeteoWind(
  options: OpenMeteoWindOptions,
): OpenMeteoWindHandle {
  if (activeHandle) {
    activeHandle.setOrigin(options.origin)
    return activeHandle
  }
  activeHandle = createOpenMeteoWindProvider(options)
  return activeHandle
}

export function stopOpenMeteoWind(): void {
  activeHandle?.stop()
  activeHandle = null
}
