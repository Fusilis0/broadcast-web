import { isSafeRaceId, parseRaceProject } from './parseRaceProject.ts'
import { getRacesBridge, type StudioRacesBridge } from './racesBridge.ts'
import type { RaceProject } from './types.ts'
import { retainMaterializedVenuePack } from './venuePack/activeMaterialization.ts'
import { materializeVenuePack } from './venuePack/materializeVenuePack.ts'
import {
  getDefaultVenuePackCache,
  type VenuePackCache,
} from './venuePack/venuePackCache.ts'

/** Default pack path under Vite `public/`. */
export function raceProjectUrl(id: string): string {
  return `/races/${encodeURIComponent(id)}/project.json`
}

/** `{projectsApiBase}/races/:id` with trailing-slash normalization. */
export function raceProjectApiUrl(apiBase: string, id: string): string {
  const base = apiBase.trim().replace(/\/+$/, '')
  return `${base}/races/${encodeURIComponent(id)}`
}

export type LoadRaceProjectOptions = {
  /** When set, try API get first; on miss/fail → Electron races / static pack. */
  projectsApiBase?: string
  fetchImpl?: typeof fetch
  /**
   * Electron local races bridge. Omit → `getRacesBridge()` (Chrome = null).
   * Pass `null` in tests to disable auto-detect.
   */
  racesBridge?: StudioRacesBridge | null
  /**
   * Offline venue-pack fallback after API + Electron + static miss.
   * `true` / omit → default IndexedDB cache; `false` → disable; or inject a cache.
   */
  venuePackCache?: boolean | VenuePackCache
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`)
  }
  return res.json() as Promise<unknown>
}

async function hydrateFeaturesUrl(
  project: RaceProject,
  fetchImpl: typeof fetch,
): Promise<RaceProject> {
  if (
    (project.features === undefined || project.features.length === 0) &&
    project.featuresUrl
  ) {
    const raw = await fetchJson(project.featuresUrl, fetchImpl)
    const list = extractFeaturesList(raw)
    const merged = parseRaceProject({ ...project, features: list })
    project.features = merged.features
  }
  return project
}

function resolveVenuePackCache(
  option: LoadRaceProjectOptions['venuePackCache'],
): VenuePackCache | null {
  if (option === false) return null
  if (option === true || option === undefined) return getDefaultVenuePackCache()
  return option
}

async function loadFromVenuePackCache(
  id: string,
  cache: VenuePackCache,
): Promise<RaceProject> {
  const pack = await cache.get(id)
  if (!pack) {
    throw new Error(`No cached venue pack for ${JSON.stringify(id)}`)
  }
  const materialized = retainMaterializedVenuePack(materializeVenuePack(pack))
  return materialized.project
}

/**
 * Fetch and lightly validate a RaceProject pack.
 * Precedence:
 * 1. API `GET {projectsApiBase}/races/:id` when configured
 * 2. Electron `races.read` when studio bridge present (userData / public writes)
 * 3. Static `/races/<id>/project.json`
 * 4. Cached venue pack (IndexedDB) when prior paths miss
 *
 * When `featuresUrl` is set and `features` omitted, loads that JSON
 * (`{ features: WorldFeature[] }` or a bare array).
 */
export async function loadRaceProject(
  id: string,
  options: LoadRaceProjectOptions = {},
): Promise<RaceProject> {
  const trimmed = id.trim()
  if (!isSafeRaceId(trimmed)) {
    throw new Error(`Invalid race id: ${JSON.stringify(id)}`)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const apiBase = options.projectsApiBase?.trim()
  const cache = resolveVenuePackCache(options.venuePackCache)
  const bridge =
    options.racesBridge === undefined
      ? getRacesBridge()
      : options.racesBridge

  if (apiBase) {
    try {
      const res = await fetchImpl(raceProjectApiUrl(apiBase, trimmed))
      if (res.ok) {
        const project = parseRaceProject(await res.json())
        return hydrateFeaturesUrl(project, fetchImpl)
      }
    } catch {
      // Network / parse failure → Electron / static fallback.
    }
  }

  if (bridge) {
    try {
      const result = await bridge.read(trimmed)
      if (result.ok) {
        const project = parseRaceProject(result.project)
        return hydrateFeaturesUrl(project, fetchImpl)
      }
    } catch {
      // Bridge miss → static.
    }
  }

  try {
    const project = parseRaceProject(
      await fetchJson(raceProjectUrl(trimmed), fetchImpl),
    )
    return hydrateFeaturesUrl(project, fetchImpl)
  } catch (staticErr) {
    if (cache) {
      try {
        return await loadFromVenuePackCache(trimmed, cache)
      } catch {
        // Re-throw original static miss.
      }
    }
    throw staticErr
  }
}

function extractFeaturesList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw !== null && typeof raw === 'object') {
    const features = (raw as Record<string, unknown>).features
    if (Array.isArray(features)) return features
  }
  throw new Error('featuresUrl JSON must be { features: WorldFeature[] }')
}
