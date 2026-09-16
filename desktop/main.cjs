/**
 * Electron studio shell for broadcast-web (Phase 7.3b).
 * Loads the SPA and publishes a named alpha NDI source via grandi.
 *
 * Studio output is locked to 1920×1080 in the SPA. Minimizing does **not**
 * use OS minimize (that freezes WebGL); the window is parked off-screen so
 * NDI keeps ~30 fps. Restore via the tray icon.
 *
 * Modes (first matching flag / env wins):
 *   --dev   or default          → http://127.0.0.1:5173  (Vite `npm run dev`)
 *   --preview                   → http://127.0.0.1:4173  (Vite `npm run preview`)
 *   --file                      → file://…/dist/index.html (run `npm run build` first)
 *   BROADCAST_WEB_URL=<url>     → override any of the above
 *   BROADCAST_NDI_NAME=<name>   → NDI source name (default broadcast-web)
 *   --no-ndi                    → disable NDI sender
 *   --integrated-gpu            → do not request high-performance (discrete) GPU
 *   BROADCAST_USE_INTEGRATED_GPU=1 → same as --integrated-gpu
 */
const {
  app,
  BrowserWindow,
  ipcMain,
  powerSaveBlocker,
  Tray,
  Menu,
  nativeImage,
  screen,
} = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const ndiSender = require('./ndiSender.cjs')
const racesFs = require('./racesFs.cjs')
const configFs = require('./configFs.cjs')
const srtReader = require('./srtReader.cjs')
const srtPublisherMod = require('./srtPublisher.cjs')
const srtPlateCapture = require('./srtPlateCapture.cjs')
const cinematicTileCache = require('./cinematicTileCache.cjs')
const cinematicRecord = require('./cinematicRecord.cjs')

const DEV_URL = 'http://127.0.0.1:5173'
const PREVIEW_URL = 'http://127.0.0.1:4173'
const STUDIO_WIDTH = 1920
const STUDIO_HEIGHT = 1080
const PARK_X = -16000
const PARK_Y = -16000

/**
 * Prefer discrete / high-performance GPU on dual-GPU Windows (Optimus, etc.).
 * Must run before `app.whenReady()`. Chromium may still follow OS assignment —
 * see desktop/README.md § GPU. Opt out: `--integrated-gpu` or
 * `BROADCAST_USE_INTEGRATED_GPU=1`.
 */
const useIntegratedGpu =
  process.argv.includes('--integrated-gpu') ||
  ['1', 'true', 'yes'].includes(
    (process.env.BROADCAST_USE_INTEGRATED_GPU || '').trim().toLowerCase(),
  )
if (!useIntegratedGpu) {
  app.commandLine.appendSwitch('force_high_performance_gpu')
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
}

// Electron is not Chrome-branded, so HEVC WebCodecs is off unless we opt in.
// Chrome on the same PC can decode DJI HEVC via Windows Media Foundation;
// without this switch, `VideoDecoder.isConfigSupported({codec:'hev1…'})` is false
// and the AR underlay stays on colour bars. H.264 does not need this.
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')

// Keep renderer eligible while occluded; Windows occlusion can still freeze GPU.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion',
)

/** @type {number | null} */
let powerBlockerId = null
/** @type {ReturnType<typeof setInterval> | null} */
let studioTickTimer = null
/** @type {ReturnType<typeof setInterval> | null} */
let ndiPerfTimer = null
/** @type {import('electron').Tray | null} */
let tray = null
/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {Map<string, BrowserWindow>} */
const srtPlateWindows = new Map()
srtReader.setIngestFanout(() => {
  const ar = srtPlateWindows.get('ar')
  if (!ar || ar.isDestroyed()) return []
  return [ar.webContents]
})
/** @type {{ x: number, y: number, width: number, height: number } | null} */
let preParkBounds = null
let parked = false
let quitting = false

// NDI stagger clock only (DSP-OUT-20260828-04). Ops preview stays rAF when
// visible (`startDualFrameClock`) — this constant does not drive preview.
// 60 Hz + one FBO render per tick spreads AR 30 + 3D 30 on alternate ticks.
// Do not also allow two FBO renders on one tick.
const STUDIO_TICK_FPS = 60

