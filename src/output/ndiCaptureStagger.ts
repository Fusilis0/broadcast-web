/**
 * Stagger heavy GPU/CPU NDI readbacks so AR + 3D never both stall the
 * renderer main thread on the same studio tick (DSP-OUT-20260812-06).
 *
 * Studio clock ~30 fps drives scene render (AR pump) and the 3D pump.
 * When both channels are due, AR claims first; 3D defers and AR yields
 * the next tick so 3D can catch up — AR stays ~27 fps, 3D hits its cap.
 */

export type NdiHeavyCaptureChannel = 'ar' | '3d'

/** Same-tick window — under ~30 fps ticks (~33 ms), keep well below half. */
export const NDI_HEAVY_STAGGER_MS = 8

let lastClaimChannel: NdiHeavyCaptureChannel | null = null
let lastClaimMs = 0
/** When set, the other channel should yield so this one can capture. */
let preferNext: NdiHeavyCaptureChannel | null = null

/**
 * Claim a heavy sync readback slot. Returns false → skip capture this tick.
 */
export function tryClaimNdiHeavyCapture(
  channel: NdiHeavyCaptureChannel,
  nowMs: number = performance.now(),
): boolean {
  const otherClaimedSameTick =
    lastClaimChannel !== null &&
    lastClaimChannel !== channel &&
    nowMs - lastClaimMs < NDI_HEAVY_STAGGER_MS

  if (otherClaimedSameTick) {
    if (channel === '3d') preferNext = '3d'
    return false
  }

  if (preferNext !== null && preferNext !== channel) {
    return false
  }

  if (preferNext === channel) preferNext = null
  lastClaimChannel = channel
  lastClaimMs = nowMs
  return true
}

/** Test / dispose helper — clears stagger state. */
export function resetNdiHeavyCaptureStagger(): void {
  lastClaimChannel = null
  lastClaimMs = 0
  preferNext = null
}
