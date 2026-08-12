/**
 * RaceProject types (PLT + SCN + CAL soft calib).
 * Contract: `docs/contracts/race-project.md`.
 * Feature shape matches editor export `WorldFeature` (`src/scene/features`).
 */

import type { RaceProjectCalibration } from '../calibration/projectCalibration.ts'
import type { WorldFeature } from '../scene/features/types.ts'

export type { RaceProjectCalibration }

export type RaceProjectOrigin = {
  lat: number
  lon: number
  altMsl: number
}

export type RaceProjectFleet = {
  boatIds: string[]
  /** Boat name/colour catalogue JSON URL. */
  boatNamesUrl?: string
  /**
   * Soft optional per-boat draw mode (`solid` | `ghost` | `hidden`).
   * Omitted ids default to solid; unknown mode strings are dropped at parse.
   */
  boatVisibility?: Record<string, 'solid' | 'ghost' | 'hidden'>
  /**
   * Soft optional per-boat 2D map-dot visibility (SCN 11.7).
   * `false` = hide map icon; omit / true → show. Independent of boatVisibility.
   */
  boatMapVisible?: Record<string, boolean>
  /**
   * Soft optional per-POV 2D map-dot visibility (SCN 11.7).
   * `false` = hide; omit / true → show.
   */
  povMapVisible?: Record<string, boolean>
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
  /**
   * Soft optional per-POV calibration offsets (CAL).
   * Omit when empty; old packs without this field still parse.
   */
  calibration?: RaceProjectCalibration
}

export type { WorldFeature }
