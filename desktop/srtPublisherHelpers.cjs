/**
 * Pure SRT *publish* helpers (no child_process, no Electron, no NDI).
 * Ingest argv stays in srtHelpers.cjs (bitstream copy MPEG-TS pipe). Do not mix.
 */

const {
  validateSrtUrl,
  mergeSrtUrlOptions,
  serializeSrtHref,
} = require('./srtHelpers.cjs')

const SRT_OUT_CHANNEL_IDS = /** @type {const} */ (['ar', '3d', '2d'])

const SRT_OUT_TITLES = {
  ar: 'broadcast-web-srt-ar',
  '3d': 'broadcast-web-srt-3d',
  '2d': 'broadcast-web-srt-2d',
}

/** ffmpeg `latency` is microseconds (60 ms → 60000). Local OBS first; no VPS. */
const SRT_OUT_DEFAULT_URLS = {
  ar: 'srt://127.0.0.1:9201?mode=caller&latency=60000',
  '3d': 'srt://127.0.0.1:9202?mode=caller&latency=60000',
  '2d': 'srt://127.0.0.1:9203?mode=caller&latency=60000',
}

const SRT_OUT_WIDTH = 1920
const SRT_OUT_HEIGHT = 1080
const SRT_OUT_FPS = 30
/** Mid of the 8–15 Mbps lock. */
const SRT_OUT_BITRATE = '10M'
const SRT_OUT_MAXRATE = '12M'
const SRT_OUT_BUFSIZE = '5M'

/**
 * Fit a 16:9 plate fully inside a display work area (no spill onto a
 * neighbouring vertical monitor).
 *
 * @param {{ x?: number, y?: number, width?: number, height?: number }} work
 * @param {number} [index]
 */
function fitSrtPlateInWorkArea(work, index = 0) {
  const workW = Math.max(1, Number(work && work.width) || 1)
  const workH = Math.max(1, Number(work && work.height) || 1)
  const workX = Number(work && work.x) || 0
  const workY = Number(work && work.y) || 0
  let width = Math.min(SRT_OUT_WIDTH, workW)
  let height = Math.round((width * 9) / 16)
  if (height > workH) {
    height = workH
    width = Math.round((height * 16) / 9)
    if (width > workW) {
      width = workW
      height = Math.round((width * 9) / 16)
    }
  }
  width = Math.max(16, width)
  height = Math.max(16, height)
  const slot = Math.max(0, Math.round(Number(index) || 0))
  const ox = Math.min(slot * 32, Math.max(0, workW - width))
  const oy = Math.min(slot * 24, Math.max(0, workH - height))
  return { x: workX + ox, y: workY + oy, width, height }
}

/**
 * Prefer the studio's landscape display. Never pick a portrait panel when a
 * landscape one exists (vertical second monitors overflow 1920-wide plates).
 *
 * @param {Array<{ bounds?: { x: number, y: number, width: number, height: number }, workArea?: { x: number, y: number, width: number, height: number } }>} displays
 * @param {{ x?: number, y?: number, width?: number, height?: number } | null} studioBounds
 */
function pickSrtPlateDisplay(displays, studioBounds) {
  const list = Array.isArray(displays) ? displays : []
  const area = (d) => d.workArea || d.bounds || { x: 0, y: 0, width: 0, height: 0 }
  const isLandscape = (d) => {
    const a = area(d)
    return a.width >= a.height && a.width >= 640 && a.height >= 360
  }
  const contains = (d, b) => {
    const r = d.bounds || d.workArea
    if (!r || !b) return false
    const cx = (Number(b.x) || 0) + (Number(b.width) || 0) / 2
    const cy = (Number(b.y) || 0) + (Number(b.height) || 0) / 2
    return (
      cx >= r.x &&
      cy >= r.y &&
      cx < r.x + r.width &&
      cy < r.y + r.height
    )
  }
  const studio = list.find((d) => contains(d, studioBounds)) || null
  if (studio && isLandscape(studio)) return studio
  const land = list.find(isLandscape)
  if (land) return land
  return studio || list[0] || null
}

const SRT_OUT_STATES = /** @type {const} */ ([
  'idle',
  'connecting',
  'live',
  'error',
])

/**
 * @param {unknown} raw
 * @returns {raw is 'ar' | '3d' | '2d'}
 */
function isSrtOutChannelId(raw) {
  return raw === 'ar' || raw === '3d' || raw === '2d'
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, channel: 'ar' | '3d' | '2d' } | { ok: false, error: string }}
 */
function validateSrtOutChannel(raw) {
  if (!isSrtOutChannelId(raw)) {
    return { ok: false, error: 'SRT out channel must be ar, 3d, or 2d' }
  }
  return { ok: true, channel: raw }
}

