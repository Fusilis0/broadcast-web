/**
 * 2D SRT program cam (Phase 22.4e): top-down follow of telemetry boats.
 * Planned-only / map-dropped hulls never pull the centroid. Empty set freezes.
 */

import { eastNorthFromScene } from '../geodesy/index.ts'
import { isTelemetryBoatLive } from './programCam.ts'
import { STATIC_HULL_LIVE_HOLD_MS } from './staticFleetHulls.ts'
import {
  MAX_HALF_EXTENT_N,
  MIN_HALF_EXTENT_N,
  type MapViewState,
} from './map2dView.ts'

/** Same freshness window as AR Follow / 3D Frame boats / static-hull hold. */
export const MAP2D_PROGRAM_STALE_MS = STATIC_HULL_LIVE_HOLD_MS

/** Default zoom: metres of East visible across the 16:9 stream frame. */
export const DEFAULT_MAP2D_METRES_ACROSS = 250
export const MIN_MAP2D_METRES_ACROSS = 40
export const MAX_MAP2D_METRES_ACROSS = 20_000

/** Stream map is 1920×1080. East span = 2 * halfExtentN * aspect. */
export const STREAM_MAP_ASPECT = 16 / 9

export type Map2dProgramFollow = 'centroid' | 'boat'

export type Map2dProgramCamState = {
  follow: Map2dProgramFollow
  boatId: string | null
  offsetEastM: number
  offsetNorthM: number
  metresAcross: number
}

export type Map2dProgramBoatPose = {
  id: string
  east: number
  north: number
  lastLiveAtMs: number
}

export type Map2dProgramView = {
  centerE: number
  centerN: number
  halfExtentN: number
  autoFit: false
}

export type Map2dProgramEnu = { east: number; north: number }

export type ResolveMap2dProgramViewInput = {
  boats: readonly Map2dProgramBoatPose[]
  nowMs: number
  follow: Map2dProgramFollow
  boatId: string | null
  offsetEastM: number
  offsetNorthM: number
  metresAcross: number
  aspect?: number
  lastTarget: Map2dProgramEnu | null
  fallbackTarget?: Map2dProgramEnu | null
  hiddenIds?: ReadonlySet<string>
  staleMs?: number
}

export type ResolveMap2dProgramViewResult = {
  view: Map2dProgramView
  target: Map2dProgramEnu
  frozen: boolean
}

export type Map2dProgramCamHandle = {
  noteBoatPose: (id: string, east: number, north: number, nowMs?: number) => void
  removeBoat: (id: string) => void
  retainBoatIds: (ids: readonly string[]) => void
  setHiddenIds: (ids: ReadonlySet<string> | readonly string[]) => void
  setFollowCentroid: () => void
  setFollowBoat: (id: string) => void
  setOffsetEastM: (m: number) => void
  setOffsetNorthM: (m: number) => void
  setMetresAcross: (m: number) => void
  setFallbackTarget: (target: Map2dProgramEnu | null) => void
  getState: () => Map2dProgramCamState
  listLiveBoats: (nowMs?: number) => Map2dProgramBoatPose[]
  resolveView: (nowMs?: number) => Map2dProgramView
}

export function clampMap2dMetresAcross(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_MAP2D_METRES_ACROSS
  return Math.min(
    MAX_MAP2D_METRES_ACROSS,
    Math.max(MIN_MAP2D_METRES_ACROSS, m),
  )
}

export function clampMap2dOffsetM(m: number): number {
  if (!Number.isFinite(m)) return 0
  return Math.min(50_000, Math.max(-50_000, m))
}

/** Metres across the frame (East span) → map `halfExtentN`. */
export function metresAcrossToHalfExtentN(
  metresAcross: number,
  aspect = STREAM_MAP_ASPECT,
): number {
  const across = clampMap2dMetresAcross(metresAcross)
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : STREAM_MAP_ASPECT
  const halfN = across / (2 * a)
  return Math.min(MAX_HALF_EXTENT_N, Math.max(MIN_HALF_EXTENT_N, halfN))
}

export function halfExtentNToMetresAcross(
  halfExtentN: number,
  aspect = STREAM_MAP_ASPECT,
): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : STREAM_MAP_ASPECT
  const half = Number.isFinite(halfExtentN) ? halfExtentN : MIN_HALF_EXTENT_N
  return clampMap2dMetresAcross(2 * half * a)
}

export function liveMap2dProgramBoats(
  boats: readonly Map2dProgramBoatPose[],
  nowMs: number,
  hiddenIds?: ReadonlySet<string>,
  staleMs = MAP2D_PROGRAM_STALE_MS,
): Map2dProgramBoatPose[] {
  const out: Map2dProgramBoatPose[] = []
  for (const boat of boats) {
    const id = boat.id.trim()
    if (id === '') continue
    if (hiddenIds?.has(id)) continue
    if (!Number.isFinite(boat.east) || !Number.isFinite(boat.north)) continue
    if (!isTelemetryBoatLive(boat.lastLiveAtMs, nowMs, staleMs)) continue
    out.push(boat)
  }
  return out
}

export function centroidEastNorth(
  boats: readonly Map2dProgramEnu[],
): Map2dProgramEnu | null {
  if (boats.length === 0) return null
  let east = 0
  let north = 0
  for (const b of boats) {
    east += b.east
    north += b.north
  }
  const n = boats.length
  return { east: east / n, north: north / n }
}

