import {
  parseCategoryColor,
  parseHexColorCss,
} from './categoryColor.ts'
import type { BoatNameEntry, BoatNamesCatalogue } from './types.ts'

/** Reserved category-level hex override key (not a boat id). */
export const CATEGORY_COLOR_OVERRIDE_KEY = '_color'

function parseEntryNameAndColor(
  raw: unknown,
  categoryColor: string,
): { name: string; color: string } | null {
  if (typeof raw === 'string') {
    const name = raw.trim()
    if (name === '') return null
    return { name, color: categoryColor }
  }
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (name === '') return null
    const override = parseHexColorCss(o.color)
    return { name, color: override ?? categoryColor }
  }
  return null
}

/**
 * Flatten Unity-style category → id → name JSON into id → { name, category, color }.
 * Later duplicate ids overwrite earlier ones.
 */
export function normalizeBoatNames(raw: unknown): BoatNamesCatalogue {
  const out = new Map<string, BoatNameEntry>()
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return out
  }

  const categories = raw as Record<string, unknown>
  for (const [category, boatsRaw] of Object.entries(categories)) {
    const categoryName = category.trim()
    if (categoryName === '') continue
    if (boatsRaw === null || typeof boatsRaw !== 'object' || Array.isArray(boatsRaw)) {
      continue
    }

    const boats = boatsRaw as Record<string, unknown>
    const categoryOverride = parseHexColorCss(boats[CATEGORY_COLOR_OVERRIDE_KEY])
    const categoryColor =
      categoryOverride ?? parseCategoryColor(categoryName)

    for (const [idRaw, entryRaw] of Object.entries(boats)) {
      if (idRaw === CATEGORY_COLOR_OVERRIDE_KEY) continue
      const id = idRaw.trim()
      if (id === '') continue
      const parsed = parseEntryNameAndColor(entryRaw, categoryColor)
      if (!parsed) continue
      out.set(id, {
        name: parsed.name,
        category: categoryName,
        color: parsed.color,
      })
    }
  }

  return out
}

/** Lookup helper — unknown id → undefined (caller falls back to stub). */
export function lookupBoatName(
  catalogue: BoatNamesCatalogue | null | undefined,
  id: string,
): BoatNameEntry | undefined {
  if (!catalogue) return undefined
  return catalogue.get(id)
}
