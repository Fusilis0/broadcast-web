/**
 * L8 — `arBackground: 'video'` forces ocean / sky / Cesium off on the AR plate
 * (`opaqueClearSafe = false`), same as transparent. Operator does not also
 * pick transparent. 3D NDI still mounts env during its opaque pass.
 *
 * Pure helper for `main.ts` `applyLocalChannelFocus` + AR NDI plate clear.
 * Does not touch environment modules.
 */

import { normalizeArBackground } from './applyOutputMode.ts'
import { normalizeLocalChannelFocus } from './localChannelSwitcher.ts'

/**
 * When true, SCN must unmount realistic env for this pass.
 * - Local AR + video → off (preview must show the underlay).
 * - AR NDI plate + video → off (`localFocus` omitted).
 * - Local 3D stays on so the 3D window still has sea/sky.
 */
export function videoForcesEnvironmentOff(
  arBackground: unknown,
  localFocus?: unknown,
): boolean {
  if (normalizeArBackground(arBackground) !== 'video') return false
  if (localFocus === undefined) return true
  return normalizeLocalChannelFocus(localFocus) === 'ar'
}

/**
 * Combine the existing clear-derived `opaqueClearSafe` with L8.
 * Video + AR (or AR plate) always returns `false`.
 */
export function resolveOpaqueClearSafeForVideo(input: {
  arBackground: unknown
  /** Omit for AR NDI plate (always apply L8 when video). */
  localFocus?: unknown
  opaqueClearSafe: boolean
}): boolean {
  if (videoForcesEnvironmentOff(input.arBackground, input.localFocus)) {
    return false
  }
  return input.opaqueClearSafe
}
