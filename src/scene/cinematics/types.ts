/**
 * Cinematic sequence JSON (Phase 21). Authoring only — not an air path.
 * Camera keyframes are geodetic; SCN converts via GEO (no ECEF in this package).
 */

export type CinematicDomain = 'globe' | 'enu'

export type CinematicImagery = 'aerial' | 'road'

export type CinematicEase = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export type CinematicKeyframe = {
  lat: number
  lon: number
  altMsl: number
  lookLat: number
  lookLon: number
  lookAltMsl: number
  /** 0–1 within the shot. */
  t01: number
  ease?: CinematicEase
  /** Authoring + pin focus. Copied through the parser. */
  lookId?: string
}

export type CinematicPinKind = 'country' | 'hero' | 'place'

/** Sequence-level marker. Globe = ECEF; heroes = ENU. */
export type CinematicPin = {
  id: string
  label: string
  lat: number
  lon: number
  /** ISO-like flag key: usa, canada, uk, russia, bulgaria, turkey. */
  flag?: string
  kind?: CinematicPinKind
}

export type CinematicShot = {
  t0: number
  t1: number
  domain: CinematicDomain
  fog: boolean
  ocean: boolean
  buildings: boolean
  imagery: CinematicImagery
  /** Full-screen cloud overlay opacity (0–1). Not `scene.fog`. */
  cloud01: number
  keyframes: readonly CinematicKeyframe[]
}

/** Tile IDs for other machines — URLs only, no binaries, no ion token. */
export type CinematicTileWarm = {
  contentUrls: readonly string[]
}

export type CinematicSequence = {
  id: string
  durationSec: number
  width: number
  height: number
  fps: number
  shots: readonly CinematicShot[]
  /** Globe pins; hide when `domain=enu`. Empty when omitted in JSON. */
  pins: readonly CinematicPin[]
  /** ENU hero labels; hidden on globe. Empty when omitted. */
  heroPins: readonly CinematicPin[]
  /**
   * Prefetch index for this sequence. Bytes stay in the local PLT cache.
   * Far computers download the listed ion content URLs after they have a token.
   */
  tileWarm: CinematicTileWarm
}

export type CinematicCatalogueEntry = {
  id: string
  label: string
  url: string
}

export type Vec3 = { x: number; y: number; z: number }

export type CinematicPose = {
  eye: Vec3
  target: Vec3
  up: Vec3
}

export type CinematicSample = {
  tSec: number
  shot: CinematicShot
  domain: CinematicDomain
  fog: boolean
  ocean: boolean
  buildings: boolean
  imagery: CinematicImagery
  cloud01: number
  pose: CinematicPose
  keyframe: CinematicKeyframe
  lookId?: string
}
