/**
 * Unity `BoatNameAssigner.ParseCategoryColor` keywords → `#rrggbb`.
 * First keyword match wins (case-insensitive). Fallback white.
 */

export const CATEGORY_COLOR_FALLBACK = '#ffffff'

/** Soft pink — Unity `(1, 0.4, 0.7)`. */
export const CATEGORY_COLOR_PEMBE = '#ff66b3'
/** Unity `Color.yellow`. */
export const CATEGORY_COLOR_SARI = '#ffff00'
/** Unity `Color.green`. */
export const CATEGORY_COLOR_YESIL = '#00ff00'
/** Unity `Color.blue`. */
export const CATEGORY_COLOR_MAVI = '#0000ff'
/** Soft orange — Unity `(1, 0.5, 0)`. */
export const CATEGORY_COLOR_TURUNCU = '#ff8000'

/**
 * Map a category name string (Turkish keywords supported) to `#rrggbb`.
 */
export function parseCategoryColor(categoryName: string): string {
  const lower = categoryName.toLowerCase()
  if (lower.includes('pembe')) return CATEGORY_COLOR_PEMBE
  if (lower.includes('sarı') || lower.includes('sari')) return CATEGORY_COLOR_SARI
  if (lower.includes('yeşil') || lower.includes('yesil')) return CATEGORY_COLOR_YESIL
  if (lower.includes('mavi')) return CATEGORY_COLOR_MAVI
  if (lower.includes('turuncu')) return CATEGORY_COLOR_TURUNCU
  return CATEGORY_COLOR_FALLBACK
}

/** Accept `#rrggbb` or `0xrrggbb`; else null. */
export function parseHexColorCss(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^0x[0-9a-fA-F]{6}$/i.test(s)) return `#${s.slice(2).toLowerCase()}`
  return null
}

/**
 * Flatten catalogue → id → `#rrggbb` for map dots / hull sync.
 * Pure helper — no DOM / Three.
 */
export function boatColorsFromCatalogue(
  catalogue: ReadonlyMap<string, { color: string }>,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const [id, entry] of catalogue) {
    const css = parseHexColorCss(entry.color)
    if (css) out.set(id, css)
  }
  return out
}

/**
 * Flatten catalogue → id → trimmed name for stream fleet pills.
 * Empty names are omitted so the map can fall back to id.
 */
export function boatNamesFromCatalogue(
  catalogue: ReadonlyMap<string, { name: string }>,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const [id, entry] of catalogue) {
    const name = entry.name.trim()
    if (name) out.set(id, name)
  }
  return out
}

/** Stream fleet pill: catalogue name when non-empty, else id. */
export function resolveStreamFleetLabel(
  id: string,
  names: ReadonlyMap<string, string>,
): string {
  const n = names.get(id)
  if (typeof n === 'string') {
    const t = n.trim()
    if (t) return t
  }
  return id
}
