import { isSafeRaceId, parseRaceProject } from './parseRaceProject.ts'
import type { RaceProject } from './types.ts'

/** Default pack path under Vite `public/`. */
export function raceProjectUrl(id: string): string {
  return `/races/${encodeURIComponent(id)}/project.json`
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`)
  }
  return res.json() as Promise<unknown>
}

/**
 * Fetch and lightly validate a local RaceProject pack.
 * Pack root: `/races/<id>/project.json`.
 * When `featuresUrl` is set and `features` omitted, loads that JSON
 * (`{ features: WorldFeature[] }` or a bare array).
 */
export async function loadRaceProject(id: string): Promise<RaceProject> {
  const trimmed = id.trim()
  if (!isSafeRaceId(trimmed)) {
    throw new Error(`Invalid race id: ${JSON.stringify(id)}`)
  }

  const project = parseRaceProject(await fetchJson(raceProjectUrl(trimmed)))

  if (
    (project.features === undefined || project.features.length === 0) &&
    project.featuresUrl
  ) {
    const raw = await fetchJson(project.featuresUrl)
    const list = extractFeaturesList(raw)
    // Re-parse through project validator for feature shape.
    const merged = parseRaceProject({ ...project, features: list })
    project.features = merged.features
  }

  return project
}

function extractFeaturesList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw !== null && typeof raw === 'object') {
    const features = (raw as Record<string, unknown>).features
    if (Array.isArray(features)) return features
  }
  throw new Error('featuresUrl JSON must be { features: WorldFeature[] }')
}
