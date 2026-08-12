/**
 * Local RaceProject folder I/O for the Electron studio shell (Phase 13.8).
 * Dev / Vite URL → repo `public/races/`. `--file` → `userData/races/`.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

/** @param {unknown} id */
function isSafeRaceId(id) {
  return typeof id === 'string' && SAFE_ID.test(id)
}

/**
 * @param {'url' | 'file'} loadKind
 * @param {{ desktopDir: string, userDataPath: string }} paths
 * @returns {string}
 */
function resolveRacesDir(loadKind, paths) {
  if (loadKind === 'file') {
    return path.join(paths.userDataPath, 'races')
  }
  return path.join(paths.desktopDir, '..', 'public', 'races')
}

/**
 * @param {'url' | 'file'} loadKind
 * @returns {'public' | 'userData'}
 */
function resolveRacesKind(loadKind) {
  return loadKind === 'file' ? 'userData' : 'public'
}

/**
 * Merge-and-dedupe; never drops existing safe ids. Appends `id` when safe + missing.
 * @param {unknown[]} existing
 * @param {string} [id]
 * @returns {string[]}
 */
function upsertRaceIndexIds(existing, id) {
  const out = []
  const seen = new Set()
  if (Array.isArray(existing)) {
    for (const item of existing) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim()
      if (!isSafeRaceId(trimmed) || seen.has(trimmed)) continue
      seen.add(trimmed)
      out.push(trimmed)
    }
  }
  if (typeof id === 'string') {
    const trimmed = id.trim()
    if (isSafeRaceId(trimmed) && !seen.has(trimmed)) {
      out.push(trimmed)
    }
  }
  return out
}

/**
 * @param {string} racesDir
 * @param {unknown} project
 */
async function saveRaceProject(racesDir, project) {
  if (project === null || typeof project !== 'object' || Array.isArray(project)) {
    return { ok: false, error: 'invalid project' }
  }
  const rawId = /** @type {{ id?: unknown }} */ (project).id
  const id = typeof rawId === 'string' ? rawId.trim() : ''
  if (!isSafeRaceId(id)) {
    return { ok: false, error: 'invalid race id' }
  }

  const dir = path.join(racesDir, id)
  await fs.promises.mkdir(dir, { recursive: true })
  const projectPath = path.join(dir, 'project.json')
  await fs.promises.writeFile(
    projectPath,
    `${JSON.stringify(project, null, 2)}\n`,
    'utf8',
  )

  const indexPath = path.join(racesDir, 'index.json')
  let existing = []
  try {
    const raw = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'))
    if (Array.isArray(raw?.ids)) existing = raw.ids
  } catch {
    /* missing or invalid → start fresh, still upsert below */
  }
  const ids = upsertRaceIndexIds(existing, id)
  await fs.promises.writeFile(
    indexPath,
    `${JSON.stringify({ ids }, null, 2)}\n`,
    'utf8',
  )

  return { ok: true, id, path: dir }
}

/**
 * @param {string} racesDir
 */
async function listRaceIds(racesDir) {
  await fs.promises.mkdir(racesDir, { recursive: true })
  const indexPath = path.join(racesDir, 'index.json')
  let existing = []
  try {
    const raw = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'))
    if (Array.isArray(raw?.ids)) existing = raw.ids
  } catch {
    /* empty */
  }
  return { ok: true, ids: upsertRaceIndexIds(existing) }
}

/**
 * @param {string} racesDir
 * @param {unknown} id
 */
async function readRaceProject(racesDir, id) {
  const trimmed = typeof id === 'string' ? id.trim() : ''
  if (!isSafeRaceId(trimmed)) {
    return { ok: false, error: 'invalid race id' }
  }
  const projectPath = path.join(racesDir, trimmed, 'project.json')
  try {
    const text = await fs.promises.readFile(projectPath, 'utf8')
    const project = JSON.parse(text)
    return { ok: true, project }
  } catch {
    return { ok: false, error: 'not found' }
  }
}

module.exports = {
  isSafeRaceId,
  resolveRacesDir,
  resolveRacesKind,
  upsertRaceIndexIds,
  saveRaceProject,
  listRaceIds,
  readRaceProject,
}
