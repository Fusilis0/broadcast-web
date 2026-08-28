/**
 * Per-feature mark rounding sense (Phase 15.3 / 16.5).
 * Omit → CW ring. Explicit `'none'` hides. Unknown JSON → `'none'`.
 *
 * Yaw is around scene +Y. Viewed from above the water (look −Y, broadcast
 * convention: clock on the XZ plane), **CW is clockwise** and maps to
 * **negative** `Object3D.rotation.y` (right-handed; +yaw takes +X toward −Z).
 */
export type RoundingSense = 'cw' | 'ccw' | 'none'

export const ROUNDING_SENSES: readonly RoundingSense[] = ['cw', 'ccw', 'none']

/** Seconds per full revolution of the water-level arrow ring. */
export const ROUNDING_REVOLUTION_SEC = 5

const FEATURE_TYPES_WITH_ROUNDING = new Set([
  'mark',
  'buoy',
  'gateLeft',
  'gateRight',
])

export function isRoundingFeatureType(type: string): boolean {
  return FEATURE_TYPES_WITH_ROUNDING.has(type)
}

/**
 * Parse additive `rounding` from JSON.
 * Missing → `undefined` (effective CW). Unknown / non-string → `none`.
 */
export function parseRounding(raw: unknown): RoundingSense | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'string') return 'none'
  const s = raw.trim().toLowerCase()
  if (s === 'cw' || s === 'ccw' || s === 'none') return s
  return 'none'
}

/** Effective sense for drawing: omit → `cw`; explicit `'none'` / junk → hide. */
export function effectiveRounding(
  raw: RoundingSense | null | undefined,
): RoundingSense {
  if (raw === undefined || raw === null) return 'cw'
  if (raw === 'cw' || raw === 'ccw') return raw
  return 'none'
}

/**
 * Inspector → stored field. Choosing CW on an omitted field stays omitted
 * (universal default). `ccw` / `none` always persist. Explicit `'cw'` stays.
 */
export function persistRoundingSelection(
  selected: RoundingSense,
  stored: RoundingSense | undefined,
): RoundingSense | undefined {
  if (selected === 'cw' && stored === undefined) return undefined
  return selected
}

/**
 * Yaw around +Y (radians) at `timeSec`.
 * CW from above → negative yaw; CCW → positive yaw; `none` → 0.
 */
export function roundingYawRad(
  sense: RoundingSense,
  timeSec: number,
  revolutionSec = ROUNDING_REVOLUTION_SEC,
): number {
  if (sense !== 'cw' && sense !== 'ccw') return 0
  const period = revolutionSec > 0 ? revolutionSec : ROUNDING_REVOLUTION_SEC
  const turns = timeSec / period
  return (sense === 'cw' ? -turns : turns) * Math.PI * 2
}
