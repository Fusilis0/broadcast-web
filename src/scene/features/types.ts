import type { BillboardLogo } from '../billboardLogos.ts'
import type { RoundingSense } from './rounding.ts'

export type { BillboardLogo } from '../billboardLogos.ts'

export type { RoundingSense } from './rounding.ts'

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

/** Billboard chain LineString cap (geojson import + map insert). */
export const BILLBOARD_CHAIN_MAX_POINTS = 64

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
  /** Optional extent in meters: sponsor across-water depth; billboardChain / poles vertical height. */
  heightM?: number
  /** Hex fill 0xRRGGBB when known. */
  color?: number
  /** Display label (sponsor text, etc.). */
  label?: string
  /** Optional texture under `public/` (sponsors / billboardChain). */
  textureUrl?: string | null
  /**
   * Billboard-chain logo list with integer weights (Phase 19.11).
   * Present (including `[]`) wins over `textureUrl`. Empty → solid plate.
   * One `{ url, weight: 1 }` is the single-logo case.
   */
  logos?: BillboardLogo[]
  /**
   * Additive board fill 0xRRGGBB (sponsor / billboardChain).
   * Sponsor omit → white `#f4f4f2`. Chain omit → bluish `#2A6FA6`.
   */
  panelColor?: number
  /**
   * Additive frame stroke 0xRRGGBB (sponsor / billboardChain).
   * Omit → default dark slate.
   */
  frameColor?: number
  /**
   * Additive plate alpha 0–1 (sponsor / billboardChain).
   * Omit → 1 (opaque). Canvas fill + mesh transparency honour this.
   */
  panelAlpha?: number
  /**
   * Additive sponsor along/across ratio (A–B metres / short-side metres).
   * When set, stretching GPS A–B scales the board uniformly. Omit → `heightM`
   * is independent depth (old packs) until the next height or span edit.
   */
  boardAspect?: number
  /**
   * Billboard-chain logo pitch along the ribbon (meters).
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
  /**
   * Racing-mark float body (DSP-06). Omit / true → show; false → hide mesh.
   * Independent of `visibleTag` / `rounding`. Ignored when `visible3d` is false
   * (full 3D omit). Applies to `mark` / `buoy` / `gateLeft` / `gateRight`.
   * Does not affect 2D (`visible2d`).
   */
  visibleBuoyMesh?: boolean
  /**
   * Racing-mark name sprite (DSP-06). Omit / true → show; false → hide tag.
   * Independent of `visibleBuoyMesh` / `rounding`. Ignored when `visible3d` is false.
   * Applies to `mark` / `buoy` / `gateLeft` / `gateRight`. Does not affect 2D.
   */
  visibleTag?: boolean
  /**
   * Water-level circular two-arrow rounding glyph (Phase 15.3 / 16.5).
   * Applies to `mark` / `buoy` / `gateLeft` / `gateRight`.
   * Omit → CW; `'none'` hides; unknown JSON parses as `'none'`.
   * Sense is per feature (not wind-coupled). From above the water (look −Y): `cw` = clock.
   */
  rounding?: RoundingSense
}

/** ENU meters after GEO + water-Y force (x=East, y=Up, z=−North). */
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
  logos?: BillboardLogo[]
  panelColor?: number
  frameColor?: number
  panelAlpha?: number
  boardAspect?: number
  spacingM?: number
  telemetryId?: string | null
  visible3d?: boolean
  visible2d?: boolean
  visibleBuoyMesh?: boolean
  visibleTag?: boolean
  rounding?: RoundingSense
  rawPoints: WorldGpsPoint[]
}
