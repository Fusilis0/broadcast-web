import type { WorldFeature, WorldFeatureType } from '../scene/features/types.ts'
import { normalizeBoatIds, normalizePovIds } from '../config/loadConfig.ts'
import type {
  RaceProject,
  RaceProjectFleet,
  RaceProjectOrigin,
  RaceProjectOutputDefaults,
} from './types.ts'

const FEATURE_TYPES = new Set<WorldFeatureType>([
  'mark',
  'gateLeft',
  'gateRight',
  'sponsor',
  'flagP1',
  'flagP2',
  'start',
  'finish',
  'arrow',
  'rotation',
])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t === '' ? undefined : t
}

function parseOrigin(raw: unknown): RaceProjectOrigin | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    !isFiniteNumber(o.lat) ||
    !isFiniteNumber(o.lon) ||
    !isFiniteNumber(o.altMsl)
  ) {
    return null
  }
  return { lat: o.lat, lon: o.lon, altMsl: o.altMsl }
}

function parseOptionalUrl(value: unknown): string | undefined {
  return nonEmptyString(value)
}

function parseWorldFeature(raw: unknown): WorldFeature | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = nonEmptyString(o.id)
  const name = nonEmptyString(o.name)
  const type = nonEmptyString(o.type) as WorldFeatureType | undefined
  if (!id || !name || !type || !FEATURE_TYPES.has(type)) return null
  if (!Array.isArray(o.points) || o.points.length < 1) return null

  const points: WorldFeature['points'] = []
  for (const p of o.points) {
    if (p === null || typeof p !== 'object') return null
    const pt = p as Record<string, unknown>
    if (
      !isFiniteNumber(pt.lat) ||
      !isFiniteNumber(pt.lon) ||
      !isFiniteNumber(pt.altMsl)
    ) {
      return null
    }
    points.push({ lat: pt.lat, lon: pt.lon, altMsl: pt.altMsl })
  }

  const feature: WorldFeature = { id, name, type, points }
  if (isFiniteNumber(o.heightM)) feature.heightM = o.heightM
  if (isFiniteNumber(o.color)) feature.color = o.color
  const label = nonEmptyString(o.label)
  if (label !== undefined) feature.label = label
  return feature
}

function parseFeatures(raw: unknown): WorldFeature[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    throw new Error('RaceProject.features must be an array when present')
  }
  const out: WorldFeature[] = []
  for (const item of raw) {
    const f = parseWorldFeature(item)
    if (!f) {
      throw new Error('RaceProject.features contains an invalid WorldFeature')
    }
    out.push(f)
  }
  return out
}

function parseOutput(raw: unknown): RaceProjectOutputDefaults | undefined {
  if (raw === undefined) return undefined
  if (raw === null || typeof raw !== 'object') {
    throw new Error('RaceProject.output must be an object when present')
  }
  const o = raw as Record<string, unknown>
  const out: RaceProjectOutputDefaults = {}
  if (typeof o.outputMode === 'string') out.outputMode = o.outputMode.trim()
  const whepUrl = parseOptionalUrl(o.whepUrl)
  if (whepUrl !== undefined) out.whepUrl = whepUrl
  if (typeof o.chromaKey === 'string') out.chromaKey = o.chromaKey.trim()
  if (typeof o.timecodeEnabled === 'boolean') {
    out.timecodeEnabled = o.timecodeEnabled
  }
  if (typeof o.timecodeCorner === 'string') {
    out.timecodeCorner = o.timecodeCorner.trim()
  }
  if (isFiniteNumber(o.timecodeSizePx)) out.timecodeSizePx = o.timecodeSizePx
  return out
}

/**
 * Light-validate unknown JSON into a typed RaceProject.
 * Throws on garbage / missing required fields.
 */
export function parseRaceProject(raw: unknown): RaceProject {
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
  if (!name) throw new Error('RaceProject.name is required')

  const origin = parseOrigin(o.origin)
  if (!origin) {
    throw new Error(
      'RaceProject.origin requires finite lat, lon, and altMsl',
    )
  }

  if (o.fleet === null || typeof o.fleet !== 'object') {
    throw new Error('RaceProject.fleet is required')
  }
  const fleetRaw = o.fleet as Record<string, unknown>
  if (!Array.isArray(fleetRaw.boatIds)) {
    throw new Error('RaceProject.fleet.boatIds must be an array')
  }
  const boatIds = normalizeBoatIds(fleetRaw.boatIds)
  const fleet: RaceProjectFleet = { boatIds }
  const boatNamesUrl = parseOptionalUrl(fleetRaw.boatNamesUrl)
  if (boatNamesUrl !== undefined) fleet.boatNamesUrl = boatNamesUrl

  if (!Array.isArray(o.povIds)) {
    throw new Error('RaceProject.povIds must be an array')
  }
  const povIds = normalizePovIds(o.povIds)

  const project: RaceProject = {
    schemaVersion: o.schemaVersion,
    id,
    name,
    origin,
    fleet,
    povIds,
  }

  const updatedAt = nonEmptyString(o.updatedAt)
  if (updatedAt !== undefined) project.updatedAt = updatedAt
  if (isFiniteNumber(o.revision)) project.revision = o.revision
  if (isFiniteNumber(o.takeoffAltitudeMSL)) {
    project.takeoffAltitudeMSL = o.takeoffAltitudeMSL
  }

  const features = parseFeatures(o.features)
  if (features !== undefined) project.features = features

  const featuresUrl = parseOptionalUrl(o.featuresUrl)
  if (featuresUrl !== undefined) project.featuresUrl = featuresUrl
  const courseUrl = parseOptionalUrl(o.courseUrl)
  if (courseUrl !== undefined) project.courseUrl = courseUrl
  const sponsorsUrl = parseOptionalUrl(o.sponsorsUrl)
  if (sponsorsUrl !== undefined) project.sponsorsUrl = sponsorsUrl
  const flagsUrl = parseOptionalUrl(o.flagsUrl)
  if (flagsUrl !== undefined) project.flagsUrl = flagsUrl
  const replayUrl = parseOptionalUrl(o.replayUrl)
  if (replayUrl !== undefined) project.replayUrl = replayUrl

  const output = parseOutput(o.output)
  if (output !== undefined) project.output = output

  return project
}

/** Safe race id for URL path segment (`public/races/<id>/`). */
export function isSafeRaceId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)
}
