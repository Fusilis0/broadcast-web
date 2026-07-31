/**
 * Electron studio shell for broadcast-web (Phase 7.3b).
 * Loads the SPA and publishes a named alpha NDI source via grandi.
 *
 * Studio output is locked to 1920×1080 in the SPA; the window may be resized
 * or minimized without stopping the NDI stream.
 *
 * Modes (first matching flag / env wins):
 *   --dev   or default          → http://127.0.0.1:5173  (Vite `npm run dev`)
 *   --preview                   → http://127.0.0.1:4173  (Vite `npm run preview`)
 *   --file                      → file://…/dist/index.html (run `npm run build` first)
 *   BROADCAST_WEB_URL=<url>     → override any of the above
 *   BROADCAST_NDI_NAME=<name>   → NDI source name (default broadcast-web)
 *   --no-ndi                    → disable NDI sender
 */
const { app, BrowserWindow, ipcMain, powerSaveBlocker } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const ndiSender = require('./ndiSender.cjs')

const DEV_URL = 'http://127.0.0.1:5173'
const PREVIEW_URL = 'http://127.0.0.1:4173'
const STUDIO_WIDTH = 1920
const STUDIO_HEIGHT = 1080

// Keep renderer timers / rAF eligible while occluded or minimized.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-background-timer-throttling')

/** @type {number | null} */
let powerBlockerId = null
/** @type {ReturnType<typeof setInterval> | null} */
let studioTickTimer = null
const STUDIO_TICK_FPS = 30

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
    const name =
      (opts && typeof opts.name === 'string' && opts.name.trim()) ||
      resolveNdiName()
    const result = await ndiSender.start(name)
    if (result.ok) {
      console.info(`[desktop] NDI source: ${result.sourceName} (${result.sdkVersion})`)
    } else {
      console.error(`[desktop] NDI start failed: ${result.error}`)
    }
    return result
  })

  ipcMain.handle('ndi:stop', async () => {
    await ndiSender.stop()
  })

  ipcMain.handle('ndi:status', () => ndiSender.getStatus())

  ipcMain.on('ndi:frame', (_evt, frame) => {
    if (!ndiEnabled) return
    ndiSender.sendFrame(frame)
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

  win.webContents.setBackgroundThrottling(false)

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

/** Main-process render clock — renderer timers are throttled when minimized. */
function startStudioClock() {
  if (studioTickTimer !== null) return
  const intervalMs = 1000 / STUDIO_TICK_FPS
  studioTickTimer = setInterval(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
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

app.whenReady().then(() => {
  registerNdiIpc()
  if (ndiEnabled) {
    console.info(
      `[desktop] NDI enabled (default name "${resolveNdiName()}"). Use outputMode=transparent for alpha plate.`,
    )
    console.info(
      `[desktop] Studio buffer ${STUDIO_WIDTH}×${STUDIO_HEIGHT}; NDI continues when window is resized or minimized.`,
    )
    startPowerBlocker()
  } else {
    console.info('[desktop] NDI disabled (--no-ndi)')
  }
  // Always drive SPA frames from main so minimize does not throttle to ~0.2 fps.
  startStudioClock()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopStudioClock()
  stopPowerBlocker()
  ndiSender.shutdown()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopStudioClock()
  stopPowerBlocker()
  ndiSender.shutdown()
})
