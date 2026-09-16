/**
 * Main-process SRT *publish* — one ffmpeg child per AR / 3D / 2D channel.
 *
 * Input is BGRA compositor frames from the plate BrowserWindow (capturePage),
 * piped into ffmpeg stdin. Not DXGI screen copy. Not NDI/grandi pack.
 * Output is an SRT caller. Do not spawn ingest readers.
 */

const { spawn, spawnSync } = require('node:child_process')
const srtReader = require('./srtReader.cjs')
const {
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
  parseFfmpegFrame,
  instantFpsFromFrames,
  idleSrtOutStatus,
  normalizeSrtOutStatus,
  fitSrtPlateInWorkArea,
  pickSrtPlateDisplay,
  isPipeGrab,
  formatSrtPublishListenerError,
  isSrtPublishListenerMissing,
} = require('./srtPublisherHelpers.cjs')

const LIBX264_NOTE =
  'encoder is libx264 (CPU) — last resort; AMF/NVENC missing. FPS may miss 30×3.'

/**
 * @param {number} pid
 * @param {(cmd: string, args: string[], opts?: object) => import('node:child_process').ChildProcess} spawnImpl
 */
function killProcessTree(pid, spawnImpl) {
  if (!pid || pid <= 0) return
  if (process.platform === 'win32') {
    const killer = spawnImpl('taskkill', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    killer.unref?.()
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    /* already dead */
  }
  setTimeout(() => {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already dead */
    }
  }, 400).unref?.()
}

/**
 * @param {{
 *   spawn?: typeof spawn,
 *   spawnSync?: typeof spawnSync,
 *   resolveFfmpegPath?: () => string,
 *   listEncoders?: (ffmpegPath: string) => string,
   *   ensureWindow?: (channel: 'ar' | '3d' | '2d') => Promise<object | void>,
 *   closeWindow?: (channel: 'ar' | '3d' | '2d') => void,
 *   onStatus?: (status: ReturnType<typeof idleSrtOutStatus>) => void,
 *   now?: () => number,
 * }} [deps]
 */