/** Course / layout fallback when the follow set has never been live. */
export function layoutCentroidEastNorth(
  features: readonly { points: readonly { x: number; z: number }[] }[],
): Map2dProgramEnu | null {
  let east = 0
  let north = 0
  let n = 0
  for (const f of features) {
    for (const p of f.points) {
      const en = eastNorthFromScene(p)
      if (!Number.isFinite(en.east) || !Number.isFinite(en.north)) continue
      east += en.east
      north += en.north
      n += 1
    }
  }
  if (n === 0) return null
  return { east: east / n, north: north / n }
}

export function resolveMap2dProgramView(
  input: ResolveMap2dProgramViewInput,
): ResolveMap2dProgramViewResult {
  const live = liveMap2dProgramBoats(
    input.boats,
    input.nowMs,
    input.hiddenIds,
    input.staleMs,
  )
  let target: Map2dProgramEnu | null = null
  let frozen = false

  if (input.follow === 'boat') {
    const id = input.boatId?.trim() ?? ''
    const one = id === '' ? undefined : live.find((b) => b.id === id)
    if (one) {
      target = { east: one.east, north: one.north }
    } else {
      frozen = true
      target = input.lastTarget ?? input.fallbackTarget ?? { east: 0, north: 0 }
    }
  } else {
    const c = centroidEastNorth(live)
    if (c) {
      target = c
    } else {
      frozen = true
      target = input.lastTarget ?? input.fallbackTarget ?? { east: 0, north: 0 }
    }
  }

  const centre: Map2dProgramEnu = {
    east: target.east + clampMap2dOffsetM(input.offsetEastM),
    north: target.north + clampMap2dOffsetM(input.offsetNorthM),
  }
  const view: Map2dProgramView = {
    centerE: centre.east,
    centerN: centre.north,
    halfExtentN: metresAcrossToHalfExtentN(
      input.metresAcross,
      input.aspect ?? STREAM_MAP_ASPECT,
    ),
    autoFit: false,
  }
  return { view, target, frozen }
}

export function isMap2dProgramView(raw: unknown): raw is Map2dProgramView {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return (
    Number.isFinite(Number(o.centerE)) &&
    Number.isFinite(Number(o.centerN)) &&
    Number.isFinite(Number(o.halfExtentN)) &&
    o.autoFit === false
  )
}

export function asMapViewState(view: Map2dProgramView): MapViewState {
  return {
    centerE: view.centerE,
    centerN: view.centerN,
    halfExtentN: view.halfExtentN,
    autoFit: false,
  }
}

function hiddenSet(
  ids: ReadonlySet<string> | readonly string[],
): Set<string> {
  if (ids instanceof Set) return new Set(ids)
  return new Set([...ids].map((id) => id.trim()).filter((id) => id !== ''))
}

/** Mutable 2D program rig used by studio local 2D and the SRT 2D plate. */
export function createMap2dProgramCam(): Map2dProgramCamHandle {
  const boats = new Map<string, Map2dProgramBoatPose>()
  let hiddenIds = new Set<string>()
  let follow: Map2dProgramFollow = 'centroid'
  let boatId: string | null = null
  let offsetEastM = 0
  let offsetNorthM = 0
  let metresAcross = DEFAULT_MAP2D_METRES_ACROSS
  let lastTarget: Map2dProgramEnu | null = null
  let fallbackTarget: Map2dProgramEnu | null = null

  function resolve(nowMs: number): Map2dProgramView {
    const result = resolveMap2dProgramView({
      boats: [...boats.values()],
      nowMs,
      follow,
      boatId,
      offsetEastM,
      offsetNorthM,
      metresAcross,
      lastTarget,
      fallbackTarget,
      hiddenIds,
    })
    if (!result.frozen) lastTarget = result.target
    return result.view
  }

  return {
    noteBoatPose(id, east, north, nowMs = Date.now()) {
      const key = id.trim()
      if (key === '') return
      if (!Number.isFinite(east) || !Number.isFinite(north)) return
      if (!Number.isFinite(nowMs)) return
      boats.set(key, { id: key, east, north, lastLiveAtMs: nowMs })
    },
    removeBoat(id) {
      boats.delete(id.trim())
    },
    retainBoatIds(ids) {
      const allow = new Set(
        [...ids].map((row) => row.trim()).filter((row) => row !== ''),
      )
      for (const key of [...boats.keys()]) {
        if (!allow.has(key)) boats.delete(key)
      }
    },
    setHiddenIds(ids) {
      hiddenIds = hiddenSet(ids)
    },
    setFollowCentroid() {
      follow = 'centroid'
      boatId = null
    },
    setFollowBoat(id) {
      const key = id.trim()
      if (key === '') return
      follow = 'boat'
      boatId = key
    },
    setOffsetEastM(m) {
      offsetEastM = clampMap2dOffsetM(m)
    },
    setOffsetNorthM(m) {
      offsetNorthM = clampMap2dOffsetM(m)
    },
    setMetresAcross(m) {
      metresAcross = clampMap2dMetresAcross(m)
    },
    setFallbackTarget(target) {
      fallbackTarget =
        target && Number.isFinite(target.east) && Number.isFinite(target.north)
          ? { east: target.east, north: target.north }
          : null
    },
    getState() {
      return {
        follow,
        boatId,
        offsetEastM,
        offsetNorthM,
        metresAcross,
      }
    },
    listLiveBoats(nowMs = Date.now()) {
      return liveMap2dProgramBoats(
        [...boats.values()],
        nowMs,
        hiddenIds,
      )
    },
    resolveView(nowMs = Date.now()) {
      return resolve(nowMs)
    },
  }
}
