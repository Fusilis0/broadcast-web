/**
 * Electron studio SRT ingest bridge (Phase 17.1).
 * Absent in Chrome — getSrtBridge() returns null and callers no-op.
 *
 * Main process is a dumb MPEG-TS byte pipe. This module is types + detection
 * + URL/status helpers. No demux, no decode.
 */

export type SrtState = 'idle' | 'connecting' | 'live' | 'error'

export const SRT_STATES: readonly SrtState[] = [
  'idle',
  'connecting',
  'live',
  'error',
]

export type SrtStatus = {
  povId: string
  state: SrtState
  bitrateKbps: number
  lastError: string | null
  /** Main-process TS chunk drops when the IPC queue is full (not libsrt loss). */
  ipcDropCount?: number
  ipcDropPerSec?: number
  ffmpegDropFrames?: string | null
  ffmpegDupFrames?: string | null
}

export type SrtOpenRequest = {
  povId: string
  url: string
  streamId?: string
  latencyMs?: number
  passphrase?: string
  /**
   * Electron HEVC fallback: ffmpeg decodes HEVC and remuxes H.264.
   * WebCodecs HEVC is often unavailable; OBS uses this same ffmpeg decoder.
   */
  transcodeToH264?: boolean
}

export type SrtCloseRequest = { povId: string } | 'all'

export type SrtOpenResult =
  | { ok: true; povId: string }
  | { ok: false; error: string }

export type SrtDataPayload = {
  povId: string
  chunk: Uint8Array
}

export type SrtBridge = {
  open: (opts: SrtOpenRequest) => Promise<SrtOpenResult>
  /**
   * `{ povId }` → that session; `'all'` / `{ povId: 'all' }` → every session.
   */
  close: (opts?: SrtCloseRequest) => Promise<void>
  getStatus: () => Promise<Record<string, SrtStatus>>
  onSrtData: (cb: (payload: SrtDataPayload) => void) => () => void
  onSrtStatus: (cb: (status: SrtStatus) => void) => () => void
}

export type SrtUrlOk = { ok: true; href: string }
export type SrtUrlErr = { ok: false; error: string }

/**
 * Serialize `srt://` without percent-encoding `streamid` colons.
 * Chromium `URL.href` encodes `read:cam1:…` as `read%3Acam1%3A…`.
 */
export function serializeSrtHref(parsed: URL): string {
  const parts: string[] = []
  parsed.searchParams.forEach((value, key) => {
    if (key === 'streamid' || key === 'passphrase' || key === 'mode') {
      parts.push(`${key}=${value}`)
      return
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  })
  const path =
    parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : ''
  const query = parts.length > 0 ? `?${parts.join('&')}` : ''
  return `srt://${parsed.hostname}:${parsed.port}${path}${query}`
}

/**
 * Caller-mode `srt://host:port` only (L3). Listener URLs (`srt://:9000`) fail.
 */
export function validateSrtUrl(raw: unknown): SrtUrlOk | SrtUrlErr {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'SRT URL is required' }
  }
  const trimmed = raw.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'SRT URL is not a valid URL' }
  }
  if (parsed.protocol.toLowerCase() !== 'srt:') {
    return {
      ok: false,
      error: `SRT URL must use srt:// (got ${parsed.protocol.replace(':', '')})`,
    }
  }
  if (!parsed.hostname) {
    return {
      ok: false,
      error:
        'SRT URL must include a host (caller mode; listener URLs are rejected)',
    }
  }
  if (!parsed.port) {
    return { ok: false, error: 'SRT URL must include a port' }
  }
  return { ok: true, href: serializeSrtHref(parsed) }
}

export function validatePovId(
  raw: unknown,
): { ok: true; povId: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'povId is required' }
  }
  const povId = raw.trim()
  if (povId.toLowerCase() === 'all') {
    return { ok: false, error: 'povId "all" is reserved for srt:close' }
  }
  return { ok: true, povId }
}

/**
 * Merge SRT socket options into the URL query. `latency` is microseconds
 * (ffmpeg / libsrt). `streamid` is the SRT stream id, not an MPEG-TS PID.
 */
