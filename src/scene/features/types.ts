/** Injected GEO convert — keep ECEF out of scene (same as course/sponsors/flags). */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

/**
 * Shared world-feature kinds (race-projects §4).
 * Stub-ready types may be map-only until 3D builders exist.
 */
export type WorldFeatureType =
  | 'mark'
  | 'gateLeft'
  | 'gateRight'
  | 'sponsor'
  | 'flagP1'
  | 'flagP2'
  | 'start'
  | 'finish'
  | 'arrow'
  | 'rotation'

/** GPS point before GEO (lat/lon + AMSL meters). */
export type WorldGpsPoint = {
  lat: number
  lon: number
  altMsl: number
}

/**
 * Normalized GPS-space feature (pre-layout).
 * `points` length is 1 (mark/flag/arrow) or 2 (gate ends as separate features,
 * sponsor A–B, start/finish line).
 */
export type WorldFeature = {
  id: string
  name: string
  type: WorldFeatureType
  points: WorldGpsPoint[]
  /** Optional vertical extent (sponsors, poles). */
  heightM?: number
  /** Hex fill 0xRRGGBB when known. */
  color?: number
  /** Display label (sponsor text, etc.). */
  label?: string
}

/** ENU meters after GEO + water-Y force (x=East, y=Up, z=North). */
export type LayoutEnuPoint = {
  x: number
  y: number
  z: number
}

/**
 * Post-layout feature: one GEO pass, water plane Y = 0.
 * Raw GPS kept for editor / debug.
 */
export type LayoutFeature = {
  id: string
  name: string
  type: WorldFeatureType
  points: LayoutEnuPoint[]
  heightM?: number
  color?: number
  label?: string
  rawPoints: WorldGpsPoint[]
}
