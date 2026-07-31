/**
 * Minimal Electron studio shell for broadcast-web (Phase 7.3a).
 * Loads the SPA only — no NDI SDK / frame sender in this slice.
 *
 * Modes (first matching flag / env wins):
 *   --dev   or default          → http://127.0.0.1:5173  (Vite `npm run dev`)
 *   --preview                   → http://127.0.0.1:4173  (Vite `npm run preview`)
 *   --file                      → file://…/dist/index.html (run `npm run build` first)
 *   BROADCAST_WEB_URL=<url>     → override any of the above
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DEV_URL = 'http://127.0.0.1:5173'
const PREVIEW_URL = 'http://127.0.0.1:4173'

function hasFlag(name) {
  return process.argv.includes(name)
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
  // Default = Vite dev (also when --dev is passed explicitly).
  return { kind: 'url', value: DEV_URL }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'broadcast-web (studio shell)',
    webPreferences: {
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
