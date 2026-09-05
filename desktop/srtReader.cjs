/**
 * Main-process SRT ingest — dumb MPEG-TS byte pipe (Phase 17.1).
 *
 * Per-POV ffmpeg child: `ffmpeg -i srt://… -c copy -f mpegts pipe:1`.
 * No demux, no decode, no transcode. PTS must survive (see buildFfmpegArgv).
 *
 * Native dep: ffmpeg on PATH (or BROADCAST_FFMPEG / packaged extraResources).
 * Must be a libsrt build (gyan full_build on Windows). Not a Node native addon.
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const {
  MAX_SESSIONS,
  BACKOFF_MS,
  MAX_QUEUED_CHUNKS,
  validateSrtUrl,
  validatePovId,
  mergeSrtUrlOptions,
  buildFfmpegArgv,
  redactSrtUrl,
  idleSrtStatus,
} = require('./srtHelpers.cjs')

/**
 * @typedef {'idle' | 'connecting' | 'live' | 'error'} SrtState
 * @typedef {{
 *   povId: string,
 *   url: string,
 *   streamId?: string,
 *   latencyMs?: number,
 *   passphrase?: string,
 *   transcodeToH264: boolean,
 *   webContents: import('electron').WebContents | null,
 *   webContentsId: number | null,
 *   child: import('node:child_process').ChildProcess | null,
 *   childPid: number | null,
 *   state: SrtState,
 *   lastError: string | null,
 *   bitrateKbps: number,
 *   bytesWindow: number,
 *   dropCount: number,
 *   queued: Uint8Array[],
 *   sending: boolean,
 *   backoffIndex: number,
 *   retryTimer: ReturnType<typeof setTimeout> | null,
 *   bitrateTimer: ReturnType<typeof setInterval> | null,
 *   generation: number,
 *   closing: boolean,
 *   stderrTail: string,
 *   ffProgress: Record<string, string>,
 *   diagDropAtLastLog: number,
 *   lastIpcDropPerSec: number,
 *   queueDepthHighWater: number,
 *   queueDepthSum: number,
 *   queueDepthSamples: number,
 *   enqueueCount: number,
 *   enqueueBytes: number,
 *   flushCount: number,
 *   sendingTrueSamples: number,
 *   lastStdoutAt: number | null,
 *   stdoutGapSum: number,
 *   stdoutGapN: number,
 *   stdoutGapMax: number,
 *   cpuSampling: boolean,
 *   cpuSecLast: number | null,
 *   cpuCoresLast: number | null,
 * }} SrtSession
 */

/** @type {Map<string, SrtSession>} */
const sessions = new Map()

/** @type {Map<string, number>} */
const lastErrorLogAt = new Map()
const ERROR_LOG_THROTTLE_MS = 10_000

/* DIAG:srt-fps — temporary ingest instrumentation; revert after diagnosis. */
const DIAG_LOG_PATH = path.join(__dirname, '..', 'diag-srt-fps.log')
const DIAG_PROGRESS_PREFIX =
  /^(frame|fps|stream_|bitrate|total_size|out_time|dup_frames|drop_frames|speed|progress)/

/**
 * @param {Record<string, unknown>} payload
 */
function diagSrtFpsLog(payload) {
  const line = `[diag:srt-fps] ${JSON.stringify(payload)}`
  console.info(line)
  try {
    fs.appendFileSync(DIAG_LOG_PATH, `${line}\n`)
  } catch {
    /* diagnostics must never break ingest */
  }
}

/**
 * @param {SrtSession} session
 * @param {string} text
 */
function parseFfmpegProgress(session, text) {
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (
      key === 'frame' ||
      key === 'fps' ||
      key === 'bitrate' ||
      key === 'speed' ||
      key === 'drop_frames' ||
      key === 'dup_frames' ||
      key === 'out_time' ||
      key === 'progress'
    ) {
      session.ffProgress[key] = val
    }
  }
}

/**
 * @param {SrtSession} session
 */
function sampleChildCpu(session) {
  const pid = session.childPid
  if (!pid || session.cpuSampling) return
  if (process.platform !== 'win32') return
  session.cpuSampling = true
  const ps = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `try { (Get-Process -Id ${pid} -ErrorAction Stop).CPU } catch { '' }`,
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
  )
  let out = ''
  ps.stdout?.on('data', (buf) => {
    out += buf.toString('utf8')
  })
  ps.on('close', () => {
    session.cpuSampling = false
    const cpuSec = Number.parseFloat(out.trim().replace(',', '.'))
    if (!Number.isFinite(cpuSec)) return
    const prev = session.cpuSecLast
    session.cpuSecLast = cpuSec
    if (typeof prev === 'number') {
      session.cpuCoresLast = Math.max(0, cpuSec - prev)
    }
  })
}

