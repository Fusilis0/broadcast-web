/**
 * Shared AR/3D PBO pressure signal for 2D NDI scheduling (SRT round 5).
 *
 * When an FBO channel cannot `readback.canBegin()` (both PBO slots in flight),
 * 2D must not start `createImageBitmap` / ensureDrawn on the same GPU/main
 * window — live postfix showed AR `busy` skips (~6.5/s) tracking long `2dGrab`
 * walls and cutting unique Send below 30.
 *
 * 2D does not claim the heavy-capture stagger slot; this is a soft yield only.
 */

const canBeginProbes = new Set<() => boolean>()

/** Register an FBO pump's `() => readback.canBegin()`. Returns unregister. */
export function registerNdiFboCanBeginProbe(probe: () => boolean): () => void {
  canBeginProbes.add(probe)
  return () => {
    canBeginProbes.delete(probe)
  }
}

export function hasNdiFboCanBeginProbes(): boolean {
  return canBeginProbes.size > 0
}

/** True when any registered FBO readback cannot accept a new pack. */
export function isNdiFboReadbackPressured(): boolean {
  for (const probe of canBeginProbes) {
    try {
      if (!probe()) return true
    } catch {
      /* ignore broken probe */
    }
  }
  return false
}

/** Test helper. */
export function resetNdiFboReadbackPressure(): void {
  canBeginProbes.clear()
}
