/**
 * RaceProject `fleet.boats` snapshot / Load reconstruction (SCN 15.4).
 * Pack rows are the persist source of truth; names URL is fallback only.
 * Project fleets accept any non-empty string id and may be empty — never
 * `DEFAULT_BOAT_IDS`.
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
 * Project-fleet id reader. Any non-empty string is legal; author order is
 * preserved; duplicates dropped. Empty stays empty — never the config
 * `DEFAULT_BOAT_IDS` demo slice.
 */
export function parseProjectFleetIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function hydratePackBoatRow(
  row: RaceProjectFleetBoat,
  catalogue: ReadonlyMap<string, FleetBoatNameEntry>,
): RaceProjectFleetBoat {
  const id = row.id.trim()
  const fromCat = catalogue.get(id)
  const name = row.name.trim() || fromCat?.name || id
  const category = row.category.trim() || fromCat?.category || ''
  const out: RaceProjectFleetBoat = { id, name, category }
  const color = parseHexColorCss(row.color)
  if (color) out.color = color
  if (row.visibility) out.visibility = row.visibility
  if (row.mapVisible === false) out.mapVisible = false
  Object.assign(out, clonePlannedGps(row))
  return out
}

/**
 * Write `fleet.boats` in `boatIds` order so both fields stay in sync.
 * Missing rows become `{ id, name: id, category: '' }`. Empty `boatIds`
 * yields `[]`.
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
  return parseProjectFleetIds(boatIds).map((id) =>
    serializeFleetBoat(byId.get(id) ?? { id, name: id, category: '' }),
  )
}

/**
 * Rebuild Live-panel rows from a loaded pack.
 *
 * - `fleet.boats` present (including `[]`) → that array is the complete fleet.
 *   Do not add ids from `boatIds` or from the names catalogue.
 * - `fleet.boats` omitted → one row per `boatIds` from the catalogue (do **not**
 *   dump extra catalogue-only demo ids).
 */
export function resolveLoadedFleetBoats(input: {
  boatIds: readonly string[]
  boats?: readonly RaceProjectFleetBoat[]
  catalogue: ReadonlyMap<string, FleetBoatNameEntry>
}): RaceProjectFleetBoat[] {
  if (input.boats !== undefined) {
    const out: RaceProjectFleetBoat[] = []
    const seen = new Set<string>()
    for (const row of input.boats) {
      const id = row.id.trim()
      if (id === '' || seen.has(id)) continue
      seen.add(id)
      out.push(hydratePackBoatRow(row, input.catalogue))
    }
    return out
  }
  return parseProjectFleetIds(input.boatIds).map((id) => {
    const fromCat = input.catalogue.get(id)
    return {
      id,
      name: fromCat?.name ?? id,
      category: fromCat?.category ?? '',
    }
  })
}

/**
 * Session fleet overlays boot only when no RaceProject pack is loaded
 * (`?race=` / later `switchRace`). A loaded pack always wins.
 */
export function resolveBootPanelBoats(input: {
  packLoaded: boolean
  packBoats: readonly RaceProjectFleetBoat[]
  sessionBoats?: readonly RaceProjectFleetBoat[] | null
}): RaceProjectFleetBoat[] {
  if (
    !input.packLoaded &&
    input.sessionBoats &&
    input.sessionBoats.length > 0
  ) {
    return input.sessionBoats.map((b) => ({ ...b }))
  }
  return input.packBoats.map((b) => ({ ...b }))
}
