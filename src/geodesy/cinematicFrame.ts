/**
 * Cinematic camera domains (Phase 21).
 *
 * Globe keyframes: WGS84 ECEF metres + ellipsoid (geodetic) up.
 * ENU keyframes: existing race tangent plane via `gpsToEnuAmsl`.
 *
 * Altitude in cinematic JSON is AMSL. Globe conversion uses `amslToHae`
 * (EGM96) before the ellipsoid radius — same geoid as the race path.
 * No Three.js in the ECEF math; no tileset / CesiumJS here (SCN owns tiles).
 */

import { amslToHae } from './egm96.ts'
import { gpsToEnuAmsl } from './geoUtils.ts'
import { WGS84 } from './geoOrigin.ts'

const { A, E_SQ } = WGS84

/** Metres. Closer than this, `ecefLookAt` treats eye and target as coincident. */
export const ECEF_LOOK_AT_EPSILON_M = 1e-3

export type EcefMeters = {
  x: number
  y: number
  z: number
}

/**
 * Orthonormal right-handed camera basis in ECEF.
 * `right × up = forward`. Forward points at the target (or nadir on degenerate look).
 */
export type EcefLookAt = {
  eye: EcefMeters
  forward: EcefMeters
  up: EcefMeters
  right: EcefMeters
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function hypot3(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z)
}

function sub(a: EcefMeters, b: EcefMeters): EcefMeters {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function scale(v: EcefMeters, s: number): EcefMeters {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

function normalize(v: EcefMeters): EcefMeters {
  const len = hypot3(v.x, v.y, v.z)
  if (len < 1e-15) return { x: 0, y: 0, z: 0 }
  return scale(v, 1 / len)
}

function cross(a: EcefMeters, b: EcefMeters): EcefMeters {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

/** WGS84 geodetic (degrees, HAE metres) → ECEF metres. */
function ecefFromHae(latDeg: number, lonDeg: number, altHae: number): EcefMeters {
  const latRad = toRad(latDeg)
  const lonRad = toRad(lonDeg)
  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  const N = A / Math.sqrt(1.0 - E_SQ * sinLat * sinLat)
  return {
    x: (N + altHae) * cosLat * Math.cos(lonRad),
    y: (N + altHae) * cosLat * Math.sin(lonRad),
    z: (N * (1.0 - E_SQ) + altHae) * sinLat,
  }
}

/** ECEF metres → geodetic degrees + HAE. Iterative latitude (same method as geoUtils). */
function geodeticFromEcef(x: number, y: number, z: number): {
  lat: number
  lon: number
  altHae: number
} {
  const lon = (Math.atan2(y, x) * 180) / Math.PI
  const p = Math.hypot(x, y)
  if (p < 1e-12) {
    const lat = z >= 0 ? 90 : -90
    const altHae = Math.abs(z) - A * Math.sqrt(1 - E_SQ)
    return { lat, lon, altHae }
  }

  let latRad = Math.atan2(z, p * (1 - E_SQ))
  for (let i = 0; i < 8; i++) {
    const sinLat = Math.sin(latRad)
    const N = A / Math.sqrt(1.0 - E_SQ * sinLat * sinLat)
    const alt = p / Math.cos(latRad) - N
    const next = Math.atan2(z, p * (1 - (E_SQ * N) / (N + alt)))
    if (Math.abs(next - latRad) < 1e-12) {
      latRad = next
      break
    }
    latRad = next
  }

  const sinLat = Math.sin(latRad)
  const N = A / Math.sqrt(1.0 - E_SQ * sinLat * sinLat)
  const altHae = p / Math.cos(latRad) - N
  return { lat: (latRad * 180) / Math.PI, lon, altHae }
}

/**
 * Geodetic keyframe (AMSL) → WGS84 ECEF metres.
 * Uses `amslToHae` (EGM96) before the ellipsoid radius.
 */
export function geodeticToEcefMeters(
  latDeg: number,
  lonDeg: number,
  altMsl: number,
): EcefMeters {
  return ecefFromHae(latDeg, lonDeg, amslToHae(latDeg, lonDeg, altMsl))
}

/**
 * Unit geodetic normal (ellipsoid up) at lat/lon. Independent of altitude.
 * This is the WGS84 ellipsoidal normal, not the geocentric radial.
 */
export function ellipsoidUpEcef(latDeg: number, lonDeg: number): EcefMeters {
  const latRad = toRad(latDeg)
  const lonRad = toRad(lonDeg)
  const cosLat = Math.cos(latRad)
  return {
    x: cosLat * Math.cos(lonRad),
    y: cosLat * Math.sin(lonRad),
    z: Math.sin(latRad),
  }
}

function fallbackAxis(upHint: EcefMeters): EcefMeters {
  return Math.abs(upHint.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }
}

function orthonormalBasis(forward: EcefMeters, upHint: EcefMeters): {
  forward: EcefMeters
  up: EcefMeters
  right: EcefMeters
} {
  const fwd = normalize(forward)
  let right = cross(upHint, fwd)
  if (hypot3(right.x, right.y, right.z) < 1e-8) {
    right = cross(fallbackAxis(upHint), fwd)
  }
  right = normalize(right)
  const up = normalize(cross(fwd, right))
  return { forward: fwd, up, right }
}

/**
 * Eye + right-handed orthonormal basis looking at `targetEcef`.
 *
 * - `forward` toward the target
 * - `up` = ellipsoid up at the **eye**, Gram–Schmidt against forward
 * - `right` completes `right × up = forward`
 *
 * Degenerate look (`|eye − target| < ECEF_LOOK_AT_EPSILON_M`): look **nadir**
 * (`forward = −ellipsoid up` at the eye). If forward is already parallel to
 * ellipsoid up (nadir/zenith), right is completed from ECEF +Z (or +X if that
 * is parallel) so the triad stays orthonormal.
 */
export function ecefLookAt(
  eyeEcef: EcefMeters,
  targetEcef: EcefMeters,
): EcefLookAt {
  const eyeLen = hypot3(eyeEcef.x, eyeEcef.y, eyeEcef.z)
  const geo =
    eyeLen < 1e-3
      ? { lat: 90, lon: 0, altHae: -A }
      : geodeticFromEcef(eyeEcef.x, eyeEcef.y, eyeEcef.z)
  const upHint = ellipsoidUpEcef(geo.lat, geo.lon)

  const delta = sub(targetEcef, eyeEcef)
  const dist = hypot3(delta.x, delta.y, delta.z)
  const forward = dist < ECEF_LOOK_AT_EPSILON_M ? scale(upHint, -1) : delta

  return { eye: { ...eyeEcef }, ...orthonormalBasis(forward, upHint) }
}

/**
 * Cinematic `enu` domain: Istanbul race tangent plane.
 * Delegates to `gpsToEnuAmsl` (same EGM96 geoid). Requires GeoOrigin set.
 * Scene packing: x=East, y=Up, z=−North.
 */
export function enuKeyframeToScene(
  lat: number,
  lon: number,
  altMsl: number,
): { x: number; y: number; z: number } {
  const v = gpsToEnuAmsl(lat, lon, altMsl)
  return { x: v.x, y: v.y, z: v.z }
}
