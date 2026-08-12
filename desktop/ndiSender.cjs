/**
 * Main-process multi-sender NDI bridge (grandi / NDI SDK 6).
 * Map of channelId → independent grandi sender.
 * Receives RGBA frames from the renderer, converts to top-down BGRA, sends.
 *
 * Channel ids: 'ar' | '3d' | '2d' (string enum).
 * Omitting channel in IPC/SPA defaults to 'ar' (today's air plate).
 */
const grandi = require('grandi')

/** @typedef {'ar' | '3d' | '2d'} NdiChannelId */

const CHANNEL_IDS = /** @type {const} */ (['ar', '3d', '2d'])
const DEFAULT_CHANNEL = /** @type {NdiChannelId} */ ('ar')

/** Default NDI source names per channel (hostname prepended by SDK). */
const DEFAULT_NAMES = {
  ar: 'broadcast-web',
  '3d': 'broadcast-web-3d',
  '2d': 'broadcast-web-2d',
}

/** @deprecated Prefer DEFAULT_NAMES.ar — kept for main.cjs resolveNdiName(). */
const DEFAULT_NAME = DEFAULT_NAMES.ar

const FRAME_RATE_N = 30
const FRAME_RATE_D = 1

/** @type {string | null} */
let sdkVersion = null
let sdkInitialized = false

/**
 * @typedef {{
 *   sender: import('grandi').Sender | null,
 *   name: string | null,
 *   lastError: string | null,
 *   busy: boolean,
 *   bgraScratch: Buffer | null,
 *   scratchBytes: number,
 * }} ChannelState
 */

/** @type {Map<string, ChannelState>} */
const channels = new Map()

/**
 * @param {unknown} raw
 * @returns {NdiChannelId}
 */
function normalizeChannel(raw) {
  if (raw == null || raw === '') return DEFAULT_CHANNEL
  const id = String(raw).trim().toLowerCase()
  if (id === 'ar' || id === '3d' || id === '2d') return id
  throw new Error(`unknown NDI channel: ${raw}`)
}

/**
 * @param {NdiChannelId} channelId
 * @returns {ChannelState}
 */
function ensureChannel(channelId) {
  let state = channels.get(channelId)
  if (!state) {
    state = {
      sender: null,
      name: null,
      lastError: null,
      busy: false,
      bgraScratch: null,
      scratchBytes: 0,
    }
    channels.set(channelId, state)
  }
  return state
}

function ensureInitialized() {
  if (sdkInitialized) return
  if (!grandi.isSupportedCPU()) {
    throw new Error('CPU does not support NDI')
  }
  if (!grandi.initialize()) {
    throw new Error('grandi.initialize() failed')
  }
  sdkVersion = grandi.version()
  sdkInitialized = true
}

/**
 * RGBA (optionally bottom-up from WebGL readPixels) → top-down BGRA.
 * @param {Buffer|Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @param {boolean} bottomUp
 * @param {Buffer} out
 */
function rgbaToBgra(rgba, width, height, bottomUp, out) {
  const rowBytes = width * 4
  for (let y = 0; y < height; y++) {
    const srcY = bottomUp ? height - 1 - y : y
    const srcRow = srcY * rowBytes
    const dstRow = y * rowBytes
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * 4
      const di = dstRow + x * 4
      out[di] = rgba[si + 2] // B
      out[di + 1] = rgba[si + 1] // G
      out[di + 2] = rgba[si] // R
      out[di + 3] = rgba[si + 3] // A
    }
  }
}

/**
 * @param {ChannelState} state
 * @param {number} bytes
 */
function ensureScratch(state, bytes) {
  if (!state.bgraScratch || state.scratchBytes < bytes) {
    state.bgraScratch = Buffer.allocUnsafe(bytes)
    state.scratchBytes = bytes
  }
  return state.bgraScratch
}

/**
 * @param {unknown} channelId
 * @param {string} [name]
 */
async function start(channelId, name) {
  const id = normalizeChannel(channelId)
  const state = ensureChannel(id)
  state.lastError = null
  const sourceName =
    (name && String(name).trim()) || DEFAULT_NAMES[id] || DEFAULT_NAME
  try {
    ensureInitialized()
    if (state.sender) {
      await state.sender.destroy().catch(() => {})
      state.sender = null
      state.name = null
    }
    state.sender = await grandi.send({
      name: sourceName,
      clockVideo: true,
      clockAudio: false,
    })
    const full = state.sender.sourcename()
    state.name = full
    return {
      ok: true,
      channel: id,
      sourceName: full,
      sdkVersion,
    }
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err)
    state.sender = null
    state.name = null
    return { ok: false, channel: id, error: state.lastError, sdkVersion }
  }
}

