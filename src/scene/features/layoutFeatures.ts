import { gateBaseName } from '../course/gatePairing.ts'
import type {
  GpsToEnuAmslFn,
  LayoutFeature,
  WorldFeature,
} from './types.ts'

/**
 * Water-plane Y for shared layout (Unity `waterSurfaceY`).
 * AMSL→ENU `y` is ignored so Istanbul geoid offset does not lift features.
 */
export const FEATURE_WATER_Y = 0

/**
 * Convert WorldFeature[] → LayoutFeature[] via a single GEO pass.
 * Pure — no Three.js. Call after `applyConfigOrigin` + EGM96.
 */
export function layoutFeatures(
  features: readonly WorldFeature[],
  gpsToEnuAmsl: GpsToEnuAmslFn,
): LayoutFeature[] {
  return features.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    points: f.points.map((p) => {
      const enu = gpsToEnuAmsl(p.lat, p.lon, p.altMsl)
      return { x: enu.x, y: FEATURE_WATER_Y, z: enu.z }
    }),
    heightM: f.heightM,
    color: f.color,
    label: f.label,
    rawPoints: f.points.map((p) => ({ ...p })),
  }))
}

export type LayoutGatePair = {
  baseName: string
  left: LayoutFeature
  right: LayoutFeature
}

/**
 * Pair gateLeft + gateRight layout features by Unity-style base name.
 * Used by the 2D map (and future editor) to draw gate segments.
 */
export function pairLayoutGates(
  features: readonly LayoutFeature[],
): LayoutGatePair[] {
  const lefts = new Map<string, LayoutFeature>()
  const rights = new Map<string, LayoutFeature>()

  for (const f of features) {
    if (f.type === 'gateLeft' && f.points[0]) {
      const base = gateBaseName(f.name)
      if (!lefts.has(base)) lefts.set(base, f)
    } else if (f.type === 'gateRight' && f.points[0]) {
      const base = gateBaseName(f.name)
      if (!rights.has(base)) rights.set(base, f)
    }
  }

  const pairs: LayoutGatePair[] = []
  for (const [baseName, left] of lefts) {
    const right = rights.get(baseName)
    if (right) pairs.push({ baseName, left, right })
  }
  return pairs
}
