import { parseRounding } from './rounding.ts'
import type { WorldFeature, WorldFeatureType } from './types.ts'

export const DEFAULT_WORLD_EXTRAS_URL =
  '/fixtures/world/demo-istanbul-extras.json'

const LINE_TYPES = new Set<WorldFeatureType>(['start', 'finish'])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parsePoint(
  raw: unknown,
): { lat: number; lon: number; altMsl: number } | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isFiniteNumber(o.lat) || !isFiniteNumber(o.lon)) return null
  return {
    lat: o.lat,
    lon: o.lon,
    altMsl: isFiniteNumber(o.altMsl) ? o.altMsl : 0,
  }
}

function parseFeature(raw: unknown): WorldFeature | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const name = typeof o.name === 'string' ? o.name.trim() : id
  const type = o.type
  if (id === '' || typeof type !== 'string' || !LINE_TYPES.has(type as WorldFeatureType)) {
    return null
  }
  if (!Array.isArray(o.points) || o.points.length < 1) return null
  const points = []
  for (const p of o.points) {
    const gp = parsePoint(p)
    if (!gp) return null
    points.push(gp)
  }
  const feature: WorldFeature = {
    id,
    name: name || id,
    type: type as WorldFeatureType,
    points,
  }
  if (typeof o.label === 'string' && o.label.trim() !== '') {
    feature.label = o.label.trim()
  }
  if (isFiniteNumber(o.color)) feature.color = o.color >>> 0
  if (isFiniteNumber(o.heightM)) feature.heightM = o.heightM
  const rounding = parseRounding(o.rounding)
  if (rounding !== undefined) feature.rounding = rounding
  return feature
}

/**
 * Load start/finish (and future non-course extras) WorldFeature[] from a fixture.
 * Invalid / missing → empty list (boot continues).
 */
export async function loadWorldExtrasFeatures(
  url: string = DEFAULT_WORLD_EXTRAS_URL,
): Promise<WorldFeature[]> {
  const trimmed = url.trim()
  if (trimmed === '') return []
  try {
    const res = await fetch(trimmed)
    if (!res.ok) {
      console.warn(`[worldExtras] failed to load ${trimmed}: HTTP ${res.status}`)
      return []
    }
    const raw: unknown = await res.json()
    if (raw === null || typeof raw !== 'object') return []
    const o = raw as Record<string, unknown>
    if (!Array.isArray(o.features)) return []
    const out: WorldFeature[] = []
    for (const item of o.features) {
      const f = parseFeature(item)
      if (f) out.push(f)
    }
    return out
  } catch (err) {
    console.warn(`[worldExtras] failed to load ${trimmed}`, err)
    return []
  }
}
