/**
 * Electron studio preload bridge (path A). Absent in Chrome — NDI pump no-ops.
 */

import type { StudioRacesBridge } from '../projects/racesBridge.ts'

/** NDI output channels (multi-sender bridge). Default air plate = `'ar'`. */
export type NdiChannelId = 'ar' | '3d' | '2d'

export const NDI_CHANNEL_IDS: readonly NdiChannelId[] = ['ar', '3d', '2d']

export const DEFAULT_NDI_CHANNEL: NdiChannelId = 'ar'

export type StudioNdiStatus = {
  channel?: NdiChannelId
  active: boolean
  sourceName: string | null
  sdkVersion: string | null
  error: string | null
}

export type StudioNdiStatusAll = Record<NdiChannelId, StudioNdiStatus>

export type StudioNdiStartResult = {
  ok: boolean
  channel?: NdiChannelId
  sourceName?: string
  sdkVersion?: string
  error?: string
}

export type StudioNdiFrame = {
  /** Omit → `'ar'` (back-compat). */
  channel?: NdiChannelId
  width: number
  height: number
  /** RGBA8888, WebGL bottom-up (readPixels order). */
  data: ArrayBuffer
  bottomUp?: boolean
}

export type StudioNdiBridge = {
  start: (opts?: {
    channel?: NdiChannelId
    name?: string
  }) => Promise<StudioNdiStartResult>
  /**
   * Stop one channel or all.
   * Omit → `'ar'`; `'all'` / `{ channel: 'all' }` → every sender.
   */
  stop: (
    channelOrOpts?: NdiChannelId | 'all' | { channel?: NdiChannelId | 'all' },
  ) => Promise<void>
  /**
   * Push one RGBA frame (top-down or bottom-up — main flips as needed).
   * `data` is transferred when possible; do not reuse after send.
   */
  sendFrame: (frame: StudioNdiFrame) => void
  /** Omit channel → `'ar'` status (back-compat). Pass `'all'` for the map. */
  getStatus: (
    channel?: NdiChannelId | 'all',
  ) => Promise<StudioNdiStatus | StudioNdiStatusAll>
  getStatusAll: () => Promise<StudioNdiStatusAll>
}

export type StudioConfigKind = 'public' | 'userData'

export type StudioConfigSetTokenResult =
  | { ok: true; path: string; kind?: StudioConfigKind }
  | { ok: false; error: string }

export type StudioConfigBridge = {
  setCesiumIonToken: (token: string) => Promise<StudioConfigSetTokenResult>
}

export type BroadcastStudioBridge = {
  isStudio: true
  ndi: StudioNdiBridge
  /** Local RaceProject folder writes (Phase 13.8). Optional for typing; Electron preload provides it. */
  races?: StudioRacesBridge
  /**
   * Patch `config.json` (Phase 14 ion token). Dev → repo `public/config.json`
   * (commit to share). `--file` → userData (not git).
   */
  config?: StudioConfigBridge
  /**
   * Main-process ~30 fps clock (not throttled when minimized).
   * NDI pumps subscribe here. Ops WebGL preview uses rAF when visible
   * (`startDualFrameClock`); this tick is the hidden/minimize fallback.
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
