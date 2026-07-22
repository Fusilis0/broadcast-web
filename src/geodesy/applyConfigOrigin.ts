/**
 * Thin helper: apply public/config.json-shaped origin (altMsl → AMSL).
 * Not wired into main.ts / scene loop — for tests and callers that load config themselves.
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
