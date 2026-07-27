import { normalizeBoatNames } from './normalizeBoatNames.ts'
import type { BoatNamesCatalogue } from './types.ts'

export const DEFAULT_BOAT_NAMES_URL =
  '/fixtures/boats/demo-istanbul-names.json'

/**
 * Fetch boat name/colour JSON and flatten to id → entry map.
 * Network/parse failure → empty catalogue (stub tags remain).
 */
export async function loadBoatNames(
  url?: string,
): Promise<BoatNamesCatalogue> {
  const resolved = url?.trim() || DEFAULT_BOAT_NAMES_URL
  try {
    const res = await fetch(resolved)
    if (!res.ok) {
      console.warn(
        `[boatNames] failed to load ${resolved}: HTTP ${res.status}`,
      )
      return new Map()
    }
    return normalizeBoatNames(await res.json())
  } catch (err) {
    console.warn(`[boatNames] failed to load ${resolved}`, err)
    return new Map()
  }
}
