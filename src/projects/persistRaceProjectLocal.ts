/**
 * Persist RaceProject for Save / Save as / Export (Phase 13.8 UX).
 * Electron folderMode: races.save is primary; download only when requested.
 * Chrome: download is primary (browser cannot write public/races/).
 */

import type { StudioRacesBridge, StudioRacesSaveResult } from './racesBridge.ts'
import type { RaceProject } from './types.ts'

export type PersistRaceProjectMode = 'save' | 'saveAs' | 'export'

export type PersistRaceProjectOptions = {
  project: RaceProject
  /** Electron races bridge; null/undefined → Chrome download-only path. */
  racesBridge?: StudioRacesBridge | null
  /**
   * `save` / `saveAs`: folder write when bridge present; else download.
   * `export`: always download; skip folder write.
   */
  mode: PersistRaceProjectMode
  /** Force download even when folder write succeeds (rare). Default false. */
  alsoDownload?: boolean
  download: (project: RaceProject) => void
}

export type PersistRaceProjectResult = {
  downloaded: boolean
  local: StudioRacesSaveResult | null
}

/**
 * Run the correct persist path for the current shell.
 * Does not touch the HTTP projects API (caller handles that additively).
 */
export async function persistRaceProjectLocal(
  options: PersistRaceProjectOptions,
): Promise<PersistRaceProjectResult> {
  const { project, mode, download } = options
  const bridge = options.racesBridge ?? null
  const folderMode = Boolean(bridge) && mode !== 'export'

  let local: StudioRacesSaveResult | null = null
  let downloaded = false

  if (folderMode && bridge) {
    try {
      local = await bridge.save(project)
    } catch (err) {
      local = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
    if (options.alsoDownload) {
      download(project)
      downloaded = true
    }
    return { downloaded, local }
  }

  download(project)
  downloaded = true
  return { downloaded, local: null }
}

export function formatPersistStatus(
  result: PersistRaceProjectResult,
  extras?: { api?: boolean },
): string {
  const parts: string[] = []
  if (result.local?.ok) {
    parts.push(`folder: ${result.local.path}`)
  } else if (result.local && !result.local.ok) {
    parts.push(`folder failed: ${result.local.error}`)
  }
  if (result.downloaded) parts.push('download')
  if (extras?.api) parts.push('API')
  if (parts.length === 0) return 'save: no persist'
  return parts.join(' · ')
}
