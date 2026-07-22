/**
 * First-class calibration knobs (architecture §5.3).
 * CV / future UI write these same fields — one apply path only.
 */

/** Mini 4 Pro default horizontal FOV (degrees). */
export const DEFAULT_HFOV_DEG = 66.8832

export interface CalibrationOffsets {
  yawDeg: number
  pitchDeg: number
  rollDeg: number
  fovHDeg: number
  altMeters: number
}

/** Zero angular/altitude offsets + default hFOV. Fresh object each call. */
export function zeroOffsets(): CalibrationOffsets {
  return {
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    fovHDeg: DEFAULT_HFOV_DEG,
    altMeters: 0,
  }
}
