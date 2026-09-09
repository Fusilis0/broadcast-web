import { LANDMARK_FOCUS_RADIUS_CAP_M } from './constants.ts'
import type { OccupancyHole } from '../buildings/index.ts'
import type {
  GpsToEnuAmslFn,
  LandmarkEnu,
  LandmarkEntry,
  LandmarkPoseOffset,
} from './types.ts'

/** Place one catalogue row through GEO `gpsToEnuAmsl` (no second geoid). */
export function landmarkEnuFromGps(
  entry: LandmarkEntry,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): LandmarkEnu {
  const enu = gpsToEnuAmsl(entry.lat, entry.lon, entry.altMsl)
  return {
    id: entry.id,
    x: enu.x,
    y: enu.y,
    z: enu.z,
    radiusM: entry.occupancyRadiusM,
  }
}

/**
 * Occupancy disks for **visible** heroes. XZ from GEO ENU, radius from catalogue.
 * Empty input → `[]` (OSM massing stays).
 */
export function occupancyHolesFromEnu(
  placed: readonly LandmarkEnu[],
): OccupancyHole[] {
  const holes: OccupancyHole[] = []
  for (const p of placed) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue
    if (!Number.isFinite(p.radiusM) || p.radiusM <= 0) continue
    holes.push({ x: p.x, z: p.z, radiusM: p.radiusM })
  }
  return holes
}

export function occupancyHolesForCatalogue(
  entries: readonly LandmarkEntry[],
  gpsToEnuAmsl: GpsToEnuAmslFn,
): OccupancyHole[] {
  return occupancyHolesFromEnu(
    entries.map((entry) => landmarkEnuFromGps(entry, gpsToEnuAmsl)),
  )
}

export function yawRadFromDeg(yawDeg: number | undefined): number {
  const deg = typeof yawDeg === 'number' && Number.isFinite(yawDeg) ? yawDeg : 0
  return (deg * Math.PI) / 180
}

export function degToRad(deg: number | undefined): number {
  return yawRadFromDeg(deg)
}

/** Occupancy / world XZ follow offset metres, not rotation. */
export function applyLandmarkOffset(
  enu: LandmarkEnu,
  offset: LandmarkPoseOffset,
): LandmarkEnu {
  return {
    id: enu.id,
    x: enu.x + offset.x,
    y: enu.y + offset.y,
    z: enu.z + offset.z,
    radiusM: enu.radiusM,
  }
}

/**
 * Free-cam Focus radius. Occupancy or half AABB; bridges capped so the
 * camera does not pull to space.
 */
export function landmarkFocusRadiusM(
  entry: LandmarkEntry,
  aabbMaxM?: number,
): number {
  const occ = entry.occupancyRadiusM
  const aabbR =
    aabbMaxM !== undefined && Number.isFinite(aabbMaxM) && aabbMaxM > 0
      ? aabbMaxM * 0.5
      : occ
  const raw = Math.max(occ, aabbR)
  if (entry.id.includes('bridge')) {
    return Math.min(raw, LANDMARK_FOCUS_RADIUS_CAP_M)
  }
  return raw
}
