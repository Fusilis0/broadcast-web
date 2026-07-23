import type { AppConfig, ConfigOrigin } from './types.ts'

const DEFAULT_ORIGIN: ConfigOrigin = {
  lat: 41.0082,
  lon: 28.9784,
  altMsl: 0,
}

const DEFAULT_REPLAY_URL = '/fixtures/telemetry/spine-demo.json'

const DEFAULT_CONFIG: AppConfig = {
  telemetryMode: 'mock',
  replayUrl: DEFAULT_REPLAY_URL,
  wsUrl: '',
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

/** Normalize a parsed JSON object into `AppConfig` (fills defaults). */
export function normalizeConfig(raw: unknown): AppConfig {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_CONFIG, origin: { ...DEFAULT_ORIGIN } }
  const o = raw as Record<string, unknown>
  return {
    telemetryMode: parseMode(o.telemetryMode),
    replayUrl:
      typeof o.replayUrl === 'string' && o.replayUrl.trim() !== ''
        ? o.replayUrl
        : DEFAULT_REPLAY_URL,
    wsUrl: typeof o.wsUrl === 'string' ? o.wsUrl : '',
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
