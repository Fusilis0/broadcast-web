export type DisposableHandle = { dispose: () => void } | null | undefined

export type WorldGeometryHandles = {
  course?: DisposableHandle
  sponsors?: DisposableHandle
  countdownFlags?: DisposableHandle
  lineSigns?: DisposableHandle
  worldBuoys?: DisposableHandle
  billboardChains?: DisposableHandle
  positionMarkers?: DisposableHandle
}

/** Dispose order for pack remount (empty `features` must still run each). */
export const WORLD_GEOMETRY_DISPOSE_ORDER = [
  'course',
  'sponsors',
  'countdownFlags',
  'lineSigns',
  'worldBuoys',
  'billboardChains',
  'positionMarkers',
] as const

/**
 * Drop leftover 3D world meshes. Null / already-disposed handles are skipped.
 * `remountWorldFromFeatures([])` calls this before mounting nothing.
 */
export function disposeWorldGeometryHandles(
  handles: WorldGeometryHandles,
): void {
  for (const key of WORLD_GEOMETRY_DISPOSE_ORDER) {
    handles[key]?.dispose()
  }
}
