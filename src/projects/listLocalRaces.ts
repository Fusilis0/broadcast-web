import { isSafeRaceId } from './parseRaceProject.ts'

/** Manifest under Vite `public/races/index.json`. */
export const LOCAL_RACES_INDEX_URL = '/races/index.json'

/** Always available when the manifest is missing. */
export const DEFAULT_LOCAL_RACE_IDS: readonly string[] = ['demo-istanbul']

/**
 * Discover local pack ids from `/races/index.json`.
 * Shape: `{ "ids": ["demo-istanbul", ...] }`.
 * On miss / invalid → `DEFAULT_LOCAL_RACE_IDS` (still includes `demo-istanbul`).
 */
export async function listLocalRaceIds(
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  try {
    const res = await fetchImpl(LOCAL_RACES_INDEX_URL)
    if (!res.ok) return [...DEFAULT_LOCAL_RACE_IDS]
    const raw: unknown = await res.json()
    const ids = extractIds(raw)
    if (ids.length === 0) return [...DEFAULT_LOCAL_RACE_IDS]
    // Ensure demo-istanbul stays visible even if omitted from a partial manifest.
    if (!ids.includes('demo-istanbul')) {
      return ['demo-istanbul', ...ids]
    }
    return ids
  } catch {
    return [...DEFAULT_LOCAL_RACE_IDS]
  }
}

function extractIds(raw: unknown): string[] {
  if (raw === null || typeof raw !== 'object') return []
  const ids = (raw as Record<string, unknown>).ids
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of ids) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!isSafeRaceId(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
