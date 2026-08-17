import { Vector3 } from 'three'
import { amslToHae } from '../../geodesy/egm96.ts'
import { REORIENTATION_AZIMUTH_RAD } from './constants.ts'

const DEG2RAD = Math.PI / 180

export type ReorientationPose = {
  /** Latitude, radians (plugin contract). */
  latRad: number
  /** Longitude, radians (plugin contract). */
  lonRad: number
  /** Height above WGS84 ellipsoid (metres). */
  heightHae: number
  /** Yaw about +Y mapping plugin X-west/Z-north → scene X-east/Z-−north. */
  azimuthRad: number
}

/**
 * `ReorientationPlugin.height` is HAE. `config.origin.altMsl` is AMSL.
 * Contract: never pass raw `altMsl` into the plugin.
 */
export function reorientationHeightHae(
  latDeg: number,
  lonDeg: number,
  altMsl: number,
): number {
  return amslToHae(latDeg, lonDeg, altMsl)
}

/**
 * Build plugin args from geographic degrees + AMSL (converts height via EGM96).
 */
export function reorientationFromOriginAmsl(
  latDeg: number,
  lonDeg: number,
  altMsl: number,
): ReorientationPose {
  return {
    latRad: latDeg * DEG2RAD,
    lonRad: lonDeg * DEG2RAD,
    heightHae: reorientationHeightHae(latDeg, lonDeg, altMsl),
    azimuthRad: REORIENTATION_AZIMUTH_RAD,
  }
}

/**
 * Apply the 180° Y term that maps a point in the plugin's local frame
 * (X west, Z north) into our scene frame (X east, Z −north).
 */
export function pluginFrameToScene(v: Vector3, out = new Vector3()): Vector3 {
  return out.set(-v.x, v.y, -v.z)
}
