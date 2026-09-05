/**
 * Soft per-feature 3D / 2D visibility (Phase 11.7).
 * Omitted / undefined → visible (old packs unchanged).
 */

const BUOY_MARKER_TYPES = new Set([
  'mark',
  'buoy',
  'gateLeft',
  'gateRight',
])

/** On-air / local-2D map: race traffic + course only (no TV boards, no marks). */
const ON_AIR_MAP_FEATURE_TYPES = new Set([
  'start',
  'finish',
  'buoy',
  'gateLeft',
  'gateRight',
])

export function isFeatureVisible3d(f: { visible3d?: boolean }): boolean {
  return f.visible3d !== false
}

export function isFeatureVisible2d(f: { visible2d?: boolean }): boolean {
  return f.visible2d !== false
}

/** Racing-mark float body. Omit / true → show. Independent of tag / rounding / 2D. */
export function isBuoyMeshVisible(f: { visibleBuoyMesh?: boolean }): boolean {
  return f.visibleBuoyMesh !== false
}

/** Racing-mark name sprite. Omit / true → show. Independent of mesh / rounding / 2D. */
export function isBuoyTagVisible(f: { visibleTag?: boolean }): boolean {
  return f.visibleTag !== false
}

/** Types that share the racing-mark buoy prop (mesh + tag + rounding arrows). */
export function isBuoyMarkerFeatureType(type: string): boolean {
  return BUOY_MARKER_TYPES.has(type)
}

/** Features drawn in the Three.js world remount path. */
export function filterFeaturesFor3d<T extends { visible3d?: boolean }>(
  features: readonly T[],
): T[] {
  return features.filter(isFeatureVisible3d)
}

/** Features drawn on the 2D ops / World Authoring map. */
export function filterFeaturesFor2d<T extends { visible2d?: boolean }>(
  features: readonly T[],
): T[] {
  return features.filter(isFeatureVisible2d)
}

/** Course types shown on the stream / NDI 2D graphic. */
export function isOnAirMapFeatureType(type: string): boolean {
  return ON_AIR_MAP_FEATURE_TYPES.has(type)
}

/**
 * Stream / local-2D / NDI map: `visible2d` plus on-air type allow-list.
 * Drops mark, sponsor, billboardChain, flags, arrow, rotation.
 */
export function filterFeaturesForStreamMap<
  T extends { type: string; visible2d?: boolean },
>(features: readonly T[]): T[] {
  return features.filter(
    (f) => isFeatureVisible2d(f) && isOnAirMapFeatureType(f.type),
  )
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
