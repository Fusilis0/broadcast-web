import type { WorldFeature } from '../features/types.ts'
import {
  WATER_PLANE_Y,
  WATER_PLANE_Y_OFFSET,
} from '../waterPlanePlacement.ts'
import type { GpsToEnuAmslFn, LineSignEnu, LineSignKind } from './types.ts'

/** Water-plane Y for line-sign bands (Unity `waterSurfaceY`). */
export const LINE_SIGN_WATER_Y = WATER_PLANE_Y

/** Slight lift so the band does not z-fight the water clear colour. */
export const LINE_SIGN_Y_OFFSET = WATER_PLANE_Y_OFFSET

/** Depth of the text band on the water (meters). Phase 19.10: ×2 vs the original 12 m Unity-port band. */
export const LINE_SIGN_BAND_DEPTH_M = 24

/**
 * Default span when the feature has a single GPS point (editor one-click legacy).
 * Oriented east–west through the point. Authored two-point A–B GPS span is unchanged.
 */
export const DEFAULT_LINE_SIGN_WIDTH_M = 100

export const DEFAULT_START_COLOR = 0xad0000
export const DEFAULT_FINISH_COLOR = 0xad0000

function isLineSignKind(type: string): type is LineSignKind {
  return type === 'start' || type === 'finish'
}

/**
 * Build water-plane ENU spans from WorldFeature start/finish entries.
 * 2 points → A–B span; 1 point → default width east–west.
 */
export function buildLineSignLayout(
  features: readonly WorldFeature[],
  gpsToEnuAmsl: GpsToEnuAmslFn,
): LineSignEnu[] {
  const out: LineSignEnu[] = []
  for (const f of features) {
    if (!isLineSignKind(f.type)) continue
    const p0 = f.points[0]
    if (!p0) continue

    const a = gpsToEnuAmsl(p0.lat, p0.lon, p0.altMsl)
    let ax = a.x
    let az = a.z
    let ay = a.y
    let bx: number
    let bz: number
    let by: number

    const p1 = f.points[1]
    if (p1) {
      const b = gpsToEnuAmsl(p1.lat, p1.lon, p1.altMsl)
      bx = b.x
      bz = b.z
      by = b.y
    } else {
      const half = DEFAULT_LINE_SIGN_WIDTH_M / 2
      ax = a.x - half
      az = a.z
      bx = a.x + half
      bz = a.z
      by = a.y
    }

    const widthM = Math.hypot(bx - ax, bz - az)
    if (widthM < 0.5) continue

    const defaultLabel = f.type === 'start' ? 'START' : 'FINISH'
    const label = (f.label?.trim() || defaultLabel).toUpperCase()
    const color =
      f.color ??
      (f.type === 'start' ? DEFAULT_START_COLOR : DEFAULT_FINISH_COLOR)

    out.push({
      id: f.id,
      kind: f.type,
      label,
      color,
      ax,
      az,
      bx,
      bz,
      midX: (ax + bx) / 2,
      midY: (ay + by) / 2,
      midZ: (az + bz) / 2,
      widthM,
    })
  }
  return out
}
