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

/**
 * Embedded Live-fleet row (SCN 15.4). Always written on save (including `[]`).
 * Old packs may omit `fleet.boats`; then `boatIds` + names catalogue applies.
 * On save, `fleet.boatIds` matches `boats[].id` membership and order.
 * Any non-empty string id is legal; an empty fleet is legal.
 */
export type RaceProjectFleetBoat = {
  id: string
  name: string
  category: string
  /** Explicit `#rrggbb` palette colour. Omit → category keyword parse. */
  color?: string
  visibility?: 'solid' | 'ghost' | 'hidden'
  mapVisible?: boolean
  plannedLat?: number
  plannedLon?: number
}

export type RaceProjectFleet = {
  boatIds: string[]
  /**
   * Full Live-fleet rows. Source of truth on Load when present (including `[]`).
   * Never topped up from the names catalogue or from `boatIds`.
   * Names URL is fallback only for legacy packs that omit this field.
   */
  boats?: RaceProjectFleetBoat[]
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
  /**
   * Shared SRT caller template with `{srtId}` (L9). Soft — old packs omit.
   * Do **not** commit a filled relay token; session may hold the secret.
   */
  srtUrlTemplate?: string
  /**
   * Per-POV SRT camera id (independent of telemetry `povId`).
   * Soft map; junk / empty dropped. Old packs omit.
   */
  srtByPovId?: Record<string, string>
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
  /** Embedded GPS features. Present (including `[]`) is the complete world. */
  features?: WorldFeature[]
  /** Optional pointer to `{ features: WorldFeature[] }` JSON. */
  featuresUrl?: string
  /** Compat fixture URLs when `features` is omitted (legacy packs). */
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
  /**
   * Soft optional hero landmark authoring offsets (SCN).
   * ENU metres + Euler degrees on catalogue ids. Omit when empty;
   * old packs without this field still parse. Not a geoid.
   */
  landmarks?: RaceProjectLandmarks
}

export type RaceProjectLandmarkPose = {
  offsetM?: { x: number; y: number; z: number }
  yawDeg?: number
  pitchDeg?: number
  rollDeg?: number
  /** Uniform mesh scale. Omit → 1. */
  scale?: number
}

export type RaceProjectLandmarks = {
  byId?: Record<string, RaceProjectLandmarkPose>
}

export type { WorldFeature }