/**
 * Prefer AMF (this studio is RX 6750 XT), then NVENC, then libx264.
 *
 * @param {string} encoderListText `ffmpeg -encoders` stdout
 * @returns {'h264_amf' | 'h264_nvenc' | 'libx264' | null}
 */
function pickPublishEncoder(encoderListText) {
  const text = typeof encoderListText === 'string' ? encoderListText : ''
  if (/(^|\s)h264_amf(\s|$)/m.test(text)) return 'h264_amf'
  if (/(^|\s)h264_nvenc(\s|$)/m.test(text)) return 'h264_nvenc'
  if (/(^|\s)libx264(\s|$)/m.test(text)) return 'libx264'
  return null
}

/**
 * Operator URL field → ffmpeg SRT destination. Any host (loopback, LAN, VPS).
 * Studio is always caller. `0.0.0.0` is a listen bind, not a dial target.
 *
 * @param {string} url
 * @returns {{ ok: true, href: string } | { ok: false, error: string }}
 */
function resolvePublishUrl(url) {
  const checked = validateSrtUrl(url)
  if (!checked.ok) return checked
  try {
    const parsed = new URL(checked.href)
    const host = String(parsed.hostname || '').replace(/^\[|\]$/g, '').toLowerCase()
    if (host === '0.0.0.0' || host === '::' || host === '') {
      return {
        ok: false,
        error:
          'Caller destination cannot be 0.0.0.0. Paste the listener PC or VPS IP. Studio always dials (mode=caller).',
      }
    }
    parsed.searchParams.set('mode', 'caller')
    if (!parsed.searchParams.has('latency')) {
      parsed.searchParams.set('latency', '60000')
    }
    const href = mergeSrtUrlOptions(serializeSrtHref(parsed), {})
    const forced = new URL(href)
    forced.searchParams.set('mode', 'caller')
    return { ok: true, href: serializeSrtHref(forced) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function srtOutRawFrameBytes(width = SRT_OUT_WIDTH, height = SRT_OUT_HEIGHT) {
  const w = Math.max(1, Math.round(Number(width) || SRT_OUT_WIDTH))
  const h = Math.max(1, Math.round(Number(height) || SRT_OUT_HEIGHT))
  return w * h * 4
}

function isPipeGrab(grab) {
  return Boolean(grab && typeof grab === 'object' && grab.kind === 'pipe')
}

/**
 * ffmpeg publish argv. Production input is BGRA compositor frames on stdin
 * (`kind: 'pipe'`). That is the plate window's own framebuffer — not DXGI
 * screen copy. gdigrab title remains a test/fallback path only.
 *
 * Must not be an ingest bitstream-copy MPEG-TS pipe.
 *
 * @param {{
 *   title: string,
 *   url: string,
 *   encoder: 'h264_amf' | 'h264_nvenc' | 'libx264',
 *   width?: number,
 *   height?: number,
 *   fps?: number,
 *   grab?: {
 *     kind?: 'pipe' | 'gdi',
 *     title?: string,
 *   },
 * }} opts
 * @returns {string[]}
 */
function buildSrtPublishArgv(opts) {
  const title = typeof opts.title === 'string' ? opts.title.trim() : ''
  const url = typeof opts.url === 'string' ? opts.url.trim() : ''
  const encoder = opts.encoder
  const width = opts.width || SRT_OUT_WIDTH
  const height = opts.height || SRT_OUT_HEIGHT
  const fps = opts.fps || SRT_OUT_FPS
  if (!title) throw new Error('gdigrab window title is required')
  if (!url) throw new Error('SRT caller URL is required')
  if (
    encoder !== 'h264_amf' &&
    encoder !== 'h264_nvenc' &&
    encoder !== 'libx264'
  ) {
    throw new Error('publish encoder is required')
  }

  const grab = opts.grab && typeof opts.grab === 'object' ? opts.grab : null
  const usePipe = isPipeGrab(grab)

  /** @type {string[]} */
  const input = usePipe
    ? [
        '-hide_banner',
        '-loglevel',
        'warning',
        '-stats_period',
        '1',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'bgra',
        '-s',
        `${width}x${height}`,
        '-r',
        String(fps),
        '-i',
        'pipe:0',
      ]
    : [
        '-hide_banner',
        '-nostdin',
        '-loglevel',
        'warning',
        '-stats_period',
        '1',
        '-f',
        'gdigrab',
        '-framerate',
        String(fps),
        '-draw_mouse',
        '0',
        '-i',
        `title=${title}`,
      ]

  const commonOut = [
    '-progress',
    'pipe:1',
    '-an',
    '-r',
    String(fps),
    '-s',
    `${width}x${height}`,
    '-pix_fmt',
    'yuv420p',
    '-fps_mode',
    'cfr',
  ]

  /** @type {string[]} */
  let encode
  if (encoder === 'h264_amf') {
    encode = [
      '-c:v',
      'h264_amf',
      '-usage',
      'ultralowlatency',
      '-quality',
      'speed',
      '-rc',
      'cbr',
      '-b:v',
      SRT_OUT_BITRATE,
      '-maxrate',
      SRT_OUT_MAXRATE,
      '-bufsize',
      SRT_OUT_BUFSIZE,
      '-g',
      String(fps),
      '-bf',
      '0',
      '-async_depth',
      '1',
    ]
  } else if (encoder === 'h264_nvenc') {
    encode = [
      '-c:v',
      'h264_nvenc',
      '-preset',
      'p1',
      '-tune',
      'll',
      '-rc',
      'cbr',
      '-b:v',
      SRT_OUT_BITRATE,
      '-maxrate',
      SRT_OUT_MAXRATE,
      '-bufsize',
      SRT_OUT_BUFSIZE,
      '-g',
      String(fps),
      '-bf',
      '0',
    ]
  } else {
    encode = [
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-b:v',
      SRT_OUT_BITRATE,
      '-maxrate',
      SRT_OUT_MAXRATE,
      '-bufsize',
      SRT_OUT_BUFSIZE,
      '-g',
      String(fps),
      '-bf',
      '0',
      '-x264-params',
      'bframes=0:keyint=30:min-keyint=30:scenecut=0',
    ]
  }

  return [
    ...input,
    ...commonOut,
    ...encode,
    '-f',
    'mpegts',
    url,
  ]
}

/**
 * Parse ffmpeg `-stats` / stderr fps (optional ops readout).
 *
 * @param {string} chunk
 * @returns {number | null}
 */
function parseFfmpegFps(chunk) {
  if (typeof chunk !== 'string' || !chunk) return null
  const hit = chunk.match(/\bfps=\s*([\d.]+)/)
  if (!hit) return null
  const n = Number(hit[1])
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * @param {unknown} raw
 * @param {'ar' | '3d' | '2d'} [fallbackChannel]
 */
function idleSrtOutStatus(fallbackChannel) {
  const channel = isSrtOutChannelId(fallbackChannel) ? fallbackChannel : 'ar'
  return {
    channel,
    state: /** @type {const} */ ('idle'),
    encoder: /** @type {string | null} */ (null),
    encoderFps: /** @type {number | null} */ (null),
    url: SRT_OUT_DEFAULT_URLS[channel],
    lastError: /** @type {string | null} */ (null),
    fallbackNote: /** @type {string | null} */ (null),
  }
}

/**
 * @param {unknown} raw
 * @param {'ar' | '3d' | '2d'} [fallbackChannel]
 */
function normalizeSrtOutStatus(raw, fallbackChannel) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {}
  const channel = isSrtOutChannelId(o.channel)
    ? o.channel
    : isSrtOutChannelId(fallbackChannel)
      ? fallbackChannel
      : 'ar'
  const state = SRT_OUT_STATES.includes(
    /** @type {(typeof SRT_OUT_STATES)[number]} */ (o.state),
  )
    ? /** @type {(typeof SRT_OUT_STATES)[number]} */ (o.state)
    : 'idle'
  const encoder =
    o.encoder === 'h264_amf' ||
    o.encoder === 'h264_nvenc' ||
    o.encoder === 'libx264'
      ? o.encoder
      : null
  const fpsN = Number(o.encoderFps)
  const encoderFps = Number.isFinite(fpsN) && fpsN >= 0 ? fpsN : null
  const url =
    typeof o.url === 'string' && o.url.trim()
      ? o.url.trim()
      : SRT_OUT_DEFAULT_URLS[channel]
  let lastError = null
  if (o.lastError != null && o.lastError !== '') lastError = String(o.lastError)
  let fallbackNote = null
  if (o.fallbackNote != null && o.fallbackNote !== '') {
    fallbackNote = String(o.fallbackNote)
  }
  return {
    channel,
    state,
    encoder,
    encoderFps,
    url,
    lastError,
    fallbackNote,
  }
}

module.exports = {
  SRT_OUT_CHANNEL_IDS,
  SRT_OUT_TITLES,
  SRT_OUT_DEFAULT_URLS,
  SRT_OUT_WIDTH,
  SRT_OUT_HEIGHT,
  SRT_OUT_FPS,
  SRT_OUT_BITRATE,
  SRT_OUT_STATES,
  isSrtOutChannelId,
  validateSrtOutChannel,
  pickPublishEncoder,
  resolvePublishUrl,
  buildSrtPublishArgv,
  parseFfmpegFps,
  idleSrtOutStatus,
  normalizeSrtOutStatus,
  fitSrtPlateInWorkArea,
  pickSrtPlateDisplay,
  srtOutRawFrameBytes,
  isPipeGrab,
}
