/**
 * Electron studio SRT *publish* bridge (Phase 22).
 * Absent in Chrome — getSrtOutBridge() returns null.
 *
 * Separate from ingest `getSrtBridge()` / `srt:open`. Do not pack NDI frames.
 */

export const SRT_OUT_CHANNEL_IDS = ['ar', '3d', '2d'] as const
export type SrtOutChannelId = (typeof SRT_OUT_CHANNEL_IDS)[number]

export const SRT_OUT_TITLES: Record<SrtOutChannelId, string> = {
  ar: 'broadcast-web-srt-ar',
  '3d': 'broadcast-web-srt-3d',
  '2d': 'broadcast-web-srt-2d',
}

/** ffmpeg `latency` is microseconds (60 ms → 60000). */
export const SRT_OUT_DEFAULT_URLS: Record<SrtOutChannelId, string> = {
  ar: 'srt://127.0.0.1:9201?mode=caller&latency=60000',
  '3d': 'srt://127.0.0.1:9202?mode=caller&latency=60000',
  '2d': 'srt://127.0.0.1:9203?mode=caller&latency=60000',
}

export type SrtOutState = 'idle' | 'connecting' | 'live' | 'error'

export type SrtOutEncoder = 'h264_amf' | 'h264_nvenc' | 'libx264'

export type SrtOutStatus = {
  channel: SrtOutChannelId
  state: SrtOutState
  encoder: SrtOutEncoder | null
  encoderFps: number | null
  url: string
  lastError: string | null
  fallbackNote: string | null
}

export type SrtOutStartRequest = {
  channel: SrtOutChannelId
  url?: string
}

export type SrtOutStopRequest =
  | SrtOutChannelId
  | 'all'
  | { channel?: SrtOutChannelId | 'all' }

export type SrtOutStartResult =
  | { ok: true; channel: SrtOutChannelId }
  | { ok: false; error: string }

export type SrtOutBridge = {
  start: (opts: SrtOutStartRequest) => Promise<SrtOutStartResult>
  stop: (opts?: SrtOutStopRequest) => Promise<{ ok: boolean; error?: string }>
  getStatus: () => Promise<Record<SrtOutChannelId, SrtOutStatus>>
  onStatus: (cb: (status: SrtOutStatus) => void) => () => void
  /** 3D program-rig pose only — ops free-cam `previewView` is retired. */
  sendProgramView?: (view: unknown) => void
  onProgramView?: (cb: (view: unknown) => void) => () => void
  /** 2D program-cam viewport (studio local 2D = OBS 2D). */
  sendMap2dView?: (view: unknown) => void
  onMap2dView?: (cb: (view: unknown) => void) => () => void
  sendWorldLook?: (look: SrtWorldLook) => void
  onWorldLook?: (cb: (look: unknown) => void) => () => void
  sendLayerPreset?: (packet: unknown) => void
  onLayerPreset?: (cb: (packet: unknown) => void) => () => void
  /** Active POV so the AR plate decodes the same ingest as studio. */
  sendArPov?: (povId: string) => void
  onArPov?: (cb: (povId: unknown) => void) => () => void
}

/** Studio 3D look mirrored onto the SRT **3D** plate only (not AR). */
export type SrtWorldLook = {
  environmentMode: 'simple' | 'realistic'
  seaQuality: 'high' | 'low'
  terrainEnabled: boolean
  buildingsEnabled: boolean
  heroesEnabled: boolean
  terrainOverlay: 'road' | 'aerial'
  terrainTilesLocked: boolean
  terrainAltitudeNudgeM: number
  terrainWaterDiscardYM: number
  seaHeightYM: number
}

export function isSrtWorldLook(raw: unknown): raw is SrtWorldLook {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return (
    (o.environmentMode === 'simple' || o.environmentMode === 'realistic') &&
    (o.seaQuality === 'high' || o.seaQuality === 'low') &&
    typeof o.terrainEnabled === 'boolean' &&
    typeof o.buildingsEnabled === 'boolean' &&
    typeof o.heroesEnabled === 'boolean' &&
    (o.terrainOverlay === 'road' || o.terrainOverlay === 'aerial') &&
    typeof o.terrainTilesLocked === 'boolean' &&
    Number.isFinite(Number(o.terrainAltitudeNudgeM)) &&
    Number.isFinite(Number(o.terrainWaterDiscardYM)) &&
    Number.isFinite(Number(o.seaHeightYM))
  )
}

export function isSrtOutChannelId(raw: unknown): raw is SrtOutChannelId {
  return raw === 'ar' || raw === '3d' || raw === '2d'
}

/** 3D plate only — AR must not copy terrain / sea / buildings / heroes. */
export function srtPlateAcceptsWorldLook(
  channel: SrtOutChannelId | null | undefined,
): boolean {
  return channel === '3d'
}

/** `?srtPlate=ar|3d|2d` → chrome-free program surface (gdigrab HWND). */
export function parseSrtPlateQuery(search: string): SrtOutChannelId | null {
  const raw = search.startsWith('?') ? search.slice(1) : search
  let value = ''
  try {
    value = new URLSearchParams(raw).get('srtPlate') ?? ''
  } catch {
    return null
  }
  return isSrtOutChannelId(value) ? value : null
}

function isSrtOutBridge(value: unknown): value is SrtOutBridge {
  if (!value || typeof value !== 'object') return false
  const s = value as SrtOutBridge
  return (
    typeof s.start === 'function' &&
    typeof s.stop === 'function' &&
    typeof s.getStatus === 'function' &&
    typeof s.onStatus === 'function'
  )
}

function readStudio(): { isStudio?: boolean; srtOut?: unknown } | null {
  try {
    const g = globalThis as { window?: { broadcastStudio?: unknown } }
    const studio = g.window?.broadcastStudio
    if (!studio || typeof studio !== 'object') return null
    return studio as { isStudio?: boolean; srtOut?: unknown }
  } catch {
    return null
  }
}

/**
 * True when running inside the Electron studio shell with SRT publish IPC.
 * Plain browser → null (do not throw).
 */
export function getSrtOutBridge(): SrtOutBridge | null {
  const studio = readStudio()
  if (studio?.isStudio === true && isSrtOutBridge(studio.srtOut)) {
    return studio.srtOut
  }
  return null
}
