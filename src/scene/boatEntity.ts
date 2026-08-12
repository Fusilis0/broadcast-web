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
  type BoatTagHandle,
  type BoatTagIdentity,
} from './boatTag.ts'
import {
  applyBoatVisibilityMode,
  createGhostBoatRing,
  normalizeBoatVisibilityMode,
  tintGhostBoatRing,
  type BoatVisibilityMode,
} from './boatVisibility.ts'

/** Mock boat id from TEL (`src/telemetry/mockSource.ts`). */
export const DEFAULT_BOAT_ID = '21'

export type BoatEntityOptions = {
  id?: string
  /** Display name from catalogue (default `Boat {id}`). */
  displayName?: string
  /** Category tint `#rrggbb` for tag plate + hull. */
  color?: string
  /**
   * When true (default), start with procedural hull and swap to glTF clone
   * when `/models/boat.glb` loads. Set false to keep procedural only.
   */
  tryGltf?: boolean
  /** Initial draw mode — default `solid`. */
  visibilityMode?: BoatVisibilityMode
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
  dispose: () => void
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      const mat = obj.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

/**
 * Boat entity: pose root + visual child (glTF or procedural) + billboard tag.
 * Fleet registry (`createScene`) owns `Map<id, BoatEntityHandle>` and clones
 * the shared glTF/procedural template per id.
 */
export function createBoatEntity(
  options: BoatEntityOptions = {},
): BoatEntityHandle {
  const id = options.id ?? DEFAULT_BOAT_ID
  const displayName = options.displayName ?? `Boat ${id}`
  const tryGltf = options.tryGltf !== false
  let hullColor = options.color
  let visibilityMode = normalizeBoatVisibilityMode(options.visibilityMode)

  const root = new THREE.Group()
  root.name = `boat-${id}`

  let visual: THREE.Object3D = createProceduralBoatVisual()
  applyBoatVisualOffset(visual)
  applyBoatHullTint(visual, hullColor)
  root.add(visual)

  const ghostRing = createGhostBoatRing(hullColor)
  root.add(ghostRing)

  const tag: BoatTagHandle = createBoatTag({
    id,
    displayName,
    color: options.color,
  })
  root.add(tag.root)

  root.visible = false

  function applyVisibility(): void {
    applyBoatVisibilityMode(visibilityMode, {
      visual,
      ghostRing,
      tagRoot: tag.root,
    })
  }

  applyVisibility()

  let cancelled = false
  if (tryGltf) {
    void loadBoatModelTemplate().then((template) => {
      if (cancelled) return
      const next = template.clone(true)
      root.remove(visual)
      disposeObject3D(visual)
      visual = next
      applyBoatHullTint(visual, hullColor)
      root.add(visual)
      // Keep ring + tag as later children for stable draw order
      root.add(ghostRing)
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
      root.quaternion.copy(poseRotationToQuaternion(pose.rotation))
      // Root show-on-first-pose; hull/tag stay under setVisibilityMode.
      root.visible = true
    },
    updateTag(camera: THREE.Camera, viewportHeightPx: number): void {
      if (visibilityMode === 'hidden') return
      tag.update(camera, viewportHeightPx)
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
    },
    getVisibilityMode(): BoatVisibilityMode {
      return visibilityMode
    },
    dispose(): void {
      cancelled = true
      tag.dispose()
      disposeObject3D(root)
      root.clear()
    },
  }
}

export type { BoatVisibilityMode }
