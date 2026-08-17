/** Course waypoint kinds (Unity `CourseWaypointType`). */
export type CourseWaypointType = 'mark' | 'gateLeft' | 'gateRight'

export type CourseWaypoint = {
  name: string
  type: CourseWaypointType
  lat: number
  lon: number
  /** AMSL meters; default 0. */
  altMsl: number
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
