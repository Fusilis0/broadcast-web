/**
 * Capture a plate BrowserWindow's compositor (the page / WebGL), not the
 * screen pixels under that HWND. Desktop duplication of a rectangle will
 * show whatever is on top (ops HUD). GDI title grab of Chromium WebGL is
 * often black. capturePage / paint read Chromium's own buffer.
 *
 * HiDPI: NativeImage.getSize() can be 1920×1080 while toBitmap() is 2K.
 * Cropping that buffer to 1080p looks like a zoomed 2K crop. Always infer
 * size from byte length, then scale — never subarray a larger stride.
 *
 * Do not import grandi / ndiUyvy.
 */

const {
  SRT_OUT_WIDTH,
  SRT_OUT_HEIGHT,
  SRT_OUT_FPS,
  srtOutRawFrameBytes,
} = require('./srtPublisherHelpers.cjs')

/**
 * @param {Buffer | Uint8Array} buf
 * @param {{ width?: number, height?: number, scaleFactor?: number } | null} [reported]
 * @returns {{ width: number, height: number } | null}
 */
function inferBgraSize(buf, reported) {
  if (!buf || buf.length < 16 || buf.length % 4 !== 0) return null
  const pixels = buf.length / 4
  const rw = Math.round(Number(reported && reported.width) || 0)
  const rh = Math.round(Number(reported && reported.height) || 0)
  const dpr = Number(reported && reported.scaleFactor) || 0
  if (rw > 0 && rh > 0 && rw * rh === pixels) return { width: rw, height: rh }
  if (dpr > 0 && rw > 0 && rh > 0) {
    const width = Math.round(rw * dpr)
    const height = Math.round(rh * dpr)
    if (width * height === pixels) return { width, height }
  }
  if (rw > 0 && rh > 0 && rw * rh > 0) {
    const scale = Math.sqrt(pixels / (rw * rh))
    const width = Math.round(rw * scale)
    const height = Math.round(rh * scale)
    if (width * height === pixels) return { width, height }
  }
  // 16:9 family (1080p × 1.25 / 1.5 / 2K / 4K) even when getSize() lied.
  const k = Math.round(Math.sqrt(pixels / 144))
  if (k > 0 && 16 * k * 9 * k === pixels) {
    return { width: 16 * k, height: 9 * k }
  }
  if (rw > 0 && pixels % rw === 0) return { width: rw, height: pixels / rw }
  if (rh > 0 && pixels % rh === 0) return { width: pixels / rh, height: rh }
  return null
}

/**
 * @param {Buffer} src
 * @param {number} srcW
 * @param {number} srcH
 * @param {number} dstW
 * @param {number} dstH
 * @returns {Buffer}
 */
function scaleBgraNearest(src, srcW, srcH, dstW, dstH) {
  const expect = srtOutRawFrameBytes(dstW, dstH)
  if (srcW === dstW && srcH === dstH && src.length >= expect) {
    return src.length === expect ? src : src.subarray(0, expect)
  }
  const dst = Buffer.alloc(expect)
  if (srcW < 1 || srcH < 1) return dst
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH))
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW))
      const si = (sy * srcW + sx) * 4
      const di = (y * dstW + x) * 4
      dst[di] = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = src[si + 3]
    }
  }
  return dst
}

/**
 * @param {import('electron').NativeImage | null | undefined} image
 * @param {number} [width]
 * @param {number} [height]
 * @returns {Buffer | null}
 */
function nativeImageToSrtBgra(image, width = SRT_OUT_WIDTH, height = SRT_OUT_HEIGHT) {
  if (!image || (typeof image.isEmpty === 'function' && image.isEmpty())) {
    return null
  }
  if (typeof image.toBitmap !== 'function') {
    return null
  }
  const expect = srtOutRawFrameBytes(width, height)
  const reported =
    typeof image.getSize === 'function' ? image.getSize() || { width: 0, height: 0 } : {}
  const scaleFactor =
    typeof image.getScaleFactor === 'function' ? Number(image.getScaleFactor()) : 0
  // Never NativeImage.resize/crop: on HiDPI that copies the top-left 1080 of a
  // 2K bitmap (AR Fail). Always read the full buffer and scale.
  const buf = image.toBitmap()
  const inferred = inferBgraSize(buf, {
    width: reported.width,
    height: reported.height,
    scaleFactor,
  })
  if (!inferred) return null
  if (inferred.width === width && inferred.height === height && buf.length === expect) {
    return buf
  }
  if (inferred.width === width && inferred.height === height && buf.length > expect) {
    const fromBytes = inferBgraSize(buf, null)
    if (!fromBytes || (fromBytes.width === width && fromBytes.height === height)) {
      return null
    }
    return scaleBgraNearest(buf, fromBytes.width, fromBytes.height, width, height)
  }
  return scaleBgraNearest(buf, inferred.width, inferred.height, width, height)
}

