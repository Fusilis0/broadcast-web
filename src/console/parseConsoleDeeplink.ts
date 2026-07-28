import type {
  ConsoleDeeplink,
  DeeplinkOutputMode,
  DeeplinkTelemetryMode,
} from './types.ts'

const TELEMETRY_MODES = new Set<DeeplinkTelemetryMode>([
  'mock',
  'replay',
  'live',
])

const OUTPUT_MODES = new Set<DeeplinkOutputMode>(['preview', 'chroma'])

function asSearchParams(search: string | URLSearchParams): URLSearchParams {
  if (search instanceof URLSearchParams) return search
  const s = search.trim()
  if (s.startsWith('?')) return new URLSearchParams(s)
  return new URLSearchParams(s)
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  return n
}

function parseNonEmptyString(raw: string | null): string | undefined {
  if (raw === null) return undefined
  const t = raw.trim()
  return t === '' ? undefined : t
}

/**
 * Pure parser for console deep-link query strings.
 * Works with `window.location.search` on `/`, `/overlay`, or `/index.html`.
 * Invalid `mode` / `outputMode` are omitted (optional console.warn).
 */
export function parseConsoleDeeplink(
  search: string | URLSearchParams,
): ConsoleDeeplink {
  const params = asSearchParams(search)
  const out: ConsoleDeeplink = {}

  const race = parseNonEmptyString(params.get('race'))
  if (race !== undefined) out.race = race

  const token = parseNonEmptyString(params.get('token'))
  if (token !== undefined) out.token = token

  const modeRaw = params.get('mode')
  if (modeRaw !== null && modeRaw.trim() !== '') {
    const mode = modeRaw.trim() as DeeplinkTelemetryMode
    if (TELEMETRY_MODES.has(mode)) {
      out.mode = mode
    } else {
      console.warn(`[console] ignoring invalid mode=${JSON.stringify(modeRaw)}`)
    }
  }

  const originLat = parseFiniteNumber(params.get('originLat'))
  if (originLat !== undefined) out.originLat = originLat

  const originLon = parseFiniteNumber(params.get('originLon'))
  if (originLon !== undefined) out.originLon = originLon

  const originAltMsl = parseFiniteNumber(params.get('originAltMsl'))
  if (originAltMsl !== undefined) out.originAltMsl = originAltMsl

  const outputRaw = params.get('outputMode')
  if (outputRaw !== null && outputRaw.trim() !== '') {
    const outputMode = outputRaw.trim() as DeeplinkOutputMode
    if (OUTPUT_MODES.has(outputMode)) {
      out.outputMode = outputMode
    } else {
      console.warn(
        `[console] ignoring invalid outputMode=${JSON.stringify(outputRaw)}`,
      )
    }
  }

  return out
}
