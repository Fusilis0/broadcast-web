import type { OutputMode } from './types.ts'

/**
 * Product contract: NDI / transparent studio plate = **active POV** only.
 * Ops free cam (SCN) may drive the on-screen preview; air must not follow it.
 *
 * @see docs/agentic/dispatches/active/DSP-OUT-20260803-01-ndi-active-cam-lock.md
 */

export type AirCameraLockInput = {
  /** Normalized OUT clear mode. */
  outputMode: OutputMode
  /** True when Electron preload injected `window.broadcastStudio`. */
  studioBridgePresent: boolean
}

/**
 * Studio / transparent sessions lock air framing to the active POV.
 * Preferred path: SCN free cam uses a separate preview camera; NDI
 * dual-renders active POV (`startNdiFramePump` + `getAirCamera`).
 */
export function isAirCameraLocked(input: AirCameraLockInput): boolean {
  return input.studioBridgePresent || input.outputMode === 'transparent'
}

/**
 * Legacy Option B helper: true when air is locked.
 * With dual-render wired, SCN need not force-follow — free cam may stay on
 * while NDI captures `getActivePovCamera()`. Kept for callers that want a
 * simple “air session” flag.
 */
export function shouldForceFollowActivePov(
  input: AirCameraLockInput,
): boolean {
  return isAirCameraLocked(input)
}

export type NdiCapturePlan =
  | { mode: 'framebuffer' }
  | { mode: 'air-target' }

/**
 * When the screen render camera differs from the air (active POV) camera,
 * NDI must capture from a dedicated air render target, not the screen FB.
 */
export function planNdiCapture(options: {
  renderCamera: object
  airCamera: object | null | undefined
}): NdiCapturePlan {
  const air = options.airCamera
  if (air != null && air !== options.renderCamera) {
    return { mode: 'air-target' }
  }
  return { mode: 'framebuffer' }
}
