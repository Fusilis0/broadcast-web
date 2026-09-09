/**
 * Soft RaceProject.landmarks — authoring offsets, not a geoid.
 * Parse like calibration: junk / omit → ignore; empty byId → omit on save.
 */

import type {
  RaceProjectLandmarkPose,
  RaceProjectLandmarks,
} from '../../projects/types.ts'
import {
  LANDMARKS_OFFSETS_LOCAL_KEY,
  LANDMARKS_OFFSETS_SESSION_KEY,
} from './constants.ts'
import type { LandmarkPoseOffset } from './types.ts'

export const ZERO_LANDMARK_POSE: LandmarkPoseOffset = {
  x: 0,
  y: 0,
  z: 0,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  scale: 1,
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function finiteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback
}

function finiteScale(value: unknown): number {
  if (!isFiniteNumber(value) || value <= 0) return 1
  return value
}

export function isZeroLandmarkPose(pose: LandmarkPoseOffset): boolean {
  return (
    pose.x === 0 &&
    pose.y === 0 &&
    pose.z === 0 &&
    pose.yawDeg === 0 &&
    pose.pitchDeg === 0 &&
    pose.rollDeg === 0 &&
    pose.scale === 1
  )
}

export function normalizeLandmarkPose(
  partial: Partial<LandmarkPoseOffset> | undefined,
): LandmarkPoseOffset {
  return {
    x: finiteOr(partial?.x, 0),
    y: finiteOr(partial?.y, 0),
    z: finiteOr(partial?.z, 0),
    yawDeg: finiteOr(partial?.yawDeg, 0),
    pitchDeg: finiteOr(partial?.pitchDeg, 0),
    rollDeg: finiteOr(partial?.rollDeg, 0),
    scale: finiteScale(partial?.scale),
  }
}

function parseOffsetM(
  raw: unknown,
): { x: number; y: number; z: number } | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined
  }
  const o = raw as Record<string, unknown>
  if (
    !isFiniteNumber(o.x) ||
    !isFiniteNumber(o.y) ||
    !isFiniteNumber(o.z)
  ) {
    return undefined
  }
  return { x: o.x, y: o.y, z: o.z }
}

function parsePoseEntry(raw: unknown): RaceProjectLandmarkPose | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const o = raw as Record<string, unknown>
  const pose: RaceProjectLandmarkPose = {}
  const offsetM = parseOffsetM(o.offsetM)
  if (offsetM) pose.offsetM = offsetM
  if (isFiniteNumber(o.yawDeg)) pose.yawDeg = o.yawDeg
  if (isFiniteNumber(o.pitchDeg)) pose.pitchDeg = o.pitchDeg
  if (isFiniteNumber(o.rollDeg)) pose.rollDeg = o.rollDeg
  if (isFiniteNumber(o.scale) && o.scale > 0) pose.scale = o.scale
  if (
    pose.offsetM === undefined &&
    pose.yawDeg === undefined &&
    pose.pitchDeg === undefined &&
    pose.rollDeg === undefined &&
    pose.scale === undefined
  ) {
    return null
  }
  return pose
}

/**
 * Soft-parse `landmarks` block. Invalid / empty → undefined (omit).
 * Does not throw — pack load must not break on junk.
 */
export function parseRaceProjectLandmarks(
  raw: unknown,
): RaceProjectLandmarks | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const byRaw = (raw as Record<string, unknown>).byId
  if (byRaw === null || typeof byRaw !== 'object' || Array.isArray(byRaw)) {
    return undefined
  }
  const byId: Record<string, RaceProjectLandmarkPose> = {}
  for (const [key, value] of Object.entries(byRaw as Record<string, unknown>)) {
    const id = key.trim()
    if (id === '') continue
    const pose = parsePoseEntry(value)
    if (pose) byId[id] = pose
  }
  return Object.keys(byId).length > 0 ? { byId } : undefined
}

export function poseFromProjectEntry(
  entry: RaceProjectLandmarkPose,
): LandmarkPoseOffset {
  return normalizeLandmarkPose({
    x: entry.offsetM?.x,
    y: entry.offsetM?.y,
    z: entry.offsetM?.z,
    yawDeg: entry.yawDeg,
    pitchDeg: entry.pitchDeg,
    rollDeg: entry.rollDeg,
    scale: entry.scale,
  })
}

export function offsetsFromProject(
  landmarks: RaceProjectLandmarks | undefined,
): Record<string, LandmarkPoseOffset> {
  const out: Record<string, LandmarkPoseOffset> = {}
  if (!landmarks?.byId) return out
  for (const [id, entry] of Object.entries(landmarks.byId)) {
    out[id] = poseFromProjectEntry(entry)
  }
  return out
}

/**
 * Always write current offsets; omit empty `byId` (and omit the field).
 * Zero poses are dropped.
 */
