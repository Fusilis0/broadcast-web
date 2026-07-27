/** Injected GEO convert — keep ECEF out of scene (same as course/sponsors). */
export type GpsToEnuAmslFn = (
  lat: number,
  lon: number,
  altAmsl: number,
) => { x: number; y: number; z: number }

export type FlagGpsPoint = {
  lat: number
  lon: number
  /** AMSL meters; default 0. Pole baseline still forced to water Y = 0. */
  altMsl: number
}

/** Normalized countdown-flags fixture (Unity CountdownFlagController knobs). */
export type CountdownFlagsData = {
  name: string
  point1: FlagGpsPoint
  point2: FlagGpsPoint
  /** Total countdown duration (minutes). Default 6. */
  startMinutes: number
  whiteRaiseMinutes: number
  orangeRaiseMinutes: number
  blueWhiteRaiseMinutes: number
  blueWhiteLowerMinutes: number
  point1FlagVerticalOffset: number
  point2FlagVerticalOffset: number
  /**
   * Extra height for blue-white above orange (meters).
   * Demo default 6 — readable; Unity inspector default is 35.
   */
  blueWhiteExtraOffsetM: number
  canvasVerticalOffset: number
  poleHeightM: number
  /** Auto-start after mount. Default true. */
  autoStart: boolean
  /**
   * Multiplier on wall-clock delta while ticking (demo speedup).
   * Default 20 so a 6-min sequence is observable in ~18 s.
   */
  demoTimeScale: number
}

/** ENU placement after GEO + water-Y force. */
export type CountdownFlagsLayout = {
  p1x: number
  p1z: number
  p2x: number
  p2z: number
  data: CountdownFlagsData
}

export type FlagPhaseState = {
  white: boolean
  orange: boolean
  blueWhite: boolean
}
