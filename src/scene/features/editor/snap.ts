/** ENU East/North vertex for snap candidates. */
export type SnapVertex = {
  east: number
  north: number
}

export type SnapMode = 'none' | 'vertex' | 'grid'

export type SnapOptions = {
  /** Prefer nearest existing vertex within this ENU radius (meters). */
  vertexEnabled?: boolean
  vertexRadiusM?: number
  /** Snap to ENU grid (applied when vertex miss or vertex disabled). */
  gridEnabled?: boolean
  /** Grid cell size in meters (default 5). */
  gridStepM?: number
}

export type SnapResult = {
  east: number
  north: number
  mode: SnapMode
}

export const DEFAULT_VERTEX_RADIUS_M = 3
export const DEFAULT_GRID_STEP_M = 5

/** Snap East/North to nearest grid intersection. */
export function snapToGrid(
  east: number,
  north: number,
  stepM = DEFAULT_GRID_STEP_M,
): SnapVertex {
  const step = stepM > 0 ? stepM : DEFAULT_GRID_STEP_M
  return {
    east: Math.round(east / step) * step,
    north: Math.round(north / step) * step,
  }
}

/**
 * Nearest vertex within `radiusM`, or null.
 * Pure ENU distance (meters on the water plane).
 */
export function nearestVertex(
  east: number,
  north: number,
  vertices: readonly SnapVertex[],
  radiusM = DEFAULT_VERTEX_RADIUS_M,
): SnapVertex | null {
  let best: SnapVertex | null = null
  let bestD = radiusM
  for (const v of vertices) {
    const d = Math.hypot(v.east - east, v.north - north)
    if (d <= bestD) {
      bestD = d
      best = v
    }
  }
  return best
}

/**
 * Apply editor snap: vertex wins over grid when both enabled.
 * Defaults: vertex on (3 m), grid off (5 m step when enabled).
 */
export function applySnap(
  east: number,
  north: number,
  vertices: readonly SnapVertex[],
  options: SnapOptions = {},
): SnapResult {
  const vertexEnabled = options.vertexEnabled ?? true
  const gridEnabled = options.gridEnabled ?? false
  const vertexRadiusM = options.vertexRadiusM ?? DEFAULT_VERTEX_RADIUS_M
  const gridStepM = options.gridStepM ?? DEFAULT_GRID_STEP_M

  if (vertexEnabled) {
    const hit = nearestVertex(east, north, vertices, vertexRadiusM)
    if (hit) {
      return { east: hit.east, north: hit.north, mode: 'vertex' }
    }
  }

  if (gridEnabled) {
    const g = snapToGrid(east, north, gridStepM)
    return { east: g.east, north: g.north, mode: 'grid' }
  }

  return { east, north, mode: 'none' }
}

/** Collect unique ENU vertices from layout-style point lists (x=E, z=N). */
export function verticesFromLayoutPoints(
  features: readonly { points: readonly { x: number; z: number }[] }[],
): SnapVertex[] {
  const out: SnapVertex[] = []
  const seen = new Set<string>()
  for (const f of features) {
    for (const p of f.points) {
      const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ east: p.x, north: p.z })
    }
  }
  return out
}
