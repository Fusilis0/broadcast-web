import { isSafeRaceId } from './parseRaceProject.ts'

/** Manifest under Vite `public/races/index.json`. */
export const LOCAL_RACES_INDEX_URL = '/races/index.json'

/** Always available when the manifest is missing. */
export const DEFAULT_LOCAL_RACE_IDS: readonly string[] = ['demo-istanbul']

export type ListLocalRaceIdsOptions = {
  /** When set, prefer `GET {base}/races` when reachable; else static index. */
  projectsApiBase?: string
  /** When true with API, include archived projects (default hides them). */
  includeArchived?: boolean
  fetchImpl?: typeof fetch
}

/**
 * Discover local pack ids.
 * - With `projectsApiBase`: API list wins when reachable and non-empty.
 *   Default API list excludes `archived` (pass `includeArchived: true` to show them).
 * - Else / on miss: `/races/index.json` → `{ "ids": [...] }`.
 * - On static miss / invalid → `DEFAULT_LOCAL_RACE_IDS`.
 */
export async function listLocalRaceIds(
  options: ListLocalRaceIdsOptions | typeof fetch = {},
): Promise<string[]> {
  const opts: ListLocalRaceIdsOptions =
    typeof options === 'function' ? { fetchImpl: options } : options
  const fetchImpl = opts.fetchImpl ?? fetch
  const apiBase = opts.projectsApiBase?.trim()

  if (apiBase) {
    try {
      const base = apiBase.replace(/\/+$/, '')
      const q = opts.includeArchived ? '?includeArchived=1' : ''
      const res = await fetchImpl(`${base}/races${q}`)
      if (res.ok) {
        const ids = extractIdsFromApiList(await res.json())
        if (ids.length > 0) return ids
      }
    } catch {
      // Fall through to static index.
    }
  }

  try {
    const res = await fetchImpl(LOCAL_RACES_INDEX_URL)
    if (!res.ok) return [...DEFAULT_LOCAL_RACE_IDS]
    const ids = extractIdsFromManifest(await res.json())
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

function extractIdsFromManifest(raw: unknown): string[] {
  if (raw === null || typeof raw !== 'object') return []
  const ids = (raw as Record<string, unknown>).ids
  if (!Array.isArray(ids)) return []
  return normalizeIdList(ids)
}

function extractIdsFromApiList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const ids: unknown[] = []
  for (const item of raw) {
    if (item !== null && typeof item === 'object') {
      ids.push((item as Record<string, unknown>).id)
    }
  }
  return normalizeIdList(ids)
}

function normalizeIdList(ids: unknown[]): string[] {
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
