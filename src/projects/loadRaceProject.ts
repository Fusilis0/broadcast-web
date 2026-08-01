import { isSafeRaceId, parseRaceProject } from './parseRaceProject.ts'
import type { RaceProject } from './types.ts'

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
  /** When set, try API get first; on miss/fail → static pack. */
  projectsApiBase?: string
  fetchImpl?: typeof fetch
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

/**
 * Fetch and lightly validate a RaceProject pack.
 * Pack root: `/races/<id>/project.json`.
 * When `projectsApiBase` is set: `GET {base}/races/:id` first, then static fallback.
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

  if (apiBase) {
    try {
      const res = await fetchImpl(raceProjectApiUrl(apiBase, trimmed))
      if (res.ok) {
        const project = parseRaceProject(await res.json())
        return hydrateFeaturesUrl(project, fetchImpl)
      }
    } catch {
      // Network / parse failure → static fallback.
    }
  }

  const project = parseRaceProject(
    await fetchJson(raceProjectUrl(trimmed), fetchImpl),
  )
  return hydrateFeaturesUrl(project, fetchImpl)
}

function extractFeaturesList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw !== null && typeof raw === 'object') {
    const features = (raw as Record<string, unknown>).features
    if (Array.isArray(features)) return features
  }
  throw new Error('featuresUrl JSON must be { features: WorldFeature[] }')
}
