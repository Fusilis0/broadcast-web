import type { RoundingSense } from '../features/rounding.ts'

/** Course waypoint kinds (Unity `CourseWaypointType`). */
export type CourseWaypointType = 'mark' | 'gateLeft' | 'gateRight'

export type CourseWaypoint = {
  name: string
  type: CourseWaypointType
  lat: number
  lon: number
  /** AMSL meters; default 0. */
  altMsl: number
  /**
   * Optional rounding arrows (Phase 15.3 / 16.5). Omit → CW ring;
   * `'none'` hides. Copied through WorldFeature on adapt / remount.
   */
  rounding?: RoundingSense
  /** Racing-mark float body (DSP-06). Omit / true → show. */
  visibleBuoyMesh?: boolean
  /** Racing-mark name sprite (DSP-06). Omit / true → show. */
  visibleTag?: boolean
}

export type CourseAppearance = {
  boundaryColor: number
  gateColor: number
  buoyColor: number
  buoyHeightM: number
}

export type CourseData = {
  name: string
  waypoints: CourseWaypoint[]
  appearance: CourseAppearance
}

/** ENU meters after GEO conversion (x=East, y=Up, z=−North). */
export type CourseEnuPoint = {
  name: string
  type: CourseWaypointType
  x: number
  y: number
  z: number
  rounding?: RoundingSense
  visibleBuoyMesh?: boolean
  visibleTag?: boolean
}

export type GatePair = {
  baseName: string
  left: CourseWaypoint
  right: CourseWaypoint
}

/** Injected GEO convert — keep ECEF out of scene. */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }
