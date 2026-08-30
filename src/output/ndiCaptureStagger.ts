/**
 * Gate NDI **FBO renders** so two **blocking** (sync `readPixels`) captures
 * never share a studio tick (DSP-OUT-20260828-04, narrowed by
 * DSP-OUT-20260829-04).
 *
 * On the PBO path (`blocking: false`) this module is a no-op: AR and 3D may
 * both render in the same tick. Pumps must not call this helper unless
 * `readback.mode === 'sync'`.
 *
 * 2D stream-map is canvas CPU (deferred/async grab), not an FBO, and does not
 * occupy this slot (DSP-OUT-20260828-07).
 */

export type NdiHeavyCaptureChannel = 'ar' | '3d' | '2d'

export type NdiHeavyCaptureClaimOptions = {
  /**
   * True when this capture will stall the main thread (sync `readPixels`).
   * False for pipelined PBO packs — no exclusivity. Omitted = blocking
   * (conservative).
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
 * this tick.
 *
 * Sync / `blocking: true`: returns false when another FBO already won this
 * stagger window. PBO / `blocking: false`: always true (no arbitration).
 * 2D always succeeds and does not occupy the slot.
 */
export function tryClaimNdiHeavyCapture(
  channel: NdiHeavyCaptureChannel,
  nowMs: number = performance.now(),
  options?: NdiHeavyCaptureClaimOptions,
): boolean {
  if (!isFboChannel(channel)) {
    return true
  }
  if (options?.blocking === false) {
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

/**
 * Undo a claim when `readback.begin` fails after the 1080p pass was skipped
 * or aborted. Only releases if this channel still owns the current window.
 */
export function releaseNdiHeavyCapture(
  channel: NdiHeavyCaptureChannel,
  nowMs: number = performance.now(),
): void {
  if (!isFboChannel(channel)) return
  if (lastFboChannel !== channel) return
  if (nowMs - lastFboMs >= NDI_HEAVY_STAGGER_MS) return
  lastFboChannel = null
  lastFboMs = 0
}

/** Test / dispose helper — clears stagger state. */
export function resetNdiHeavyCaptureStagger(): void {
  lastFboChannel = null
  lastFboMs = 0
  preferNext = null
}