/**
 * Node's default pipe highWaterMark is 16 KB. One 1080p BGRA frame is 8.3 MB,
 * so stdin.write(frame) always NAKs and we stall on drain (~5–14 fps).
 * Allow two frames so the encoder can pipeline.
 *
 * @param {import('node:stream').Writable} stdin
 * @param {number} [bytes]
 * @returns {number}
 */
function raiseSrtStdinHighWaterMark(stdin, bytes) {
  const want = Math.max(
    srtOutRawFrameBytes() * 2,
    Math.round(Number(bytes) || 0),
  )
  const state = stdin && stdin._writableState
  if (!state || typeof state.highWaterMark !== 'number') return 0
  if (state.highWaterMark < want) state.highWaterMark = want
  return state.highWaterMark
}

/**
 * ffmpeg closing stdin (encoder fail, SRT handshake, stop) completes in-flight
 * writes with `write EOF` / EPIPE. No listener → Electron main Uncaught Exception.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
function isSrtStdinPipeClosedError(err) {
  if (!err) return false
  const code =
    typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
  const msg = err instanceof Error ? err.message : String(err)
  return (
    code === 'EPIPE' ||
    code === 'EOF' ||
    code === 'ECONNRESET' ||
    /write EOF|EPIPE|broken pipe/i.test(msg)
  )
}

/**
 * @param {import('node:stream').Writable} stdin
 * @param {() => void} [onClosed]
 * @returns {() => void}
 */
