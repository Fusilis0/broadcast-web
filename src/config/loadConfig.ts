import type { AppConfig, ConfigOrigin } from './types.ts'

const DEFAULT_ORIGIN: ConfigOrigin = {
  lat: 41.0082,
  lon: 28.9784,
  altMsl: 0,
}

const DEFAULT_REPLAY_URL = '/fixtures/telemetry/spine-demo.json'

/** Committed default boat band slice (full `21–52` later via config only). */
export const DEFAULT_BOAT_IDS: readonly string[] = ['21', '22', '23', '24']

const BOAT_ID_MIN = 21
const BOAT_ID_MAX = 52

const DEFAULT_CONFIG: AppConfig = {
  telemetryMode: 'mock',
  replayUrl: DEFAULT_REPLAY_URL,
  wsUrl: '',
  wsBoatUrl: '',
  boatIds: [...DEFAULT_BOAT_IDS],
  origin: { ...DEFAULT_ORIGIN },
  takeoffAltitudeMSL: 0,
  outputMode: 'preview',
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseOrigin(raw: unknown): ConfigOrigin {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_ORIGIN }
  const o = raw as Record<string, unknown>
  return {
    lat: isFiniteNumber(o.lat) ? o.lat : DEFAULT_ORIGIN.lat,
    lon: isFiniteNumber(o.lon) ? o.lon : DEFAULT_ORIGIN.lon,
    altMsl: isFiniteNumber(o.altMsl) ? o.altMsl : DEFAULT_ORIGIN.altMsl,
  }
}

function parseMode(value: unknown): AppConfig['telemetryMode'] {
  if (value === 'mock' || value === 'replay' || value === 'live') return value
  return 'mock'
}

/**
 * Normalize `boatIds`: non-empty strings in arch band `21–52`.
 * Missing/empty/all-junk → four-id default matching committed `config.json`.
 * Out-of-band values (e.g. pilots `81–84`) are filtered with a console warn.
 */
export function normalizeBoatIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_BOAT_IDS]

  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      console.warn('[config] boatIds: ignoring non-string entry')
      continue
    }
    const id = item.trim()
    if (id === '') continue
    const n = Number(id)
    if (!Number.isInteger(n) || n < BOAT_ID_MIN || n > BOAT_ID_MAX) {
      console.warn(
        `[config] boatIds: ignoring out-of-band id "${id}" (prefer ${BOAT_ID_MIN}–${BOAT_ID_MAX})`,
      )
      continue
    }
    if (!out.includes(id)) out.push(id)
  }

  return out.length > 0 ? out : [...DEFAULT_BOAT_IDS]
}

/** Normalize a parsed JSON object into `AppConfig` (fills defaults). */
export function normalizeConfig(raw: unknown): AppConfig {
  if (raw === null || typeof raw !== 'object') {
    return {
      ...DEFAULT_CONFIG,
      boatIds: [...DEFAULT_BOAT_IDS],
      origin: { ...DEFAULT_ORIGIN },
    }
  }
  const o = raw as Record<string, unknown>
  return {
    telemetryMode: parseMode(o.telemetryMode),
    replayUrl:
      typeof o.replayUrl === 'string' && o.replayUrl.trim() !== ''
        ? o.replayUrl
        : DEFAULT_REPLAY_URL,
    wsUrl: typeof o.wsUrl === 'string' ? o.wsUrl : '',
    wsBoatUrl: typeof o.wsBoatUrl === 'string' ? o.wsBoatUrl : '',
    boatIds: normalizeBoatIds(o.boatIds),
    origin: parseOrigin(o.origin),
    takeoffAltitudeMSL: isFiniteNumber(o.takeoffAltitudeMSL)
      ? o.takeoffAltitudeMSL
      : 0,
    outputMode: typeof o.outputMode === 'string' ? o.outputMode : 'preview',
  }
}

/**
 * Fetch `/config.json`. On network/parse failure returns mock-centered defaults
 * (Istanbul near TEL mock tracks — not 0,0).
 */
export async function loadConfig(url = '/config.json'): Promise<AppConfig> {
  try {
    const res = await fetch(url)
    if (!res.ok) return normalizeConfig(null)
    return normalizeConfig(await res.json())
  } catch {
    return normalizeConfig(null)
  }
}

export { DEFAULT_CONFIG, DEFAULT_ORIGIN }
