/**
 * Pure SRT helpers for the main-process reader (no child_process, no Electron).
 * Renderer-side twins live in src/output/srtBridge.ts — keep the URL rules in sync.
 *
 * PTS-safety lives in buildFfmpegArgv(): bitstream copy, no restamp.
 */

const SRT_STATES = /** @type {const} */ (['idle', 'connecting', 'live', 'error'])

const MAX_SESSIONS = 4

/** Backoff between failed spawns (ms). Caps so we neither spin nor go silent forever. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000]

/**
 * One in-flight IPC chunk + a short queue. At ~8 Mbps a typical stdout read is
 * 64–256 KB; depth 32 absorbs renderer hitch without unbounded main memory.
 */
const MAX_QUEUED_CHUNKS = 32

/**
 * Serialize an srt:// URL without percent-encoding `streamid` colons.
 * Chromium `URL.href` turns `read:cam1:…` into `read%3Acam1%3A…`; libsrt wants colons.
 *
 * @param {URL} parsed
 */
function serializeSrtHref(parsed) {
  const parts = []
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
 * @param {unknown} raw
 * @returns {{ ok: true, href: string } | { ok: false, error: string }}
 */
function validateSrtUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'SRT URL is required' }
  }
  const trimmed = raw.trim()
  let parsed
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
      error: 'SRT URL must include a host (caller mode; listener URLs are rejected)',
    }
  }
  if (!parsed.port) {
    return { ok: false, error: 'SRT URL must include a port' }
  }
  return { ok: true, href: serializeSrtHref(parsed) }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, povId: string } | { ok: false, error: string }}
 */
function validatePovId(raw) {
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
 * Merge optional SRT socket options into the URL query.
 * ffmpeg reads `latency` in **microseconds**; `streamid` / `passphrase` are SRT
 * socket options, never ffmpeg `-streamid` (that flag is an MPEG-TS PID map).
 *
 * @param {string} href already-validated srt:// URL
 * @param {{ streamId?: unknown, latencyMs?: unknown, passphrase?: unknown }} [opts]
 */
function mergeSrtUrlOptions(href, opts = {}) {
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
    const clamped = Math.max(20, Math.min(30000, Math.round(ms)))
    parsed.searchParams.set('latency', String(clamped * 1000))
  }
  const passphrase =
    typeof opts.passphrase === 'string' && opts.passphrase ? opts.passphrase : ''
  if (passphrase) {
    parsed.searchParams.set('passphrase', passphrase)
  }
  // Connection timeout (µs). Unreachable URLs fail into error+backoff instead
  // of hanging in 'connecting' until the operator gives up.
  if (!parsed.searchParams.has('timeout')) {
    parsed.searchParams.set('timeout', '5000000')
  }
  if (!parsed.searchParams.has('mode')) {
    parsed.searchParams.set('mode', 'caller')
  }
  return serializeSrtHref(parsed)
}

/**
 * ffmpeg argv for an MPEG-TS byte pipe.
 *
 * Default is bitstream copy (PTS-safe). `transcodeToH264` is the Electron
 * fallback when WebCodecs cannot decode HEVC: ffmpeg (same decoder OBS uses)
 * decodes HEVC and encodes H.264. Copy path is `-c copy` plus the muxer tail.
 * Transcode keeps the **input 90 kHz PTS** via `-copytb 1` (demuxer timebase)
 * and `-enc_time_base 1:90000` (encoder uses the MPEG-TS ruler, not a new
 * frame-rate origin). `-copyts` / `-mpegts_copyts 1` stay. No Store pack.
 *
 * @param {string} inputUrl merged srt:// URL
 * @param {{ transcodeToH264?: boolean }} [opts]
 * @returns {string[]}
 */
function buildFfmpegArgv(inputUrl, opts = {}) {
  const transcode = opts.transcodeToH264 === true
  const head = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-copyts',
    ...(transcode ? ['-copytb', '1'] : []),
    '-fflags', '+nobuffer',
    '-analyzeduration', '0',
    '-probesize', '65536',
    '-f', 'mpegts',
    '-i', inputUrl,
  ]
  const tail = [
    '-f', 'mpegts',
    '-mpegts_copyts', '1',
    '-muxdelay', '0',
    '-muxpreload', '0',
    '-avoid_negative_ts', 'disabled',
    'pipe:1',
  ]
  if (!transcode) {
    return [...head, '-map', '0', '-c', 'copy', ...tail]
  }
  return [
    ...head,
    '-map', '0:v:0',
    '-an',
    '-c:v', 'libx264',
    // MPEG-TS 90 kHz ruler. Default enc_time_base 0 = frame-rate origin.
    '-enc_time_base', '1:90000',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-bf', '0',
    '-g', '30',
    '-x264-params', 'repeat-headers=1:bframes=0:keyint=30:min-keyint=30:scenecut=0',
    '-fps_mode', 'passthrough',
    '-copyts',
    ...tail,
  ]
}

/**
 * @param {string} href
 */
function redactSrtUrl(href) {
  try {
    const parsed = new URL(href)
    if (parsed.searchParams.has('passphrase')) {
      parsed.searchParams.set('passphrase', '***')
    }
    const sid = parsed.searchParams.get('streamid')
    if (sid) {
      const parts = sid.split(':')
      if (parts.length >= 4) {
        const last = parts[parts.length - 1] ?? ''
        if (last !== '' && !/[{}]/.test(last)) {
          parts[parts.length - 1] = '***'
          parsed.searchParams.set('streamid', parts.join(':'))
        }
      }
    }
    return serializeSrtHref(parsed)
  } catch {
    return 'srt://***'
  }
}

/**
 * @param {unknown} raw
 * @param {string} [fallbackPovId]
 */
function normalizeSrtStatus(raw, fallbackPovId = '') {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {}
  const povId =
    typeof o.povId === 'string' && o.povId.trim()
      ? o.povId.trim()
      : fallbackPovId
  const state = SRT_STATES.includes(/** @type {(typeof SRT_STATES)[number]} */ (o.state))
    ? /** @type {(typeof SRT_STATES)[number]} */ (o.state)
    : 'idle'
  const n = Number(o.bitrateKbps)
  const bitrateKbps = Number.isFinite(n) ? Math.max(0, n) : 0
  let lastError = null
  if (o.lastError != null && o.lastError !== '') {
    lastError = String(o.lastError)
  }
  return { povId, state, bitrateKbps, lastError }
}

/**
 * @param {string} povId
 */
function idleSrtStatus(povId) {
  return { povId, state: /** @type {const} */ ('idle'), bitrateKbps: 0, lastError: null }
}

module.exports = {
  SRT_STATES,
  MAX_SESSIONS,
  BACKOFF_MS,
  MAX_QUEUED_CHUNKS,
  serializeSrtHref,
  validateSrtUrl,
  validatePovId,
  mergeSrtUrlOptions,
  buildFfmpegArgv,
  redactSrtUrl,
  normalizeSrtStatus,
  idleSrtStatus,
}
