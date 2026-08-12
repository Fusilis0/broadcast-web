import type { MaterializedVenuePack } from './types.ts'

let active: MaterializedVenuePack | null = null

/** Revoke previous blob URLs, keep the latest materialization alive. */
export function retainMaterializedVenuePack(
  next: MaterializedVenuePack,
): MaterializedVenuePack {
  if (active && active !== next) {
    try {
      active.revoke()
    } catch {
      /* ignore */
    }
  }
  active = next
  return next
}

export function revokeActiveMaterializedVenuePack(): void {
  if (!active) return
  try {
    active.revoke()
  } catch {
    /* ignore */
  }
  active = null
}
