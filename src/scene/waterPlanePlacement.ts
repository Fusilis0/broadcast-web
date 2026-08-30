import * as THREE from 'three'

/** Water-plane Y for graphics that sit on the sea (Unity `waterSurfaceY`). */
export const WATER_PLANE_Y = 0

/**
 * Slight lift so a coplanar water graphic does not z-fight the clear colour
 * or Gerstner `liftY` (both 0.08 m). Shared so line signs and sponsors cannot drift.
 */
export const WATER_PLANE_Y_OFFSET = 0.08

export type WaterPlaneSpan = {
  ax: number
  az: number
  bx: number
  bz: number
  midX: number
  midZ: number
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
  object.position.set(
    span.midX,
    WATER_PLANE_Y + WATER_PLANE_Y_OFFSET,
    span.midZ,
  )
  return true
}
