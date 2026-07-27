import type {
  SponsorEntry,
  SponsorGpsPoint,
  SponsorsData,
} from './types.ts'

export const DEFAULT_SPONSOR_HEIGHT_M = 8
export const DEFAULT_SPONSOR_COLOR = 0x2a6f7a

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseHexColor(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const s = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return Number.parseInt(s.slice(1), 16)
  if (/^0x[0-9a-fA-F]{6}$/i.test(s)) return Number.parseInt(s.slice(2), 16)
  return fallback
}

function parseGpsPoint(raw: unknown): SponsorGpsPoint | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isFiniteNumber(o.lat) || !isFiniteNumber(o.lon)) return null
  return {
    lat: o.lat,
    lon: o.lon,
    altMsl: isFiniteNumber(o.altMsl) ? o.altMsl : 0,
  }
}

function parseSponsor(raw: unknown): SponsorEntry | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (id === '' || label === '') return null
  const a = parseGpsPoint(o.a)
  const b = parseGpsPoint(o.b)
  if (!a || !b) return null

  let textureUrl: string | null = null
  if (typeof o.textureUrl === 'string' && o.textureUrl.trim() !== '') {
    textureUrl = o.textureUrl.trim()
  }

  return {
    id,
    label,
    a,
    b,
    heightM: isFiniteNumber(o.heightM)
      ? Math.max(o.heightM, 1)
      : DEFAULT_SPONSOR_HEIGHT_M,
    textureUrl,
    color: parseHexColor(o.color, DEFAULT_SPONSOR_COLOR),
  }
}

/**
 * Normalize parsed sponsors JSON. Invalid entries dropped; empty → empty list.
 */
export function normalizeSponsors(raw: unknown): SponsorsData {
  if (raw === null || typeof raw !== 'object') {
    return { name: '', sponsors: [] }
  }
  const o = raw as Record<string, unknown>
  const sponsors: SponsorEntry[] = []
  if (Array.isArray(o.sponsors)) {
    for (const item of o.sponsors) {
      const entry = parseSponsor(item)
      if (entry) sponsors.push(entry)
    }
  }
  return {
    name: typeof o.name === 'string' ? o.name.trim() : '',
    sponsors,
  }
}