export function mergeSrtUrlOptions(
  href: string,
  opts: {
    streamId?: unknown
    latencyMs?: unknown
    passphrase?: unknown
  } = {},
): string {
  const parsed = new URL(href)
  const streamId =
    typeof opts.streamId === 'string' && opts.streamId.trim()
      ? opts.streamId.trim()
      : ''
  if (streamId) {
    parsed.searchParams.set('streamid', streamId.slice(0, 512))
  }
  if (opts.latencyMs != null && opts.latencyMs !== '') {
    const ms = Number(opts.latencyMs)
    if (!Number.isFinite(ms)) {
      throw new Error('latencyMs must be a finite number')
    }
    const clamped = Math.max(20, Math.min(30_000, Math.round(ms)))
    parsed.searchParams.set('latency', String(clamped * 1000))
  }
  const passphrase =
    typeof opts.passphrase === 'string' && opts.passphrase ? opts.passphrase : ''
  if (passphrase) {
    parsed.searchParams.set('passphrase', passphrase)
  }
  if (!parsed.searchParams.has('timeout')) {
    parsed.searchParams.set('timeout', '5000000')
  }
  if (!parsed.searchParams.has('mode')) {
    parsed.searchParams.set('mode', 'caller')
  }
  return serializeSrtHref(parsed)
}

export function idleSrtStatus(povId: string): SrtStatus {
  return { povId, state: 'idle', bitrateKbps: 0, lastError: null }
}

export function normalizeSrtStatus(
  raw: unknown,
  fallbackPovId = '',
): SrtStatus {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const povId =
    typeof o.povId === 'string' && o.povId.trim()
      ? o.povId.trim()
      : fallbackPovId
  const state = SRT_STATES.includes(o.state as SrtState)
    ? (o.state as SrtState)
    : 'idle'
  const n = Number(o.bitrateKbps)
  const bitrateKbps = Number.isFinite(n) ? Math.max(0, n) : 0
  const lastError =
    o.lastError == null || o.lastError === '' ? null : String(o.lastError)
  const ipcDropCount = Number(o.ipcDropCount)
  const ipcDropPerSec = Number(o.ipcDropPerSec)
  return {
    povId,
    state,
    bitrateKbps,
    lastError,
    ipcDropCount: Number.isFinite(ipcDropCount)
      ? Math.max(0, Math.floor(ipcDropCount))
      : undefined,
    ipcDropPerSec: Number.isFinite(ipcDropPerSec)
      ? Math.max(0, Math.floor(ipcDropPerSec))
      : undefined,
    ffmpegDropFrames:
      o.ffmpegDropFrames == null || o.ffmpegDropFrames === ''
        ? null
        : String(o.ffmpegDropFrames),
    ffmpegDupFrames:
      o.ffmpegDupFrames == null || o.ffmpegDupFrames === ''
        ? null
        : String(o.ffmpegDupFrames),
  }
}

type StudioWithSrt = {
  isStudio?: boolean
  srt?: SrtBridge
}

function readStudio(): StudioWithSrt | undefined {
  try {
    const g = globalThis as { window?: { broadcastStudio?: StudioWithSrt } }
    return g.window?.broadcastStudio
  } catch {
    return undefined
  }
}

function isSrtBridge(value: unknown): value is SrtBridge {
  if (!value || typeof value !== 'object') return false
  const s = value as SrtBridge
  return (
    typeof s.open === 'function' &&
    typeof s.close === 'function' &&
    typeof s.getStatus === 'function' &&
    typeof s.onSrtData === 'function' &&
    typeof s.onSrtStatus === 'function'
  )
}

/**
 * True when running inside the Electron studio shell with the SRT preload.
 * Plain browser / missing namespace → null (do not throw).
 */
export function getSrtBridge(): SrtBridge | null {
  const studio = readStudio()
  if (studio?.isStudio === true && isSrtBridge(studio.srt)) {
    return studio.srt
  }
  return null
}
