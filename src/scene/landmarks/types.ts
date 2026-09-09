import type { OccupancyHole } from '../buildings/index.ts'

/** Injected GEO convert — keep ECEF / geoid out of this module. */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

export type LandmarkKind = 'gltf' | 'proxy'

export type LandmarkSizeM = {
  x: number
  y: number
  z: number
}

export type LandmarkEntry = {
  id: string
  displayName: string
  lat: number
  lon: number
  /** Ground / rock top, metres AMSL. Unknown → 0 (GEO owns residual). */
  altMsl: number
  /** Optional yaw about +Y (Three.js degrees). Omit → 0. */
  yawDeg: number
  /** Local URL under `public/`. Null → named proxy box. */
  gltfUrl: string | null
  occupancyRadiusM: number
  licence: string
  kind: LandmarkKind
  /** Distinct proxy colour when `kind === 'proxy'` or glTF is missing. */
  proxyColor: number
  /** Approx real-world metres for the proxy (1 unit = 1 m). */
  proxySizeM: LandmarkSizeM
}

export type LandmarkEnu = {
  id: string
  x: number
  y: number
  z: number
  radiusM: number
}

/** Authoring ENU metres + Euler degrees + uniform scale. Not a geoid. */
export type LandmarkPoseOffset = {
  x: number
  y: number
  z: number
  yawDeg: number
  pitchDeg: number
  rollDeg: number
  /** Uniform mesh scale. Default 1. */
  scale: number
}

export type LandmarkTextureKind = 'textured' | 'no image' | 'proxy'

export type LandmarkTextureReport = {
  id: string
  kind: LandmarkTextureKind
}

export type { OccupancyHole }
