/** Wind ingest DTOs — operator + Open-Meteo API; sensor publishes onto the same bus later. */

export type WindSource = 'operator' | 'api' | 'sensor' | 'default'

/**
 * Sticky wind frame. Direction is meteorological **from** (true north, clockwise).
 * Never a bare `direction` — that name hid a 180° from/to bug.
 * Marine fields are additive (14.3b); subscribers may ignore them.
 */
export type WindFrame = {
  /** Compass from-bearing, degrees clockwise from true north, range [0, 360). */
  directionFromDeg: number
  /** Speed in m/s, ≥ 0. Convert knots at the UI / ingest edge only. */
  speedMs: number
  gustMs?: number
  /** Significant wave height (m), Open-Meteo marine — optional. */
  waveHeightM?: number
  /** Wave direction FROM, true north, clockwise — optional. */
  waveDirectionFromDeg?: number
  /** Wave period (s), Open-Meteo marine — optional. */
  wavePeriodS?: number
  source: WindSource
  updatedAtMs: number
}

/** Scene XZ travel (unit). Post-14.0: `x=East`, `z=−North`. */
export type WindTravelXZ = { x: number; z: number }

/** `kt * 0.514444 ≈ m/s` — one conversion site. */
export const KT_TO_MS = 0.514444

/** Venue fallback when nothing is set — 6 kt from 000° (true north). */
export const DEFAULT_WIND_SPEED_KT = 6
export const DEFAULT_WIND_DIRECTION_FROM_DEG = 0
