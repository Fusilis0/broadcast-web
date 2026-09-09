/**
 * Renderer disk cache for cinematic ion tiles (SCN-07).
 * Does **not** import `getCinematicTileCacheDir` (Node fs).
 *
 * Read: GET `/cinematic-tiles/<sha256>` (Vite) or Electron IPC (`--file` / userData).
 * Write: POST (dev) or IPC (packaged). Bytes stay off git.
 */

import {
  cinematicTileCacheFileNameAsync,
  isCinematicTileCacheFileName,
  stripCinematicTileAuthQuery,
} from '../../platform/cinematicTileCacheKey.ts'

export const CINEMATIC_TILE_CACHE_URL_PREFIX = '/cinematic-tiles'

export type CinematicTilesIpc = {
  packaged?: () => Promise<boolean>
  has: (name: string) => Promise<boolean>
  read: (name: string) => Promise<ArrayBuffer | null>
  write: (payload: {
    name: string
    bytes: ArrayBuffer
    url?: string
  }) => Promise<{ ok: boolean; skipped?: boolean; error?: string }>
}

function cinematicTilesIpc(): CinematicTilesIpc | null {
  const bridge = (
    globalThis as { window?: { broadcastStudio?: { cinematicTiles?: CinematicTilesIpc } } }
  ).window?.broadcastStudio?.cinematicTiles
  if (!bridge || typeof bridge.read !== 'function' || typeof bridge.write !== 'function') {
    return null
  }
  return bridge
}

let packagedFileCache: boolean | null = null

async function isPackagedFileCache(): Promise<boolean> {
  if (packagedFileCache !== null) return packagedFileCache
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    packagedFileCache = true
    return true
  }
  const ipc = cinematicTilesIpc()
  if (ipc?.packaged) {
    try {
      packagedFileCache = (await ipc.packaged()) === true
      return packagedFileCache
    } catch {
      packagedFileCache = false
    }
  } else {
    packagedFileCache = false
  }
  return packagedFileCache
}

export type TileDiskCacheHooks = {
  fetchImpl?: typeof fetch
  ipc?: CinematicTilesIpc | null
}

const seenUrls = new Set<string>()
let inFlight = 0

export function cinematicTileCacheInFlight(): number {
  return inFlight
}

export function cinematicTileCacheIdle(): boolean {
  return inFlight === 0
}

export function collectedWarmContentUrls(): readonly string[] {
  return [...seenUrls].sort()
}

export function clearCollectedWarmContentUrls(): void {
  seenUrls.clear()
}

function rememberUrl(contentUrl: string): void {
  const stripped = stripCinematicTileAuthQuery(contentUrl)
  if (stripped !== '') seenUrls.add(stripped)
}

function cacheUrl(name: string): string {
  return `${CINEMATIC_TILE_CACHE_URL_PREFIX}/${name}`
}

/**
 * True when the hashed file is already on disk (GET 200 or IPC has).
 */
export async function cinematicTileCacheHas(
  contentUrl: string,
  hooks: TileDiskCacheHooks = {},
): Promise<boolean> {
  const name = await cinematicTileCacheFileNameAsync(contentUrl)
  const ipc = hooks.ipc !== undefined ? hooks.ipc : cinematicTilesIpc()
  if (ipc && (await isPackagedFileCache())) {
    try {
      return (await ipc.has(name)) === true
    } catch {
      return false
    }
  }
  if (ipc) {
    try {
      if ((await ipc.has(name)) === true) return true
    } catch {
      /* Vite GET below */
    }
  }
  const fetchImpl = hooks.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(cacheUrl(name), { method: 'HEAD' })
    if (res.ok) return true
    if (res.status === 405) {
      const getRes = await fetchImpl(cacheUrl(name), { method: 'GET' })
      return getRes.ok
    }
    return false
  } catch {
    return false
  }
}

export async function readCinematicTileCache(
  contentUrl: string,
  hooks: TileDiskCacheHooks = {},
): Promise<ArrayBuffer | null> {
  const name = await cinematicTileCacheFileNameAsync(contentUrl)
  if (!isCinematicTileCacheFileName(name)) return null
  const ipc = hooks.ipc !== undefined ? hooks.ipc : cinematicTilesIpc()
  if (ipc && (await isPackagedFileCache())) {
    try {
      const buf = await ipc.read(name)
      return buf && buf.byteLength > 0 ? buf : null
    } catch {
      return null
    }
  }
  const fetchImpl = hooks.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(cacheUrl(name), { method: 'GET' })
    if (res.ok) return await res.arrayBuffer()
  } catch {
    /* miss */
  }
  if (ipc) {
    try {
      const buf = await ipc.read(name)
      return buf && buf.byteLength > 0 ? buf : null
    } catch {
      return null
    }
  }
  return null
}

