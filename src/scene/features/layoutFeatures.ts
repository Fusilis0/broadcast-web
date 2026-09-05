import { gateBaseName } from '../course/gatePairing.ts'
import type {
  GpsToEnuAmslFn,
  LayoutFeature,
  WorldFeature,
} from './types.ts'

/**
 * Default water-plane Y when Alt MSL ≈ 0 and origin is applied (Unity
 * `waterSurfaceY`). Layout uses GEO `enu.y` so inspector Alt MSL lifts assets.
 */
export const FEATURE_WATER_Y = 0

/**
 * Convert WorldFeature[] → LayoutFeature[] via a single GEO pass.
 * Pure — no Three.js. Call after `applyConfigOrigin` + EGM96.
 * 3D Y is GEO `enu.y` (do not force `FEATURE_WATER_Y`).
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
      return { x: enu.x, y: enu.y, z: enu.z }
    }),
    heightM: f.heightM,
    color: f.color,
    label: f.label,
    textureUrl: f.textureUrl,
    logos: f.logos?.map((l) => ({ url: l.url, weight: l.weight })),
    panelColor: f.panelColor,
    frameColor: f.frameColor,
    panelAlpha: f.panelAlpha,
    boardAspect: f.boardAspect,
    spacingM: f.spacingM,
    telemetryId: f.telemetryId,
    visible3d: f.visible3d,
    visible2d: f.visible2d,
    visibleBuoyMesh: f.visibleBuoyMesh,
    visibleTag: f.visibleTag,
    rounding: f.rounding,
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
