/**
 * Static / planned fleet hulls (SCN 15.4).
 *
 * Live `poseBus` boat packets always update the same entity. Planned GPS (or a
 * default origin grid) seeds a hull when an allow-listed id has never received
 * telemetry. After a live packet, hold that pose — do not snap back to planned
 * every fleet sync (~2 s freshness is documented; we never pop back).
 *
 * Scene stays ENU-only. Callers convert planned lat/lon via GEO `gpsToEnuAmsl`.
 */

import { TEMP_HFOV_DEG } from './droneCamera.ts'
import type { EnuPosition, PoseEvent } from '../pose/index.ts'

/** Documented live-packet freshness window (ms). Static apply never overwrites after first live pose. */
export const STATIC_HULL_LIVE_HOLD_MS = 2000

/** Default grid spacing (metres) so hulls without planned GPS do not stack. */
export const STATIC_HULL_GRID_SPACING_M = 18

export type StaticHullSeed = {
  id: string
  /** Planned ENU. Omit → `staticHullGridPosition(index)`. */
  position?: EnuPosition
}

/** Origin-neighbour grid: +East columns, −North rows (4-wide). */
export function staticHullGridPosition(index: number): EnuPosition {
  const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  const col = i % 4
  const row = Math.floor(i / 4)
  return {
    x: col * STATIC_HULL_GRID_SPACING_M,
    y: 0,
    z: row === 0 ? 0 : -row * STATIC_HULL_GRID_SPACING_M,
  }
}

export function staticBoatPose(
  id: string,
  position: EnuPosition,
  ts = 0,
): PoseEvent {
  return {
    id,
    kind: 'boat',
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
    fovHDeg: TEMP_HFOV_DEG,
    ts,
  }
}

/**
 * Planned/static pose may move the hull only if this id never received a live
 * boat packet. After live telem, hold last live (including after
 * `STATIC_HULL_LIVE_HOLD_MS`) — do not snap back to planned.
 */
export function canApplyStaticHull(lastLiveAtMs: number | undefined): boolean {
  return lastLiveAtMs === undefined
}

/**
 * Operator may drag a hull on the world map when it is not currently live.
 * Fresh packets within `STATIC_HULL_LIVE_HOLD_MS` win; after that (or never
 * live) map-authored ENU is allowed. Fleet sync still uses `canApplyStaticHull`
 * so a remount cannot teleport a previously-live boat back to planned.
 */
export function canAuthorStaticHull(
  lastLiveAtMs: number | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastLiveAtMs === undefined) return true
  return nowMs - lastLiveAtMs > STATIC_HULL_LIVE_HOLD_MS
}

/** Resolve ENU for a seed (planned position or grid by index). */
export function resolveStaticHullPosition(
  seed: StaticHullSeed,
  index: number,
): EnuPosition {
  const p = seed.position
  if (
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.z)
  ) {
    return { x: p.x, y: p.y, z: p.z }
  }
  return staticHullGridPosition(index)
}
