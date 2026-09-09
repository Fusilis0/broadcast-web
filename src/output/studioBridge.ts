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

export type NdiMainPerfChannel = {
  rgbaToBgra: { count: number; sumMs: number; maxMs: number; meanMs: number }
  video: { count: number; sumMs: number; maxMs: number; meanMs: number }
  dropBusy: number
}

export type NdiMainPerfSummary = {
  channels: Record<NdiChannelId, NdiMainPerfChannel>
}

export type StudioNdiStartResult = {
  ok: boolean
  channel?: NdiChannelId
  sourceName?: string
  sdkVersion?: string
  error?: string
}

export type NdiPixelFormat = 'rgba' | 'uyvy' | 'uyva'

export type StudioNdiFrame = {
  /** Omit → `'ar'` (back-compat). */
  channel?: NdiChannelId
  width: number
  height: number
  /**
   * Packed pixels. Default / omit = RGBA8888.
   * `uyvy` = 4:2:2 (2 bytes/px). `uyva` = UYVY + alpha plane (3 bytes/px).
   */
  data: ArrayBuffer
  bottomUp?: boolean
  pixelFormat?: NdiPixelFormat
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
   * Push one packed frame. Default `pixelFormat` is RGBA; pumps send
   * `uyvy` (AR/3D/2D). `uyva` remains valid on the wire but AR no longer
   * sends an alpha plane (in-app SRT + sim composite).
   * `data` is transferred when possible; do not reuse after send.
   */
  sendFrame: (frame: StudioNdiFrame) => void
  /** Omit channel → `'ar'` status (back-compat). Pass `'all'` for the map. */
  getStatus: (
    channel?: NdiChannelId | 'all',
  ) => Promise<StudioNdiStatus | StudioNdiStatusAll>
  getStatusAll: () => Promise<StudioNdiStatusAll>
  /** Last 1 s main-process stage window (does not reset). Optional. */
  getPerfSummary?: () => Promise<NdiMainPerfSummary>
  /** 1 Hz push of main-process rgbaToBgra / grandi.video / busy-drop counts. */
  onPerfSummary?: (cb: (summary: NdiMainPerfSummary) => void) => () => void
}

export type StudioConfigKind = 'public' | 'userData'

export type StudioConfigSetTokenResult =
  | { ok: true; path: string; kind?: StudioConfigKind }
  | { ok: false; error: string }

export type StudioConfigBridge = {
  setCesiumIonToken: (token: string) => Promise<StudioConfigSetTokenResult>
}

export type StudioCinematicTilesBridge = {
  packaged: () => Promise<boolean>
  has: (name: string) => Promise<boolean>
  read: (name: string) => Promise<ArrayBuffer | null>
  write: (payload: {
    name: string
    bytes: ArrayBuffer
    url?: string
  }) => Promise<{ ok: boolean; skipped?: boolean; error?: string }>
}

export type StudioCinematicRecordSaveResult =
  | { ok: true; path: string }
  | { ok: false; cancelled?: boolean; error?: string }

export type StudioCinematicRecordBridge = {
  choosePath: (opts: {
    defaultName: string
  }) => Promise<StudioCinematicRecordSaveResult>
  write: (opts: {
    path: string
    mime: string
    bytes: ArrayBuffer
  }) => Promise<StudioCinematicRecordSaveResult>
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
  /** Packaged `--file` ion tile cache (userData). Optional; Vite uses GET/POST. */
  cinematicTiles?: StudioCinematicTilesBridge
  /** Silent cinematic MP4 save dialog + disk write. Optional; Chrome has none. */
  cinematicRecord?: StudioCinematicRecordBridge
  /**
   * Main-process ~30 fps clock (not throttled when minimized).
   * NDI pumps subscribe here. Ops WebGL preview uses rAF when visible
   * (`startDualFrameClock`); this tick is the hidden/minimize fallback.
   * Returns an unsubscribe function.
   */
  onStudioTick: (cb: () => void) => () => void
  /** Debug-session only: renderer → main NDJSON (Electron sandbox blocks fetch). */
  debugLog?: (payload: unknown) => void
}

declare global {
  interface Window {
    broadcastStudio?: BroadcastStudioBridge
    broadcastStudioNdiFramePort?: MessagePort
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

/**
 * Push one packed NDI frame. Prefers a transferable MessagePort so the
 * renderer does not structured-clone 4–6 MB (contextBridge + ipcRenderer.send).
 */
export function sendStudioNdiFrame(
  ndi: Pick<StudioNdiBridge, 'sendFrame'>,
  frame: StudioNdiFrame,
): void {
  const port = window.broadcastStudioNdiFramePort
  const data = frame.data
  if (port && data instanceof ArrayBuffer && data.byteLength > 0) {
    try {
      port.postMessage(
        {
          channel: frame.channel,
          width: frame.width,
          height: frame.height,
          bottomUp: frame.bottomUp,
          pixelFormat: frame.pixelFormat,
          data,
        },
        [data],
      )
      return
    } catch {
      /* fall through to structured-clone send */
    }
  }
  ndi.sendFrame(frame)
}

/** Renderer debug ingest: IPC (works in studio) + HTTP (works in Chrome/tests). */
export function debugSessionLog(payload: {
  hypothesisId: string
  location: string
  message: string
  data?: Record<string, unknown>
  runId?: string
}): void {
  const body = {
    sessionId: '173fbb',
    runId: payload.runId ?? 'post-fix',
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  }
  try {
    getStudioBridge()?.debugLog?.(body)
  } catch {
    /* ignore */
  }
  fetch('http://127.0.0.1:7438/ingest/7196fb84-148e-4d0c-af68-4fcb53313232', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '173fbb',
    },
    body: JSON.stringify(body),
  }).catch(() => {})
}