/**
 * @param {unknown} [channelIdOrAll] channel id, 'all', or omit → 'ar'
 */
async function stop(channelIdOrAll) {
  if (
    channelIdOrAll === 'all' ||
    (channelIdOrAll &&
      typeof channelIdOrAll === 'object' &&
      /** @type {{ channel?: string }} */ (channelIdOrAll).channel === 'all')
  ) {
    const ids = [...channels.keys()]
    for (const id of ids) {
      await stopOne(id)
    }
    return
  }
  const id = normalizeChannel(
    channelIdOrAll &&
      typeof channelIdOrAll === 'object' &&
      'channel' in /** @type {object} */ (channelIdOrAll)
      ? /** @type {{ channel?: unknown }} */ (channelIdOrAll).channel
      : channelIdOrAll,
  )
  await stopOne(id)
}

/**
 * @param {NdiChannelId} id
 */
async function stopOne(id) {
  const state = channels.get(id)
  if (!state) return
  state.busy = false
  if (state.sender) {
    try {
      await state.sender.destroy()
    } catch {
      /* ignore */
    }
    state.sender = null
    state.name = null
  }
}

/**
 * @param {unknown} channelId
 * @param {{ width: number, height: number, data: ArrayBuffer|Buffer|Uint8Array, bottomUp?: boolean }} frame
 */
function sendFrame(channelId, frame) {
  let id
  try {
    id = normalizeChannel(channelId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
  const state = channels.get(id)
  if (!state?.sender || state.busy) return { ok: false, dropped: true, channel: id }
  const width = frame.width | 0
  const height = frame.height | 0
  if (width < 1 || height < 1 || !frame.data) {
    return { ok: false, error: 'invalid frame', channel: id }
  }
  const bytes = width * height * 4
  const rgba =
    frame.data instanceof ArrayBuffer
      ? Buffer.from(frame.data)
      : Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength)
  if (rgba.length < bytes) {
    return { ok: false, error: 'frame buffer too small', channel: id }
  }

  state.busy = true
  try {
    const out = ensureScratch(state, bytes)
    rgbaToBgra(rgba, width, height, frame.bottomUp !== false, out)
    const data = out.subarray(0, bytes)
    void state.sender
      .video({
        xres: width,
        yres: height,
        frameRateN: FRAME_RATE_N,
        frameRateD: FRAME_RATE_D,
        fourCC: grandi.FourCC.BGRA,
        pictureAspectRatio: width / height,
        frameFormatType: grandi.FrameType.Progressive,
        lineStrideBytes: width * 4,
        data,
      })
      .catch((err) => {
        state.lastError = err instanceof Error ? err.message : String(err)
      })
      .finally(() => {
        state.busy = false
      })
    return { ok: true, channel: id }
  } catch (err) {
    state.busy = false
    state.lastError = err instanceof Error ? err.message : String(err)
    return { ok: false, error: state.lastError, channel: id }
  }
}

/**
 * @param {unknown} [channelId]
 */
function getStatus(channelId) {
  const id = normalizeChannel(channelId)
  const state = channels.get(id)
  return {
    channel: id,
    active: state?.sender != null,
    sourceName: state?.sender ? state.sender.sourcename() : null,
    sdkVersion,
    error: state?.lastError ?? null,
  }
}

function getStatusAll() {
  /** @type {Record<string, ReturnType<typeof getStatus>>} */
  const out = {}
  for (const id of CHANNEL_IDS) {
    out[id] = getStatus(id)
  }
  return out
}

function shutdown() {
  void stop('all').finally(() => {
    if (!sdkInitialized) return
    try {
      grandi.destroy()
    } catch {
      /* ignore */
    }
    sdkInitialized = false
    sdkVersion = null
  })
}

module.exports = {
  CHANNEL_IDS,
  DEFAULT_CHANNEL,
  DEFAULT_NAMES,
  DEFAULT_NAME,
  normalizeChannel,
  start,
  stop,
  sendFrame,
  getStatus,
  getStatusAll,
  shutdown,
}
