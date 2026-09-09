/**
 * Mount named Bosphorus heroes (glTF or labelled proxy).
 * Placement: GEO `gpsToEnuAmsl` only. Occupancy disks → OSM Buildings.
 */

import * as THREE from 'three'
import { gpsToEnuAmsl } from '../../geodesy/index.ts'
import * as GeoOrigin from '../../geodesy/geoOrigin.ts'
import type { OccupancyHole } from '../buildings/index.ts'
import { landmarkCatalogueSlice } from './catalogue.ts'
import {
  DEFAULT_HEROES_ENABLED,
  LANDMARK_INCHES_TO_M,
  LANDMARK_MM_TO_M,
  LANDMARK_TENS_OF_KM_M,
  shouldShowLandmarks,
} from './constants.ts'
import {
  applyLandmarkOffset,
  degToRad,
  landmarkEnuFromGps,
  landmarkFocusRadiusM,
  occupancyHolesFromEnu,
  yawRadFromDeg,
} from './layout.ts'
import { loadLandmarkGltf } from './loadLandmarkGltf.ts'
import { defaultLandmarkPose } from './defaultOffsets.ts'
import {
  isZeroLandmarkPose,
  normalizeLandmarkPose,
  offsetsFromProject,
} from './projectLandmarks.ts'
import { createLandmarkProxy, disposeObject3D } from './proxyMesh.ts'
import { stripLandmarkFloors } from './stripFloors.ts'
import { recolorSketchupPurple } from './sketchupPurple.ts'
import { landmarkTextureKindFromVisual } from './textureKind.ts'
import type {
  GpsToEnuAmslFn,
  LandmarkEnu,
  LandmarkEntry,
  LandmarkPoseOffset,
  LandmarkTextureReport,
} from './types.ts'
import type { RaceProjectLandmarks } from '../../projects/types.ts'

export type CreateLandmarksOptions = {
  /** Override GEO convert (tests). Default: `gpsToEnuAmsl`. */
  gpsToEnuAmsl?: GpsToEnuAmslFn
  catalogue?: readonly LandmarkEntry[]
  enabled?: boolean
  /** Test seam — omit in production. */
  loadGltf?: (url: string) => Promise<THREE.Group | null>
  /** Called after layout / visibility change. Empty when hidden. */
  onOccupancyHoles?: (holes: readonly OccupancyHole[]) => void
}

export type LandmarksHandle = {
  root: THREE.Group
  setEnabled: (enabled: boolean) => void
  getEnabled: () => boolean
  setOpaqueClearSafe: (safe: boolean) => void
  getOccupancyHoles: () => OccupancyHole[]
  relayout: () => void
  setLandmarkPoseOffset: (
    id: string,
    pose: Partial<LandmarkPoseOffset>,
  ) => void
  getLandmarkPoseOffsets: () => Record<string, LandmarkPoseOffset>
  applyLandmarkPoseOffsets: (landmarks?: RaceProjectLandmarks) => void
  getLandmarkWorldPosition: (
    id: string,
  ) => { x: number; y: number; z: number } | null
  /** Mesh AABB: XZ centre, Y at the roof. Cinematic pins use this. */
  getLandmarkPinAnchor: (
    id: string,
  ) => { x: number; y: number; z: number } | null
  getLandmarkFocusRadius: (id: string) => number | null
  getLandmarkTextureReport: () => LandmarkTextureReport[]
  /** Settles when every glTF attempt has finished (proxies resolve immediately). */
  ready: Promise<void>
  dispose: () => void
}

type MountedHero = {
  entry: LandmarkEntry
  group: THREE.Group
  enu: LandmarkEnu
  textureKind: LandmarkTextureReport['kind']
}

function defaultConvert(): GpsToEnuAmslFn {
  return (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  }
}

function applyEnuPose(
  group: THREE.Group,
  entry: LandmarkEntry,
  enu: LandmarkEnu,
  offset: LandmarkPoseOffset,
): void {
  const world = applyLandmarkOffset(enu, offset)
  group.position.set(world.x, world.y, world.z)
  group.rotation.set(
    degToRad(offset.pitchDeg),
    yawRadFromDeg(entry.yawDeg + offset.yawDeg),
    degToRad(offset.rollDeg),
  )
  const base = group.userData.landmarkBaseScale
  if (base instanceof THREE.Vector3) {
    group.scale.copy(base).multiplyScalar(offset.scale)
  } else {
    group.scale.setScalar(offset.scale)
  }
}

