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
  heightM: number
  /** Optional image under `public/`; null → procedural label on the board. */
  textureUrl: string | null
  /** Hex brand/map colour (0xRRGGBB). Not the board fill (see `panelColor`). */
  color: number
  /** Additive board fill 0xRRGGBB; omit → default white (`#f4f4f2`). */
  panelColor?: number
  /** Additive frame stroke 0xRRGGBB; omit → default dark slate. */
  frameColor?: number
}

export type SponsorsData = {
  name: string
  sponsors: SponsorEntry[]
}

/** ENU meters after GEO + water-Y force (x=East, y=Up, z=−North). */
export type SponsorEnuEndpoints = {
  id: string
  label: string
  heightM: number
  textureUrl: string | null
  color: number
  panelColor?: number
  frameColor?: number
  ax: number
  az: number
  bx: number
  bz: number
  /** Midpoint at water plane (y = 0). */
  midX: number
  midZ: number
  /** Horizontal width A↔B (meters). */
  widthM: number
}
