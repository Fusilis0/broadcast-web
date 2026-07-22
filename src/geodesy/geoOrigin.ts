/**
 * Process-wide WGS84 origin cache (Unity GeoOrigin port, without Cesium/scene lookup).
 * Callers must set origin explicitly via setOriginHAE / setOriginAMSL.
 */

import { amslToHae } from './egm96.ts'

const A = 6378137.0
const E_SQ = 6.6943799901377997e-3

type ChangedListener = () => void

const listeners = new Set<ChangedListener>()

export let isValid = false
export let latitudeDeg = 0
export let longitudeDeg = 0
export let altitudeHAE = 0

/** Cached ECEF of origin (meters). Used by geoUtils. */
export let ecefX = 0
export let ecefY = 0
export let ecefZ = 0

/**
 * ECEF→ENU rotation rows (Unity cache layout):
 * m0* = East, m1* = North, m2* = Up (in ECEF).
 */
export let m00 = 0
export let m01 = 0
export let m02 = 0
export let m10 = 0
export let m11 = 0
export let m12 = 0
export let m20 = 0
export let m21 = 0
export let m22 = 0

function rebuildCache(): void {
  const latRad = (latitudeDeg * Math.PI) / 180
  const lonRad = (longitudeDeg * Math.PI) / 180

  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  const sinLon = Math.sin(lonRad)
  const cosLon = Math.cos(lonRad)

  const N = A / Math.sqrt(1.0 - E_SQ * sinLat * sinLat)
  ecefX = (N + altitudeHAE) * cosLat * cosLon
  ecefY = (N + altitudeHAE) * cosLat * sinLon
  ecefZ = (N * (1.0 - E_SQ) + altitudeHAE) * sinLat

  m00 = -sinLon
  m01 = cosLon
  m02 = 0.0
  m10 = -sinLat * cosLon
  m11 = -sinLat * sinLon
  m12 = cosLat
  m20 = cosLat * cosLon
  m21 = cosLat * sinLon
  m22 = sinLat
}

function emitChanged(): void {
  for (const cb of listeners) {
    cb()
  }
}

export function setOriginHAE(lat: number, lon: number, altHAE: number): void {
  latitudeDeg = lat
  longitudeDeg = lon
  altitudeHAE = altHAE
  rebuildCache()
  isValid = true
  emitChanged()
}

/** AMSL path: bridges via EGM96 (ensure grid loaded first for non-zero N). */
export function setOriginAMSL(lat: number, lon: number, altAMSL: number): void {
  setOriginHAE(lat, lon, amslToHae(lat, lon, altAMSL))
}

export function onChanged(listener: ChangedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test helper: clear origin. */
export function resetForTests(): void {
  isValid = false
  latitudeDeg = 0
  longitudeDeg = 0
  altitudeHAE = 0
  ecefX = ecefY = ecefZ = 0
  m00 = m01 = m02 = 0
  m10 = m11 = m12 = 0
  m20 = m21 = m22 = 0
  listeners.clear()
}

export const WGS84 = { A, E_SQ } as const
