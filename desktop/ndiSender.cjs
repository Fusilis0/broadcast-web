/**
 * Main-process NDI sender (grandi / NDI SDK 6).
 * Receives RGBA frames from the renderer, converts to top-down BGRA, sends.
 */
const grandi = require('grandi')

const DEFAULT_NAME = 'broadcast-web'
const FRAME_RATE_N = 30
const FRAME_RATE_D = 1

/** @type {import('grandi').Sender | null} */
let sender = null
let sdkVersion = null
let lastError = null
let busy = false
/** @type {Buffer | null} */
let bgraScratch = null
let scratchBytes = 0

function ensureInitialized() {
  if (!grandi.isSupportedCPU()) {
    throw new Error('CPU does not support NDI')
  }
  if (!grandi.initialize()) {
    throw new Error('grandi.initialize() failed')
  }
  sdkVersion = grandi.version()
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

function ensureScratch(bytes) {
  if (!bgraScratch || scratchBytes < bytes) {
    bgraScratch = Buffer.allocUnsafe(bytes)
    scratchBytes = bytes
  }
  return bgraScratch
}

async function start(name) {
  lastError = null
  const sourceName = (name && String(name).trim()) || DEFAULT_NAME
  try {
    ensureInitialized()
    if (sender) {
      await sender.destroy().catch(() => {})
      sender = null
    }
    sender = await grandi.send({
      name: sourceName,
      clockVideo: true,
      clockAudio: false,
    })
    const full = sender.sourcename()
    return {
      ok: true,
      sourceName: full,
      sdkVersion,
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    sender = null
    return { ok: false, error: lastError, sdkVersion }
  }
}

async function stop() {
  busy = false
  if (sender) {
    try {
      await sender.destroy()
    } catch {
      /* ignore */
    }
    sender = null
  }
}

/**
 * @param {{ width: number, height: number, data: ArrayBuffer|Buffer|Uint8Array, bottomUp?: boolean }} frame
 */
function sendFrame(frame) {
  if (!sender || busy) return { ok: false, dropped: true }
  const width = frame.width | 0
  const height = frame.height | 0
  if (width < 1 || height < 1 || !frame.data) {
    return { ok: false, error: 'invalid frame' }
  }
  const bytes = width * height * 4
  const rgba =
    frame.data instanceof ArrayBuffer
      ? Buffer.from(frame.data)
      : Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength)
  if (rgba.length < bytes) {
    return { ok: false, error: 'frame buffer too small' }
  }

  busy = true
  try {
    const out = ensureScratch(bytes)
    rgbaToBgra(rgba, width, height, frame.bottomUp !== false, out)
    // Slice exact size — scratch may be larger after a resize.
    const data = out.subarray(0, bytes)
    // Fire-and-forget; drop later frames while this awaits.
    void sender
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
        lastError = err instanceof Error ? err.message : String(err)
      })
      .finally(() => {
        busy = false
      })
    return { ok: true }
  } catch (err) {
    busy = false
    lastError = err instanceof Error ? err.message : String(err)
    return { ok: false, error: lastError }
  }
}

function getStatus() {
  return {
    active: sender !== null,
    sourceName: sender ? sender.sourcename() : null,
    sdkVersion,
    error: lastError,
  }
}

function shutdown() {
  void stop().finally(() => {
    try {
      grandi.destroy()
    } catch {
      /* ignore */
    }
  })
}

module.exports = {
  DEFAULT_NAME,
  start,
  stop,
  sendFrame,
  getStatus,
  shutdown,
}
