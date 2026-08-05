import type { AppConfig, ConfigOrigin } from './types.ts'

const DEFAULT_ORIGIN: ConfigOrigin = {
  lat: 41.0082,
  lon: 28.9784,
  altMsl: 0,
}

const DEFAULT_REPLAY_URL = '/fixtures/telemetry/spine-demo.json'
const DEFAULT_COURSE_URL = '/fixtures/course/demo-istanbul.json'
const DEFAULT_SPONSORS_URL = '/fixtures/sponsors/demo-istanbul.json'
const DEFAULT_FLAGS_URL = '/fixtures/flags/demo-istanbul-countdown.json'
const DEFAULT_BOAT_NAMES_URL = '/fixtures/boats/demo-istanbul-names.json'

/** Committed default boat band slice (full `21–52` later via config only). */
export const DEFAULT_BOAT_IDS: readonly string[] = ['21', '22', '23', '24']

/** Committed default POV ids (drones/cams in band `1–12`). */
export const DEFAULT_POV_IDS: readonly string[] = ['1', '2']

const BOAT_ID_MIN = 21
const BOAT_ID_MAX = 52

/** Soft POV band: drone/cam ids `1–12` (includes live id `5`). */
function isPovBandId(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 12
}

const DEFAULT_CONFIG: AppConfig = {
  telemetryMode: 'mock',
  replayUrl: DEFAULT_REPLAY_URL,
  courseUrl: DEFAULT_COURSE_URL,
  sponsorsUrl: DEFAULT_SPONSORS_URL,
  flagsUrl: DEFAULT_FLAGS_URL,
  boatNamesUrl: DEFAULT_BOAT_NAMES_URL,
  wsUrl: '',
  wsBoatUrl: '',
  boatIds: [...DEFAULT_BOAT_IDS],
  povIds: [...DEFAULT_POV_IDS],
  origin: { ...DEFAULT_ORIGIN },
  takeoffAltitudeMSL: 0,
  outputMode: 'preview',
  chromaKey: '',
  timecodeEnabled: true,
  timecodeCorner: 'bottom-right',
  timecodeSizePx: 96,
  whepUrl: '',
  projectsApiBase: '',
  projectsRole: 'editor',
  projectsApiToken: '',
}

function parseTimecodeEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  return true
}

function parseTimecodeCorner(value: unknown): string {
  if (value === 'bottom-left' || value === 'bottom-right') return value
  return 'bottom-right'
}

function parseTimecodeSizePx(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 96
  return Math.min(256, Math.max(32, Math.round(value)))
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

/**
 * Normalize `povIds`: non-empty strings in band `1–12`.
 * Missing/empty/all-junk → `["1","2"]` matching committed `config.json`.
 * Out-of-band values (boats/pilots/junk) are filtered with a console warn.
 */
export function normalizePovIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_POV_IDS]

  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      console.warn('[config] povIds: ignoring non-string entry')
      continue
    }
    const id = item.trim()
    if (id === '') continue
    const n = Number(id)
    if (!isPovBandId(n)) {
      console.warn(
        `[config] povIds: ignoring out-of-band id "${id}" (prefer 1–12)`,
      )
      continue
    }
    if (!out.includes(id)) out.push(id)
  }

  return out.length > 0 ? out : [...DEFAULT_POV_IDS]
}

/** Normalize a parsed JSON object into `AppConfig` (fills defaults). */
export function normalizeConfig(raw: unknown): AppConfig {
  if (raw === null || typeof raw !== 'object') {
    return {
      ...DEFAULT_CONFIG,
      boatIds: [...DEFAULT_BOAT_IDS],
      povIds: [...DEFAULT_POV_IDS],
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
    courseUrl:
      typeof o.courseUrl === 'string' && o.courseUrl.trim() !== ''
        ? o.courseUrl
        : DEFAULT_COURSE_URL,
    sponsorsUrl:
      typeof o.sponsorsUrl === 'string' && o.sponsorsUrl.trim() !== ''
        ? o.sponsorsUrl
        : DEFAULT_SPONSORS_URL,
    flagsUrl:
      typeof o.flagsUrl === 'string' && o.flagsUrl.trim() !== ''
        ? o.flagsUrl
        : DEFAULT_FLAGS_URL,
    boatNamesUrl:
      typeof o.boatNamesUrl === 'string' && o.boatNamesUrl.trim() !== ''
        ? o.boatNamesUrl
        : DEFAULT_BOAT_NAMES_URL,
    wsUrl: typeof o.wsUrl === 'string' ? o.wsUrl : '',
    wsBoatUrl: typeof o.wsBoatUrl === 'string' ? o.wsBoatUrl : '',
    boatIds: normalizeBoatIds(o.boatIds),
    povIds: normalizePovIds(o.povIds),
    origin: parseOrigin(o.origin),
    takeoffAltitudeMSL: isFiniteNumber(o.takeoffAltitudeMSL)
      ? o.takeoffAltitudeMSL
      : 0,
    outputMode: typeof o.outputMode === 'string' ? o.outputMode : 'preview',
    chromaKey: typeof o.chromaKey === 'string' ? o.chromaKey.trim() : '',
    timecodeEnabled: parseTimecodeEnabled(o.timecodeEnabled),
    timecodeCorner: parseTimecodeCorner(o.timecodeCorner),
    timecodeSizePx: parseTimecodeSizePx(o.timecodeSizePx),
    whepUrl: typeof o.whepUrl === 'string' ? o.whepUrl.trim() : '',
    projectsApiBase:
      typeof o.projectsApiBase === 'string' ? o.projectsApiBase.trim() : '',
    projectsRole: normalizeProjectsRoleField(o.projectsRole),
    projectsApiToken:
      typeof o.projectsApiToken === 'string' ? o.projectsApiToken.trim() : '',
  }
}

function normalizeProjectsRoleField(raw: unknown): string {
  if (typeof raw !== 'string') return 'editor'
  const v = raw.trim().toLowerCase()
  if (v === 'air' || v === 'air-only' || v === 'aironly') return 'air'
  if (v === 'editor' || v === 'edit' || v === '') return 'editor'
  return 'editor'
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

export {
  DEFAULT_CONFIG,
  DEFAULT_ORIGIN,
  DEFAULT_COURSE_URL,
  DEFAULT_SPONSORS_URL,
  DEFAULT_FLAGS_URL,
  DEFAULT_BOAT_NAMES_URL,
}