function resolveFfmpegPath() {
  const fromEnv = process.env.BROADCAST_FFMPEG?.trim()
  if (fromEnv) return fromEnv
  try {
    const resources = process.resourcesPath
    if (resources) {
      const bundled = path.join(
        resources,
        'ffmpeg',
        process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
      )
      if (fs.existsSync(bundled)) return bundled
    }
  } catch {
    /* unpackaged / no resourcesPath */
  }
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

/**
 * @param {number} pid
 */
function killProcessTree(pid) {
  if (!pid || pid <= 0) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
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
 * @param {SrtSession} session
 */
function killSessionChild(session) {
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
  if (pid) killProcessTree(pid)
}

/**
 * @param {SrtSession} session
 */
function clearRetry(session) {
  if (session.retryTimer !== null) {
    clearTimeout(session.retryTimer)
    session.retryTimer = null
  }
}

/**
 * @param {SrtSession} session
 */
function clearBitrate(session) {
  if (session.bitrateTimer !== null) {
    clearInterval(session.bitrateTimer)
    session.bitrateTimer = null
  }
}

/**
 * @param {string} povId
 * @param {string} message
 * @param {'info' | 'error'} [level]
 */
function logSrt(povId, message, level = 'info') {
  const line = `[desktop] srt[${povId}] ${message}`
  if (level === 'error') {
    const key = `${povId}|${message}`
    const now = Date.now()
    const prev = lastErrorLogAt.get(key) ?? 0
    if (now - prev < ERROR_LOG_THROTTLE_MS) return
    lastErrorLogAt.set(key, now)
    console.error(line)
    return
  }
  console.info(line)
}

/**
 * @param {SrtSession} session
 * @param {string} channel
 * @param {unknown} payload
 */
function sendToOwner(session, channel, payload) {
  const wc = session.webContents
  if (!wc || wc.isDestroyed()) return
  try {
    wc.send(channel, payload)
  } catch {
    /* window gone */
  }
}

/**
 * @param {SrtSession} session
 */
function statusPayload(session) {
  return {
    povId: session.povId,
    state: session.state,
    bitrateKbps: session.bitrateKbps,
    lastError: session.lastError,
    /* DIAG:decode-error — proxies; libsrt packet-loss counters are not exposed. */
    ipcDropCount: session.dropCount,
    ipcDropPerSec: session.lastIpcDropPerSec,
    ffmpegDropFrames: session.ffProgress.drop_frames ?? null,
    ffmpegDupFrames: session.ffProgress.dup_frames ?? null,
  }
}

/**
 * @param {SrtSession} session
 * @param {SrtState} state
 * @param {string | null} [lastError]
 */
function setState(session, state, lastError) {
  const error =
    lastError === undefined ? session.lastError : lastError
  const changed =
    session.state !== state || session.lastError !== error
  session.state = state
  session.lastError = error
  if (state !== 'live') session.bitrateKbps = state === 'idle' ? 0 : session.bitrateKbps
  if (changed) sendToOwner(session, 'srt:status', statusPayload(session))
}

/**
 * @param {SrtSession} session
 */
function noteQueueDepth(session) {
  const depth = session.queued.length + (session.sending ? 1 : 0)
  session.queueDepthSamples += 1
  session.queueDepthSum += depth
  if (depth > session.queueDepthHighWater) session.queueDepthHighWater = depth
  if (session.sending) session.sendingTrueSamples += 1
}

/**
 * @param {SrtSession} session
 */
function resetQueueDepthWindow(session) {
  session.queueDepthHighWater = 0
  session.queueDepthSum = 0
  session.queueDepthSamples = 0
  session.enqueueCount = 0
  session.enqueueBytes = 0
  session.flushCount = 0
  session.sendingTrueSamples = 0
  session.stdoutGapSum = 0
  session.stdoutGapN = 0
  session.stdoutGapMax = 0
}

/**
 * @param {SrtSession} session
 */
function flushQueue(session) {
  if (session.sending || session.queued.length === 0) return
  if (session.closing || session.state === 'idle') {
    session.queued.length = 0
    noteQueueDepth(session)
    return
  }
  const chunk = session.queued.shift()
  if (!chunk) return
  session.sending = true
  session.flushCount += 1
  noteQueueDepth(session)
  sendToOwner(session, 'srt:data', { povId: session.povId, chunk })
  setImmediate(() => {
    session.sending = false
    noteQueueDepth(session)
    flushQueue(session)
  })
}

/**
 * @param {SrtSession} session
 * @param {Buffer} buf
 */
function onStdoutChunk(session, buf) {
  if (session.closing) return
  if (session.state === 'connecting') {
    session.backoffIndex = 0
    setState(session, 'live', null)
    logSrt(session.povId, 'live')
  }
  session.bytesWindow += buf.length
  const now = Date.now()
  if (session.lastStdoutAt != null) {
    const gap = now - session.lastStdoutAt
    session.stdoutGapSum += gap
    session.stdoutGapN += 1
    if (gap > session.stdoutGapMax) session.stdoutGapMax = gap
  }
  session.lastStdoutAt = now
  if (session.queued.length >= MAX_QUEUED_CHUNKS && session.sending) {
    session.dropCount += 1
    noteQueueDepth(session)
    return
  }
  if (session.queued.length >= MAX_QUEUED_CHUNKS) {
    session.dropCount += 1
    session.queued.length = 0
  }
  session.queued.push(Uint8Array.from(buf))
  session.enqueueCount += 1
  session.enqueueBytes += buf.length
  noteQueueDepth(session)
  flushQueue(session)
}

/**
 * @param {SrtSession} session
 * @param {Buffer} buf
 */
function onStderrChunk(session, buf) {
  const text = buf.toString('utf8')
  /* DIAG:srt-fps */
  parseFfmpegProgress(session, text)
  const cleaned = text
    .split(/\r?\n/)
    .filter((line) => !DIAG_PROGRESS_PREFIX.test(line))
    .join('\n')
  if (cleaned.trim()) {
    session.stderrTail = (session.stderrTail + cleaned).slice(-2000)
  }
}

/**
 * @param {SrtSession} session
 */
function lastErrorFromStderr(session) {
  const lines = session.stderrTail
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return 'ffmpeg exited'
  return lines[lines.length - 1].slice(0, 400)
}

/**
 * @param {SrtSession} session
 */
function scheduleRetry(session) {
  if (session.closing) return
  clearRetry(session)
  const delay = BACKOFF_MS[Math.min(session.backoffIndex, BACKOFF_MS.length - 1)]
  session.backoffIndex += 1
  logSrt(session.povId, `retry in ${delay}ms`)
  session.retryTimer = setTimeout(() => {
    session.retryTimer = null
    if (session.closing) return
    spawnSession(session)
  }, delay)
}

/**
 * @param {SrtSession} session
 */
function spawnSession(session) {
  if (session.closing) return
  clearRetry(session)
  killSessionChild(session)
  session.queued.length = 0
  session.sending = false
  session.stderrTail = ''
  session.ffProgress = {}
  session.cpuSecLast = null
  session.cpuCoresLast = null
  session.generation += 1
  const gen = session.generation
  setState(session, 'connecting', session.lastError)

  let inputUrl
  try {
    inputUrl = mergeSrtUrlOptions(session.url, {
      streamId: session.streamId,
      latencyMs: session.latencyMs,
      passphrase: session.passphrase,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    setState(session, 'error', msg)
    logSrt(session.povId, msg, 'error')
    scheduleRetry(session)
    return
  }

  const ffmpegPath = resolveFfmpegPath()
  const argv = buildFfmpegArgv(inputUrl, {
    transcodeToH264: session.transcodeToH264,
  })
  /* DIAG:srt-fps — progress on stderr; does not change copy vs transcode. */
  const hideIdx = argv.indexOf('-hide_banner')
  if (hideIdx >= 0) argv.splice(hideIdx + 1, 0, '-progress', 'pipe:2')
  else argv.unshift('-progress', 'pipe:2')
  logSrt(
    session.povId,
    `connecting${session.transcodeToH264 ? ' (ffmpeg HEVC→H.264)' : ''} ${redactSrtUrl(inputUrl)}`,
  )

  let child
  try {
    child = spawn(ffmpegPath, argv, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    setState(session, 'error', msg)
    logSrt(session.povId, msg, 'error')
    scheduleRetry(session)
    return
  }

  session.child = child
  session.childPid = child.pid ?? null

  child.stdout?.on('data', (buf) => {
    if (session.generation !== gen || session.closing) return
    onStdoutChunk(session, buf)
  })
  child.stderr?.on('data', (buf) => {
    if (session.generation !== gen) return
    onStderrChunk(session, buf)
  })
  child.on('error', (err) => {
    if (session.generation !== gen || session.closing) return
    const msg =
      err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT'
        ? `ffmpeg not found (${ffmpegPath}). Install a libsrt build (gyan full_build) or set BROADCAST_FFMPEG.`
        : err instanceof Error
          ? err.message
          : String(err)
    session.lastError = msg
    logSrt(session.povId, msg, 'error')
  })
  child.on('exit', (code, signal) => {
    if (session.generation !== gen) return
    session.child = null
    session.childPid = null
    if (session.closing) return
    const fromErr = lastErrorFromStderr(session)
    const msg =
      session.lastError && session.lastError.includes('ffmpeg not found')
        ? session.lastError
        : fromErr !== 'ffmpeg exited'
          ? fromErr
          : `ffmpeg exited (${code ?? signal ?? 'unknown'})`
    setState(session, 'error', msg)
    logSrt(session.povId, msg, 'error')
    scheduleRetry(session)
  })
}

/**
 * @param {SrtSession} session
 */
function startBitrateTimer(session) {
  if (session.bitrateTimer !== null) return
  session.bitrateTimer = setInterval(() => {
    session.bitrateKbps = Math.round((session.bytesWindow * 8) / 1000)
    const stdoutBytesPerSec = session.bytesWindow
    session.bytesWindow = 0
    /* DIAG:srt-fps */
    const dropNow = session.dropCount
    const ipcDropPerSec = dropNow - session.diagDropAtLastLog
    session.diagDropAtLastLog = dropNow
    session.lastIpcDropPerSec = ipcDropPerSec
    if (session.state === 'live') {
      sendToOwner(session, 'srt:status', statusPayload(session))
    }
    if (ipcDropPerSec > 0) {
      diagSrtFpsLog({
        stage: 'ipc-drop',
        wallMs: Date.now(),
        povId: session.povId,
        ipcDropPerSec,
        ipcDropCount: dropNow,
        bitrateKbps: session.bitrateKbps,
        ffmpegDropFrames: session.ffProgress.drop_frames ?? null,
      })
    }
    diagSrtFpsLog({
      stage: 'ingest',
      wallMs: Date.now(),
      povId: session.povId,
      transcodeToH264: session.transcodeToH264,
      state: session.state,
      bitrateKbps: session.bitrateKbps,
      stdoutBytesPerSec,
      ipcDropCount: dropNow,
      ipcDropPerSec,
      queued: session.queued.length,
      queuedHighWater: session.queueDepthHighWater,
      queuedMean:
        session.queueDepthSamples > 0
          ? Math.round(
              (1000 * session.queueDepthSum) / session.queueDepthSamples,
            ) / 1000
          : 0,
      queuedSamples: session.queueDepthSamples,
      enqueueCount: session.enqueueCount,
      enqueueBytes: session.enqueueBytes,
      flushCount: session.flushCount,
      sendingBusyShare:
        session.queueDepthSamples > 0
          ? Math.round(
              (1000 * session.sendingTrueSamples) / session.queueDepthSamples,
            ) / 1000
          : 0,
      stdoutGapMeanMs:
        session.stdoutGapN > 0
          ? Math.round((1000 * session.stdoutGapSum) / session.stdoutGapN) / 1000
          : null,
      stdoutGapMaxMs: session.stdoutGapN > 0 ? session.stdoutGapMax : null,
      sending: session.sending,
      maxQueuedChunks: MAX_QUEUED_CHUNKS,
      ffmpeg: { ...session.ffProgress },
      ffmpegCpuCores: session.cpuCoresLast,
      childPid: session.childPid,
    })
    resetQueueDepthWindow(session)
    sampleChildCpu(session)
  }, 1000)
}

/**
 * @param {import('electron').WebContents | null} webContents
 * @param {unknown} raw
 */
function open(webContents, raw) {
  const opts = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {}
  const pov = validatePovId(opts.povId)
  if (!pov.ok) return { ok: false, error: pov.error }
  const url = validateSrtUrl(opts.url)
  if (!url.ok) return { ok: false, error: url.error }

  const existing = sessions.get(pov.povId)
  if (!existing && sessions.size >= MAX_SESSIONS) {
    return {
      ok: false,
      error: `SRT session cap is ${MAX_SESSIONS} (L5); close one before opening another`,
    }
  }

  if (existing) {
    existing.closing = true
    clearRetry(existing)
    clearBitrate(existing)
    killSessionChild(existing)
    sessions.delete(pov.povId)
  }

  /** @type {SrtSession} */
  const session = {
    povId: pov.povId,
    url: url.href,
    streamId: typeof opts.streamId === 'string' ? opts.streamId : undefined,
    latencyMs:
      opts.latencyMs == null || opts.latencyMs === ''
        ? undefined
        : Number(opts.latencyMs),
    passphrase: typeof opts.passphrase === 'string' ? opts.passphrase : undefined,
    transcodeToH264: opts.transcodeToH264 === true,
    webContents: webContents && !webContents.isDestroyed() ? webContents : null,
    webContentsId:
      webContents && !webContents.isDestroyed() && typeof webContents.id === 'number'
        ? webContents.id
        : null,
    child: null,
    childPid: null,
    state: 'connecting',
    lastError: null,
    bitrateKbps: 0,
    bytesWindow: 0,
    dropCount: 0,
    queued: [],
    sending: false,
    backoffIndex: 0,
    retryTimer: null,
    bitrateTimer: null,
    generation: 0,
    closing: false,
    stderrTail: '',
    ffProgress: {},
    diagDropAtLastLog: 0,
    lastIpcDropPerSec: 0,
    queueDepthHighWater: 0,
    queueDepthSum: 0,
    queueDepthSamples: 0,
    enqueueCount: 0,
    enqueueBytes: 0,
    flushCount: 0,
    sendingTrueSamples: 0,
    lastStdoutAt: null,
    stdoutGapSum: 0,
    stdoutGapN: 0,
    stdoutGapMax: 0,
    cpuSampling: false,
    cpuSecLast: null,
    cpuCoresLast: null,
  }
  sessions.set(pov.povId, session)
  startBitrateTimer(session)
  sendToOwner(session, 'srt:status', statusPayload(session))
  spawnSession(session)
  return { ok: true, povId: pov.povId }
}

/**
 * @param {SrtSession} session
 */
function teardownSession(session) {
  session.closing = true
  clearRetry(session)
  clearBitrate(session)
  killSessionChild(session)
  session.queued.length = 0
  session.sending = false
  session.bitrateKbps = 0
  setState(session, 'idle', null)
}

/**
 * @param {unknown} povIdOrAll
 */
function close(povIdOrAll) {
  if (
    povIdOrAll === 'all' ||
    (povIdOrAll &&
      typeof povIdOrAll === 'object' &&
      /** @type {{ povId?: unknown }} */ (povIdOrAll).povId === 'all')
  ) {
    closeAll()
    return { ok: true }
  }
  const raw =
    povIdOrAll && typeof povIdOrAll === 'object'
      ? /** @type {{ povId?: unknown }} */ (povIdOrAll).povId
      : povIdOrAll
  const pov = validatePovId(raw)
  if (!pov.ok) return { ok: false, error: pov.error }
  const session = sessions.get(pov.povId)
  if (!session) return { ok: true, povId: pov.povId }
  teardownSession(session)
  sessions.delete(pov.povId)
  return { ok: true, povId: pov.povId }
}

function closeAll() {
  for (const session of [...sessions.values()]) {
    teardownSession(session)
  }
  sessions.clear()
}

/**
 * @param {import('electron').WebContents} webContents
 */
function closeForWebContents(webContents) {
  const id =
    webContents && typeof webContents.id === 'number' ? webContents.id : null
  for (const session of [...sessions.values()]) {
    if (
      session.webContents === webContents ||
      (id != null && session.webContentsId === id)
    ) {
      teardownSession(session)
      sessions.delete(session.povId)
    }
  }
}

function getStatusAll() {
  /** @type {Record<string, ReturnType<typeof idleSrtStatus>>} */
  const out = {}
  for (const session of sessions.values()) {
    out[session.povId] = statusPayload(session)
  }
  return out
}

function shutdown() {
  closeAll()
}

module.exports = {
  MAX_SESSIONS,
  open,
  close,
  closeAll,
  closeForWebContents,
  getStatusAll,
  shutdown,
  resolveFfmpegPath,
}
