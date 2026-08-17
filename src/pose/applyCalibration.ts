/**
 * Apply CAL offsets on the GEO→SCN pose path.
 * Unity WorldAnchorManager order: worldYaw × inputRot × localPitchRoll; alt on ENU Y.
 */

import { Euler, MathUtils, Quaternion } from 'three'
import {
  getOffsets,
  type CalibrationOffsets,
  zeroOffsets,
} from '../calibration/index.ts'
import type { EnuPosition, PoseRotation } from './types.ts'

/** ENU pose for apply: position metres (x=E, y=U, z=−N), rotation as Three quaternion. */
export type EnuPose = {
  position: EnuPosition
  rotation: Quaternion
}

export type CalibratedPoseResult = {
  pose: EnuPose
  fovHDeg: number
}

/**
 * Unity `Quaternion.Euler(x,y,z)` → Three.js quaternion.
 * Matches MidpointLerp / Unity: Three Euler order `'YXZ'`.
 */
export function unityEulerDeg(
  xDeg: number,
  yDeg: number,
  zDeg: number,
): Quaternion {
  return new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(xDeg),
      MathUtils.degToRad(yDeg),
      MathUtils.degToRad(zDeg),
      'YXZ',
    ),
  )
}

export function poseRotationToQuaternion(r: PoseRotation): Quaternion {
  return unityEulerDeg(r.pitchDeg, r.yawDeg, r.rollDeg)
}

export function quaternionToPoseRotation(q: Quaternion): PoseRotation {
  const e = new Euler().setFromQuaternion(q, 'YXZ')
  return {
    pitchDeg: MathUtils.radToDeg(e.x),
    yawDeg: MathUtils.radToDeg(e.y),
    rollDeg: MathUtils.radToDeg(e.z),
  }
}

/**
 * Apply calibration offsets to an ENU pose.
 *
 * - Position: add `altMeters` to ENU Y only (east/north out of scope).
 * - Rotation: `worldYaw(yawDeg) * inputRot * localPitchRoll(pitch, roll)`
 *   (declination is GEO-owned — not applied here).
 * - `fovHDeg` always from offsets (default 66.8832), never telemetry `cam.fov`.
 *
 * With zero angles, rotation is identity within float epsilon.
 */
export function applyCalibration(
  pose: EnuPose,
  offsets: CalibrationOffsets = zeroOffsets(),
): CalibratedPoseResult {
  const position: EnuPosition = {
    x: pose.position.x,
    y: pose.position.y + offsets.altMeters,
    z: pose.position.z,
  }

  const worldYaw = unityEulerDeg(0, offsets.yawDeg, 0)
  const localPitchRoll = unityEulerDeg(offsets.pitchDeg, 0, offsets.rollDeg)
  const rotation = worldYaw
    .multiply(pose.rotation.clone())
    .multiply(localPitchRoll)

  return {
    pose: { position, rotation },
    fovHDeg: offsets.fovHDeg,
  }
}

/** Look up per-device offsets (or zero+FOV default) and apply. */
export function applyCalibrationForDevice(
  pose: EnuPose,
  deviceId: string,
): CalibratedPoseResult {
  return applyCalibration(pose, getOffsets(deviceId))
}

/**
 * Convenience for convert/pipeline: ENU + Euler in → calibrated ENU + Euler + FOV.
 */
export function applyCalibrationEuler(
  position: EnuPosition,
  rotation: PoseRotation,
  deviceId: string,
): { position: EnuPosition; rotation: PoseRotation; fovHDeg: number } {
  const calibrated = applyCalibrationForDevice(
    {
      position,
      rotation: poseRotationToQuaternion(rotation),
    },
    deviceId,
  )
  return {
    position: calibrated.pose.position,
    rotation: quaternionToPoseRotation(calibrated.pose.rotation),
    fovHDeg: calibrated.fovHDeg,
  }
}

/** @deprecated Prefer applyCalibration — identity passthrough for old GEO stub. */
export function applyCalOffsetsStub(rotation: PoseRotation): PoseRotation {
  return rotation
}
