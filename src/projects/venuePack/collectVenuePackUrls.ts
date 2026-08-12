import type { RaceProject } from '../types.ts'

/**
 * Scene assets not always listed on RaceProject but needed for a full local boot
 * (boat GLB, map chrome, world extras, position markers).
 */
export const DEFAULT_VENUE_EXTRA_URLS: readonly string[] = [
  '/models/boat.glb',
  '/textures/map/tekne_yeni.png',
  '/textures/map/sail-icon.png',
  '/fixtures/world/demo-istanbul-extras.json',
  '/fixtures/markers/demo-istanbul.json',
]

const ASSET_EXT_RE =
  /\.(json|png|jpe?g|webp|gif|svg|glb|bin|txt|csv)(?:\?.*)?$/i

/** Site-relative asset path used by fixtures / project URL fields. */
export function isVenueAssetPath(value: string): boolean {
  const t = value.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return false
  if (t.includes('://')) return false
  if (
    t.startsWith('/fixtures/') ||
    t.startsWith('/textures/') ||
    t.startsWith('/models/') ||
    t.startsWith('/assets/library/') ||
    t.startsWith('/races/')
  ) {
    return true
  }
  return ASSET_EXT_RE.test(t)
}

/** Normalize to a stable files-map key (strip query). */
export function normalizeVenueAssetPath(url: string): string | null {
  const t = url.trim()
  if (!isVenueAssetPath(t)) return null
  const q = t.indexOf('?')
  return q === -1 ? t : t.slice(0, q)
}

/** Collect top-level RaceProject fixture / catalogue URL fields. */
export function collectProjectAssetUrls(project: RaceProject): string[] {
  const out: string[] = []
  const push = (u: string | undefined): void => {
    if (!u) return
    const n = normalizeVenueAssetPath(u)
    if (n) out.push(n)
  }
  push(project.fleet.boatNamesUrl)
  push(project.featuresUrl)
  push(project.courseUrl)
  push(project.sponsorsUrl)
  push(project.flagsUrl)
  push(project.replayUrl)
  return out
}

/** Walk JSON and collect nested site-relative asset path strings. */
export function collectNestedAssetUrls(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const n = normalizeVenueAssetPath(value)
    if (n) into.add(n)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNestedAssetUrls(item, into)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectNestedAssetUrls(v, into)
    }
  }
}

/**
 * Seed URL set for pack build: project pointers + optional extras.
 * Nested discovery happens while fetching JSON in buildVenuePack.
 */
export function seedVenuePackUrls(
  project: RaceProject,
  extraUrls: readonly string[] = DEFAULT_VENUE_EXTRA_URLS,
): string[] {
  const set = new Set<string>()
  for (const u of collectProjectAssetUrls(project)) set.add(u)
  for (const u of extraUrls) {
    const n = normalizeVenueAssetPath(u)
    if (n) set.add(n)
  }
  return [...set]
}
