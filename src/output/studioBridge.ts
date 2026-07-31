/**
 * Electron studio preload bridge (path A). Absent in Chrome — NDI pump no-ops.
 */

export type StudioNdiStatus = {
  active: boolean
  sourceName: string | null
  sdkVersion: string | null
  error: string | null
}

export type StudioNdiBridge = {
  start: (opts?: { name?: string }) => Promise<{
    ok: boolean
    sourceName?: string
    sdkVersion?: string
    error?: string
  }>
  stop: () => Promise<void>
  /**
   * Push one RGBA frame (top-down or bottom-up — main flips as needed).
   * `data` is transferred when possible; do not reuse after send.
   */
  sendFrame: (frame: {
    width: number
    height: number
    /** RGBA8888, WebGL bottom-up (readPixels order). */
    data: ArrayBuffer
    bottomUp?: boolean
  }) => void
  getStatus: () => Promise<StudioNdiStatus>
}

export type BroadcastStudioBridge = {
  isStudio: true
  ndi: StudioNdiBridge
  /**
   * Main-process ~30 fps clock (not throttled when minimized).
   * Returns an unsubscribe function.
   */
  onStudioTick: (cb: () => void) => () => void
}

declare global {
  interface Window {
    broadcastStudio?: BroadcastStudioBridge
  }
}

/** True when running inside the Electron studio shell with preload bridge. */
export function getStudioBridge(): BroadcastStudioBridge | null {
  const bridge = window.broadcastStudio
  if (
    bridge?.isStudio === true &&
    bridge.ndi &&
    typeof bridge.onStudioTick === 'function'
  ) {
    return bridge
  }
  return null
}