export function snapshotRaceProjectLandmarks(
  offsets: Readonly<Record<string, LandmarkPoseOffset>>,
): RaceProjectLandmarks | undefined {
  const byId: Record<string, RaceProjectLandmarkPose> = {}
  for (const [rawId, pose] of Object.entries(offsets)) {
    const id = rawId.trim()
    if (id === '') continue
    const next = normalizeLandmarkPose(pose)
    if (isZeroLandmarkPose(next)) continue
    const row: RaceProjectLandmarkPose = {}
    if (next.x !== 0 || next.y !== 0 || next.z !== 0) {
      row.offsetM = { x: next.x, y: next.y, z: next.z }
    }
    if (next.yawDeg !== 0) row.yawDeg = next.yawDeg
    if (next.pitchDeg !== 0) row.pitchDeg = next.pitchDeg
    if (next.rollDeg !== 0) row.rollDeg = next.rollDeg
    if (next.scale !== 1) row.scale = next.scale
    if (
      row.offsetM === undefined &&
      row.yawDeg === undefined &&
      row.pitchDeg === undefined &&
      row.rollDeg === undefined &&
      row.scale === undefined
    ) {
      continue
    }
    byId[id] = row
  }
  return Object.keys(byId).length > 0 ? { byId } : undefined
}

function offsetsFromStorageJson(
  raw: string | null,
): Record<string, LandmarkPoseOffset> {
  if (raw === null || raw === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  const out: Record<string, LandmarkPoseOffset> = {}
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    const id = key.trim()
    if (id === '') continue
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      continue
    }
    const o = value as Record<string, unknown>
    const pose = normalizeLandmarkPose({
      x: finiteOr(o.x, 0),
      y: finiteOr(o.y, 0),
      z: finiteOr(o.z, 0),
      yawDeg: finiteOr(o.yawDeg, 0),
      pitchDeg: finiteOr(o.pitchDeg, 0),
      rollDeg: finiteOr(o.rollDeg, 0),
      scale: finiteScale(o.scale),
    })
    if (!isZeroLandmarkPose(pose)) out[id] = pose
  }
  return out
}

function writeOffsetsToStorage(key: string, offsets: Readonly<Record<string, LandmarkPoseOffset>>): void {
  try {
    const snap = snapshotRaceProjectLandmarks(offsets)
    if (!snap?.byId) {
      if (key === LANDMARKS_OFFSETS_SESSION_KEY) {
        sessionStorage.removeItem(key)
      } else {
        localStorage.removeItem(key)
      }
      return
    }
    const stored: Record<string, LandmarkPoseOffset> = {}
    for (const [id, entry] of Object.entries(snap.byId)) {
      stored[id] = poseFromProjectEntry(entry)
    }
    const json = JSON.stringify(stored)
    if (key === LANDMARKS_OFFSETS_SESSION_KEY) {
      sessionStorage.setItem(key, json)
    } else {
      localStorage.setItem(key, json)
    }
  } catch {
    // storage may be blocked
  }
}

export function readSessionLandmarkOffsets(): Record<string, LandmarkPoseOffset> {
  try {
    return offsetsFromStorageJson(
      sessionStorage.getItem(LANDMARKS_OFFSETS_SESSION_KEY),
    )
  } catch {
    return {}
  }
}

export function writeSessionLandmarkOffsets(
  offsets: Readonly<Record<string, LandmarkPoseOffset>>,
): void {
  writeOffsetsToStorage(LANDMARKS_OFFSETS_SESSION_KEY, offsets)
}

export function readGlobalLandmarkOffsets(): Record<string, LandmarkPoseOffset> {
  try {
    return offsetsFromStorageJson(
      localStorage.getItem(LANDMARKS_OFFSETS_LOCAL_KEY),
    )
  } catch {
    return {}
  }
}

export function writeGlobalLandmarkOffsets(
  offsets: Readonly<Record<string, LandmarkPoseOffset>>,
): void {
  writeOffsetsToStorage(LANDMARKS_OFFSETS_LOCAL_KEY, offsets)
}

/**
 * Persist authoring: session (this tab) + localStorage (studio-wide).
 * Pack write is a separate Electron/API path.
 */
export function persistLandmarkOffsets(
  offsets: Readonly<Record<string, LandmarkPoseOffset>>,
): void {
  writeSessionLandmarkOffsets(offsets)
  writeGlobalLandmarkOffsets(offsets)
}

/**
 * Pack first, then studio global, then this tab. Tab edits win.
 */
export function mergeLandmarkOffsetLayers(
  pack: Readonly<Record<string, LandmarkPoseOffset>>,
  global: Readonly<Record<string, LandmarkPoseOffset>>,
  session: Readonly<Record<string, LandmarkPoseOffset>>,
): Record<string, LandmarkPoseOffset> {
  return { ...pack, ...global, ...session }
}
