import { parseCategoryColor, parseHexColorCss } from './categoryColor.ts'
import type { BoatNameEntry, BoatNamesCatalogue } from './types.ts'

export type UpsertBoatNameInput = {
  id: string
  name: string
  category?: string
  /** Optional `#rrggbb`; else derived from category keywords. */
  color?: string
}

/**
 * Merge one boat identity into a catalogue (immutable).
 * Used by the ops Fleet/Live panel — no fixture file write.
 */
export function upsertBoatNameEntry(
  catalogue: BoatNamesCatalogue,
  input: UpsertBoatNameInput,
): Map<string, BoatNameEntry> {
  const id = input.id.trim()
  const name = input.name.trim() || id
  const category = (input.category ?? '').trim() || 'Ops'
  const color =
    parseHexColorCss(input.color) ?? parseCategoryColor(category)
  const next = new Map(catalogue)
  next.set(id, { name, category, color })
  return next
}

export function removeBoatNameEntry(
  catalogue: BoatNamesCatalogue,
  id: string,
): Map<string, BoatNameEntry> {
  const next = new Map(catalogue)
  next.delete(id.trim())
  return next
}