export async function writeCinematicTileCache(
  contentUrl: string,
  bytes: ArrayBuffer,
  hooks: TileDiskCacheHooks = {},
): Promise<'wrote' | 'skipped' | 'failed'> {
  if (bytes.byteLength === 0) return 'failed'
  const name = await cinematicTileCacheFileNameAsync(contentUrl)
  if (!isCinematicTileCacheFileName(name)) return 'failed'
  const ipc = hooks.ipc !== undefined ? hooks.ipc : cinematicTilesIpc()
  if (ipc && (await isPackagedFileCache())) {
    try {
      const result = await ipc.write({ name, bytes, url: contentUrl })
      if (result.ok && result.skipped) return 'skipped'
      return result.ok ? 'wrote' : 'failed'
    } catch {
      return 'failed'
    }
  }
  const fetchImpl = hooks.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(cacheUrl(name), {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-cinematic-tile-url': stripCinematicTileAuthQuery(contentUrl),
      },
      body: bytes,
    })
    if (res.status === 204) return 'skipped'
    if (res.ok) return 'wrote'
  } catch {
    /* IPC fallback */
  }
  if (ipc) {
    try {
      const result = await ipc.write({ name, bytes, url: contentUrl })
      if (result.ok && result.skipped) return 'skipped'
      return result.ok ? 'wrote' : 'failed'
    } catch {
      return 'failed'
    }
  }
  return 'failed'
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url, 'https://invalid.invalid').hostname
  } catch {
    return null
  }
}

/**
 * Cesium ion content (tiles / imagery / OSM), not the token endpoint.
 */
export function isIonContentUrl(url: string): boolean {
  const host = hostnameOf(url)
  if (!host) return false
  if (!/(^|\.)cesium\.com$/i.test(host)) return false
  try {
    const path = new URL(url).pathname
    if (/\/v1\/assets\/\d+\/endpoint\/?$/i.test(path)) return false
  } catch {
    return false
  }
  return true
}

function bufferToResponse(body: ArrayBuffer): Response {
  return new Response(body, {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/octet-stream',
      'x-cinematic-tile-cache': 'hit',
    },
  })
}

export type InstallCinematicTileFetchCacheOptions = {
  fetchImpl?: { fetch: typeof fetch; setFetch?: (next: typeof fetch) => void }
}

let installCount = 0
let originalFetch: typeof fetch | null = null

/**
 * Wrap `fetch` so ion GETs hit disk first, then ion, then POST/IPC write.
 * Refcounted — createTerrain + createBuildings share one wrap.
 */
export function installCinematicTileFetchCache(
  options: InstallCinematicTileFetchCacheOptions = {},
): () => void {
  installCount += 1
  if (installCount > 1) {
    return () => {
      uninstallCinematicTileFetchCache()
    }
  }
  const fetchHolder = options.fetchImpl
  const current =
    fetchHolder?.fetch ??
    (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch)
  originalFetch = current

  const wrapped: typeof fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    if (method !== 'GET' && method !== 'HEAD') {
      return current(input as RequestInfo, init)
    }
    if (url.startsWith(CINEMATIC_TILE_CACHE_URL_PREFIX)) {
      return current(input as RequestInfo, init)
    }
    if (!isIonContentUrl(url)) {
      return current(input as RequestInfo, init)
    }

    rememberUrl(url)
    inFlight += 1
    try {
      const cached = await readCinematicTileCache(url, { fetchImpl: current })
      if (cached) {
        return bufferToResponse(cached)
      }
      const res = await current(input as RequestInfo, init)
      if (res.ok && method === 'GET') {
        try {
          const bytes = await res.clone().arrayBuffer()
          const wrote = await writeCinematicTileCache(url, bytes, {
            fetchImpl: current,
          })
          if (wrote === 'skipped') {
            /* already on disk */
          }
        } catch {
          /* cache write is best-effort */
        }
      }
      return res
    } finally {
      inFlight = Math.max(0, inFlight - 1)
    }
  }) as typeof fetch

  if (fetchHolder?.setFetch) {
    fetchHolder.setFetch(wrapped)
  } else {
    globalThis.fetch = wrapped
  }

  return () => {
    uninstallCinematicTileFetchCache()
  }
}

export function uninstallCinematicTileFetchCache(): void {
  installCount = Math.max(0, installCount - 1)
  if (installCount > 0) return
  if (originalFetch) {
    globalThis.fetch = originalFetch
    originalFetch = null
  }
}

/** Test seam — reset wrap + URL set. */
export function resetCinematicTileFetchCacheForTests(): void {
  installCount = 0
  if (originalFetch) {
    globalThis.fetch = originalFetch
    originalFetch = null
  }
  inFlight = 0
  seenUrls.clear()
  packagedFileCache = null
}
