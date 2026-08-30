/**
 * Main-process multi-sender NDI bridge (grandi / NDI SDK 6).
 * Map of channelId → independent grandi sender.
 * Receives packed frames from the renderer. Hot path is UYVY (3D/2D,
 * 2 bytes/px) or UYVA (AR alpha plate, 3 bytes/px). RGBA/BGRA remain
 * as fallbacks. Copies into a pooled buffer (no per-pixel loop).
 *
 * Channel ids: 'ar' | '3d' | '2d' (string enum).
 * Omitting channel in IPC/SPA defaults to 'ar' (today's air plate).
 */
const grandi = require('grandi')
const fs = require('node:fs')
const path = require('node:path')

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

/** In-flight + pending + two spares. Extra slots do not raise fps. */
const POOL_SIZE = 4

/**
 * Ops-safe note when the native RGBA FourCC path is unavailable.
 * Same spirit as NDI_SYNC_READBACK_NOTE — Send still works, main thread pays
 * the ~7 ms/frame scalar conversion.
 */
const NDI_BGRA_FALLBACK_NOTE =
  '[output] NDI send: native RGBA FourCC unavailable — using CPU rgbaToBgra (main-thread cost ~7 ms/frame at 1080p).'

/** @type {string | null} */
let sdkVersion = null
let sdkInitialized = false
let fourCCProbed = false
let nativeRgbaPreferred =
  typeof grandi.FourCC === 'object' &&
  grandi.FourCC != null &&
  typeof grandi.FourCC.RGBA === 'number'
let nativeRgbaDisabled = false
let bgraFallbackNoted = false
let nativeUyvyPreferred =
  typeof grandi.FourCC === 'object' &&
  grandi.FourCC != null &&
  typeof grandi.FourCC.UYVY === 'number'
let nativeUyvaPreferred =
  typeof grandi.FourCC === 'object' &&
  grandi.FourCC != null &&
  typeof grandi.FourCC.UYVA === 'number'

/**
 * @typedef {{
 *   sender: import('grandi').Sender | null,
 *   name: string | null,
 *   lastError: string | null,
 *   busy: boolean,
 *   pool: Buffer[],
 *   poolBytes: number,
 *   inFlightIndex: number,
 *   pendingIndex: number,
 *   pending: PreparedFrame | null,
 *   sendGen: number,
 * }} ChannelState
 */

/**
 * @typedef {{
 *   poolIndex: number,
 *   width: number,
 *   height: number,
 *   bytes: number,
 *   useRgba: boolean,
 *   pixelFormat: 'rgba' | 'uyvy' | 'uyva',
 *   lineStride: number,
 *   fourCC: number,
 * }} PreparedFrame
 */

/** @type {Map<string, ChannelState>} */
const channels = new Map()

/** Per-channel 1 s accumulators (DSP-PRF-20260829-01). Measurement only. */
function emptyPerfAcc() {
  return { count: 0, sumMs: 0, maxMs: 0 }
}

/** @type {Record<string, { rgbaToBgra: ReturnType<typeof emptyPerfAcc>, video: ReturnType<typeof emptyPerfAcc>, dropBusy: number }>} */
const perfByChannel = {
  ar: { rgbaToBgra: emptyPerfAcc(), video: emptyPerfAcc(), dropBusy: 0 },
  '3d': { rgbaToBgra: emptyPerfAcc(), video: emptyPerfAcc(), dropBusy: 0 },
  '2d': { rgbaToBgra: emptyPerfAcc(), video: emptyPerfAcc(), dropBusy: 0 },
}

/**
 * @param {ReturnType<typeof emptyPerfAcc>} acc
 * @param {number} ms
 */
function addPerf(acc, ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return
  acc.count += 1
  acc.sumMs += ms
  if (ms > acc.maxMs) acc.maxMs = ms
}

/**
 * @param {ReturnType<typeof emptyPerfAcc>} acc
 */
