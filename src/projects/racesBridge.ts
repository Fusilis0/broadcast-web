/**
 * Electron `broadcastStudio.races` bridge (Phase 13.8).
 * Absent in plain Chrome — Save stays download-only.
 */

export type StudioRacesRootKind = 'public' | 'userData'

export type StudioRacesSaveResult =
  | { ok: true; id: string; path: string }
  | { ok: false; error: string }

export type StudioRacesListResult =
  | { ok: true; ids: string[]; kind?: StudioRacesRootKind }
  | { ok: false; error: string }

export type StudioRacesReadResult =
  | { ok: true; project: unknown }
  | { ok: false; error: string }

export type StudioRacesRootResult = {
  kind: StudioRacesRootKind
  path: string
}

export type StudioRacesBridge = {
  save: (project: unknown) => Promise<StudioRacesSaveResult>
  list: () => Promise<StudioRacesListResult>
  read: (id: string) => Promise<StudioRacesReadResult>
  getRoot?: () => Promise<StudioRacesRootResult>
}

/** True when Electron preload injected `window.broadcastStudio.races`. */
export function getRacesBridge(): StudioRacesBridge | null {
  const root = globalThis as typeof globalThis & {
    window?: Window
  }
  const bridge = root.window?.broadcastStudio
  const races = bridge?.races
  if (
    races &&
    typeof races.save === 'function' &&
    typeof races.list === 'function' &&
    typeof races.read === 'function'
  ) {
    return races
  }
  return null
}
