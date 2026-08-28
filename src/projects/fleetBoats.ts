/**
 * RaceProject `fleet.boats` snapshot / Load reconstruction (SCN 15.4).
 * Pack rows are the persist source of truth; names URL is fallback only.
 */

import { parseHexColorCss } from '../scene/boatNames/categoryColor.ts'
import type { RaceProjectFleetBoat } from './types.ts'

export type FleetBoatSnapshotInput = {
  id: string
  name?: string
  category?: string
  color?: string
  visibility?: 'solid' | 'ghost' | 'hidden'
  mapVisible?: boolean
  plannedLat?: number
  plannedLon?: number
}

export type FleetBoatNameEntry = {
  name: string
  category: string
}

function clonePlannedGps(
  row: FleetBoatSnapshotInput,
): Pick<RaceProjectFleetBoat, 'plannedLat' | 'plannedLon'> {
  if (
    typeof row.plannedLat !== 'number' ||
    !Number.isFinite(row.plannedLat) ||
    typeof row.plannedLon !== 'number' ||
    !Number.isFinite(row.plannedLon)
  ) {
    return {}
  }
  return { plannedLat: row.plannedLat, plannedLon: row.plannedLon }
}

/** Serialize one Live-fleet row for the pack (omit default solid / shown map). */
export function serializeFleetBoat(
  row: FleetBoatSnapshotInput,
): RaceProjectFleetBoat {
  const id = row.id.trim()
  const out: RaceProjectFleetBoat = {
    id,
    name: (row.name ?? '').trim() || id,
    category: (row.category ?? '').trim(),
  }
  const color = parseHexColorCss(row.color)
  if (color) out.color = color
  if (row.visibility && row.visibility !== 'solid') {
    out.visibility = row.visibility
  }
  if (row.mapVisible === false) out.mapVisible = false
  Object.assign(out, clonePlannedGps(row))
  return out
}

/**
 * Write `fleet.boats` in `boatIds` order so both fields stay in sync.
 * Missing rows become `{ id, name: id, category: '' }`.
 */
export function snapshotFleetBoats(
  boatIds: readonly string[],
  boats: readonly FleetBoatSnapshotInput[] | undefined,
): RaceProjectFleetBoat[] {
  const byId = new Map<string, FleetBoatSnapshotInput>()
  for (const row of boats ?? []) {
    const id = row.id.trim()
    if (id === '' || byId.has(id)) continue
    byId.set(id, row)
  }
  return boatIds.map((raw) => {
    const id = raw.trim()
    return serializeFleetBoat(byId.get(id) ?? { id, name: id, category: '' })
  })
}

/**
 * Rebuild Live-panel rows from a loaded pack.
 *
 * - `fleet.boats` present → use those rows (by `boatIds` order); names URL /
 *   catalogue fills ids missing from `boats[]`.
 * - `fleet.boats` omitted → one row per `boatIds` from the catalogue (do **not**
 *   dump extra catalogue-only demo ids).
 */
export function resolveLoadedFleetBoats(input: {
  boatIds: readonly string[]
  boats?: readonly RaceProjectFleetBoat[]
  catalogue: ReadonlyMap<string, FleetBoatNameEntry>
}): RaceProjectFleetBoat[] {
  const packed = new Map<string, RaceProjectFleetBoat>()
  for (const row of input.boats ?? []) {
    const id = row.id.trim()
    if (id === '' || packed.has(id)) continue
    packed.set(id, row)
  }
  return input.boatIds.map((raw) => {
    const id = raw.trim()
    const fromPack = packed.get(id)
    const fromCat = input.catalogue.get(id)
    if (fromPack) {
      const name = fromPack.name.trim() || fromCat?.name || id
      const category = fromPack.category.trim() || fromCat?.category || ''
      const out: RaceProjectFleetBoat = { id, name, category }
      const color = parseHexColorCss(fromPack.color)
      if (color) out.color = color
      if (fromPack.visibility) out.visibility = fromPack.visibility
      if (fromPack.mapVisible === false) out.mapVisible = false
      Object.assign(out, clonePlannedGps(fromPack))
      return out
    }
    return {
      id,
      name: fromCat?.name ?? id,
      category: fromCat?.category ?? '',
    }
  })
}
