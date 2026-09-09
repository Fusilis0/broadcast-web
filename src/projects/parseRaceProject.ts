import { parseRaceProjectCalibration } from '../calibration/projectCalibration.ts'
import { parseRaceProjectLandmarks } from '../scene/landmarks/projectLandmarks.ts'
import { parseRounding } from '../scene/features/rounding.ts'
import { parseHexColorCss } from '../scene/boatNames/categoryColor.ts'
import type { WorldFeature, WorldFeatureType } from '../scene/features/types.ts'
import { parseOptionalAlpha, parseOptionalHexColor } from '../scene/sponsors/boardCompose.ts'
import { parseOptionalBoardAspect } from '../scene/sponsors/sponsorLayout.ts'
import { parseBillboardLogos } from '../scene/billboardLogos.ts'
import { normalizePovIds } from '../config/loadConfig.ts'
import { parseProjectFleetIds } from './fleetBoats.ts'
import { parseSrtByPovId } from '../output/srtCallerUrl.ts'
import type {
  RaceProject,
  RaceProjectFleet,
  RaceProjectFleetBoat,
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
  'buoy',
  'billboardChain',
])

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t === '' ? undefined : t
}

const BOAT_VISIBILITY_MODES = new Set(['solid', 'ghost', 'hidden'])

/** Soft optional fleet.boatVisibility — invalid entries dropped; omit if empty. */
function parseBoatVisibility(
  raw: unknown,
): RaceProjectFleet['boatVisibility'] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined
  }
  const out: NonNullable<RaceProjectFleet['boatVisibility']> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    if (
      id === '' ||
      typeof value !== 'string' ||
      !BOAT_VISIBILITY_MODES.has(value)
    ) {
      continue
    }
    out[id] = value as 'solid' | 'ghost' | 'hidden'
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Soft optional fleet.boats. Missing / non-array → omitted (legacy pack).
 * A present array — including `[]` — is the complete fleet; invalid rows
 * dropped; empty stays empty.
 */
function parseFleetBoats(raw: unknown): RaceProjectFleetBoat[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: RaceProjectFleetBoat[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      continue
    }
    const o = item as Record<string, unknown>
    const id = nonEmptyString(o.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const row: RaceProjectFleetBoat = {
      id,
      name: nonEmptyString(o.name) ?? id,
      category: typeof o.category === 'string' ? o.category.trim() : '',
    }
    const color = parseHexColorCss(o.color)
    if (color) row.color = color
    if (
      typeof o.visibility === 'string' &&
      BOAT_VISIBILITY_MODES.has(o.visibility)
    ) {
      row.visibility = o.visibility as 'solid' | 'ghost' | 'hidden'
    }
    if (typeof o.mapVisible === 'boolean') row.mapVisible = o.mapVisible
    if (
      isFiniteNumber(o.plannedLat) &&
      isFiniteNumber(o.plannedLon)
    ) {
      row.plannedLat = o.plannedLat
      row.plannedLon = o.plannedLon
    }
    out.push(row)
  }
  return out
}

/** Soft id→boolean map (map visibility). Non-boolean values dropped; omit if empty. */
function parseIdBoolMap(raw: unknown): Record<string, boolean> | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined
  }
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    if (id === '' || typeof value !== 'boolean') continue
    out[id] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
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
  // Additive optional fields (sponsors / Phase 11.6 chain + buoy bind).
  if (typeof o.textureUrl === 'string') {
    const t = o.textureUrl.trim()
    feature.textureUrl = t === '' ? null : t
  } else if (o.textureUrl === null) {
    feature.textureUrl = null
  }
  const logos = parseBillboardLogos(o.logos)
  if (logos !== undefined) feature.logos = logos
  const panelColor = parseOptionalHexColor(o.panelColor)
  if (panelColor !== undefined) feature.panelColor = panelColor
  const frameColor = parseOptionalHexColor(o.frameColor)
  if (frameColor !== undefined) feature.frameColor = frameColor
  const panelAlpha = parseOptionalAlpha(o.panelAlpha)
  if (panelAlpha !== undefined) feature.panelAlpha = panelAlpha
  const boardAspect = parseOptionalBoardAspect(o.boardAspect)
  if (boardAspect !== undefined) feature.boardAspect = boardAspect
  if (isFiniteNumber(o.spacingM) && o.spacingM > 0) {
    feature.spacingM = o.spacingM
  }
  if (typeof o.telemetryId === 'string') {
    const t = o.telemetryId.trim()
    feature.telemetryId = t === '' ? null : t
  } else if (o.telemetryId === null) {
    feature.telemetryId = null
  }
  // Soft visibility (SCN 11.7 / DSP-06) — omit → visible; only persist false typically.
  if (typeof o.visible3d === 'boolean') feature.visible3d = o.visible3d
  if (typeof o.visible2d === 'boolean') feature.visible2d = o.visible2d
  if (typeof o.visibleBuoyMesh === 'boolean') {
    feature.visibleBuoyMesh = o.visibleBuoyMesh
  }
  if (typeof o.visibleTag === 'boolean') feature.visibleTag = o.visibleTag
  const rounding = parseRounding(o.rounding)
  if (rounding !== undefined) feature.rounding = rounding
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
  const srtUrlTemplate = parseOptionalUrl(o.srtUrlTemplate)
  if (srtUrlTemplate !== undefined) out.srtUrlTemplate = srtUrlTemplate
  const srtByPovId = parseSrtByPovId(o.srtByPovId)
  if (srtByPovId !== undefined) out.srtByPovId = srtByPovId
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
  const boats = parseFleetBoats(fleetRaw.boats)
  // `boats` present (including []) is the complete fleet; never DEFAULT_BOAT_IDS.
  const boatIds =
    boats !== undefined
      ? boats.map((b) => b.id)
      : parseProjectFleetIds(fleetRaw.boatIds)
  const fleet: RaceProjectFleet = { boatIds }
  if (boats !== undefined) fleet.boats = boats
  const boatNamesUrl = parseOptionalUrl(fleetRaw.boatNamesUrl)
  if (boatNamesUrl !== undefined) fleet.boatNamesUrl = boatNamesUrl
  const boatVisibility = parseBoatVisibility(fleetRaw.boatVisibility)
  if (boatVisibility !== undefined) fleet.boatVisibility = boatVisibility
  const boatMapVisible = parseIdBoolMap(fleetRaw.boatMapVisible)
  if (boatMapVisible !== undefined) fleet.boatMapVisible = boatMapVisible
  const povMapVisible = parseIdBoolMap(fleetRaw.povMapVisible)
  if (povMapVisible !== undefined) fleet.povMapVisible = povMapVisible

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

  const calibration = parseRaceProjectCalibration(o.calibration)
  if (calibration !== undefined) project.calibration = calibration

  const landmarks = parseRaceProjectLandmarks(o.landmarks)
  if (landmarks !== undefined) project.landmarks = landmarks

  return project
}

/** Safe race id for URL path segment (`public/races/<id>/`). */
export function isSafeRaceId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)
}
