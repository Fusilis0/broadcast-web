import * as THREE from 'three'

/** Environment sea height (m). Moves Gerstner rest Y + shared water-plane graphics. */
export const SEA_HEIGHT_Y_MIN = -20
export const SEA_HEIGHT_Y_MAX = 20
export const SEA_HEIGHT_Y_DEFAULT = 0

/**
 * Water-plane Y for graphics that sit on the sea (Unity `waterSurfaceY`).
 * Mutable via `setWaterPlaneY` / Environment **sea m** (not Cesium tile discard).
 */
export let WATER_PLANE_Y = SEA_HEIGHT_Y_DEFAULT

/**
 * Slight lift so a coplanar water graphic does not z-fight the clear colour
 * or Gerstner `liftY` (both 0.08 m). Shared so line signs and sponsors cannot drift.
 */
export const WATER_PLANE_Y_OFFSET = 0.08

export function clampSeaHeightYM(yM: number): number {
  if (!Number.isFinite(yM)) return SEA_HEIGHT_Y_DEFAULT
  return Math.min(SEA_HEIGHT_Y_MAX, Math.max(SEA_HEIGHT_Y_MIN, yM))
}

/** Shared sea rest Y (Environment **sea m**). Does not change Cesium hide. */
export function setWaterPlaneY(yM: number): void {
  WATER_PLANE_Y = clampSeaHeightYM(yM)
}

export function getWaterPlaneY(): number {
  return WATER_PLANE_Y
}

export type WaterPlaneSpan = {
  ax: number
  az: number
  bx: number
  bz: number
  midX: number
  midZ: number
  /**
   * GEO ENU Y (Alt MSL). When set, boards stay at this height + offset so
   * Environment **sea m** can lower the ocean under them.
   */
  midY?: number
}

/**
 * Horizontal A→B basis on the water: local PlaneGeometry +X along, +Y across, +Z up.
 */
export function flatOnWaterBasis(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { along: THREE.Vector3; across: THREE.Vector3; up: THREE.Vector3 } | null {
  const along = new THREE.Vector3(bx - ax, 0, bz - az)
  if (along.lengthSq() < 1e-8) return null
  along.normalize()
  const up = new THREE.Vector3(0, 1, 0)
  // Across on water = up × along so local Y of PlaneGeometry lies on water.
  const across = new THREE.Vector3().crossVectors(up, along)
  if (across.lengthSq() < 1e-8) return null
  across.normalize()
  return { along, across, up }
}

/**
 * Lie a PlaneGeometry mesh on the water (normal +Y, readable from above).
 * Returns false when A→B is degenerate — caller throws with its own prefix.
 */
export function applyFlatOnWaterPlacement(
  object: THREE.Object3D,
  span: WaterPlaneSpan,
): boolean {
  const basis = flatOnWaterBasis(span.ax, span.az, span.bx, span.bz)
  if (!basis) return false
  const m = new THREE.Matrix4().makeBasis(basis.along, basis.across, basis.up)
  object.quaternion.setFromRotationMatrix(m)
  const baseY =
    span.midY !== undefined && Number.isFinite(span.midY)
      ? span.midY
      : WATER_PLANE_Y
  object.position.set(span.midX, baseY + WATER_PLANE_Y_OFFSET, span.midZ)
  return true
}
