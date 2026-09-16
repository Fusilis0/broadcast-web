/**
 * 3D SRT program rig (Phase 22.4d): independent of the ops free cam.
 * Air motion is damped. Frame boats only uses hulls with recent telemetry.
 */

import { STATIC_HULL_LIVE_HOLD_MS } from './staticFleetHulls.ts'

/**
 * MapControls dampingFactor for the on-air 3D program rig.
 * Lower than ops `OPS_CAM_DAMPING_FACTOR` (0.08) — smoother because this is air.
 */
export const PROGRAM_CAM_DAMPING_FACTOR = 0.035

/** WASD exponential time constant (seconds). Ops is instant (`wasdTauSec` 0). */
export const PROGRAM_WASD_TAU_SEC = 0.25

/** Live-packet window for Frame boats — same freshness as static-hull hold. */
export const PROGRAM_FRAME_BOATS_STALE_MS = STATIC_HULL_LIVE_HOLD_MS

export function isTelemetryBoatLive(
  lastLiveAtMs: number | undefined,
  nowMs: number,
  staleMs = PROGRAM_FRAME_BOATS_STALE_MS,
): boolean {
  if (lastLiveAtMs == null || !Number.isFinite(lastLiveAtMs)) return false
  if (!Number.isFinite(nowMs) || !Number.isFinite(staleMs) || staleMs < 0) {
    return false
  }
  const age = nowMs - lastLiveAtMs
  return Number.isFinite(age) && age <= staleMs
}

/** Studio 3D shows the program rig while takeover is on, or always on the 3D plate. */
export function studioShowsProgramRig(input: {
  control3dProgram: boolean
  programOutputOnly: boolean
}): boolean {
  return input.programOutputOnly === true || input.control3dProgram === true
}

/**
 * Until the operator aims the program rig (Control 3D program or Frame boats),
 * copy ops into it so OBS 3D is not stuck at the unused default over water.
 * After the first drive, Control-off freezes OBS at that last program pose.
 */
export function programCamShouldMirrorOps(input: {
  programOutputOnly: boolean
  control3dProgram: boolean
  programDriven: boolean
}): boolean {
  return (
    input.programOutputOnly !== true &&
    input.control3dProgram !== true &&
    input.programDriven !== true
  )
}
