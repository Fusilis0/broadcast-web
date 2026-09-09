/**
 * Electron save path for Phase 21 cinematic MP4.
 * Renderer captures via MediaRecorder; this process picks a path and writes
 * bytes. WebM is remuxed with ffmpeg so vMix gets a silent H.264 MP4.
 */
const { dialog, app, ipcMain } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const MAX_BYTES = 512 * 1024 * 1024

function isMp4Mime(mime) {
  const lower = typeof mime === 'string' ? mime.trim().toLowerCase() : ''
  return lower.startsWith('video/mp4') || lower.includes('mp4;')
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
    /* unpackaged */
  }
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

function ffmpegExists(ffmpegPath) {
  if (path.isAbsolute(ffmpegPath)) return fs.existsSync(ffmpegPath)
  return true
}

function defaultDir() {
  try {
    return app.getPath('videos')
  } catch {
    try {
      return app.getPath('documents')
    } catch {
      return os.tmpdir()
    }
  }
}

function withMp4Ext(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return filePath
  return filePath.toLowerCase().endsWith('.mp4') ? filePath : `${filePath}.mp4`
}

function buildCopyArgv(inputPath, outputPath) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-an',
    '-c:v',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}

function buildTranscodeArgv(inputPath, outputPath) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}

function runFfmpeg(ffmpegPath, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, argv, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
      if (stderr.length > 4000) stderr = stderr.slice(-4000)
    })
    child.on('error', (err) => {
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else {
        const tail = stderr.trim().slice(-400)
        reject(
          new Error(
            tail
              ? `ffmpeg exited ${code}: ${tail}`
              : `ffmpeg exited ${code ?? 'unknown'}`,
          ),
        )
      }
    })
  })
}

async function choosePath(win, defaultName) {
  const name =
    typeof defaultName === 'string' && defaultName.trim()
      ? defaultName.trim()
      : 'intro-bosphorus.mp4'
  const defaultPath = path.join(defaultDir(), withMp4Ext(name))
  const result = await dialog.showSaveDialog(win ?? undefined, {
    title: 'Save cinematic MP4',
    defaultPath,
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  })
  if (result.canceled || !result.filePath) {
    return { ok: false, cancelled: true }
  }
  return { ok: true, path: withMp4Ext(result.filePath) }
}

function toBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes)
  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  return null
}

async function writeMp4(payload) {
  const destPath =
    typeof payload?.path === 'string' && payload.path.trim()
      ? withMp4Ext(payload.path.trim())
      : ''
  if (!destPath) return { ok: false, error: 'missing path' }
  const buf = toBuffer(payload.bytes)
  if (!buf) return { ok: false, error: 'bad bytes' }
  if (buf.byteLength <= 0) return { ok: false, error: 'empty capture' }
  if (buf.byteLength > MAX_BYTES) return { ok: false, error: 'file too large' }

  const mime = typeof payload.mime === 'string' ? payload.mime : ''
  const ffmpegPath = resolveFfmpegPath()
  const canSpawn = ffmpegExists(ffmpegPath)

  try {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  if (isMp4Mime(mime) && !canSpawn) {
    try {
      fs.writeFileSync(destPath, buf)
      return { ok: true, path: destPath }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  const ext = isMp4Mime(mime) ? '.mp4' : '.webm'
  const tmp = path.join(os.tmpdir(), `bw-cinematic-${Date.now()}${ext}`)
  try {
    fs.writeFileSync(tmp, buf)
    if (!canSpawn) {
      if (isMp4Mime(mime)) {
        fs.copyFileSync(tmp, destPath)
        return { ok: true, path: destPath }
      }
      return {
        ok: false,
        error: 'ffmpeg not found — cannot mux WebM to MP4',
      }
    }
    const argv = isMp4Mime(mime)
      ? buildCopyArgv(tmp, destPath)
      : buildTranscodeArgv(tmp, destPath)
    try {
      await runFfmpeg(ffmpegPath, argv)
      return { ok: true, path: destPath }
    } catch (err) {
      if (isMp4Mime(mime)) {
        try {
          fs.copyFileSync(tmp, destPath)
          return { ok: true, path: destPath }
        } catch (copyErr) {
          return {
            ok: false,
            error:
              copyErr instanceof Error ? copyErr.message : String(copyErr),
          }
        }
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {() => import('electron').BrowserWindow | null} getWindow
 */
function registerCinematicRecordIpc(getWindow) {
  ipcMain.handle('cinematicRecord:choosePath', async (_evt, payload) => {
    try {
      return await choosePath(getWindow(), payload && payload.defaultName)
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
  ipcMain.handle('cinematicRecord:write', async (_evt, payload) => {
    try {
      return await writeMp4(payload)
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}

module.exports = {
  isMp4Mime,
  withMp4Ext,
  buildCopyArgv,
  buildTranscodeArgv,
  registerCinematicRecordIpc,
}
