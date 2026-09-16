import * as THREE from 'three'
import {
  applyBoatVisualOffset,
} from '../assets/boatVisualOffset.ts'
import { createProceduralBoatVisual } from '../assets/createProceduralBoatVisual.ts'
import { loadBoatModelTemplate } from '../assets/loadBoatModel.ts'
import { applyBoatHullTint } from '../assets/tintBoatVisual.ts'
import {
  poseRotationToQuaternion,
  type PoseEvent,
} from '../pose/index.ts'
import {
  createBoatTag,
  resolveBoatMastTopWorld,
  type BoatTagHandle,
  type BoatTagIdentity,
} from './boatTag.ts'
import {
  applyBoatVisibilityMode,
  cloneSharedMaterials,
  createGhostBoatRing,
  normalizeBoatVisibilityMode,
  tintGhostBoatRing,
  type BoatVisibilityMode,
} from './boatVisibility.ts'
import { createBoatWake } from './boatWake.ts'

/** Mock boat id from TEL (`src/telemetry/mockSource.ts`). */
export const DEFAULT_BOAT_ID = '21'

/**
 * Hull / glTF forward is +Z; geographic north is scene −Z. Compass yaw is
 * negated (same as the POV camera) then this 180° Y maps +Z-forward meshes
 * onto −Z-north. Pose `yawDeg` stays geographic for the 2D map.
 */
const HULL_PLUSZ_TO_NORTH = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI,
)

export type BoatEntityOptions = {
  id?: string
  /** Display name from catalogue (default `Boat {id}`). */
  displayName?: string
  /** Category tint `#rrggbb` for tag plate + hull + sail. */
  color?: string
  /**
   * When true (default), start with procedural hull and swap to glTF clone
   * when `/models/boat.glb` loads. Set false to keep procedural only.
   */
  tryGltf?: boolean
  /** Initial draw mode — default `solid`. */
  visibilityMode?: BoatVisibilityMode
  /**
   * Uniform hull scale (ratio locked). Omit / non-finite / ≤0 → 1.
   * Alt MSL is ENU y on the pose root — do not mix with this.
   */
  heightM?: number
}

export type BoatEntityHandle = {
  root: THREE.Group
  id: string
  applyPose: (pose: PoseEvent) => void
  /** Billboard distance scale — call with the camera about to render this pass. */
  updateTag: (camera: THREE.Camera, viewportHeightPx: number) => void
  /** Apply catalogue name/colour after async load (or live update). */
  setTagIdentity: (identity: BoatTagIdentity) => void
  /** Ghost / hidden / solid draw mode (pose still applies). */
  setVisibilityMode: (mode: BoatVisibilityMode) => void
  getVisibilityMode: () => BoatVisibilityMode
  /**
   * Uniform scale on the hull visual (and ghost ring). Tag + wake stay 1.
   * `heightM` omitted / non-finite / ≤0 → 1.
   */
  setHullScale: (heightM?: number) => void
  getHullScale: () => number
  /**
   * Advance the water-plane foam ribbon from hull XZ motion.
   * Call from the existing scene tick — do not add a second clock.
   */
  tickWake: (dtSeconds: number) => void
  getWakeLengthM: () => number
  /**
   * AND SRT channel preset onto authoring mode. Preset cannot force a hull
   * that `hidden` already turned off.
   */
  setChannelLayers: (layers: {
    boatModel: boolean
    boatTag: boolean
    headingArrow: boolean
  }) => void
  dispose: () => void
}

/** Unlit heading tick on the pose root (independent of hull). */
export function createBoatHeadingArrow(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'headingArrow'
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc14a,
    depthTest: true,
    depthWrite: false,
  })
  const shaftGeom = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6)
  const shaft = new THREE.Mesh(shaftGeom, mat)
  shaft.name = 'headingArrowShaft'
  shaft.rotation.x = Math.PI / 2
  shaft.position.z = 2.2
  const headGeom = new THREE.ConeGeometry(0.45, 1.2, 8)
  const head = new THREE.Mesh(headGeom, mat)
  head.name = 'headingArrowHead'
  head.rotation.x = Math.PI / 2
  head.position.z = 4.4
  g.add(shaft, head)
  g.position.y = 0.6
  return g
}

/**
 * Boat `heightM` → uniform scale. Default 1 when omitted.
 * Alt MSL is pose ENU y, not this scale.
 */
