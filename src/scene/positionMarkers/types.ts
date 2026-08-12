/** Injected GEO convert — keep ECEF out of scene. */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

export type PositionMarkerGps = {
  lat: number
  lon: number
  altMsl: number
}

export type PositionMarkerEntry = {
  id: string
  /** Display text (Unity Distances: "100", "200", …). */
  label: string
  point: PositionMarkerGps
  /** Optional hex 0xRRGGBB; default semi-white. */
  color: number
  /** World size of label plane (meters). */
  sizeM: number
}

export type PositionMarkersData = {
  name: string
  markers: PositionMarkerEntry[]
}

export type PositionMarkerEnu = {
  id: string
  label: string
  color: number
  sizeM: number
  x: number
  z: number
}