function rememberBaseScale(group: THREE.Group): void {
  group.userData.landmarkBaseScale = group.scale.clone()
}

function aabbSizeM(object: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  box.getSize(size)
  return size
}

/**
 * Unit conversion only: leftover millimetres (tens of km) or inches (~39× real).
 * Do not invent a geoid or an eyeball fudge.
 */
function applyLandmarkUnitScale(group: THREE.Group, entry: LandmarkEntry): void {
  const size = aabbSizeM(group)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(maxDim) || maxDim <= 0) return

  if (maxDim >= LANDMARK_TENS_OF_KM_M) {
    group.scale.multiplyScalar(LANDMARK_MM_TO_M)
    return
  }

  const expected = Math.max(
    entry.proxySizeM.x,
    entry.proxySizeM.y,
    entry.proxySizeM.z,
  )
  if (expected <= 0) return
  const ratio = maxDim / expected
  if (ratio > 30 && ratio < 50) {
    group.scale.multiplyScalar(LANDMARK_INCHES_TO_M)
  }
}

function logLandmarkAabb(id: string, object: THREE.Object3D): void {
  const size = aabbSizeM(object)
  console.info(
    `[landmarks] ${id} AABB m: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
  )
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim >= LANDMARK_TENS_OF_KM_M) {
    console.warn(
      `[landmarks] ${id} AABB is tens of km after unit scale; report to SCN — no further fudge`,
    )
  } else if (maxDim > 0 && maxDim < 0.05) {
    console.warn(
      `[landmarks] ${id} AABB is centimetres; report to SCN — no invented scale`,
    )
  }
}

export function createLandmarks(
  options: CreateLandmarksOptions = {},
): LandmarksHandle {
  const convert = options.gpsToEnuAmsl ?? defaultConvert()
  const catalogue = landmarkCatalogueSlice(options.catalogue)
  const loadGltf = options.loadGltf ?? loadLandmarkGltf
  const root = new THREE.Group()
  root.name = 'landmarks'

  let enabled = options.enabled !== undefined ? options.enabled === true : DEFAULT_HEROES_ENABLED
  let opaqueClearSafe = false
  let disposed = false
  const mounted: MountedHero[] = []
  const offsets = new Map<string, LandmarkPoseOffset>()

  function poseOf(id: string): LandmarkPoseOffset {
    return offsets.get(id) ?? defaultLandmarkPose(id)
  }

  function storePose(id: string, pose: LandmarkPoseOffset): void {
    const next = normalizeLandmarkPose(pose)
    if (isZeroLandmarkPose(next)) offsets.delete(id)
    else offsets.set(id, next)
  }

  function visiblePlaced(): LandmarkEnu[] {
    if (!shouldShowLandmarks(enabled, opaqueClearSafe)) return []
    return mounted.map((m) => applyLandmarkOffset(m.enu, poseOf(m.entry.id)))
  }

  function emitOccupancy(): OccupancyHole[] {
    const holes = occupancyHolesFromEnu(visiblePlaced())
    options.onOccupancyHoles?.(holes)
    return holes
  }

  function syncVisible(): void {
    if (disposed) return
    root.visible = shouldShowLandmarks(enabled, opaqueClearSafe)
    emitOccupancy()
  }

  function relayout(): void {
    if (disposed) return
    for (const m of mounted) {
      m.enu = landmarkEnuFromGps(m.entry, convert)
      applyEnuPose(m.group, m.entry, m.enu, poseOf(m.entry.id))
    }
    emitOccupancy()
  }

  function mountVisual(entry: LandmarkEntry, visual: THREE.Group): void {
    if (disposed) {
      disposeObject3D(visual)
      return
    }
    const enu = landmarkEnuFromGps(entry, convert)
    applyEnuPose(visual, entry, enu, poseOf(entry.id))
    visual.userData.landmarkId = entry.id
    root.add(visual)
    mounted.push({
      entry,
      group: visual,
      enu,
      textureKind: landmarkTextureKindFromVisual(entry.kind, visual),
    })
    emitOccupancy()
  }

  function worldPositionFor(id: string): { x: number; y: number; z: number } | null {
    const trimmed = id.trim()
    if (trimmed === '') return null
    const mountedHero = mounted.find((m) => m.entry.id === trimmed)
    const entry = mountedHero?.entry ?? catalogue.find((e) => e.id === trimmed)
    if (!entry) return null
    const enu = mountedHero?.enu ?? landmarkEnuFromGps(entry, convert)
    const world = applyLandmarkOffset(enu, poseOf(trimmed))
    return { x: world.x, y: world.y, z: world.z }
  }

  function pinAnchorFor(id: string): { x: number; y: number; z: number } | null {
    const trimmed = id.trim()
    if (trimmed === '') return null
    const mountedHero = mounted.find((m) => m.entry.id === trimmed)
    if (mountedHero) {
      const box = new THREE.Box3().setFromObject(mountedHero.group)
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3())
        return { x: c.x, y: box.max.y, z: c.z }
      }
    }
    return worldPositionFor(id)
  }

  const pending: Promise<{ entry: LandmarkEntry; visual: THREE.Group } | null>[] =
    []
  for (const entry of catalogue) {
    if (entry.kind === 'gltf' && entry.gltfUrl) {
      pending.push(
        loadGltf(entry.gltfUrl).then((group) => {
          if (!group) return null
          applyLandmarkUnitScale(group, entry)
          stripLandmarkFloors(group)
          recolorSketchupPurple(group)
          rememberBaseScale(group)
          return { entry, visual: group }
        }),
      )
      continue
    }
    pending.push(
      Promise.resolve({ entry, visual: createLandmarkProxy(entry) }).then(
        (row) => {
          rememberBaseScale(row.visual)
          return row
        },
      ),
    )
  }

  const ready = Promise.all(pending).then((results) => {
    if (disposed) {
      for (const r of results) {
        if (r) disposeObject3D(r.visual)
      }
      return
    }
    for (const r of results) {
      if (!r) continue
      mountVisual(r.entry, r.visual)
      if (r.entry.kind === 'gltf') logLandmarkAabb(r.entry.id, r.visual)
    }
  })

  const unsubOrigin = GeoOrigin.onChanged(() => {
    relayout()
  })

  syncVisible()

  return {
    root,
    setEnabled(next: boolean): void {
      if (disposed) return
      enabled = next === true
      syncVisible()
    },
    getEnabled: () => enabled,
    setOpaqueClearSafe(safe: boolean): void {
      if (disposed) return
      opaqueClearSafe = safe === true
      syncVisible()
    },
    getOccupancyHoles: () => occupancyHolesFromEnu(visiblePlaced()),
    relayout,
    setLandmarkPoseOffset(id, pose): void {
      if (disposed) return
      const trimmed = id.trim()
      if (trimmed === '') return
      storePose(trimmed, { ...poseOf(trimmed), ...pose })
      const m = mounted.find((h) => h.entry.id === trimmed)
      if (m) applyEnuPose(m.group, m.entry, m.enu, poseOf(trimmed))
      emitOccupancy()
    },
    getLandmarkPoseOffsets(): Record<string, LandmarkPoseOffset> {
      const out: Record<string, LandmarkPoseOffset> = {}
      for (const entry of catalogue) {
        out[entry.id] = { ...poseOf(entry.id) }
      }
      for (const [id, pose] of offsets) {
        if (!(id in out)) out[id] = { ...pose }
      }
      return out
    },
    applyLandmarkPoseOffsets(landmarks): void {
      if (disposed) return
      offsets.clear()
      for (const [id, pose] of Object.entries(offsetsFromProject(landmarks))) {
        storePose(id, pose)
      }
      relayout()
    },
    getLandmarkWorldPosition: worldPositionFor,
    getLandmarkPinAnchor: pinAnchorFor,
    getLandmarkFocusRadius(id): number | null {
      const trimmed = id.trim()
      if (trimmed === '') return null
      const m = mounted.find((h) => h.entry.id === trimmed)
      const entry = m?.entry ?? catalogue.find((e) => e.id === trimmed)
      if (!entry) return null
      if (!m) return landmarkFocusRadiusM(entry)
      const size = aabbSizeM(m.group)
      return landmarkFocusRadiusM(
        entry,
        Math.max(size.x, size.y, size.z),
      )
    },
    getLandmarkTextureReport(): LandmarkTextureReport[] {
      const byId = new Map(mounted.map((m) => [m.entry.id, m.textureKind]))
      return catalogue.map((entry) => ({
        id: entry.id,
        kind:
          entry.kind === 'proxy'
            ? 'proxy'
            : (byId.get(entry.id) ?? 'no image'),
      }))
    },
    ready,
    dispose(): void {
      if (disposed) return
      disposed = true
      unsubOrigin()
      disposeObject3D(root)
      root.clear()
      mounted.length = 0
      options.onOccupancyHoles?.([])
    },
  }
}