function swallowSrtStdinPipeErrors(stdin, onClosed) {
  if (!stdin || typeof stdin.on !== 'function') return () => {}
  const onError = (err) => {
    if (typeof onClosed === 'function') onClosed()
    if (!isSrtStdinPipeClosedError(err)) {
      console.warn(
        '[srt-cap] stdin',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
  stdin.on('error', onError)
  return () => {
    stdin.off?.('error', onError)
  }
}

function srtCapLogEnabled() {
  return ['1', 'true', 'yes'].includes(
    (process.env.BW_SRT_MEASURE || '').trim().toLowerCase(),
  )
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {import('node:stream').Writable} stdin
 * @param {{ width?: number, height?: number, fps?: number, channel?: string }} [opts]
 * @returns {() => void}
 */
function attachSrtPlateBitmapInput(win, stdin, opts = {}) {
  const width = opts.width || SRT_OUT_WIDTH
  const height = opts.height || SRT_OUT_HEIGHT
  const fps = Math.max(1, Number(opts.fps) || SRT_OUT_FPS)
  const channel = typeof opts.channel === 'string' && opts.channel ? opts.channel : '?'
  const minDtMs = Math.round(1000 / fps)
  let stopped = false
  let waitingDrain = false
  let lastWriteMs = 0
  let subscribed = false
  let paints = 0
  let subs = 0
  let writes = 0
  let rateSkips = 0
  let drainSkips = 0
  let convertMsSum = 0
  let convertN = 0
  let lastSize = ''
  let windowStart = Date.now()

  raiseSrtStdinHighWaterMark(stdin, srtOutRawFrameBytes(width, height) * 2)

  const onDrain = () => {
    waitingDrain = false
  }
  stdin.on?.('drain', onDrain)

  const unlistenStdinError = swallowSrtStdinPipeErrors(stdin, () => {
    waitingDrain = true
    stopped = true
  })

  const flushStats = () => {
    const now = Date.now()
    const dt = (now - windowStart) / 1000
    if (dt < 1) return
    if (!srtCapLogEnabled()) {
      paints = 0
      subs = 0
      writes = 0
      rateSkips = 0
      drainSkips = 0
      convertMsSum = 0
      convertN = 0
      windowStart = now
      return
    }
    const convert =
      convertN > 0 ? (convertMsSum / convertN).toFixed(1) : '—'
    console.info(
      `[srt-cap] ${channel} paint/s=${(paints / dt).toFixed(1)} sub/s=${(subs / dt).toFixed(1)} write/s=${(writes / dt).toFixed(1)} rateSkip/s=${(rateSkips / dt).toFixed(1)} drainSkip/s=${(drainSkips / dt).toFixed(1)} convertMs=${convert} size=${lastSize || '—'}`,
    )
    paints = 0
    subs = 0
    writes = 0
    rateSkips = 0
    drainSkips = 0
    convertMsSum = 0
    convertN = 0
    windowStart = now
  }

  const writeFrame = (image) => {
    if (
      stopped ||
      !stdin ||
      stdin.writable === false ||
      stdin.destroyed === true ||
      stdin.writableEnded === true
    ) {
      return
    }
    if (waitingDrain) {
      drainSkips += 1
      return
    }
    const now = Date.now()
    // setFrameRate(fps) is the clock. A 33 ms gate skips jittered 30 Hz
    // paints and lands ~20 writes/s. Only drop true duplicates.
    if (now - lastWriteMs < 8) {
      rateSkips += 1
      return
    }
    const t0 = now
    const buf = nativeImageToSrtBgra(image, width, height)
    const t1 = Date.now()
    if (!buf) return
    convertMsSum += t1 - t0
    convertN += 1
    lastSize = `${buf.length}`
    const reported =
      image && typeof image.getSize === 'function' ? image.getSize() : null
    if (reported && reported.width && reported.height) {
      lastSize = `${reported.width}x${reported.height}->${width}x${height} bytes=${buf.length}`
    }
    lastWriteMs = t1
    writes += 1
    let ok = true
    try {
      ok = stdin.write(buf, (err) => {
        if (!err) return
        waitingDrain = true
        stopped = true
      })
    } catch {
      waitingDrain = true
      stopped = true
      return
    }
    if (ok === false) waitingDrain = true
    flushStats()
  }

  try {
    win.webContents.setFrameRate(fps)
  } catch {
    /* on-screen windows may ignore setFrameRate */
  }
  try {
    win.webContents.setBackgroundThrottling(false)
  } catch {
    /* ignore */
  }

  const onPaint = (_evt, _dirty, image) => {
    paints += 1
    writeFrame(image)
  }
  win.webContents.on('paint', onPaint)

  // Offscreen plates fire `paint`. Dual beginFrameSubscription copies the
  // same 8 MB bitmap again and fights the stdin watermark. Subscribe only
  // if paint never arrives; capturePage is last resort.
  let fallbackTimer = setTimeout(() => {
    if (stopped || paints > 0) return
    try {
      win.webContents.beginFrameSubscription(false, (image) => {
        subs += 1
        writeFrame(image)
      })
      subscribed = true
    } catch {
      subscribed = false
    }
    if (!subscribed) {
      fallbackTimer = setInterval(() => {
        if (stopped || waitingDrain) return
        if (!win || win.isDestroyed()) return
        void win.webContents.capturePage().then(writeFrame).catch(() => {})
      }, minDtMs)
      fallbackTimer.unref?.()
    }
  }, 750)
  fallbackTimer.unref?.()

  return () => {
    stopped = true
    if (fallbackTimer) clearTimeout(fallbackTimer)
    if (fallbackTimer) clearInterval(fallbackTimer)
    stdin.off?.('drain', onDrain)
    unlistenStdinError()
    try {
      win.webContents.off('paint', onPaint)
    } catch {
      /* ignore */
    }
    if (subscribed) {
      try {
        win.webContents.endFrameSubscription()
      } catch {
        /* ignore */
      }
    }
    try {
      if (stdin.writable !== false && stdin.destroyed !== true) stdin.end?.()
    } catch {
      /* already closed */
    }
  }
}

module.exports = {
  inferBgraSize,
  scaleBgraNearest,
  nativeImageToSrtBgra,
  raiseSrtStdinHighWaterMark,
  isSrtStdinPipeClosedError,
  swallowSrtStdinPipeErrors,
  attachSrtPlateBitmapInput,
}
