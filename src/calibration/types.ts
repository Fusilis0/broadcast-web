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
  /**
   * Milliseconds added to the video frame's resolved NTP after LUT lookup
   * (`t_ntp = toNtp(pts) + syncTrimMs`). Positive samples a later world
   * state (AR overlay leads the video). `0` = no trim (today's behaviour).
   * Time offset only — not applied by `applyCalibration`.
   */
  syncTrimMs: number
}

/** Zero angular/altitude/sync offsets + default hFOV. Fresh object each call. */
export function zeroOffsets(): CalibrationOffsets {
  return {
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    fovHDeg: DEFAULT_HFOV_DEG,
    altMeters: 0,
    syncTrimMs: 0,
  }
}
