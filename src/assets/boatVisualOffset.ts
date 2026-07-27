import * as THREE from 'three'

/**
 * One-time local transform applied to loaded boat meshes under the pose root.
 *
 * Authored `public/models/boat.glb` and the procedural fallback are already in
 * SCN frame (forward +Z, up +Y, meters). Identity offset for the shipped asset.
 *
 * If a future asset is Z-up / cm-scale / bow−Z, set these instead of rotating
 * the pose root (pose still comes from poseBus on the entity root).
 */
export const BOAT_VISUAL_LOCAL_OFFSET = {
  position: new THREE.Vector3(0, 0, 0),
  /** Euler XYZ radians applied as local rotation on the visual child. */
  rotation: new THREE.Euler(0, 0, 0, 'XYZ'),
  scale: new THREE.Vector3(1, 1, 1),
} as const

export function applyBoatVisualOffset(visual: THREE.Object3D): void {
  visual.position.copy(BOAT_VISUAL_LOCAL_OFFSET.position)
  visual.rotation.copy(BOAT_VISUAL_LOCAL_OFFSET.rotation)
  visual.scale.copy(BOAT_VISUAL_LOCAL_OFFSET.scale)
}
