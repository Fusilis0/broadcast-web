/**
 * Telemetry → raw ENU + orientation (Unity WorldAnchorManager altitude / rot contracts).
 * CAL offsets applied via applyCalibrationEuler (default zero+FOV until UI/CV).
 */

import { gpsToEnu, gpsToEnuRelative } from '../geodesy/index.ts'
import type { BoatTelemetry, TelemetryData } from '../telemetry/types.ts'
import { applyCalibrationEuler } from './applyCalibration.ts'
import type { EnuPosition, PoseRotation } from './types.ts'

export type RawPose = {
  position: EnuPosition
  rotation: PoseRotation
  /** Horizontal FOV from CAL offsets (not telemetry cam.fov). */
  fovHDeg: number
}

export function droneRawPose(
  data: TelemetryData,
  takeoffAltitudeMSL: number,
): RawPose {
  const v = gpsToEnuRelative(
    data.pos.lat,
    data.pos.lon,
    data.pos.alt,
    takeoffAltitudeMSL,
  )
  const position: EnuPosition = { x: v.x, y: v.y, z: v.z }

  // Unity EULER + ABSOLUTE gimbal yaw; declination = 0 (GEO-owned later).
  // DJI → Unity: negate pitch/roll.
  const gimbal = data.gimbal
  const rawRotation: PoseRotation = {
    yawDeg: gimbal?.yaw ?? data.rot?.yaw ?? 0,
    pitchDeg: -(gimbal?.pitch ?? 0),
    rollDeg: -(gimbal?.roll ?? 0),
  }

  return applyCalibrationEuler(position, rawRotation, data.id)
}

export function boatRawPose(data: BoatTelemetry): RawPose {
  // Boat alt is HAE (not AMSL) — Unity ProcessBoatPosition.
  const v = gpsToEnu(data.lat, data.lon, data.alt)
  const position: EnuPosition = { x: v.x, y: v.y, z: v.z }

  const declinationDeg = 0 // GEO / mag service — not CAL
  const rawRotation: PoseRotation = {
    yawDeg: data.brg + declinationDeg,
    pitchDeg: 0,
    rollDeg: 0,
  }

  return applyCalibrationEuler(position, rawRotation, data.id)
}

/** @deprecated Use applyCalibration / applyCalibrationEuler — identity passthrough. */
export { applyCalOffsetsStub } from './applyCalibration.ts'
