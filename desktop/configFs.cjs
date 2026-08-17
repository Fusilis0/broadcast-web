/**
 * Patch git-shared / userData `config.json` from the Electron studio shell.
 * Dev / Vite URL → repo `public/config.json` (commit to share the ion token).
 * `--file` → `userData/config.json` (not git; dist is not writable).
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const CESIUM_ION_TOKEN_MAX_LEN = 8192

/**
 * @param {'url' | 'file'} loadKind
 * @param {{ desktopDir: string, userDataPath: string }} paths
 * @returns {string}
 */
function resolveConfigPath(loadKind, paths) {
  if (loadKind === 'file') {
    return path.join(paths.userDataPath, 'config.json')
  }
  return path.join(paths.desktopDir, '..', 'public', 'config.json')
}

/**
 * @param {'url' | 'file'} loadKind
 * @returns {'public' | 'userData'}
 */
function resolveConfigKind(loadKind) {
  return loadKind === 'file' ? 'userData' : 'public'
}

/**
 * Merge `cesiumIonToken` into an existing config.json. Does not log the token.
 * @param {string} configPath
 * @param {unknown} token
 */
async function setCesiumIonToken(configPath, token) {
  if (typeof token !== 'string') {
    return { ok: false, error: 'invalid token' }
  }
  const trimmed = token.trim()
  if (trimmed.length > CESIUM_ION_TOKEN_MAX_LEN) {
    return { ok: false, error: 'token too long' }
  }

  let existing
  try {
    existing = JSON.parse(await fs.promises.readFile(configPath, 'utf8'))
  } catch {
    return { ok: false, error: 'config.json missing' }
  }
  if (
    existing === null ||
    typeof existing !== 'object' ||
    Array.isArray(existing)
  ) {
    return { ok: false, error: 'invalid config.json' }
  }

  existing.cesiumIonToken = trimmed
  await fs.promises.writeFile(
    configPath,
    `${JSON.stringify(existing, null, 2)}\n`,
    'utf8',
  )
  return { ok: true, path: configPath }
}

module.exports = {
  CESIUM_ION_TOKEN_MAX_LEN,
  resolveConfigPath,
  resolveConfigKind,
  setCesiumIonToken,
}
