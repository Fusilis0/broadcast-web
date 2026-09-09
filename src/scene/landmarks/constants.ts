/**
 * Hero historic landmarks (Phase 20.1b). Local glTF or named proxies.
 * Opaque-only — same gate as OSM Buildings. Occupancy disks in scene ENU.
 */

/** Ops default — heroes on until the operator unchecks. */
export const DEFAULT_HEROES_ENABLED = true

/** sessionStorage: missing → on; `'0'` → off. */
export const LANDMARKS_SESSION_ENABLED_KEY = 'bw.heroes.enabled'

/** Tab backup of authoring offsets (survives refresh, not a new browser). */
export const LANDMARKS_OFFSETS_SESSION_KEY = 'bw.landmarks.offsets'

/** Studio-wide hero poses. Survives Load / new tab. Not git. */
export const LANDMARKS_OFFSETS_LOCAL_KEY = 'bw.landmarks.offsets.global'

/** Debounce for Electron/API auto-write of landmark offsets. */
export const LANDMARKS_AUTOSAVE_MS = 400

/**
 * Focus orbit cap (m). Bridges have kilometre AABBs — do not pull free cam
 * to space. Occupancy disks stay at catalogue radius.
 */
export const LANDMARK_FOCUS_RADIUS_CAP_M = 220

/** Authored glTF / proxy unit. 1 unit = 1 metre. Do not rescale by eye. */
export const LANDMARK_AUTHORED_UNIT_M = 1

/** Cap at the current operator pack (catalogue length). */
export const MAX_LANDMARKS = 13

/** 3D DOM overlay only (never AR / WebGL plate). Sketchfab CC-BY-4.0. */
export const LANDMARK_CCBY_CREDIT =
  "Maiden's Tower © oblo.3d (CC-BY-4.0)"

/**
 * OpenSKP leftover millimetres → metres. Applied only when world AABB is
 * tens of kilometres (not an eyeball fudge, not a geoid).
 */
export const LANDMARK_MM_TO_M = 0.001

/** OpenSKP leftover inches → metres. Applied only when AABB is ~39× real. */
export const LANDMARK_INCHES_TO_M = 0.0254

/** AABB max dimension (m) treated as “tens of km”. */
export const LANDMARK_TENS_OF_KM_M = 10_000

export function shouldShowLandmarks(
  enabled: boolean,
  opaqueClearSafe: boolean,
): boolean {
  return enabled === true && opaqueClearSafe === true
}

export function readSessionHeroesEnabled(fallback = true): boolean {
  try {
    const raw = sessionStorage.getItem(LANDMARKS_SESSION_ENABLED_KEY)
    if (raw === null || raw === '') return fallback
    return raw !== '0'
  } catch {
    return fallback
  }
}

export function writeSessionHeroesEnabled(enabled: boolean): void {
  try {
    sessionStorage.setItem(LANDMARKS_SESSION_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // sessionStorage may be blocked
  }
}
