import type {
  PositionMarkerEntry,
  PositionMarkerGps,
  PositionMarkersData,
} from './types.ts'

export const DEFAULT_MARKER_COLOR = 0xffffff
export const DEFAULT_MARKER_SIZE_M = 18

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseHexColor(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >>> 0
  }
  if (typeof value !== 'string') return fallback
  const s = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return Number.parseInt(s.slice(1), 16)
  if (/^0x[0-9a-fA-F]{6}$/i.test(s)) return Number.parseInt(s.slice(2), 16)
  return fallback
}

function parseGps(raw: unknown): PositionMarkerGps | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isFiniteNumber(o.lat) || !isFiniteNumber(o.lon)) return null
  return {
    lat: o.lat,
    lon: o.lon,
    altMsl: isFiniteNumber(o.altMsl) ? o.altMsl : 0,
  }
}

function parseMarker(raw: unknown): PositionMarkerEntry | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (id === '' || label === '') return null
  const point = parseGps(o.point ?? o)
  if (!point) return null
  return {
    id,
    label,
    point,
    color: parseHexColor(o.color, DEFAULT_MARKER_COLOR),
    sizeM: isFiniteNumber(o.sizeM)
      ? Math.max(o.sizeM, 2)
      : DEFAULT_MARKER_SIZE_M,
  }
}

/**
 * Normalize Distances-style marker JSON. Invalid entries dropped.
 * TODO(8.5+): promote to WorldFeature editor tool when GPS authoring lands.
 */
export function normalizePositionMarkers(raw: unknown): PositionMarkersData {
  if (raw === null || typeof raw !== 'object') {
    return { name: '', markers: [] }
  }
  const o = raw as Record<string, unknown>
  const markers: PositionMarkerEntry[] = []
  if (Array.isArray(o.markers)) {
    for (const item of o.markers) {
      const entry = parseMarker(item)
      if (entry) markers.push(entry)
    }
  }
  return {
    name: typeof o.name === 'string' ? o.name.trim() : '',
    markers,
  }
}
