import type { CountdownFlagsData, FlagGpsPoint } from './types.ts'

export const DEFAULT_START_MINUTES = 6
export const DEFAULT_WHITE_RAISE_MINUTES = 5
export const DEFAULT_ORANGE_RAISE_MINUTES = 6
export const DEFAULT_BLUE_WHITE_RAISE_MINUTES = 4
export const DEFAULT_BLUE_WHITE_LOWER_MINUTES = 1
/** Readable demo; Unity inspector default is 35 m. */
export const DEFAULT_BLUE_WHITE_EXTRA_OFFSET_M = 6
export const DEFAULT_CANVAS_VERTICAL_OFFSET_M = 12
export const DEFAULT_POLE_HEIGHT_M = 10
/** 20× so a 6-min sequence completes in ~18 s under `npm run dev`. */
export const DEFAULT_DEMO_TIME_SCALE = 20

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseGpsPoint(raw: unknown): FlagGpsPoint | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isFiniteNumber(o.lat) || !isFiniteNumber(o.lon)) return null
  return {
    lat: o.lat,
    lon: o.lon,
    altMsl: isFiniteNumber(o.altMsl) ? o.altMsl : 0,
  }
}

function positiveOr(
  value: unknown,
  fallback: number,
  min = 0,
): number {
  if (!isFiniteNumber(value)) return fallback
  return Math.max(value, min)
}

/**
 * Normalize countdown-flags JSON. Missing/invalid points → null (caller skips load).
 */
export function normalizeCountdownFlags(
  raw: unknown,
): CountdownFlagsData | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const point1 = parseGpsPoint(o.point1)
  const point2 = parseGpsPoint(o.point2)
  if (!point1 || !point2) return null

  return {
    name: typeof o.name === 'string' ? o.name.trim() : '',
    point1,
    point2,
    startMinutes: positiveOr(o.startMinutes, DEFAULT_START_MINUTES, 0.01),
    whiteRaiseMinutes: positiveOr(
      o.whiteRaiseMinutes,
      DEFAULT_WHITE_RAISE_MINUTES,
    ),
    orangeRaiseMinutes: positiveOr(
      o.orangeRaiseMinutes,
      DEFAULT_ORANGE_RAISE_MINUTES,
    ),
    blueWhiteRaiseMinutes: positiveOr(
      o.blueWhiteRaiseMinutes,
      DEFAULT_BLUE_WHITE_RAISE_MINUTES,
    ),
    blueWhiteLowerMinutes: positiveOr(
      o.blueWhiteLowerMinutes,
      DEFAULT_BLUE_WHITE_LOWER_MINUTES,
    ),
    point1FlagVerticalOffset: isFiniteNumber(o.point1FlagVerticalOffset)
      ? o.point1FlagVerticalOffset
      : 0,
    point2FlagVerticalOffset: isFiniteNumber(o.point2FlagVerticalOffset)
      ? o.point2FlagVerticalOffset
      : 0,
    blueWhiteExtraOffsetM: positiveOr(
      o.blueWhiteExtraOffsetM,
      DEFAULT_BLUE_WHITE_EXTRA_OFFSET_M,
    ),
    canvasVerticalOffset: positiveOr(
      o.canvasVerticalOffset,
      DEFAULT_CANVAS_VERTICAL_OFFSET_M,
    ),
    poleHeightM: positiveOr(o.poleHeightM, DEFAULT_POLE_HEIGHT_M, 1),
    autoStart: o.autoStart === false ? false : true,
    demoTimeScale: positiveOr(o.demoTimeScale, DEFAULT_DEMO_TIME_SCALE, 0.01),
  }
}
