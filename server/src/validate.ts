/** Safe race id — same rule as SPA `isSafeRaceId`. */
export function isSafeRaceId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t === '' ? undefined : t
}

export type RaceProjectBody = {
  schemaVersion: number
  id: string
  name: string
  updatedAt?: string
  revision?: number
  origin: { lat: number; lon: number; altMsl: number }
  fleet: { boatIds: unknown[]; boatNamesUrl?: string }
  povIds: unknown[]
  [key: string]: unknown
}

/**
 * Light-validate RaceProject JSON for API writes.
 * Mirrors contract required fields; does not re-run SPA feature parsing.
 */
export function parseRaceProjectBody(raw: unknown): RaceProjectBody {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('RaceProject must be a JSON object')
  }
  const o = raw as Record<string, unknown>

  if (!isFiniteNumber(o.schemaVersion) || o.schemaVersion < 1) {
    throw new Error('RaceProject.schemaVersion must be a number >= 1')
  }

  const id = nonEmptyString(o.id)
  const name = nonEmptyString(o.name)
  if (!id) throw new Error('RaceProject.id is required')
  if (!isSafeRaceId(id)) throw new Error(`Invalid race id: ${JSON.stringify(id)}`)
  if (!name) throw new Error('RaceProject.name is required')

  if (o.origin === null || typeof o.origin !== 'object') {
    throw new Error('RaceProject.origin is required')
  }
  const originRaw = o.origin as Record<string, unknown>
  if (
    !isFiniteNumber(originRaw.lat) ||
    !isFiniteNumber(originRaw.lon) ||
    !isFiniteNumber(originRaw.altMsl)
  ) {
    throw new Error('RaceProject.origin requires finite lat, lon, and altMsl')
  }

  if (o.fleet === null || typeof o.fleet !== 'object') {
    throw new Error('RaceProject.fleet is required')
  }
  const fleetRaw = o.fleet as Record<string, unknown>
  if (!Array.isArray(fleetRaw.boatIds)) {
    throw new Error('RaceProject.fleet.boatIds must be an array')
  }
  if (!Array.isArray(o.povIds)) {
    throw new Error('RaceProject.povIds must be an array')
  }

  return { ...(o as RaceProjectBody), id, name, schemaVersion: o.schemaVersion }
}

export function parseLabels(raw: unknown): string[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    throw new Error('labels must be an array of strings')
  }
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new Error('labels must be an array of strings')
    }
    const t = item.trim()
    if (t !== '') out.push(t)
  }
  return out
}

/** Parse If-Match / body revision into a positive integer. */
export function parseExpectedRevision(
  ifMatch: string | undefined,
  bodyRevision: unknown,
): number | null {
  if (ifMatch !== undefined && ifMatch.trim() !== '') {
    const raw = ifMatch.trim().replace(/^W\//i, '').replace(/^"|"$/g, '')
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) return null
    return n
  }
  if (typeof bodyRevision === 'number' && Number.isInteger(bodyRevision) && bodyRevision >= 1) {
    return bodyRevision
  }
  return null
}