function snapPerf(acc) {
  return {
    count: acc.count,
    sumMs: acc.sumMs,
    maxMs: acc.maxMs,
    meanMs: acc.count > 0 ? acc.sumMs / acc.count : 0,
  }
}

function nativeRgbaActive() {
  return nativeRgbaPreferred && !nativeRgbaDisabled
}

/**
 * @param {unknown} raw
 * @param {number} byteLength
 * @param {number} width
 * @param {number} height
 * @returns {'rgba' | 'uyvy' | 'uyva'}
 */
function resolvePixelFormat(raw, byteLength, width, height) {
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (id === 'uyvy' || id === 'uyva' || id === 'rgba') return id
  const rgba = width * height * 4
  const uyva = width * height * 3
  const uyvy = width * height * 2
  if (byteLength >= rgba) return 'rgba'
  if (byteLength >= uyva) return 'uyva'
  if (byteLength >= uyvy) return 'uyvy'
  return 'rgba'
}

/**
 * @param {'rgba' | 'uyvy' | 'uyva'} format
 * @param {number} width
 * @param {number} height
 */
function pixelBytes(format, width, height) {
  if (format === 'uyvy') return width * height * 2
  if (format === 'uyva') return width * height * 3
  return width * height * 4
}

/**
 * @param {'rgba' | 'uyvy' | 'uyva'} format
 */
function fourCCFor(format) {
  if (format === 'uyvy' && nativeUyvyPreferred) return grandi.FourCC.UYVY
  if (format === 'uyva' && nativeUyvaPreferred) return grandi.FourCC.UYVA
  if (nativeRgbaActive()) return grandi.FourCC.RGBA
  return grandi.FourCC.BGRA
}

/**
 * @param {'rgba' | 'uyvy' | 'uyva'} format
 */
function formatLabel(format) {
  if (format === 'uyvy' && nativeUyvyPreferred) return 'UYVY'
  if (format === 'uyva' && nativeUyvaPreferred) return 'UYVA'
  return nativeRgbaActive() ? 'RGBA' : 'BGRA'
}

/**
 * @param {string} [reason]
 */
function noteBgraFallback(reason) {
  if (bgraFallbackNoted) return
  bgraFallbackNoted = true
  const suffix = reason ? ` (${reason})` : ''
  console.warn(NDI_BGRA_FALLBACK_NOTE + suffix)
}

function probeFourCCOnce() {
  if (fourCCProbed) return
  fourCCProbed = true
  try {
    const keys = Object.keys(grandi.FourCC || {})
    console.log('[output] NDI grandi.FourCC keys:', keys.join(', '))
    if (typeof grandi.FourCC?.RGBA !== 'number') {
      nativeRgbaPreferred = false
      noteBgraFallback('FourCC.RGBA missing')
    }
    if (typeof grandi.FourCC?.UYVY !== 'number') {
      nativeUyvyPreferred = false
      console.warn('[output] NDI send: FourCC.UYVY missing — 3D/2D stay RGBA')
    }
    if (typeof grandi.FourCC?.UYVA !== 'number') {
      nativeUyvaPreferred = false
      console.warn('[output] NDI send: FourCC.UYVA missing — AR stays RGBA')
    }
  } catch (err) {
    nativeRgbaPreferred = false
    noteBgraFallback(err instanceof Error ? err.message : String(err))
  }
}

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

function emptySendState() {
  return {
    busy: false,
    pool: /** @type {Buffer[]} */ ([]),
    poolBytes: 0,
    inFlightIndex: -1,
    pendingIndex: -1,
    pending: /** @type {PreparedFrame | null} */ (null),
  }
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
      sendGen: 0,
      ...emptySendState(),
    }
    channels.set(channelId, state)
  }
  return state
}

/**
 * @param {ChannelState} state
 */
function resetQueue(state) {
  state.busy = false
  state.inFlightIndex = -1
  state.pendingIndex = -1
  state.pending = null
  state.sendGen += 1
}

