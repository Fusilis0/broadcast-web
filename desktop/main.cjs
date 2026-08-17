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
} = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const ndiSender = require('./ndiSender.cjs')
const racesFs = require('./racesFs.cjs')

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
/** @type {import('electron').Tray | null} */
let tray = null
/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {{ x: number, y: number, width: number, height: number } | null} */
let preParkBounds = null
let parked = false
let quitting = false

const STUDIO_TICK_FPS = 30

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

  ipcMain.on('ndi:frame', (_evt, frame) => {
    if (!ndiEnabled) return
    const channel =
      frame && typeof frame === 'object' && 'channel' in frame
        ? frame.channel
        : ndiSender.DEFAULT_CHANNEL
    ndiSender.sendFrame(channel, frame)
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
    // Close button parks too (keeps NDI); Quit from tray exits.
    if (!quitting && ndiEnabled) {
      e.preventDefault()
      parkWindow(win)
    }
  })

  win.on('closed', () => {
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

/** Main-process render clock + force compositor wake. */
function startStudioClock() {
  if (studioTickTimer !== null) return
  const intervalMs = 1000 / STUDIO_TICK_FPS
  studioTickTimer = setInterval(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      try {
        win.webContents.invalidate()
      } catch {
        /* ignore */
      }
      win.webContents.setBackgroundThrottling(false)
      win.webContents.send('studio:tick')
    }
  }, intervalMs)
  console.info(`[desktop] studio tick clock ${STUDIO_TICK_FPS} fps (main process)`)
}

function stopStudioClock() {
  if (studioTickTimer === null) return
  clearInterval(studioTickTimer)
  studioTickTimer = null
}

app.whenReady().then(async () => {
  registerNdiIpc()
  registerRacesIpc()
  console.info(
    `[desktop] races dir (${getRacesKind()}): ${getRacesDir()}`,
  )
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else if (mainWindow && !mainWindow.isDestroyed()) unparkWindow(mainWindow)
  })
})

app.on('before-quit', () => {
  quitting = true
  stopStudioClock()
  stopPowerBlocker()
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
    ndiSender.shutdown()
    if (process.platform !== 'darwin') app.quit()
  }
})
