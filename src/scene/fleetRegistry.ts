import { DEFAULT_BOAT_ID } from './boatEntity.ts'

/**
 * Allow-set for SCN fleet entities. Empty / omitted → single default id `21`
 * (callers normally pass `loadConfig().boatIds`).
 */
export function boatIdAllowSet(
  boatIds?: readonly string[],
): ReadonlySet<string> {
  if (boatIds !== undefined && boatIds.length > 0) {
    return new Set(boatIds)
  }
  return new Set([DEFAULT_BOAT_ID])
}

/** True when a boat pose id may create/update a scene entity. */
export function isAllowedBoatId(
  id: string,
  allow: ReadonlySet<string>,
): boolean {
  return allow.has(id)
}

/**
 * Registered boat ids that are no longer in the allow-set (soft race switch).
 * Callers dispose/remove those entities from the fleet map.
 */
export function orphanBoatIds(
  registeredIds: Iterable<string>,
  allow: ReadonlySet<string>,
): string[] {
  const orphans: string[] = []
  for (const id of registeredIds) {
    if (!allow.has(id)) orphans.push(id)
  }
  return orphans
}

/**
 * Compact multi-boat ENU status for stub HUD.
 * Example: `boats=2  21=(1.0, 0.0, 2.0) 22=(3.0, 0.0, 4.0)`
 */
export function formatBoatEnuStatus(
  boatEnuById: ReadonlyMap<string, string>,
  maxLen = 160,
): string {
  if (boatEnuById.size === 0) return 'boats=0'
  const ids = [...boatEnuById.keys()].sort()
  const detail = ids.map((id) => `${id}=${boatEnuById.get(id)}`).join(' ')
  let line = `boats=${boatEnuById.size}  ${detail}`
  if (line.length > maxLen) {
    line = `${line.slice(0, Math.max(0, maxLen - 1))}…`
  }
  return line
}
