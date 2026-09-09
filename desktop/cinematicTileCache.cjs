/**
 * Cinematic ion tile cache directory (Phase 21.3a / DSP-PLT-20260908-01).
 * Electron → `userData/cinematic-tiles`. Vite/node → `.cache/cinematic-tiles`.
 * Does not fetch ion. Tile bytes are not git.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const DIR_NAME = 'cinematic-tiles'

/**
 * @param {{ cwd?: string, userDataPath?: string | null }} [paths]
 * @returns {string | null}
 */
function resolveUserDataPath(paths) {
  if (paths && Object.prototype.hasOwnProperty.call(paths, 'userDataPath')) {
    const value = paths.userDataPath
    return typeof value === 'string' && value.length > 0 ? value : null
  }
  return null
}

/**
 * @param {{ cwd?: string, userDataPath?: string | null }} [paths]
 * @returns {string}
 */
function resolveCinematicTileCacheDir(paths) {
  const userData = resolveUserDataPath(paths)
  if (userData) {
    return path.join(userData, DIR_NAME)
  }
  const cwd = (paths && paths.cwd) || process.cwd()
  return path.join(cwd, '.cache', DIR_NAME)
}

/**
 * Absolute cache dir. Creates on first use; does not throw if mkdir fails.
 * @param {{ cwd?: string, userDataPath?: string | null }} [paths]
 * @returns {string}
 */
function getCinematicTileCacheDir(paths) {
  const dir = resolveCinematicTileCacheDir(paths)
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    /* SCN-07 may create */
  }
  return dir
}

module.exports = {
  DIR_NAME,
  getCinematicTileCacheDir,
  resolveCinematicTileCacheDir,
}