// Minimal PNG for the tray — Windows requires a real image.
const TRAY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2NkYGD4z0AEYBxVSFQw/P//H8MYNWoUI8OoQYwM/4dGYmRgZGQcVUgAALKQBf1m3l0YAAAAAElFTkSuQmCC'

function hasFlag(name) {
  return process.argv.includes(name)
}

function flagValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return undefined
  const v = hit.slice(prefix.length)
  return v || undefined
}

function resolveLoadTarget() {
  const fromEnv = process.env.BROADCAST_WEB_URL?.trim()
  if (fromEnv) {
    return { kind: 'url', value: fromEnv }
  }
  if (hasFlag('--file')) {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html')
    return { kind: 'file', value: indexHtml }
  }
  if (hasFlag('--preview')) {
    return { kind: 'url', value: PREVIEW_URL }
  }
  return { kind: 'url', value: DEV_URL }
}

function resolveNdiName() {
  const fromFlag = flagValue('--ndi-name=')
  if (fromFlag) return fromFlag
  const fromEnv = process.env.BROADCAST_NDI_NAME?.trim()
  if (fromEnv) return fromEnv
  return ndiSender.DEFAULT_NAME
}

const ndiEnabled = !hasFlag('--no-ndi')

function registerNdiIpc() {
  ipcMain.handle('ndi:start', async (_evt, opts) => {
    if (!ndiEnabled) {
      return { ok: false, error: 'NDI disabled (--no-ndi)' }
    }
    let channel = ndiSender.DEFAULT_CHANNEL
    try {
      channel = ndiSender.normalizeChannel(opts?.channel)
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
    // Back-compat: omit channel → 'ar'; env/--ndi-name override applies to 'ar' only.
    const nameFromOpts =
      opts && typeof opts.name === 'string' && opts.name.trim()
        ? opts.name.trim()
        : null
    const name =
      nameFromOpts ||
      (channel === ndiSender.DEFAULT_CHANNEL
        ? resolveNdiName()
        : ndiSender.DEFAULT_NAMES[channel])
    const result = await ndiSender.start(channel, name)
    if (result.ok) {
      console.info(
        `[desktop] NDI[${result.channel}] source: ${result.sourceName} (${result.sdkVersion})`,
      )
    } else {
      console.error(
        `[desktop] NDI[${result.channel ?? channel}] start failed: ${result.error}`,
      )
    }
    return result
  })

  ipcMain.handle('ndi:stop', async (_evt, arg) => {
    // omit / undefined → 'ar'; 'all' → every channel; string or { channel }
    if (arg === 'all') {
      await ndiSender.stop('all')
      return
    }
    if (arg && typeof arg === 'object' && arg.channel === 'all') {
      await ndiSender.stop('all')
      return
    }
    const channel =
      arg && typeof arg === 'object' && 'channel' in arg
        ? arg.channel
        : arg
    await ndiSender.stop(channel)
  })

  ipcMain.handle('ndi:status', (_evt, channel) => {
    if (channel === undefined || channel === null || channel === '') {
      return ndiSender.getStatus(ndiSender.DEFAULT_CHANNEL)
    }
    if (channel === 'all') {
      return ndiSender.getStatusAll()
    }
    return ndiSender.getStatus(channel)
  })

  ipcMain.handle('ndi:statusAll', () => ndiSender.getStatusAll())

  ipcMain.handle('ndi:perfSummary', () => ndiSender.getPerfSummary())

  ipcMain.on('debug:ndjson', (_evt, payload) => {
    // #region agent log
    try {
      const line = `${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n`
      fs.appendFileSync(path.join(__dirname, '..', 'debug-173fbb.log'), line)
    } catch {
      /* ignore */
    }
    // #endregion
  })

  ipcMain.on('ndi:frame', (_evt, frame) => {
    if (!ndiEnabled) return
    const channel =
      frame && typeof frame === 'object' && 'channel' in frame
        ? frame.channel
        : ndiSender.DEFAULT_CHANNEL
    // #region agent log
    const now = Date.now()
    const last = global.__ndiDebugLogAt || 0
    if (now - last > 1000) {
      global.__ndiDebugLogAt = now
      try {
        const data = frame && frame.data
        fs.appendFileSync(
          path.join(__dirname, '..', 'debug-173fbb.log'),
          `${JSON.stringify({
            sessionId: '173fbb',
            runId: 'post-fix',
            hypothesisId: 'H4',
            location: 'desktop/main.cjs:ndi:frame',
            message: 'main received NDI frame',
            data: {
              channel,
              w: frame && frame.width,
              h: frame && frame.height,
              bytes: data && data.byteLength,
              bottomUp: frame && frame.bottomUp,
            },
            timestamp: now,
          })}\n`,
        )
      } catch {
        /* ignore */
      }
    }
    // #endregion
    ndiSender.sendFrame(channel, frame)
  })

  ipcMain.on('ndi:frame-port', (event) => {
    const port = event.ports && event.ports[0]
    if (!port) return
    port.start()
    port.on('message', (msgEvent) => {
      if (!ndiEnabled) return
      const frame = msgEvent && msgEvent.data
      const channel =
        frame && typeof frame === 'object' && 'channel' in frame
          ? frame.channel
          : ndiSender.DEFAULT_CHANNEL
      ndiSender.sendFrame(channel, frame)
    })
  })
}

function getRacesDir() {
  return racesFs.resolveRacesDir(resolveLoadTarget().kind, {
    desktopDir: __dirname,
    userDataPath: app.getPath('userData'),
  })
}

function getRacesKind() {
  return racesFs.resolveRacesKind(resolveLoadTarget().kind)
}

function isTileCacheFileName(name) {
  return typeof name === 'string' && /^[0-9a-f]{64}$/.test(name)
}

function getTileCacheDir() {
  return cinematicTileCache.getCinematicTileCacheDir({
    userDataPath: app.getPath('userData'),
  })
}

/** Packaged `--file` userData cache. Vite `desktop:dev` uses GET/POST instead. */
function registerCinematicTilesIpc() {
  const packaged = resolveLoadTarget().kind === 'file'
  ipcMain.handle('cinematicTiles:packaged', () => packaged)
  ipcMain.handle('cinematicTiles:has', async (_evt, name) => {
    if (!isTileCacheFileName(name)) return false
    const filePath = path.join(getTileCacheDir(), name)
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    } catch {
      return false
    }
  })
  ipcMain.handle('cinematicTiles:read', async (_evt, name) => {
    if (!isTileCacheFileName(name)) return null
    const filePath = path.join(getTileCacheDir(), name)
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
      const buf = fs.readFileSync(filePath)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch {
      return null
    }
  })
  ipcMain.handle('cinematicTiles:write', async (_evt, payload) => {
    const name = payload && payload.name
    if (!isTileCacheFileName(name)) return { ok: false, error: 'bad name' }
    const bytes = payload && payload.bytes
    if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) {
      return { ok: false, error: 'bad bytes' }
    }
    const dir = getTileCacheDir()
    const filePath = path.join(dir, name)
    try {
      fs.mkdirSync(dir, { recursive: true })
      if (fs.existsSync(filePath)) return { ok: true, skipped: true }
      const buf = Buffer.from(bytes)
      if (buf.byteLength > 32 * 1024 * 1024) {
        return { ok: false, error: 'too large' }
      }
      fs.writeFileSync(filePath, buf)
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}

/** Local RaceProject saves — additive; do not refactor NDI here. */
function registerRacesIpc() {
  ipcMain.handle('races:save', async (_evt, project) => {
    try {
      return await racesFs.saveRaceProject(getRacesDir(), project)
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('races:list', async () => {
    try {
      const listed = await racesFs.listRaceIds(getRacesDir())
      return { ...listed, kind: getRacesKind() }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('races:read', async (_evt, id) => {
    try {
      return await racesFs.readRaceProject(getRacesDir(), id)
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('races:root', async () => {
    return { kind: getRacesKind(), path: getRacesDir() }
  })
}

function getConfigPath() {
  return configFs.resolveConfigPath(resolveLoadTarget().kind, {
    desktopDir: __dirname,
    userDataPath: app.getPath('userData'),
  })
}

function getConfigKind() {
  return configFs.resolveConfigKind(resolveLoadTarget().kind)
}

/** Patch git-shared `public/config.json` (dev) or userData copy (--file). */
function registerConfigIpc() {
  ipcMain.handle('config:setCesiumIonToken', async (_evt, token) => {
    try {
      const result = await configFs.setCesiumIonToken(getConfigPath(), token)
      if (!result.ok) return result
      return { ...result, kind: getConfigKind() }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}

/** SRT ingest — dumb MPEG-TS byte pipe. Per-POV; `close('all')` like `ndi:stop`. */
function registerSrtIpc() {
  ipcMain.handle('srt:open', (evt, opts) => {
    return srtReader.open(evt.sender, opts)
  })
  ipcMain.handle('srt:close', (_evt, arg) => {
    return srtReader.close(arg)
  })
  ipcMain.handle('srt:status', () => srtReader.getStatusAll())
}

function srtPlateTitle(channel) {
  return srtPublisherMod.SRT_OUT_TITLES[channel]
}

function buildSrtPlateUrl(channel) {
  const live =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.webContents.getURL()
      : ''
  if (live) {
    try {
      const u = new URL(live)
      u.searchParams.set('srtPlate', channel)
      return u.href
    } catch {
      /* fall through */
    }
  }
  const target = resolveLoadTarget()
  if (target.kind === 'file') {
    const u = new URL(`file:///${target.value.replace(/\\/g, '/')}`)
    u.searchParams.set('srtPlate', channel)
    return u.href
  }
  try {
    const u = new URL(target.value)
    u.searchParams.set('srtPlate', channel)
    return u.href
  } catch {
    const join = target.value.includes('?') ? '&' : '?'
    return `${target.value}${join}srtPlate=${channel}`
  }
}

function applyPlatePixelZoom(win) {
  if (!win || win.isDestroyed()) return
  // Zoom 1 + capture scale. Device emulation drew 1080 inside a HiDPI
  // backing store; scaling that whole buffer made OBS AR a small picture
  // in a large striped box.
  try {
    win.webContents.setZoomFactor(1)
  } catch {
    /* ignore */
  }
  try {
    win.webContents.setZoomLevel(0)
  } catch {
    /* ignore */
  }
}

function layoutSrtPlateWindow(win) {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.setSkipTaskbar(true)
  // Content size only. setBounds(1920×1080) shrinks the drawing area when
  // Windows DPI adds chrome to the outer frame.
  try {
    win.setContentSize(STUDIO_WIDTH, STUDIO_HEIGHT)
  } catch {
    /* some platforms reject while loading */
  }
  applyPlatePixelZoom(win)
  try {
    win.webContents.setFrameRate(srtPublisherMod.SRT_OUT_FPS)
  } catch {
    /* ignore */
  }
  win.webContents.setBackgroundThrottling(false)
}

function platePipeGrab(channel, win) {
  return {
    kind: 'pipe',
    width: STUDIO_WIDTH,
    height: STUDIO_HEIGHT,
    attach(stdin) {
      layoutSrtPlateWindow(win, channel)
      return srtPlateCapture.attachSrtPlateBitmapInput(win, stdin, {
        width: STUDIO_WIDTH,
        height: STUDIO_HEIGHT,
        fps: srtPublisherMod.SRT_OUT_FPS,
        channel,
      })
    },
  }
}

/**
 * Chrome-free 1920×1080 plate. Offscreen compositor so Cesium/WebGL keep
 * painting without sitting on top of the studio. Capture is Chromium's
 * buffer (paint / frame subscription), not DXGI of a screen rectangle.
 *
 * @param {'ar' | '3d' | '2d'} channel
 * @returns {Promise<object>}
 */
function ensureSrtPlateWindow(channel) {
  const existing = srtPlateWindows.get(channel)
  if (existing && !existing.isDestroyed()) {
    existing.setTitle(srtPlateTitle(channel))
    layoutSrtPlateWindow(existing, channel)
    return Promise.resolve(platePipeGrab(channel, existing))
  }

  const title = srtPlateTitle(channel)
  const win = new BrowserWindow({
    width: STUDIO_WIDTH,
    height: STUDIO_HEIGHT,
    useContentSize: true,
    frame: false,
    autoHideMenuBar: true,
    hasShadow: false,
    minimizable: false,
    skipTaskbar: true,
    title,
    backgroundColor: '#000000',
    backgroundThrottling: false,
    paintWhenInitiallyHidden: true,
    show: false,
    webPreferences: {
      offscreen: true,
      zoomFactor: 1,
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  srtPlateWindows.set(channel, win)
  win.setMenuBarVisibility(false)
  win.webContents.setBackgroundThrottling(false)
  win.setTitle(title)
  layoutSrtPlateWindow(win, channel)
  win.on('page-title-updated', (e) => {
    e.preventDefault()
    if (!win.isDestroyed()) win.setTitle(title)
  })
  win.on('closed', () => {
    if (srtPlateWindows.get(channel) === win) srtPlateWindows.delete(channel)
    srtPublisher.stop(channel, { keepWindow: true })
  })

  const href = buildSrtPlateUrl(channel)
  void win.loadURL(href).catch((err) => {
    console.error(
      `[desktop] SRT plate ${channel} failed to load ${href}: ${err.message}`,
    )
  })
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setTitle(title)
        layoutSrtPlateWindow(win, channel)
      }
      resolve(platePipeGrab(channel, win))
    }, 700)
  })
}

function closeSrtPlateWindow(channel) {
  const win = srtPlateWindows.get(channel)
  if (!win) return
  srtPlateWindows.delete(channel)
  if (!win.isDestroyed()) {
    win.removeAllListeners('closed')
    win.close()
  }
}

const srtPublisher = srtPublisherMod.createSrtPublisher({
  resolveFfmpegPath: () => srtReader.resolveFfmpegPath(),
  ensureWindow: (channel) => ensureSrtPlateWindow(channel),
  closeWindow: (channel) => closeSrtPlateWindow(channel),
  onStatus: (status) => {
    if (status.state === 'connecting' || status.state === 'live') {
      startPowerBlocker()
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send('srtOut:status', status)
    }
  },
})

/** SRT program out — ffmpeg publish children. Independent of ingest `srt:open`. */
function registerSrtOutIpc() {
  ipcMain.handle('srtOut:start', (_evt, opts) => {
    return srtPublisher.start(opts)
  })
  ipcMain.handle('srtOut:stop', (_evt, arg) => {
    return srtPublisher.stop(arg)
  })
  ipcMain.handle('srtOut:status', () => srtPublisher.getStatusAll())
  ipcMain.on('srtOut:programView', (evt, view) => {
    const plate = srtPlateWindows.get('3d')
    if (!plate || plate.isDestroyed()) return
    if (evt.sender.id === plate.webContents.id) return
    plate.webContents.send('srtOut:programView', view)
  })
  ipcMain.on('srtOut:map2dView', (evt, view) => {
    const plate = srtPlateWindows.get('2d')
    if (!plate || plate.isDestroyed()) return
    if (evt.sender.id === plate.webContents.id) return
    plate.webContents.send('srtOut:map2dView', view)
  })
  ipcMain.on('srtOut:worldLook', (evt, look) => {
    const plate = srtPlateWindows.get('3d')
    if (!plate || plate.isDestroyed()) return
    if (evt.sender.id === plate.webContents.id) return
    plate.webContents.send('srtOut:worldLook', look)
  })
  ipcMain.on('srtOut:layerPreset', (evt, packet) => {
    const channel = packet && packet.channel
    if (channel !== 'ar' && channel !== '3d') return
    const plate = srtPlateWindows.get(packet.channel)
    if (!plate || plate.isDestroyed()) return
    if (evt.sender.id === plate.webContents.id) return
    plate.webContents.send('srtOut:layerPreset', packet)
  })
  ipcMain.on('srtOut:arPov', (evt, povId) => {
    const plate = srtPlateWindows.get('ar')
    if (!plate || plate.isDestroyed()) return
    if (evt.sender.id === plate.webContents.id) return
    plate.webContents.send('srtOut:arPov', povId)
  })
}

/**
 * OS minimize freezes WebGL/GPU on Windows even when JS still ticks.
 * Park off-screen instead: window stays "shown", NDI keeps ~30 fps.
 */
function parkWindow(win) {
  if (!win || win.isDestroyed() || parked) return
  preParkBounds = win.getBounds()
  parked = true
  if (win.isMinimized()) win.restore()
  win.setOpacity(0)
  win.setSkipTaskbar(true)
  win.setBounds({
    x: PARK_X,
    y: PARK_Y,
    width: Math.max(preParkBounds.width, STUDIO_WIDTH),
    height: Math.max(preParkBounds.height, STUDIO_HEIGHT),
  })
  win.showInactive()
  win.webContents.setBackgroundThrottling(false)
  console.info(
    '[desktop] parked off-screen (minimize → continuous NDI). Restore from tray.',
  )
}

function unparkWindow(win) {
  if (!win || win.isDestroyed()) return
  if (!parked) {
    win.setOpacity(1)
    win.setSkipTaskbar(false)
    win.show()
    win.focus()
    return
  }
  parked = false
  win.setOpacity(1)
  win.setSkipTaskbar(false)
  if (preParkBounds) {
    win.setBounds(preParkBounds)
    preParkBounds = null
  }
  win.show()
  win.focus()
  win.webContents.setBackgroundThrottling(false)
  console.info('[desktop] restored from park')
}

function ensureTray() {
  if (tray) return
  const icon = nativeImage.createFromDataURL(TRAY_PNG_DATA_URL)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('broadcast-web studio (NDI)')
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show studio',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) unparkWindow(mainWindow)
      },
    },
    {
      label: 'Quit',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) unparkWindow(mainWindow)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: STUDIO_WIDTH,
    height: STUDIO_HEIGHT,
    minWidth: 640,
    minHeight: 360,
    title: 'broadcast-web (studio)',
    backgroundColor: '#000000',
    backgroundThrottling: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  mainWindow = win

  win.webContents.setBackgroundThrottling(false)

  // Minimize → park (do not stay minimized; that stalls WebGL ~0.2 fps).
  win.on('minimize', () => {
    setImmediate(() => {
      if (quitting || win.isDestroyed()) return
      parkWindow(win)
    })
  })

  win.on('restore', () => {
    if (parked) return
    win.webContents.setBackgroundThrottling(false)
  })

  win.on('close', (e) => {
    // Close button parks too (keeps NDI / SRT); Quit from tray exits.
    if (!quitting && (ndiEnabled || srtPublisher.isAnyLive())) {
      e.preventDefault()
      parkWindow(win)
    }
  })

  win.on('closed', () => {
    srtReader.closeForWebContents(win.webContents)
    if (mainWindow === win) mainWindow = null
  })

  const target = resolveLoadTarget()
  if (target.kind === 'file') {
    if (!fs.existsSync(target.value)) {
      console.error(
        `[desktop] Missing ${target.value}. Run \`npm run build\` at repo root, then retry with --file.`,
      )
      app.quit()
      return
    }
    void win.loadFile(target.value)
  } else {
    void win.loadURL(target.value).catch((err) => {
      console.error(
        `[desktop] Failed to load ${target.value}. Is the SPA running? (${err.message})`,
      )
    })
  }

  if (hasFlag('--devtools')) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  ensureTray()
}

function startPowerBlocker() {
  if (powerBlockerId !== null) return
  try {
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension')
    console.info('[desktop] powerSaveBlocker: prevent-app-suspension')
  } catch (err) {
    console.warn(
      '[desktop] powerSaveBlocker failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

function stopPowerBlocker() {
  if (powerBlockerId === null) return
  try {
    if (powerSaveBlocker.isStarted(powerBlockerId)) {
      powerSaveBlocker.stop(powerBlockerId)
    }
  } catch {
    /* ignore */
  }
  powerBlockerId = null
}

/**
 * PRF measurement: BW_SRT_MEASURE=1 auto-starts AR+3D+2D and logs encoder fps.
 * Does not change STUDIO_TICK_FPS. NDI stays off unless the operator enables it.
 */
function maybeStartSrtMeasure() {
  const on = ['1', 'true', 'yes'].includes(
    (process.env.BW_SRT_MEASURE || '').trim().toLowerCase(),
  )
  if (!on && !hasFlag('--srt-measure')) return
  console.info(
    '[desktop] SRT measure: starting AR+3D+2D in 8s (NDI not started by this flag)',
  )
  setTimeout(() => {
    for (const channel of srtPublisherMod.SRT_OUT_CHANNEL_IDS) {
      void srtPublisher.start({ channel }).then((result) => {
        console.info(`[desktop] SRT measure start ${channel}:`, result)
      })
    }
  }, 8000)
  setInterval(() => {
    const all = srtPublisher.getStatusAll()
    const row = {}
    for (const id of srtPublisherMod.SRT_OUT_CHANNEL_IDS) {
      const st = all[id]
      row[id] = {
        state: st.state,
        encoder: st.encoder,
        encoderFps: st.encoderFps,
        err: st.lastError,
      }
    }
    console.info('[srt-enc]', JSON.stringify(row))
  }, 1000)
}

/** Main-process render clock + force compositor wake. */
function startStudioClock() {
  if (studioTickTimer !== null) return
  const intervalMs = 1000 / STUDIO_TICK_FPS
  studioTickTimer = setInterval(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      let isPlate = false
      for (const plate of srtPlateWindows.values()) {
        if (plate === win) {
          isPlate = true
          break
        }
      }
      // Plates paint at SRT_OUT_FPS. 60 Hz invalidate forces extra 1080
      // compositor copies and stalls the BGRA pipe. Still send studio:tick
      // so hidden-window rAF fallback keeps rendering. Do not change
      // STUDIO_TICK_FPS.
      if (!isPlate) {
        try {
          win.webContents.invalidate()
        } catch {
          /* ignore */
        }
      }
      win.webContents.setBackgroundThrottling(false)
      win.webContents.send('studio:tick')
    }
  }, intervalMs)
  console.info(`[desktop] studio tick clock ${STUDIO_TICK_FPS} fps (main process)`)
  if (ndiPerfTimer === null) {
    ndiPerfTimer = setInterval(() => {
      const summary = ndiSender.rotatePerf()
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) continue
        win.webContents.send('ndi:perf', summary)
      }
    }, 1000)
  }
}

function stopStudioClock() {
  if (studioTickTimer === null) return
  clearInterval(studioTickTimer)
  studioTickTimer = null
  if (ndiPerfTimer !== null) {
    clearInterval(ndiPerfTimer)
    ndiPerfTimer = null
  }
}

app.whenReady().then(async () => {
  registerNdiIpc()
  registerRacesIpc()
  registerConfigIpc()
  registerSrtIpc()
  registerSrtOutIpc()
  registerCinematicTilesIpc()
  cinematicRecord.registerCinematicRecordIpc(
    () => mainWindow && !mainWindow.isDestroyed() ? mainWindow : null,
  )
  console.info(
    `[desktop] races dir (${getRacesKind()}): ${getRacesDir()}`,
  )
  console.info(
    `[desktop] config.json (${getConfigKind()}): ${getConfigPath()}`,
  )
  const tileCacheDir = cinematicTileCache.getCinematicTileCacheDir({
    userDataPath: app.getPath('userData'),
  })
  console.info(`[desktop] cinematic tile cache: ${tileCacheDir}`)
  console.info(
    `[desktop] GPU preference: ${useIntegratedGpu ? 'integrated (opt-out)' : 'high-performance (discrete preferred)'}`,
  )
  try {
    const info = await app.getGPUInfo('basic')
    const gpuDevice =
      info && typeof info === 'object' && 'gpuDevice' in info
        ? /** @type {{ gpuDevice?: unknown }} */ (info).gpuDevice
        : undefined
    console.info('[desktop] GPU info (basic):', JSON.stringify(gpuDevice ?? info))
  } catch (err) {
    console.warn('[desktop] getGPUInfo failed', err)
  }
  if (ndiEnabled) {
    console.info(
      `[desktop] NDI enabled (default name "${resolveNdiName()}"). Use outputMode=transparent for alpha plate.`,
    )
    console.info(
      `[desktop] Studio buffer ${STUDIO_WIDTH}×${STUDIO_HEIGHT}; minimize parks off-screen so NDI stays ~30 fps (tray → Show studio).`,
    )
    startPowerBlocker()
  } else {
    console.info('[desktop] NDI disabled (--no-ndi)')
  }
  startStudioClock()
  createWindow()
  console.info(
    '[desktop] SRT program out: local callers 127.0.0.1:9201–9203 (gdigrab titles broadcast-web-srt-ar/3d/2d). OBS listeners first. NDI Send is not started by SRT.',
  )
  maybeStartSrtMeasure()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (mainWindow && !mainWindow.isDestroyed()) unparkWindow(mainWindow)
  })
})

app.on('before-quit', () => {
  quitting = true
  stopStudioClock()
  stopPowerBlocker()
  srtPublisher.shutdown()
  srtReader.shutdown()
  ndiSender.shutdown()
  if (tray) {
    tray.destroy()
    tray = null
  }
})

app.on('window-all-closed', () => {
  if (quitting || !ndiEnabled) {
    stopStudioClock()
    stopPowerBlocker()
    srtPublisher.shutdown()
    srtReader.shutdown()
    ndiSender.shutdown()
    if (process.platform !== 'darwin') app.quit()
  }
})
