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
 * @param {{ width?: number, height?: number } | null} [reported]
 * @returns {{ width: number, height: number } | null}
 */
function inferBgraSize(buf, reported) {
  if (!buf || buf.length < 16 || buf.length % 4 !== 0) return null
  const pixels = buf.length / 4
  const rw = Math.round(Number(reported && reported.width) || 0)
  const rh = Math.round(Number(reported && reported.height) || 0)
  if (rw > 0 && rh > 0 && rw * rh === pixels) return { width: rw, height: rh }
  if (rw > 0 && rh > 0 && rw * rh > 0) {
    const scale = Math.sqrt(pixels / (rw * rh))
    const width = Math.round(rw * scale)
    const height = Math.round(rh * scale)
    if (width * height === pixels) return { width, height }
  }
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
  if (typeof image.getSize !== 'function' || typeof image.toBitmap !== 'function') {
    return null
  }
  const expect = srtOutRawFrameBytes(width, height)
  const reported = image.getSize() || { width: 0, height: 0 }
  let work = image
  if (
    (reported.width !== width || reported.height !== height) &&
    typeof image.resize === 'function'
  ) {
    work = image.resize({ width, height, quality: 'good' })
  }
  const buf = work.toBitmap()
  const inferred = inferBgraSize(buf, work.getSize ? work.getSize() : reported)
  if (!inferred) return null
  if (inferred.width === width && inferred.height === height && buf.length >= expect) {
    return buf.length === expect ? buf : buf.subarray(0, expect)
  }
  return scaleBgraNearest(buf, inferred.width, inferred.height, width, height)
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {import('node:stream').Writable} stdin
 * @param {{ width?: number, height?: number, fps?: number }} [opts]
 * @returns {() => void}
 */
function attachSrtPlateBitmapInput(win, stdin, opts = {}) {
  const width = opts.width || SRT_OUT_WIDTH
  const height = opts.height || SRT_OUT_HEIGHT
  const fps = Math.max(1, Number(opts.fps) || SRT_OUT_FPS)
  const minDtMs = Math.round(1000 / fps)
  let stopped = false
  let waitingDrain = false
  let lastWriteMs = 0
  let subscribed = false

  const onDrain = () => {
    waitingDrain = false
  }
  stdin.on?.('drain', onDrain)

  const writeFrame = (image) => {
    if (stopped || !stdin || stdin.writable === false || waitingDrain) return
    const now = Date.now()
    if (now - lastWriteMs < minDtMs - 2) return
    const buf = nativeImageToSrtBgra(image, width, height)
    if (!buf) return
    lastWriteMs = now
    const ok = stdin.write(buf)
    if (ok === false) waitingDrain = true
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
    writeFrame(image)
  }
  win.webContents.on('paint', onPaint)

  try {
    win.webContents.beginFrameSubscription(false, (image) => {
      writeFrame(image)
    })
    subscribed = true
  } catch {
    subscribed = false
  }

  let fallbackTimer = null
  if (!subscribed) {
    fallbackTimer = setInterval(() => {
      if (stopped || waitingDrain) return
      if (!win || win.isDestroyed()) return
      void win.webContents.capturePage().then(writeFrame).catch(() => {})
    }, minDtMs)
    fallbackTimer.unref?.()
  }

  return () => {
    stopped = true
    if (fallbackTimer) clearInterval(fallbackTimer)
    stdin.off?.('drain', onDrain)
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
      stdin.end?.()
    } catch {
      /* already closed */
    }
  }
}

module.exports = {
  inferBgraSize,
  scaleBgraNearest,
  nativeImageToSrtBgra,
  attachSrtPlateBitmapInput,
}
