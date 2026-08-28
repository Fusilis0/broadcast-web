import { pairGates } from './gatePairing.ts'
import type {
  CourseData,
  CourseEnuPoint,
  GatePair,
  GpsToEnuAmslFn,
} from './types.ts'

/**
 * Water-plane Y for course lines and buoy bases (Unity `waterSurfaceY`).
 * AMSL→ENU `y` is ignored for graphics so Istanbul geoid offset does not lift the course.
 */
export const COURSE_WATER_Y = 0

export type CourseLayout = {
  /** All waypoints in fixture order, ENU with y forced to water. */
  points: CourseEnuPoint[]
  /** Mark positions only (boundary vertices, fixture order). */
  marks: CourseEnuPoint[]
  /** Paired gates with ENU ends at water Y. */
  gates: Array<{
    baseName: string
    left: CourseEnuPoint
    right: CourseEnuPoint
  }>
}

function toEnuPoint(
  wp: {
    name: string
    type: CourseEnuPoint['type']
    lat: number
    lon: number
    altMsl: number
    rounding?: CourseEnuPoint['rounding']
  },
  gpsToEnuAmsl: GpsToEnuAmslFn,
): CourseEnuPoint {
  const enu = gpsToEnuAmsl(wp.lat, wp.lon, wp.altMsl)
  const point: CourseEnuPoint = {
    name: wp.name,
    type: wp.type,
    x: enu.x,
    y: COURSE_WATER_Y,
    z: enu.z,
  }
  if (wp.rounding !== undefined) point.rounding = wp.rounding
  return point
}

/**
 * Convert course waypoints to ENU via injected GEO helper. Pure — no Three.js.
 */
export function buildCourseLayout(
  course: CourseData,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): CourseLayout {
  const points = course.waypoints.map((wp) => toEnuPoint(wp, gpsToEnuAmsl))
  const marks = points.filter((p) => p.type === 'mark')
  const pairs: GatePair[] = pairGates(course.waypoints)
  const gates = pairs.map((pair) => ({
    baseName: pair.baseName,
    left: toEnuPoint(pair.left, gpsToEnuAmsl),
    right: toEnuPoint(pair.right, gpsToEnuAmsl),
  }))
  return { points, marks, gates }
}
