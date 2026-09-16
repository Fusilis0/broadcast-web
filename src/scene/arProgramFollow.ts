/**
 * AR SRT program cam: freeze until the follow POV has recent usable GPS.
 * Planned-only / map-dropped boats never unlock Follow.
 */

import { hasUsableGps } from '../telemetry/index.ts'

/** Wall-clock freshness for AR Follow unlock (same window as pose stale). */
export const AR_FOLLOW_STALE_MS = 2_000

/** AR plate world layers — off even when studio 3D has them on. */
export const AR_PLATE_WORLD_LAYERS = {
  environmentMode: 'simple' as const,
  terrainEnabled: false,
  buildingsEnabled: false,
  heroesEnabled: false,
}

export type ArFollowGpsTick = {
  povId: string
  lat: number
  lon: number
  receivedAtMs: number
}

export function noteArFollowGps(
  lastGpsAtMs: Map<string, number>,
  tick: ArFollowGpsTick,
): void {
  const id = tick.povId.trim()
  if (id === '') return
  if (!hasUsableGps(tick.lat, tick.lon)) return
  if (!Number.isFinite(tick.receivedAtMs)) return
  lastGpsAtMs.set(id, tick.receivedAtMs)
}

export function hasActiveArFollowTelemetry(
  lastGpsAtMs: number | undefined,
  nowMs: number,
  staleMs = AR_FOLLOW_STALE_MS,
): boolean {
  if (lastGpsAtMs == null || !Number.isFinite(lastGpsAtMs)) return false
  if (!Number.isFinite(nowMs) || !Number.isFinite(staleMs) || staleMs < 0) {
    return false
  }
  const age = nowMs - lastGpsAtMs
  return Number.isFinite(age) && age <= staleMs
}

/** Apply drone pose to the AR follow camera only when GPS is live (or gate off). */
export function shouldApplyArFollowPose(input: {
  followRequiresActiveGps: boolean
  gpsLive: boolean
}): boolean {
  if (!input.followRequiresActiveGps) return true
  return input.gpsLive === true
}