export function normalizeBoatHullScale(heightM?: number): number {
  if (typeof heightM !== 'number' || !Number.isFinite(heightM) || heightM <= 0) {
    return 1
  }
  return heightM
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

/**
 * Boat entity: pose root + visual child (glTF or procedural) + billboard tag
 * + water-plane foam wake (19.13).
 * Fleet registry (`createScene`) owns `Map<id, BoatEntityHandle>` and clones
 * the shared glTF/procedural template per id. glTF clones also
 * `cloneSharedMaterials` so ghost opacity cannot leak across boats.
 */
export function createBoatEntity(
  options: BoatEntityOptions = {},
): BoatEntityHandle {
  const id = options.id ?? DEFAULT_BOAT_ID
  const displayName = options.displayName ?? `Boat ${id}`
  const tryGltf = options.tryGltf !== false
  let hullColor = options.color
  let visibilityMode = normalizeBoatVisibilityMode(options.visibilityMode)
  let hullScale = normalizeBoatHullScale(options.heightM)
  let channelLayers = {
    boatModel: true,
    boatTag: true,
    headingArrow: true,
  }

  const root = new THREE.Group()
  root.name = `boat-${id}`

  let visual: THREE.Object3D = createProceduralBoatVisual()
  const ghostRing = createGhostBoatRing(hullColor)
  const headingArrow = createBoatHeadingArrow()

  function applyVisualTransform(): void {
    applyBoatVisualOffset(visual)
    visual.scale.multiplyScalar(hullScale)
    ghostRing.scale.setScalar(hullScale)
  }

  applyVisualTransform()
  applyBoatHullTint(visual, hullColor)
  root.add(visual)
  root.add(ghostRing)
  root.add(headingArrow)

  const wake = createBoatWake()
  root.add(wake.root)

  const tag: BoatTagHandle = createBoatTag({
    id,
    displayName,
    color: options.color,
  })
  root.add(tag.root)

  const _mastWorld = new THREE.Vector3()

  root.visible = false

  function applyVisibility(): void {
    applyBoatVisibilityMode(visibilityMode, {
      visual,
      ghostRing,
      tagRoot: tag.root,
    })
    if (!channelLayers.boatModel) {
      visual.visible = false
      ghostRing.visible = false
    }
    if (!channelLayers.boatTag) {
      tag.root.visible = false
    }
    headingArrow.visible = channelLayers.headingArrow
    wake.root.visible =
      channelLayers.boatModel && visibilityMode !== 'hidden'
  }

  applyVisibility()

  let prevX = Number.NaN
  let prevZ = Number.NaN
  let cancelled = false
  if (tryGltf) {
    void loadBoatModelTemplate().then((template) => {
      if (cancelled) return
      const next = template.clone(true)
      // clone(true) shares materials with the cached template — isolate so
      // ghost/solid opacity cannot leak across boats after save/reload.
      cloneSharedMaterials(next)
      root.remove(visual)
      disposeObject3D(visual)
      visual = next
      applyVisualTransform()
      applyBoatHullTint(visual, hullColor)
      root.add(visual)
      // Keep ring + arrow + wake + tag as later children for stable draw order
      root.add(ghostRing)
      root.add(headingArrow)
      root.add(wake.root)
      root.add(tag.root)
      applyVisibility()
    })
  }

  return {
    root,
    id,
    applyPose(pose: PoseEvent): void {
      const { x, y, z } = pose.position
      root.position.set(x, y, z)
      root.quaternion.copy(
        poseRotationToQuaternion({
          ...pose.rotation,
          yawDeg: -pose.rotation.yawDeg,
        }),
      )
      root.quaternion.multiply(HULL_PLUSZ_TO_NORTH)
      // Root show-on-first-pose; hull/tag stay under setVisibilityMode.
      root.visible = true
    },
    updateTag(camera: THREE.Camera, viewportHeightPx: number): void {
      resolveBoatMastTopWorld(visual, _mastWorld)
      tag.update(camera, viewportHeightPx, _mastWorld)
    },
    setTagIdentity(identity: BoatTagIdentity): void {
      hullColor = identity.color
      tag.setTagIdentity(identity)
      applyBoatHullTint(visual, hullColor)
      tintGhostBoatRing(ghostRing, hullColor)
      applyVisibility()
    },
    setVisibilityMode(mode: BoatVisibilityMode): void {
      visibilityMode = normalizeBoatVisibilityMode(mode)
      applyVisibility()
      wake.sync({ speedMs: 0, mode: visibilityMode, dtSeconds: 0 })
    },
    getVisibilityMode(): BoatVisibilityMode {
      return visibilityMode
    },
    setHullScale(heightM?: number): void {
      hullScale = normalizeBoatHullScale(heightM)
      applyVisualTransform()
    },
    getHullScale(): number {
      return hullScale
    },
    tickWake(dtSeconds: number): void {
      if (cancelled || !root.visible) return
      const x = root.position.x
      const z = root.position.z
      const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0
      let speedMs = 0
      if (Number.isFinite(prevX) && dt > 1e-4) {
        speedMs = Math.hypot(x - prevX, z - prevZ) / dt
      }
      prevX = x
      prevZ = z
      const wakeMode =
        channelLayers.boatModel ? visibilityMode : 'hidden'
      wake.sync({ speedMs, mode: wakeMode, dtSeconds: dt })
    },
    getWakeLengthM(): number {
      return wake.getLengthM()
    },
    setChannelLayers(layers): void {
      channelLayers = {
        boatModel: layers.boatModel === true,
        boatTag: layers.boatTag === true,
        headingArrow: layers.headingArrow === true,
      }
      applyVisibility()
    },
    dispose(): void {
      cancelled = true
      tag.dispose()
      wake.dispose()
      disposeObject3D(root)
      root.clear()
    },
  }
}

export type { BoatVisibilityMode }
