import { isSafeRaceId } from './parseRaceProject.ts'

/**
 * Merge-and-dedupe safe ids; never drops existing entries.
 * When `id` is provided and safe, appends it if missing.
 */
export function upsertRaceIndexIds(
  existing: readonly unknown[],
  id?: string,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of existing) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!isSafeRaceId(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  if (id !== undefined) {
    const trimmed = id.trim()
    if (isSafeRaceId(trimmed) && !seen.has(trimmed)) {
      out.push(trimmed)
    }
  }
  return out
}

/** Concatenate id lists in order, dedupe, keep only safe ids. */
export function mergeLocalRaceIds(
  ...lists: readonly (readonly string[])[]
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const item of list) {
      const trimmed = item.trim()
      if (!isSafeRaceId(trimmed) || seen.has(trimmed)) continue
      seen.add(trimmed)
      out.push(trimmed)
    }
  }
  return out
}

/** Electron load target → races folder kind (mirrors `desktop/racesFs.cjs`). */
export function resolveRacesKind(
  loadKind: 'url' | 'file',
): 'public' | 'userData' {
  return loadKind === 'file' ? 'userData' : 'public'
}
