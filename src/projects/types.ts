/**
 * RaceProject types (PLT + SCN).
 * Contract: `docs/contracts/race-project.md`.
 * Feature shape matches editor export `WorldFeature` (`src/scene/features`).
 */

import type { WorldFeature } from '../scene/features/types.ts'

export type RaceProjectOrigin = {
  lat: number
  lon: number
  altMsl: number
}

export type RaceProjectFleet = {
  boatIds: string[]
  /** Boat name/colour catalogue JSON URL. */
  boatNamesUrl?: string
}

export type RaceProjectOutputDefaults = {
  outputMode?: string
  whepUrl?: string
  chromaKey?: string
  timecodeEnabled?: boolean
  timecodeCorner?: string
  timecodeSizePx?: number
}

/**
 * On-disk / API race pack document (V1 static under `public/races/<id>/`).
 * Editor `world-features.json` `{ features }` is compatible with `features`.
 */
export type RaceProject = {
  schemaVersion: number
  id: string
  name: string
  updatedAt?: string
  revision?: number
  origin: RaceProjectOrigin
  takeoffAltitudeMSL?: number
  fleet: RaceProjectFleet
  povIds: string[]
  /** Embedded GPS features (same as editor export). */
  features?: WorldFeature[]
  /** Optional pointer to `{ features: WorldFeature[] }` JSON. */
  featuresUrl?: string
  /** Compat fixture URLs when `features` / `featuresUrl` omitted. */
  courseUrl?: string
  sponsorsUrl?: string
  flagsUrl?: string
  replayUrl?: string
  output?: RaceProjectOutputDefaults
}

export type { WorldFeature }
