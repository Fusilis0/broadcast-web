/**
 * Build / download RaceProject JSON from runtime editor + config state (Phase 6.2).
 * Browser cannot write into `public/races/` — download is the V1 “save”.
 */

import { parseRaceProject } from './parseRaceProject.ts'
import type {
  RaceProject,
  RaceProjectCalibration,
  RaceProjectFleetBoat,
  RaceProjectOrigin,
  RaceProjectOutputDefaults,
  WorldFeature,
} from './types.ts'

export type BuildRaceProjectInput = {
  id: string
  name: string
  origin: RaceProjectOrigin
  boatIds: readonly string[]
  /**
   * Full Live-fleet rows. Written as `fleet.boats` in `boatIds` order.
   * Custom names live here; `boatNamesUrl` is fallback for old packs.
   */
  boats?: readonly RaceProjectFleetBoat[]
  povIds: readonly string[]
  /** Current editor / adapter WorldFeature list (embedded in pack). */
  features?: readonly WorldFeature[]
  takeoffAltitudeMSL?: number
  boatNamesUrl?: string
  /** Soft optional per-boat solid/ghost/hidden (default solid when omitted). */
  boatVisibility?: Record<string, 'solid' | 'ghost' | 'hidden'>
  /** Soft optional per-boat map-dot visibility (default true when omitted). */
  boatMapVisible?: Record<string, boolean>
  /** Soft optional per-POV map-dot visibility (default true when omitted). */
  povMapVisible?: Record<string, boolean>
  courseUrl?: string
  sponsorsUrl?: string
  flagsUrl?: string
  replayUrl?: string
  featuresUrl?: string
  output?: RaceProjectOutputDefaults
  /** Soft per-POV calib (CAL); omit when empty. */
  calibration?: RaceProjectCalibration
  revision?: number
  /** ISO-8601; default now. */
  updatedAt?: string
}

/** Default pack id for a downloaded edit session. */
export function defaultEditedRaceId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `edited-${stamp}`
}

function cloneFeatures(
  features: readonly WorldFeature[] | undefined,
): WorldFeature[] | undefined {
  if (features === undefined) return undefined
  return features.map((f) => ({
    ...f,
    points: f.points.map((p) => ({ ...p })),
  }))
}

/**
 * Assemble a RaceProject from runtime state and validate via parseRaceProject.
 * Prefer embedding `features` when the editor has a non-empty list.
 */
export function buildRaceProject(input: BuildRaceProjectInput): RaceProject {
  const features = cloneFeatures(input.features)
  const raw: Record<string, unknown> = {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    origin: { ...input.origin },
    fleet: {
      boatIds: [...input.boatIds],
    },
    povIds: [...input.povIds],
  }

  if (input.revision !== undefined) raw.revision = input.revision
  if (input.takeoffAltitudeMSL !== undefined) {
    raw.takeoffAltitudeMSL = input.takeoffAltitudeMSL
  }
  if (input.boats && input.boats.length > 0) {
    ;(raw.fleet as Record<string, unknown>).boats = input.boats.map((b) => ({
      ...b,
    }))
  }
  if (input.boatNamesUrl) {
    ;(raw.fleet as Record<string, unknown>).boatNamesUrl = input.boatNamesUrl
  }
  if (input.boatVisibility && Object.keys(input.boatVisibility).length > 0) {
    ;(raw.fleet as Record<string, unknown>).boatVisibility = {
      ...input.boatVisibility,
    }
  }
  if (input.boatMapVisible && Object.keys(input.boatMapVisible).length > 0) {
    ;(raw.fleet as Record<string, unknown>).boatMapVisible = {
      ...input.boatMapVisible,
    }
  }
  if (input.povMapVisible && Object.keys(input.povMapVisible).length > 0) {
    ;(raw.fleet as Record<string, unknown>).povMapVisible = {
      ...input.povMapVisible,
    }
  }
  if (features !== undefined) raw.features = features
  if (input.featuresUrl) raw.featuresUrl = input.featuresUrl
  if (input.courseUrl) raw.courseUrl = input.courseUrl
  if (input.sponsorsUrl) raw.sponsorsUrl = input.sponsorsUrl
  if (input.flagsUrl) raw.flagsUrl = input.flagsUrl
  if (input.replayUrl) raw.replayUrl = input.replayUrl
  if (input.output) {
    const output: Record<string, unknown> = { ...input.output }
    if (input.output.srtByPovId) {
      output.srtByPovId = { ...input.output.srtByPovId }
    }
    raw.output = output
  }
  if (
    input.calibration &&
    Object.keys(input.calibration.byPovId).length > 0
  ) {
    const byPovId: Record<string, unknown> = {}
    for (const [id, offs] of Object.entries(input.calibration.byPovId)) {
      byPovId[id] = { ...offs }
    }
    raw.calibration = { byPovId }
  }

  return parseRaceProject(raw)
}

/** Pretty-print RaceProject for download. */
export function serializeRaceProject(project: RaceProject): string {
  return `${JSON.stringify(project, null, 2)}\n`
}

/** Trigger browser download of `project.json` (RaceProject schema). */
export function downloadRaceProject(
  project: RaceProject,
  filename = 'project.json',
): void {
  const text = serializeRaceProject(project)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
