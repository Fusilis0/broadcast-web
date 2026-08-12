/** Active A→B segment metrics for the editor HUD (ENU East/North meters). */

export type SegmentReadout = {
  /** Compass bearing degrees: 0 = North, 90 = East, clockwise, [0, 360). */
  bearingDeg: number
  /** Horizontal length in meters. */
  lengthM: number
}

/**
 * Bearing from A→B on the ENU water plane.
 * 0° = +North, 90° = +East (clockwise), matching map "N↑".
 */
export function segmentBearingDeg(
  eastA: number,
  northA: number,
  eastB: number,
  northB: number,
): number {
  const dE = eastB - eastA
  const dN = northB - northA
  if (dE === 0 && dN === 0) return 0
  const rad = Math.atan2(dE, dN)
  const deg = (rad * 180) / Math.PI
  return ((deg % 360) + 360) % 360
}

/** Horizontal length A→B in meters. */
export function segmentLengthM(
  eastA: number,
  northA: number,
  eastB: number,
  northB: number,
): number {
  return Math.hypot(eastB - eastA, northB - northA)
}

export function segmentReadout(
  eastA: number,
  northA: number,
  eastB: number,
  northB: number,
): SegmentReadout {
  return {
    bearingDeg: segmentBearingDeg(eastA, northA, eastB, northB),
    lengthM: segmentLengthM(eastA, northA, eastB, northB),
  }
}

/** Compact HUD line, e.g. `brg 042° · 18.4 m`. */
export function formatSegmentReadout(r: SegmentReadout): string {
  const brg = Math.round(r.bearingDeg).toString().padStart(3, '0')
  const len =
    r.lengthM >= 100 ? r.lengthM.toFixed(0) : r.lengthM.toFixed(1)
  return `brg ${brg}° · ${len} m`
}
