/**
 * Gate NDI **FBO renders** so AR and 3D never draw two 1080p scene passes
 * on the same studio tick (DSP-OUT-20260828-04).
 *
 * PBO made *readback* async (`blocking: false`); that must not skip this
 * gate — the hitch is the render, not the pack. `poll()` / drain of an
 * in-flight PBO may still complete on a tick the channel does not render.
 *
 * Studio tick is 60 Hz so AR and 3D can each Send ~30 by alternating ticks.
 * Preview stays rAF (not this clock).
 *
 * 2D stream-map is canvas CPU (deferred/async grab), not an FBO, and does not
 * occupy this slot (DSP-OUT-20260828-07).
 */

export type NdiHeavyCaptureChannel = 'ar' | '3d' | '2d'

export type NdiHeavyCaptureClaimOptions = {
  /**
   * True when this capture will stall the main thread (sync `readPixels` /
   * canvas `getImageData`). False for pipelined PBO packs. Omitted = blocking
   * (conservative). **FBO channels ignore this for exclusivity** — one render
   * per stagger window either way (DSP-OUT-20260828-04).
   */
  blocking?: boolean
}

/** Same-tick window — under ~60 fps ticks (~16 ms), keep well below half. */
export const NDI_HEAVY_STAGGER_MS = 8

let lastFboChannel: NdiHeavyCaptureChannel | null = null
let lastFboMs = 0
/** When set, the other FBO channel should yield so this one can capture. */
let preferNext: 'ar' | '3d' | null = null

function isFboChannel(
  channel: NdiHeavyCaptureChannel,
): channel is 'ar' | '3d' {
  return channel === 'ar' || channel === '3d'
}

/**
 * Claim an FBO render slot. A true return means this channel **will render**
 * this tick. Returns false when another FBO channel already won this stagger
 * window, including PBO / `blocking: false`. 2D always succeeds and does not
 * occupy the slot. Async readback drain is not a claim.
 */
export function tryClaimNdiHeavyCapture(
  channel: NdiHeavyCaptureChannel,
  nowMs: number = performance.now(),
  options?: NdiHeavyCaptureClaimOptions,
): boolean {
  void options
  if (!isFboChannel(channel)) {
    return true
  }

  const otherFboSameTick =
    lastFboChannel !== null &&
    lastFboChannel !== channel &&
    nowMs - lastFboMs < NDI_HEAVY_STAGGER_MS

  if (otherFboSameTick) {
    if (channel === '3d') preferNext = '3d'
    return false
  }

  if (preferNext !== null && preferNext !== channel) {
    return false
  }

  if (preferNext === channel) preferNext = null
  lastFboChannel = channel
  lastFboMs = nowMs
  return true
}

/** Test / dispose helper — clears stagger state. */
export function resetNdiHeavyCaptureStagger(): void {
  lastFboChannel = null
  lastFboMs = 0
  preferNext = null
}
