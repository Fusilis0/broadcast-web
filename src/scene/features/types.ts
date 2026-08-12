/** Injected GEO convert — keep ECEF out of scene (same as course/sponsors/flags). */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

/**
 * Shared world-feature kinds (race-projects §4).
 * Stub-ready types may be map-only until 3D builders exist.
 * Additive: `buoy` / `billboardChain` (Phase 11.6) — old packs without them still parse.
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
  | 'buoy'
  | 'billboardChain'

/** GPS point before GEO (lat/lon + AMSL meters). */
export type WorldGpsPoint = {
  lat: number
  lon: number
  altMsl: number
}

/**
 * Normalized GPS-space feature (pre-layout).
 * `points` length is 1 (mark/flag/arrow/buoy) or ≥2 (gate ends as separate features,
 * sponsor A–B, start/finish line, billboardChain polyline).
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
  /** Optional texture under `public/` (sponsors / billboardChain). */
  textureUrl?: string | null
  /**
   * Billboard-chain spacing along the polyline (meters).
   * Only for `type: 'billboardChain'`. Default applied at create time.
   */
  spacingM?: number
  /**
   * Optional live buoy telemetry id (TEL buoy channel).
   * When set and a matching buoy pose arrives, SCN-03 may live-bind;
   * placement remains valid with a static point when unbound.
   */
  telemetryId?: string | null
  /**
   * Draw in 3D world (default true when omitted). Soft / additive.
   * Independent of `visible2d` (map chrome).
   */
  visible3d?: boolean
  /**
   * Draw on 2D ops/stream map (default true when omitted). Soft / additive.
   * Independent of `visible3d`.
   */
  visible2d?: boolean
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
  textureUrl?: string | null
  spacingM?: number
  telemetryId?: string | null
  visible3d?: boolean
  visible2d?: boolean
  rawPoints: WorldGpsPoint[]
}
