/** Legacy single-drone default (also `povIds[0]` when list is empty). */
export const DEFAULT_DRONE_ID = '1'

/** Default POV allow-list when omitted (matches committed `config.json`). */
export const DEFAULT_POV_IDS: readonly string[] = ['1', '2']

/**
 * Allow-set for SCN POV / camera pose ids. Empty / omitted → default
 * `["1","2"]` (callers normally pass `loadConfig().povIds`).
 */
export function povIdAllowSet(
  povIds?: readonly string[],
): ReadonlySet<string> {
  if (povIds !== undefined && povIds.length > 0) {
    return new Set(povIds)
  }
  return new Set(DEFAULT_POV_IDS)
}

/** Ordered POV id list for HUD / scene (stable order from config). */
export function resolvePovIdList(
  povIds?: readonly string[],
  /** @deprecated Single-id alias when `povIds` omitted. */
  droneId?: string,
): string[] {
  if (povIds !== undefined && povIds.length > 0) {
    return [...povIds]
  }
  if (droneId !== undefined && droneId !== '') {
    return [droneId]
  }
  return [...DEFAULT_POV_IDS]
}

/** True when a drone/cam pose id may drive the render camera. */
export function isAllowedPovId(
  id: string,
  allow: ReadonlySet<string>,
): boolean {
  return allow.has(id)
}

/**
 * Initial active POV: prefer deprecated `droneId` when in the allow-list,
 * otherwise `povIds[0]` / `DEFAULT_DRONE_ID`.
 */
export function resolveInitialPovId(
  povIds: readonly string[],
  droneId?: string,
): string {
  if (droneId !== undefined && droneId !== '' && povIds.includes(droneId)) {
    return droneId
  }
  return povIds[0] ?? DEFAULT_DRONE_ID
}

/**
 * Compact POV status for stub HUD.
 * Example: `pov=1  seen=1,2`
 */
export function formatPovStatus(
  activePovId: string,
  seenIds: ReadonlySet<string> | readonly string[],
): string {
  const seen =
    seenIds instanceof Set
      ? [...seenIds].sort()
      : [...seenIds].sort()
  const seenPart = seen.length > 0 ? seen.join(',') : '—'
  return `pov=${activePovId}  seen=${seenPart}`
}
