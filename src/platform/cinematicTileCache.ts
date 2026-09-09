/**
 * Studio disk cache for cinematic Cesium ion tiles (Phase 21.3a).
 * Bytes stay off git. SCN-07 prefetches; this module only resolves the folder.
 *
 * Node / Electron main / Vitest only — do not import from the SPA entry.
 * Renderer reads `GET /cinematic-tiles/<file>` (Vite plugin in `vite.config.ts`).
 */

import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { stripCinematicTileAuthQuery } from './cinematicTileCacheKey.ts'

export {
  cinematicTileCacheFileNameAsync,
  isCinematicTileCacheFileName,
  stripCinematicTileAuthQuery,
} from './cinematicTileCacheKey.ts'

/** Folder name under Electron userData or repo `.cache/`. */
export const CINEMATIC_TILE_CACHE_DIR_NAME = 'cinematic-tiles'

/** Repo-adjacent Vite / Vitest path (posix, relative to cwd). */
export const CINEMATIC_TILE_CACHE_VITE_RELATIVE = '.cache/cinematic-tiles'

/** Renderer URL prefix mapped to the cache dir by the Vite plugin. */
export const CINEMATIC_TILE_CACHE_URL_PREFIX = '/cinematic-tiles'

export type CinematicTileCacheResolveOptions = {
  cwd?: string
  /**
   * Electron `app.getPath('userData')`.
   * Omit → probe Electron main. Pass `null` to force the Vite `.cache` path.
   */
  userDataPath?: string | null
}

function tryElectronUserDataPath(): string | null {
  if (typeof process === 'undefined') return null
  const versions = process.versions as { electron?: string } | undefined
  if (!versions?.electron) return null
  const processType = (process as { type?: string }).type
  if (processType && processType !== 'browser') return null
  try {
    const req = createRequire(import.meta.url)
    const electron = req('electron') as {
      app?: { getPath?: (name: string) => string }
    }
    const getPath = electron.app?.getPath
    if (typeof getPath !== 'function') return null
    const userData = getPath.call(electron.app, 'userData')
    if (typeof userData !== 'string' || userData.length === 0) return null
    return userData
  } catch {
    return null
  }
}

function resolveUserDataPath(
  options?: CinematicTileCacheResolveOptions,
): string | null {
  if (options && Object.prototype.hasOwnProperty.call(options, 'userDataPath')) {
    const value = options.userDataPath
    return typeof value === 'string' && value.length > 0 ? value : null
  }
  return tryElectronUserDataPath()
}

/**
 * Absolute cache directory. Electron main → `userData/cinematic-tiles`.
 * Vite / Vitest / node → `<cwd>/.cache/cinematic-tiles`.
 */
export function resolveCinematicTileCacheDir(
  options?: CinematicTileCacheResolveOptions,
): string {
  const userData = resolveUserDataPath(options)
  if (userData) {
    return join(userData, CINEMATIC_TILE_CACHE_DIR_NAME)
  }
  const cwd = options?.cwd ?? process.cwd()
  return join(cwd, '.cache', CINEMATIC_TILE_CACHE_DIR_NAME)
}

/**
 * Absolute cache directory. Creates the folder on first use; does not throw
 * if create fails (SCN may mkdir later).
 */
export function getCinematicTileCacheDir(
  options?: CinematicTileCacheResolveOptions,
): string {
  const dir = resolveCinematicTileCacheDir(options)
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* SCN-07 may create */
  }
  return dir
}

/**
 * Filename inside the cache dir: SHA-256 hex of the content URL with token
 * query stripped. SCN-07 writes `join(getCinematicTileCacheDir(), name)`.
 * Sync Node helper — SPA uses `cinematicTileCacheFileNameAsync` (Web Crypto).
 */
export function cinematicTileCacheFileName(contentUrl: string): string {
  const canonical = stripCinematicTileAuthQuery(contentUrl)
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
