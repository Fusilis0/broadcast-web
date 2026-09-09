import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve as resolvePath } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import {
  CINEMATIC_TILE_CACHE_URL_PREFIX,
  getCinematicTileCacheDir,
  isCinematicTileCacheFileName,
} from './src/platform/cinematicTileCache.ts'

/** Cap a single POST so a runaway ion tile cannot fill the disk. */
const CINEMATIC_TILE_POST_MAX_BYTES = 32 * 1024 * 1024

function sendCinematicTile(
  filePath: string,
  res: import('node:http').ServerResponse,
): void {
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = 404
    res.end()
  })
  stream.pipe(res)
}

function cinematicTileFilePath(relRaw: string): string | 'bad' | 'forbidden' {
  if (!relRaw || relRaw.includes('..') || relRaw.includes('\\') || relRaw.includes('\0')) {
    return 'bad'
  }
  if (!isCinematicTileCacheFileName(relRaw)) return 'bad'
  const dir = getCinematicTileCacheDir({ userDataPath: null })
  const filePath = resolvePath(dir, relRaw)
  const relToDir = relative(dir, filePath)
  if (!relToDir || relToDir.startsWith('..') || isAbsolute(relToDir)) {
    return 'forbidden'
  }
  return filePath
}

function readRequestBody(
  req: import('node:http').IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > maxBytes) {
        req.destroy()
        reject(new Error('payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    req.on('error', reject)
  })
}

/** Map GET /cinematic-tiles/* → local cache dir. POST writes missing ion bytes. */
function cinematicTilesMiddleware(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  next: () => void,
): void {
  const rawUrl = req.url ?? ''
  const pathname = rawUrl.split('?')[0] ?? ''
  if (
    pathname !== CINEMATIC_TILE_CACHE_URL_PREFIX &&
    !pathname.startsWith(`${CINEMATIC_TILE_CACHE_URL_PREFIX}/`)
  ) {
    next()
    return
  }
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }
  const relRaw = decodeURIComponent(
    pathname.slice(CINEMATIC_TILE_CACHE_URL_PREFIX.length).replace(/^\/+/, ''),
  )
  const filePath = cinematicTileFilePath(relRaw)
  if (filePath === 'bad') {
    res.statusCode = 400
    res.end()
    return
  }
  if (filePath === 'forbidden') {
    res.statusCode = 403
    res.end()
    return
  }

  if (method === 'POST') {
    void (async () => {
      try {
        const body = await readRequestBody(req, CINEMATIC_TILE_POST_MAX_BYTES)
        const dir = getCinematicTileCacheDir({ userDataPath: null })
        mkdirSync(dir, { recursive: true })
        if (existsSync(filePath)) {
          res.statusCode = 204
          res.end()
          return
        }
        writeFileSync(filePath, body)
        res.statusCode = 201
        res.end()
      } catch {
        if (!res.headersSent) res.statusCode = 413
        res.end()
      }
    })()
    return
  }

  if (!existsSync(filePath)) {
    res.statusCode = 404
    res.end()
    return
  }
  const stat = statSync(filePath)
  if (!stat.isFile()) {
    res.statusCode = 404
    res.end()
    return
  }
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Length', String(stat.size))
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  if (method === 'HEAD') {
    res.end()
    return
  }
  sendCinematicTile(filePath, res)
}

function cinematicTilesPlugin(): Plugin {
  return {
    name: 'cinematic-tiles-cache',
    configureServer(server) {
      server.middlewares.use(cinematicTilesMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(cinematicTilesMiddleware)
    },
  }
}

// Production static host at domain root (Hetzner / any static SPA).
// Root-relative public assets: /races/, /fixtures/, /EGM96_1deg.bin
// Dev: proxy /api → projects API stub (npm run server) for projectsApiBase: "/api".
// GET/POST /cinematic-tiles → repo .cache/cinematic-tiles (ion bytes; not git).
export default defineConfig({
  plugins: [cinematicTilesPlugin()],
  base: '/',
  server: {
    // Bind IPv4 so Electron (http://127.0.0.1:5173) can connect.
    // On some Windows hosts Vite defaults to ::1 only → ERR_CONNECTION_REFUSED.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
