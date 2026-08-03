/**
 * Thin helper: apply public/config.json-shaped origin (altMsl → AMSL).
 * Used by main boot, race switch, and ops world-anchor Apply.
 */

import { setOriginAMSL } from './geoOrigin.ts'

export type ConfigOrigin = {
  lat: number
  lon: number
  altMsl: number
}

export function applyConfigOrigin(origin: ConfigOrigin): void {
  setOriginAMSL(origin.lat, origin.lon, origin.altMsl)
}

function parseFiniteField(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  return n
}

/**
 * Parse ops HUD / form strings into a ConfigOrigin.
 * Returns null when any field is missing or non-finite.
 */
export function parseConfigOriginFields(
  latRaw: string,
  lonRaw: string,
  altMslRaw: string,
): ConfigOrigin | null {
  const lat = parseFiniteField(latRaw)
  const lon = parseFiniteField(lonRaw)
  const altMsl = parseFiniteField(altMslRaw)
  if (lat === undefined || lon === undefined || altMsl === undefined) {
    return null
  }
  return { lat, lon, altMsl }
}
