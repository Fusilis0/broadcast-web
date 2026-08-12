/**
 * RaceProject ↔ offsetsStore bridge (Phase 9.3 / CAL profiles on pack).
 * Soft field `calibration.byPovId` — omit when empty; old packs ignore.
 */

import {
  getOffsets,
  setOffsets,
} from './offsetsStore.ts'
import {
  type CalibrationOffsets,
  zeroOffsets,
} from './types.ts'

/** On-disk / API shape under RaceProject.calibration. */
export type RaceProjectCalibration = {
  byPovId: Record<string, CalibrationOffsets>
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Soft-parse one offsets object. Accepts store field names and short aliases
 * (`yaw` / `pitch` / `roll` / `fov` / `alt`). Unknown keys ignored.
 * Returns null if nothing usable.
 */
export function parseCalibrationOffsets(
  raw: unknown,
): CalibrationOffsets | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const o = raw as Record<string, unknown>
  const base = zeroOffsets()
  let any = false

  const read = (keys: string[]): number | undefined => {
    for (const k of keys) {
      if (isFiniteNumber(o[k])) return o[k]
    }
    return undefined
  }

  const yaw = read(['yawDeg', 'yaw'])
  if (yaw !== undefined) {
    base.yawDeg = yaw
    any = true
  }
  const pitch = read(['pitchDeg', 'pitch'])
  if (pitch !== undefined) {
    base.pitchDeg = pitch
    any = true
  }
  const roll = read(['rollDeg', 'roll'])
  if (roll !== undefined) {
    base.rollDeg = roll
    any = true
  }
  const fov = read(['fovHDeg', 'fov'])
  if (fov !== undefined) {
    base.fovHDeg = fov
    any = true
  }
  const alt = read(['altMeters', 'alt'])
  if (alt !== undefined) {
    base.altMeters = alt
    any = true
  }

  return any ? base : null
}

/**
 * Soft-parse `calibration` block. Invalid / empty → undefined (omit).
 * Does not throw — pack load must not break on junk calib.
 */
export function parseRaceProjectCalibration(
  raw: unknown,
): RaceProjectCalibration | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const byRaw = (raw as Record<string, unknown>).byPovId
  if (byRaw === null || typeof byRaw !== 'object' || Array.isArray(byRaw)) {
    return undefined
  }
  const byPovId: Record<string, CalibrationOffsets> = {}
  for (const [key, value] of Object.entries(byRaw as Record<string, unknown>)) {
    const id = key.trim()
    if (id === '') continue
    const offs = parseCalibrationOffsets(value)
    if (offs) byPovId[id] = offs
  }
  return Object.keys(byPovId).length > 0 ? { byPovId } : undefined
}

/** Snapshot current store offsets for the given POV ids (full five knobs each). */
export function snapshotCalibrationByPovId(
  povIds: readonly string[],
): RaceProjectCalibration | undefined {
  const byPovId: Record<string, CalibrationOffsets> = {}
  for (const id of povIds) {
    const trimmed = id.trim()
    if (trimmed === '') continue
    byPovId[trimmed] = getOffsets(trimmed)
  }
  return Object.keys(byPovId).length > 0 ? { byPovId } : undefined
}

/** Hydrate offsetsStore from a pack. No-op when `calibration` omitted (old packs). */
export function applyRaceProjectCalibration(project: {
  calibration?: RaceProjectCalibration
}): void {
  const byPovId = project.calibration?.byPovId
  if (!byPovId) return
  for (const [id, offs] of Object.entries(byPovId)) {
    setOffsets(id, offs)
  }
}
