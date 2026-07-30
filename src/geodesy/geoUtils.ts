/**
 * WGS84 GPS → local ENU (Unity GeoUtils port).
 *
 * Axis contract (Three.js / Unity-compatible):
 *   x = East, y = Up, z = North
 *
 * If GeoOrigin is unset: returns (0,0,0) and warns (Unity behavior).
 */

import { Vector3 } from 'three'
import { amslToHae, haeToAmsl, relativeToHae } from './egm96.ts'
import * as GeoOrigin from './geoOrigin.ts'
import { WGS84 } from './geoOrigin.ts'

const { A, E_SQ } = WGS84

function ensureOrigin(): boolean {
  if (GeoOrigin.isValid) return true
  console.warn('[GeoUtils] GeoOrigin is not initialized; returning zero ENU.')
  return false
}

function ecefFromGeodetic(
  lat: number,
  lon: number,
  altHAE: number,
): { x: number; y: number; z: number } {
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  const N = A / Math.sqrt(1.0 - E_SQ * sinLat * sinLat)

  return {
    x: (N + altHAE) * cosLat * Math.cos(lonRad),
    y: (N + altHAE) * cosLat * Math.sin(lonRad),
    z: (N * (1.0 - E_SQ) + altHAE) * sinLat,
  }
}

function enuFromEcefDelta(dx: number, dy: number, dz: number, out: Vector3): Vector3 {
  const east =
    GeoOrigin.m00 * dx + GeoOrigin.m01 * dy + GeoOrigin.m02 * dz
  const north =
    GeoOrigin.m10 * dx + GeoOrigin.m11 * dy + GeoOrigin.m12 * dz
  const up =
    GeoOrigin.m20 * dx + GeoOrigin.m21 * dy + GeoOrigin.m22 * dz
  return out.set(east, up, north)
}

/** GPS with HAE altitude → ENU Vector3 (x=East, y=Up, z=North). */
export function gpsToEnu(
  lat: number,
  lon: number,
  altHAE: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  if (!ensureOrigin()) return out.set(0, 0, 0)

  const { x, y, z } = ecefFromGeodetic(lat, lon, altHAE)
  const dx = x - GeoOrigin.ecefX
  const dy = y - GeoOrigin.ecefY
  const dz = z - GeoOrigin.ecefZ
  return enuFromEcefDelta(dx, dy, dz, out)
}

/** GPS with AMSL altitude (EGM96 bridge to HAE). */
export function gpsToEnuAmsl(
  lat: number,
  lon: number,
  altAMSL: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  return gpsToEnu(lat, lon, amslToHae(lat, lon, altAMSL), out)
}

/** GPS with DJI-style relative altitude + takeoff AMSL. */
export function gpsToEnuRelative(
  lat: number,
  lon: number,
  relativeAlt: number,
  takeoffAMSL: number,
  out: Vector3 = new Vector3(),
): Vector3 {
  return gpsToEnu(lat, lon, relativeToHae(lat, lon, relativeAlt, takeoffAMSL), out)
}

/**
 * Batch convert HAE GPS points into ENU results (writes into `results`).
 * Length = min of all array lengths.
 */
export function gpsToEnuBatch(
  lats: number[],
  lons: number[],
  altsHAE: number[],
  results: Vector3[],
): void {
  if (!ensureOrigin()) {
    for (const v of results) v.set(0, 0, 0)
    return
  }

  const count = Math.min(results.length, altsHAE.length, lats.length, lons.length)
  for (let i = 0; i < count; i++) {
    const { x, y, z } = ecefFromGeodetic(lats[i]!, lons[i]!, altsHAE[i]!)
    const dx = x - GeoOrigin.ecefX
    const dy = y - GeoOrigin.ecefY
    const dz = z - GeoOrigin.ecefZ
    enuFromEcefDelta(dx, dy, dz, results[i]!)
  }
}

export type GpsPoint = {
  lat: number
  lon: number
  /** Altitude — HAE for `enuToGps`, AMSL for `enuToGpsAmsl`. */
  alt: number
}

/** ECEF → geodetic (WGS84). Iterative latitude; lon via atan2. */
function geodeticFromEcef(
  x: number,
  y: number,
  z: number,
): { lat: number; lon: number; altHAE: number } {
  const lon = (Math.atan2(y, x) * 180) / Math.PI
  const p = Math.sqrt(x * x + y * y)
  if (p < 1e-12) {
    const lat = z >= 0 ? 90 : -90
    const altHAE = Math.abs(z) - A * Math.sqrt(1 - E_SQ)
    return { lat, lon, altHAE }
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
  const altHAE = p / Math.cos(latRad) - N
  return { lat: (latRad * 180) / Math.PI, lon, altHAE }
}

/**
 * Local ENU (x=East, y=Up, z=North) → GPS with HAE altitude.
 * Inverse of `gpsToEnu`. Unset origin → (0,0,0) and warn.
 */
export function enuToGps(
  east: number,
  up: number,
  north: number,
): GpsPoint {
  if (!ensureOrigin()) return { lat: 0, lon: 0, alt: 0 }

  // R^T · ENU — rows of R are East/North/Up in ECEF.
  const dx =
    GeoOrigin.m00 * east + GeoOrigin.m10 * north + GeoOrigin.m20 * up
  const dy =
    GeoOrigin.m01 * east + GeoOrigin.m11 * north + GeoOrigin.m21 * up
  const dz =
    GeoOrigin.m02 * east + GeoOrigin.m12 * north + GeoOrigin.m22 * up

  const g = geodeticFromEcef(
    GeoOrigin.ecefX + dx,
    GeoOrigin.ecefY + dy,
    GeoOrigin.ecefZ + dz,
  )
  return { lat: g.lat, lon: g.lon, alt: g.altHAE }
}

/**
 * Local ENU → GPS with AMSL altitude (EGM96 bridge).
 * Inverse of `gpsToEnuAmsl`.
 */
export function enuToGpsAmsl(
  east: number,
  up: number,
  north: number,
): GpsPoint {
  const hae = enuToGps(east, up, north)
  if (!GeoOrigin.isValid) return hae
  return {
    lat: hae.lat,
    lon: hae.lon,
    alt: haeToAmsl(hae.lat, hae.lon, hae.alt),
  }
}