function createSrtPublisher(deps = {}) {
  const spawnImpl = deps.spawn || spawn
  const spawnSyncImpl = deps.spawnSync || spawnSync
  const resolveFfmpegPath =
    deps.resolveFfmpegPath || (() => srtReader.resolveFfmpegPath())
  const ensureWindow = deps.ensureWindow || (async () => {})
  const closeWindow = deps.closeWindow || (() => {})
  const onStatus = deps.onStatus || (() => {})

  /** @type {Map<string, any>} */
  const sessions = new Map()
  /** @type {'h264_amf' | 'h264_nvenc' | 'libx264' | null} */
  let cachedEncoder = null

  function listEncoders(ffmpegPath) {
    if (typeof deps.listEncoders === 'function') {
      return deps.listEncoders(ffmpegPath)
    }
    try {
      const result = spawnSyncImpl(
        ffmpegPath,
        ['-hide_banner', '-encoders'],
        {
          encoding: 'utf8',
          timeout: 8000,
          windowsHide: true,
        },
      )
      return `${result.stdout || ''}\n${result.stderr || ''}`
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }

  function resolveEncoder(ffmpegPath) {
    if (cachedEncoder) return cachedEncoder
    const picked = pickPublishEncoder(listEncoders(ffmpegPath))
    cachedEncoder = picked || 'libx264'
    return cachedEncoder
  }

  function fallbackNoteFor(encoder) {
    return encoder === 'libx264' ? LIBX264_NOTE : null
  }

  /**
   * @param {'ar' | '3d' | '2d'} channel
   */
  function statusOf(channel) {
    const session = sessions.get(channel)
    if (!session) return idleSrtOutStatus(channel)
    return normalizeSrtOutStatus(session, channel)
  }

  /**
   * @param {'ar' | '3d' | '2d'} channel
   * @param {Partial<ReturnType<typeof idleSrtOutStatus>>} patch
   */
  function emit(channel, patch) {
    const session = sessions.get(channel)
    if (!session) return
    Object.assign(session, patch)
    const payload = normalizeSrtOutStatus(session, channel)
    onStatus(payload)
  }

  /**
   * @param {'ar' | '3d' | '2d'} channel
   */
  function killChild(channel) {
    const session = sessions.get(channel)
    if (!session) return
    if (session.retryTimer) {
      clearTimeout(session.retryTimer)
      session.retryTimer = null
    }
    if (session.liveTimer) {
      clearTimeout(session.liveTimer)
      session.liveTimer = null
    }
    if (typeof session.detachInput === 'function') {
      try {
        session.detachInput()
      } catch {
        /* ignore */
      }
      session.detachInput = null
    }
    const child = session.child
    const pid = session.childPid || child?.pid || null
    session.child = null
    session.childPid = null
    if (child && !child.killed) {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
    }
    if (pid) killProcessTree(pid, spawnImpl)
  }

  /**
   * @param {'ar' | '3d' | '2d'} channel
   * @param {string} url
   * @param {number} generation
   */
  async function spawnChannel(channel, url, generation) {
    const session = sessions.get(channel)
    if (!session || session.generation !== generation || session.closing) return

    const ffmpegPath = resolveFfmpegPath()
    const encoder = resolveEncoder(ffmpegPath)
    session.encoder = encoder
    session.fallbackNote = fallbackNoteFor(encoder)
    emit(channel, {
      state: 'connecting',
      encoder,
      fallbackNote: session.fallbackNote,
      lastError: null,
      encoderFps: null,
    })

    let grab = null
    try {
      grab = await ensureWindow(channel)
    } catch (err) {
      if (!sessions.get(channel) || sessions.get(channel).generation !== generation) {
        return
      }
      emit(channel, {
        state: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      })
      return
    }
    if (!sessions.get(channel) || sessions.get(channel).generation !== generation) {
      return
    }

    const title = SRT_OUT_TITLES[channel]
    const argv = buildSrtPublishArgv({
      title,
      url,
      encoder,
      grab: grab && typeof grab === 'object' ? grab : undefined,
    })
    const usePipe = isPipeGrab(grab)
    let child
    try {
      child = spawnImpl(ffmpegPath, argv, {
        windowsHide: true,
        stdio: [usePipe ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      })
    } catch (err) {
      emit(channel, {
        state: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      })
      return
    }

    session.child = child
    session.childPid = child.pid || null
    session.stderrTail = ''
    session.detachInput = null
    if (child.stdin && typeof child.stdin.on === 'function') {
      child.stdin.on('error', (err) => {
        const cur = sessions.get(channel)
        if (!cur || cur.generation !== generation) return
        if (typeof cur.detachInput === 'function') {
          try {
            cur.detachInput()
          } catch {
            /* ignore */
          }
          cur.detachInput = null
        }
        const msg = err instanceof Error ? err.message : String(err)
        const code = err && typeof err === 'object' ? err.code : ''
        if (
          code === 'EPIPE' ||
          code === 'EOF' ||
          /write EOF|EPIPE|broken pipe/i.test(msg)
        ) {
          return
        }
        if (!cur.closing && cur.state !== 'error') {
          emit(channel, { state: 'error', lastError: msg.slice(0, 300) })
        }
      })
    }
    if (usePipe && typeof grab.attach === 'function' && child.stdin) {
      try {
        session.detachInput = grab.attach(child.stdin)
      } catch (err) {
        emit(channel, {
          state: 'error',
          lastError: err instanceof Error ? err.message : String(err),
        })
        return
      }
    }
    if (session.liveTimer) {
      clearTimeout(session.liveTimer)
      session.liveTimer = null
    }
    session.liveTimer = setTimeout(() => {
      const cur = sessions.get(channel)
      if (!cur || cur.generation !== generation || cur.closing) return
      if (cur.state === 'connecting') {
        emit(channel, { state: 'live', lastError: null })
      }
    }, 2000)
    session.liveTimer.unref?.()

    const applyFps = (text) => {
      const cur = sessions.get(channel)
      if (!cur || cur.generation !== generation) return
      const now = Date.now()
      const frame = parseFfmpegFrame(text)
      let fps = null
      if (frame != null) {
        fps = instantFpsFromFrames(cur.prevFrame, cur.prevFrameAt, frame, now)
        cur.prevFrame = frame
        cur.prevFrameAt = now
      }
      if (fps == null) fps = parseFfmpegFps(text)
      if (fps == null) return
      cur.encoderFps = fps
      if (cur.state === 'connecting') {
        emit(channel, { state: 'live', encoderFps: fps, lastError: null })
      } else if (cur.state === 'live') {
        emit(channel, { encoderFps: fps })
      }
    }
    const onStderr = (buf) => {
      const cur = sessions.get(channel)
      if (!cur || cur.generation !== generation) return
      const text = buf.toString('utf8')
      cur.stderrTail = `${cur.stderrTail}${text}`.slice(-4000)
      applyFps(text)
      if (isSrtPublishListenerMissing(text)) {
        emit(channel, {
          lastError: formatSrtPublishListenerError(text, cur.url),
        })
        return
      }
      if (
        /Could not find window|Failed to capture|Unknown encoder|Error initializing|No such file|not recognized as an encoder|No such filter|ddagrab|timed out|Invalid argument/i.test(
          text,
        )
      ) {
        const line = text.trim().split(/\r?\n/).filter(Boolean).pop() || text.trim()
        emit(channel, { state: 'error', lastError: line.slice(0, 300) })
      }
    }
    child.stderr?.on('data', onStderr)
    child.stdout?.on('data', (buf) => applyFps(buf.toString('utf8')))

    child.once('exit', (code, signal) => {
      const cur = sessions.get(channel)
      if (!cur || cur.generation !== generation) return
      cur.child = null
      cur.childPid = null
      if (typeof cur.detachInput === 'function') {
        try {
          cur.detachInput()
        } catch {
          /* ignore */
        }
        cur.detachInput = null
      }
      if (cur.closing) return
      const detail =
        cur.lastError ||
        (cur.stderrTail.trim().split(/\r?\n/).filter(Boolean).pop() ||
          `ffmpeg exited (${code ?? signal ?? 'unknown'})`)
      const listenerMiss = isSrtPublishListenerMissing(String(detail))
      if (listenerMiss) {
        emit(channel, {
          state: 'connecting',
          lastError: formatSrtPublishListenerError(detail, cur.url),
          encoderFps: null,
        })
        if (cur.retryTimer) clearTimeout(cur.retryTimer)
        cur.retryTimer = setTimeout(() => {
          const next = sessions.get(channel)
          if (!next || next.generation !== generation || next.closing) return
          next.retryTimer = null
          void spawnChannel(channel, next.url, next.generation)
        }, 2000)
        cur.retryTimer.unref?.()
        return
      }
      emit(channel, {
        state: 'error',
        lastError: String(detail).slice(0, 300),
        encoderFps: null,
      })
    })

    child.once('error', (err) => {
      const cur = sessions.get(channel)
      if (!cur || cur.generation !== generation) return
      emit(channel, {
        state: 'error',
        lastError: err instanceof Error ? err.message : String(err),
      })
    })
  }

  /**
   * @param {{ channel?: unknown, url?: unknown }} [opts]
   */
  async function start(opts = {}) {
    const checked = validateSrtOutChannel(opts.channel)
    if (!checked.ok) return { ok: false, error: checked.error }
    const channel = checked.channel
    const rawUrl =
      typeof opts.url === 'string' && opts.url.trim()
        ? opts.url.trim()
        : SRT_OUT_DEFAULT_URLS[channel]
    const resolved = resolvePublishUrl(rawUrl)
    if (!resolved.ok) return { ok: false, error: resolved.error }

    stop(channel, { keepWindow: true })

    const session = {
      channel,
      state: 'connecting',
      encoder: null,
      encoderFps: null,
      url: resolved.href,
      lastError: null,
      fallbackNote: null,
      child: null,
      childPid: null,
      generation: Date.now(),
      closing: false,
      retryTimer: null,
      liveTimer: null,
      detachInput: null,
      stderrTail: '',
    }
    sessions.set(channel, session)
    onStatus(normalizeSrtOutStatus(session, channel))
    await spawnChannel(channel, resolved.href, session.generation)
    return { ok: true, channel }
  }

  /**
   * @param {unknown} channelOrOpts
   * @param {{ keepWindow?: boolean }} [opts]
   */
  function stop(channelOrOpts, opts = {}) {
    if (
      channelOrOpts === 'all' ||
      (channelOrOpts &&
        typeof channelOrOpts === 'object' &&
        channelOrOpts.channel === 'all')
    ) {
      for (const id of SRT_OUT_CHANNEL_IDS) stop(id, opts)
      return { ok: true }
    }
    const raw =
      channelOrOpts && typeof channelOrOpts === 'object'
        ? channelOrOpts.channel
        : channelOrOpts
    const checked = validateSrtOutChannel(raw)
    if (!checked.ok) return { ok: false, error: checked.error }
    const channel = checked.channel
    const session = sessions.get(channel)
    if (session) {
      session.closing = true
      session.generation += 1
      killChild(channel)
      sessions.delete(channel)
    }
    if (!opts.keepWindow) closeWindow(channel)
    onStatus(idleSrtOutStatus(channel))
    return { ok: true, channel }
  }

  function getStatusAll() {
    /** @type {Record<string, ReturnType<typeof idleSrtOutStatus>>} */
    const out = {}
    for (const id of SRT_OUT_CHANNEL_IDS) {
      out[id] = statusOf(id)
    }
    return out
  }

  function isAnyLive() {
    for (const session of sessions.values()) {
      if (session.state === 'live' || session.state === 'connecting') return true
    }
    return false
  }

  function shutdown() {
    stop('all')
  }

  return {
    start,
    stop,
    getStatusAll,
    isAnyLive,
    shutdown,
    resolveEncoder,
  }
}

module.exports = {
  createSrtPublisher,
  killProcessTree,
  LIBX264_NOTE,
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
  parseFfmpegFrame,
  instantFpsFromFrames,
  idleSrtOutStatus,
  normalizeSrtOutStatus,
  fitSrtPlateInWorkArea,
  pickSrtPlateDisplay,
  isPipeGrab,
  formatSrtPublishListenerError,
  isSrtPublishListenerMissing,
}