function ensureInitialized() {
  if (sdkInitialized) return
  probeFourCCOnce()
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
 * Fallback only — not on the native-RGBA hot path.
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
function ensurePool(state, bytes) {
  if (state.pool.length === POOL_SIZE && state.poolBytes >= bytes) return
  if (state.busy && state.pool.length === POOL_SIZE) return
  state.pool = []
  for (let i = 0; i < POOL_SIZE; i++) {
    state.pool.push(Buffer.allocUnsafe(bytes))
  }
  state.poolBytes = bytes
  if (state.inFlightIndex >= POOL_SIZE) state.inFlightIndex = -1
  if (state.pendingIndex >= POOL_SIZE) {
    state.pendingIndex = -1
    state.pending = null
  }
}

/**
 * Pick a slot that is not the in-flight send. Reuses the pending slot so a
 * keep-newest replace never grows the pool.
 * @param {ChannelState} state
 * @param {number} bytes
 */
function takeSlot(state, bytes) {
  ensurePool(state, bytes)
  for (let i = 0; i < POOL_SIZE; i++) {
    if (i !== state.inFlightIndex && i !== state.pendingIndex) return i
  }
  if (state.pendingIndex >= 0) return state.pendingIndex
  for (let i = 0; i < POOL_SIZE; i++) {
    if (i !== state.inFlightIndex) return i
  }
  return 0
}

/**
 * grandi validateVideoFrameBuffer rejects line_stride_in_bytes < 0
 * ("lineStrideBytes must be >= 0."). Do not flip here — that belongs on
 * the renderer capture pass, not a second full-frame CPU walk.
 * @param {ChannelState} state
 * @param {NdiChannelId} id
 * @param {Buffer} rgba
 * @param {number} width
 * @param {number} height
 * @param {boolean} bottomUp
 * @returns {PreparedFrame}
 */
function fillSlot(state, id, rgba, width, height, bottomUp, pixelFormat) {
  const format = resolvePixelFormat(pixelFormat, rgba.length, width, height)
  const bytes = pixelBytes(format, width, height)
  const poolIndex = takeSlot(state, bytes)
  const out = state.pool[poolIndex]
  const useRgba = format === 'rgba' && nativeRgbaActive()
  const tCopy = performance.now()
  if (format === 'uyvy' || format === 'uyva' || useRgba) {
    rgba.copy(out, 0, 0, bytes)
  } else {
    const tBgra = performance.now()
    rgbaToBgra(rgba, width, height, bottomUp, out)
    addPerf(perfByChannel[id].rgbaToBgra, performance.now() - tBgra)
  }
  const copyMs = performance.now() - tCopy
  // #region agent log
  const stampKey = `__ndiCopyLogAt_${id}`
  const now = Date.now()
  if (!global[stampKey] || now - global[stampKey] > 1000) {
    global[stampKey] = now
    try {
      fs.appendFileSync(
        path.join(__dirname, '..', 'debug-173fbb.log'),
        `${JSON.stringify({
          sessionId: '173fbb',
          runId: 'post-fix',
          hypothesisId: 'H8',
          location: 'desktop/ndiSender.cjs:fillSlot',
          message: 'main pool copy',
          data: { channel: id, width, height, bytes, copyMs, useRgba, pixelFormat: format },
          timestamp: now,
        })}\n`,
      )
    } catch {
      /* ignore */
    }
  }
  // #endregion
  return {
    poolIndex,
    width,
    height,
    bytes,
    useRgba,
    pixelFormat: format,
    lineStride: format === 'rgba' ? width * 4 : width * 2,
    fourCC: fourCCFor(format),
  }
}

/**
 * @param {unknown} err
 */
function isFourCCFailure(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return /fourcc/i.test(msg)
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
    resetQueue(state)
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
    // #region agent log
    try {
      fs.appendFileSync(
        path.join(__dirname, '..', 'debug-173fbb.log'),
        `${JSON.stringify({
          sessionId: '173fbb',
          runId: 'post-fix',
          hypothesisId: 'H8',
          location: 'desktop/ndiSender.cjs:start',
          message: 'NDI sender started',
          data: { channel: id, clockVideo: true, sourceName },
          timestamp: Date.now(),
        })}\n`,
      )
    } catch {
      /* ignore */
    }
    // #endregion
    const full = state.sender.sourcename()
    state.name = full
    return {
      ok: true,
      channel: id,
      sourceName: full,
      sdkVersion,
      fourCC: 'UYVY/UYVA',
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
  resetQueue(state)
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
 * @param {ChannelState} state
 * @param {NdiChannelId} id
 * @param {PreparedFrame} prepared
 */
function pumpSend(state, id, prepared) {
  const sender = state.sender
  if (!sender) {
    state.busy = false
    state.inFlightIndex = -1
    return
  }
  const gen = state.sendGen
  state.busy = true
  state.inFlightIndex = prepared.poolIndex
  state.pendingIndex = -1
  state.pending = null
  const data = state.pool[prepared.poolIndex].subarray(0, prepared.bytes)
  const fourCC = prepared.fourCC ?? fourCCFor(prepared.pixelFormat || 'rgba')
  const tVideo = performance.now()
  void sender
    .video({
      xres: prepared.width,
      yres: prepared.height,
      frameRateN: FRAME_RATE_N,
      frameRateD: FRAME_RATE_D,
      fourCC,
      pictureAspectRatio: prepared.width / prepared.height,
      frameFormatType: grandi.FrameType.Progressive,
      lineStrideBytes: prepared.lineStride ?? prepared.width * 2,
      data,
    })
    .catch((err) => {
      state.lastError = err instanceof Error ? err.message : String(err)
      if (prepared.useRgba && isFourCCFailure(err)) {
        nativeRgbaDisabled = true
        noteBgraFallback(state.lastError)
      }
    })
    .finally(() => {
      const videoMs = performance.now() - tVideo
      addPerf(perfByChannel[id].video, videoMs)
      // #region agent log
      const stampKey = `__ndiVideoLogAt_${id}`
      const now = Date.now()
      if (!global[stampKey] || now - global[stampKey] > 1000) {
        global[stampKey] = now
        try {
          fs.appendFileSync(
            path.join(__dirname, '..', 'debug-173fbb.log'),
            `${JSON.stringify({
              sessionId: '173fbb',
              runId: 'post-fix',
              hypothesisId: 'H8',
              location: 'desktop/ndiSender.cjs:pumpSend',
              message: 'grandi.video done',
              data: {
                channel: id,
                width: prepared.width,
                height: prepared.height,
                bytes: prepared.bytes,
                videoMs,
                clockVideo: true,
                hadPending: !!state.pending,
              },
              timestamp: now,
            })}\n`,
          )
        } catch {
          /* ignore */
        }
      }
      // #endregion
      if (state.sendGen !== gen) return
      state.busy = false
      state.inFlightIndex = -1
      const next = state.pending
      if (next && state.sender) {
        pumpSend(state, id, next)
      }
    })
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
  if (!state?.sender) return { ok: false, dropped: true, channel: id }
  const width = frame.width | 0
  const height = frame.height | 0
  if (width < 1 || height < 1 || !frame.data) {
    return { ok: false, error: 'invalid frame', channel: id }
  }
  const rgba =
    frame.data instanceof ArrayBuffer
      ? Buffer.from(frame.data)
      : Buffer.from(
          frame.data.buffer,
          frame.data.byteOffset,
          frame.data.byteLength,
        )
  const pixelFormat = resolvePixelFormat(
    frame.pixelFormat,
    rgba.length,
    width,
    height,
  )
  const bytes = pixelBytes(pixelFormat, width, height)
  if (rgba.length < bytes) {
    return { ok: false, error: 'frame buffer too small', channel: id }
  }

  const bottomUp = frame.bottomUp !== false
  // #region agent log
  if (width >= 640) {
    const now = Date.now()
    const stampKey = `__ndiLiveLogAt_${id}`
    if (!global[stampKey] || now - global[stampKey] > 1000) {
      global[stampKey] = now
      try {
        const line = `${JSON.stringify({
          sessionId: '173fbb',
          runId: 'post-fix',
          hypothesisId: 'H4',
          location: 'desktop/ndiSender.cjs:sendFrame',
          message: 'live NDI send',
          data: {
            channel: id,
            width,
            height,
            bytes: rgba.length,
            bottomUp,
            useRgba: nativeRgbaActive(),
            pixelFormat,
            busy: !!state.busy,
          },
          timestamp: now,
        })}\n`
        const os = require('node:os')
        const paths = [
          path.join(__dirname, '..', 'debug-173fbb.log'),
          path.join(__dirname, '..', '.cursor', 'debug-173fbb.log'),
          path.join(os.tmpdir(), 'debug-173fbb.log'),
        ]
        for (const p of paths) {
          try {
            fs.appendFileSync(p, line)
          } catch {
            /* try next */
          }
        }
        console.error('[debug-173fbb]', id, width, height, 'bottomUp=', bottomUp, 'rgba=', nativeRgbaActive())
      } catch {
        /* ignore */
      }
    }
  }
  // #endregion
  try {
    if (state.busy) {
      if (state.pending) {
        const perf = perfByChannel[id]
        if (perf) perf.dropBusy += 1
      }
      state.pending = fillSlot(state, id, rgba, width, height, bottomUp, pixelFormat)
      state.pendingIndex = state.pending.poolIndex
      return { ok: true, queued: true, channel: id }
    }
    const prepared = fillSlot(state, id, rgba, width, height, bottomUp, pixelFormat)
    pumpSend(state, id, prepared)
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
    fourCC: 'UYVY/UYVA',
    bgraFallback: bgraFallbackNoted,
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

/**
 * 1 Hz main-process stage snapshot. Resets accumulators so the next
 * window is fresh. Call from the 1 Hz IPC push only.
 */
function rotatePerf() {
  /** @type {Record<string, { rgbaToBgra: ReturnType<typeof snapPerf>, video: ReturnType<typeof snapPerf>, dropBusy: number }>} */
  const channelsOut = {}
  for (const id of CHANNEL_IDS) {
    const p = perfByChannel[id]
    channelsOut[id] = {
      rgbaToBgra: snapPerf(p.rgbaToBgra),
      video: snapPerf(p.video),
      dropBusy: p.dropBusy,
    }
    p.rgbaToBgra = emptyPerfAcc()
    p.video = emptyPerfAcc()
    p.dropBusy = 0
  }
  lastPerfSummary = {
    channels: channelsOut,
    nativeRgba: nativeRgbaActive(),
    bgraFallback: bgraFallbackNoted,
  }
  return lastSummarySafe()
}

function lastSummarySafe() {
  return lastPerfSummary
}

function emptyChannelSnap() {
  return {
    rgbaToBgra: { count: 0, sumMs: 0, maxMs: 0, meanMs: 0 },
    video: { count: 0, sumMs: 0, maxMs: 0, meanMs: 0 },
    dropBusy: 0,
  }
}

/** Last 1 s window (does not reset). */
function getPerfSummary() {
  return lastSummarySafe()
}

/** @type {{ channels: Record<string, ReturnType<typeof emptyChannelSnap>>, nativeRgba: boolean, bgraFallback: boolean }} */
let lastPerfSummary = {
  channels: {
    ar: emptyChannelSnap(),
    '3d': emptyChannelSnap(),
    '2d': emptyChannelSnap(),
  },
  nativeRgba: nativeRgbaActive(),
  bgraFallback: false,
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
  NDI_BGRA_FALLBACK_NOTE,
  FRAME_RATE_N,
  FRAME_RATE_D,
  normalizeChannel,
  start,
  stop,
  sendFrame,
  getStatus,
  getStatusAll,
  getPerfSummary,
  rotatePerf,
  shutdown,
}
