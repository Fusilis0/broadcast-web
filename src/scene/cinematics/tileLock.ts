/**
 * When to freeze cinematic LOD. A fresh tileset reports downloadIdle
 * before the first update queues work — locking then leaves an empty globe.
 */

export const CINEMATIC_LOCK_MIN_IDLE_FRAMES = 10
/** A handful of root tiles is not a globe — wait for a real mesh. */
export const CINEMATIC_LOCK_MIN_VISIBLE = 6
export const CINEMATIC_LOCK_MIN_VISIBLE_ENU = 18

export type CinematicLockReadyInput = {
  visibleTerrain: number
  downloadIdle: boolean
  cacheIdle: boolean
  idleFrames: number
  minIdleFrames?: number
  minVisible?: number
}

/**
 * True only after tiles have appeared and stayed idle for N frames.
 * Never treat “idle + 0 visible” as ready.
 */
export function cinematicTilesReadyToLock(
  input: CinematicLockReadyInput,
): boolean {
  const min = input.minIdleFrames ?? CINEMATIC_LOCK_MIN_IDLE_FRAMES
  const minVis = input.minVisible ?? CINEMATIC_LOCK_MIN_VISIBLE
  if (input.visibleTerrain < minVis) return false
  if (!input.downloadIdle || !input.cacheIdle) return false
  return input.idleFrames >= min
}
