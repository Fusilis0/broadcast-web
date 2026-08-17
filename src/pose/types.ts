/** Pose bus DTOs — ENU meters for SCN (no scene graph). */

export type PoseKind = 'drone' | 'boat' | 'buoy'

/** ENU meters: x=East, y=Up, z=−North. */
export type EnuPosition = {
  x: number
  y: number
  z: number
}

/**
 * World-frame Euler degrees (Unity-compatible YXZ intent).
 * CAL angular offsets applied in convert via `applyCalibration`.
 */
export type PoseRotation = {
  yawDeg: number
  pitchDeg: number
  rollDeg: number
}

export type PoseEvent = {
  id: string
  kind: PoseKind
  position: EnuPosition
  rotation: PoseRotation
  /**
   * Horizontal FOV from CAL offsets (`fovHDeg`), not telemetry `cam.fov`.
   * Default 66.8832 until setOffsets / UI.
   */
  fovHDeg: number
  /** Telemetry timestamp (drone `ts`, boat `time`). */
  ts: number
}

export type PoseEvents = {
  pose: PoseEvent
}
