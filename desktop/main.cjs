/**
 * Electron studio shell for broadcast-web (Phase 7.3b).
 * Loads the SPA and publishes a named alpha NDI source via grandi.
 *
 * Modes (first matching flag / env wins):
 *   --dev   or default          → http://127.0.0.1:5173  (Vite `npm run dev`)
 *   --preview                   → http://127.0.0.1:4173  (Vite `npm run preview`)
 *   --file                      → file://…/dist/index.html (run `npm run build` first)
 *   BROADCAST_WEB_URL=<url>     → override any of the above
 *   BROADCAST_NDI_NAME=<name>   → NDI source name (default broadcast-web)
 *   --no-ndi                    → disable NDI sender
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const ndiSender = require('./ndiSender.cjs')

const DEV_URL = 'http://127.0.0.1:5173'
const PREVIEW_URL = 'http://127.0.0.1:4173'

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
    width: 1280,
    height: 720,
    title: 'broadcast-web (studio)',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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
}

app.whenReady().then(() => {
  registerNdiIpc()
  if (ndiEnabled) {
    console.info(
      `[desktop] NDI enabled (default name "${resolveNdiName()}"). Use outputMode=transparent for alpha plate.`,
    )
  } else {
    console.info('[desktop] NDI disabled (--no-ndi)')
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  ndiSender.shutdown()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  ndiSender.shutdown()
})
