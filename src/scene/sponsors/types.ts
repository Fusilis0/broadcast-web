/** Injected GEO convert — keep ECEF out of scene (same as course). */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

export type SponsorGpsPoint = {
  lat: number
  lon: number
  /** AMSL meters; default 0. Graphics still force water Y for the panel baseline. */
  altMsl: number
}

export type SponsorEntry = {
  id: string
  label: string
  a: SponsorGpsPoint
  b: SponsorGpsPoint
  /**
   * Authored inspector height. Glyph scale inside the A–B canvas (clamped).
   * Does **not** set across-track metres — that is `widthM / board aspect`.
   */
  heightM: number
  /** Optional image under `public/`; null → procedural label on the board. */
  textureUrl: string | null
  /** Hex brand/map colour (0xRRGGBB). Not the board fill (see `panelColor`). */
  color: number
  /** Additive board fill 0xRRGGBB; omit → default white (`#f4f4f2`). */
  panelColor?: number
  /** Additive frame stroke 0xRRGGBB; omit → default dark slate. */
  frameColor?: number
  /** Additive plate alpha 0–1; omit → 1 (opaque). */
  panelAlpha?: number
  /** Additive along/across canvas ratio. Omit → `DEFAULT_SPONSOR_BOARD_ASPECT`. */
  boardAspect?: number
}

export type SponsorsData = {
  name: string
  sponsors: SponsorEntry[]
}

/** ENU meters after GEO (x=East, y=Up, z=−North). */
export type SponsorEnuEndpoints = {
  id: string
  label: string
  /** Across-water canvas depth for flat sponsors; vertical height for upright chain instances. */
  heightM: number
  textureUrl: string | null
  color: number
  panelColor?: number
  frameColor?: number
  panelAlpha?: number
  boardAspect?: number
  /**
   * 0–1 glyph scale inside the A–B canvas (flat water-plane). Omit → 1.
   * Authored `heightM` 100/120 clamps here; it does not grow the mesh OBB.
   */
  glyphScale?: number
  ax: number
  az: number
  bx: number
  bz: number
  /** Midpoint XZ; Y from GEO Alt MSL (average of A/B). */
  midX: number
  midY: number
  midZ: number
  /** Horizontal width A↔B (meters). */
  widthM: number
  /** Optional compose canvas (chain matches plane aspect so heightM does not stretch logos). */
  canvasW?: number
  canvasH?: number
}
