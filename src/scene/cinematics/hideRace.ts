/**
 * Race chrome (boats, course, sponsors, flags, 2D map, HUD overlay, credits,
 * calibration) is off while a cinematic is active. Restore when stopped.
 */
export function raceChromeVisible(cinematicActive: boolean): boolean {
  return cinematicActive !== true
}

export type HideRaceFlags = {
  boats: boolean
  course: boolean
  sponsors: boolean
  flags: boolean
  map: boolean
  hud: boolean
  credits: boolean
  calibration: boolean
}

export function hideRaceFlags(cinematicActive: boolean): HideRaceFlags {
  const on = raceChromeVisible(cinematicActive)
  return {
    boats: on,
    course: on,
    sponsors: on,
    flags: on,
    map: on,
    hud: on,
    credits: on,
    calibration: on,
  }
}
