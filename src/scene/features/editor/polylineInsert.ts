export type Enu2 = { east: number; north: number }

export type SegmentClosest = {
  east: number
  north: number
  t: number
  dist: number
}

/** Closest point on segment AB to P (2D). `t` is 0 at A, 1 at B. */
export function closestPointOnSegment2d(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): SegmentClosest {
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  const t =
    len2 < 1e-12
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2))
  const east = ax + abx * t
  const north = ay + aby * t
  return {
    east,
    north,
    t,
    dist: Math.hypot(px - east, py - north),
  }
}

/**
 * Extra vertex past the last point, along the last segment.
 * Degenerate / single-point → step east.
 */
export function extendPolylineEnd(
  points: readonly Enu2[],
  stepM = 20,
): Enu2 {
  const step = Number.isFinite(stepM) && stepM > 0 ? stepM : 20
  if (points.length === 0) return { east: step, north: 0 }
  const last = points[points.length - 1]!
  if (points.length === 1) {
    return { east: last.east + step, north: last.north }
  }
  const prev = points[points.length - 2]!
  const dx = last.east - prev.east
  const dy = last.north - prev.north
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { east: last.east + step, north: last.north }
  const s = step / len
  return { east: last.east + dx * s, north: last.north + dy * s }
}
