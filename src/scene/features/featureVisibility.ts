/**
 * Soft per-feature 3D / 2D visibility (Phase 11.7).
 * Omitted / undefined → visible (old packs unchanged).
 */

export function isFeatureVisible3d(f: { visible3d?: boolean }): boolean {
  return f.visible3d !== false
}

export function isFeatureVisible2d(f: { visible2d?: boolean }): boolean {
  return f.visible2d !== false
}

/** Features drawn in the Three.js world remount path. */
export function filterFeaturesFor3d<T extends { visible3d?: boolean }>(
  features: readonly T[],
): T[] {
  return features.filter(isFeatureVisible3d)
}

/** Features drawn on the 2D ops/stream map. */
export function filterFeaturesFor2d<T extends { visible2d?: boolean }>(
  features: readonly T[],
): T[] {
  return features.filter(isFeatureVisible2d)
}

/** ENU centroid of layout/world points (x=E, z=N); y averaged. */
export function featureEnuCentroid(
  points: readonly { x: number; y: number; z: number }[],
): { x: number; y: number; z: number } | null {
  if (points.length === 0) return null
  let sx = 0
  let sy = 0
  let sz = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
    sz += p.z
  }
  const n = points.length
  return { x: sx / n, y: sy / n, z: sz / n }
}
