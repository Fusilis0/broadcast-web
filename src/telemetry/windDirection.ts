import {
  DEFAULT_WIND_DIRECTION_FROM_DEG,
  DEFAULT_WIND_SPEED_KT,
  KT_TO_MS,
  type WindFrame,
  type WindTravelXZ,
} from './windTypes.ts'

/** Wrap meteorological from-bearing into [0, 360). Non-finite → 0. */
export function normalizeDirectionFromDeg(directionFromDeg: number): number {
  if (!Number.isFinite(directionFromDeg)) return 0
  const m = directionFromDeg % 360
  return m < 0 ? m + 360 : m
}

export function knotsToMs(kt: number): number {
  if (!Number.isFinite(kt) || kt < 0) return 0
  return kt * KT_TO_MS
}

export function msToKnots(speedMs: number): number {
  if (!Number.isFinite(speedMs) || speedMs < 0) return 0
  return speedMs / KT_TO_MS
}

export function createDefaultWindFrame(nowMs = Date.now()): WindFrame {
  return {
    directionFromDeg: DEFAULT_WIND_DIRECTION_FROM_DEG,
    speedMs: knotsToMs(DEFAULT_WIND_SPEED_KT),
    source: 'default',
    updatedAtMs: nowMs,
  }
}

/**
 * Meteorological **from** degrees (true north, clockwise) → unit travel vector
 * in scene XZ.
 *
 * From→to: air travels 180° from `directionFromDeg` (Open-Meteo / sailing
 * “from” vs renderer “to”).
 *
 * Post-14.0 axes: `x = East`, `y = Up`, `z = −North`. Geographic north is −Z,
 * so from-north (`directionFromDeg = 0`) travels south → **+Z**.
 *
 * Cardinals:
 * - `0` from N → travel +Z (south)
 * - `90` from E → travel −X (west)
 * - `180` from S → travel −Z (north)
 * - `270` from W → travel +X (east)
 *
 * Implementation: travel east = −sin(from), scene z = cos(from) (= −travelNorth).
 */
export function windTravelSceneXZ(directionFromDeg: number): WindTravelXZ {
  const fromRad = (normalizeDirectionFromDeg(directionFromDeg) * Math.PI) / 180
  return {
    x: -Math.sin(fromRad),
    z: Math.cos(fromRad),
  }
}

function parseFiniteNumber(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse Ops speed (knots) + from-deg. Empty / invalid → `fallback` (last or
 * default). Does not throw.
 */
export function parseOperatorWindInput(
  input: { directionFromDegText: string; speedKtText: string },
  fallback: WindFrame,
  nowMs = Date.now(),
): WindFrame {
  const from = parseFiniteNumber(input.directionFromDegText)
  const kt = parseFiniteNumber(input.speedKtText)
  if (from === null || kt === null || kt < 0) return fallback
  return {
    directionFromDeg: normalizeDirectionFromDeg(from),
    speedMs: knotsToMs(kt),
    source: 'operator',
    updatedAtMs: nowMs,
  }
}

const STALE_AFTER_MS = 10 * 60 * 1000

/** Visible source + age (or `default` / `stale`) for the Ops hint. */
export function formatWindSourceAge(frame: WindFrame, nowMs = Date.now()): string {
  if (frame.source === 'default') return 'default'
  const ageMs = Math.max(0, nowMs - frame.updatedAtMs)
  if (ageMs >= STALE_AFTER_MS) return `${frame.source} · stale`
  if (ageMs < 1000) return `${frame.source} · ${Math.round(ageMs)}ms`
  return `${frame.source} · ${(ageMs / 1000).toFixed(0)}s`
}
