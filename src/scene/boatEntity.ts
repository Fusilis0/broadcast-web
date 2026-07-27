import * as THREE from 'three'
import {
  applyBoatVisualOffset,
} from '../assets/boatVisualOffset.ts'
import { createProceduralBoatVisual } from '../assets/createProceduralBoatVisual.ts'
import { loadBoatModelTemplate } from '../assets/loadBoatModel.ts'
import {
  poseRotationToQuaternion,
  type PoseEvent,
} from '../pose/index.ts'
import {
  createBoatTag,
  type BoatTagHandle,
  type BoatTagIdentity,
} from './boatTag.ts'

/** Mock boat id from TEL (`src/telemetry/mockSource.ts`). */
export const DEFAULT_BOAT_ID = '21'

export type BoatEntityOptions = {
  id?: string
  /** Display name from catalogue (default `Boat {id}`). */
  displayName?: string
  /** Category tint `#rrggbb` for the tag plate/border/name. */
  color?: string
  /**
   * When true (default), start with procedural hull and swap to glTF clone
   * when `/models/boat.glb` loads. Set false to keep procedural only.
   */
  tryGltf?: boolean
}

export type BoatEntityHandle = {
  root: THREE.Group
  id: string
  applyPose: (pose: PoseEvent) => void
  /** Billboard distance scale — call each frame with the active drone camera. */
  updateTag: (camera: THREE.Camera, viewportHeightPx: number) => void
  /** Apply catalogue name/colour after async load (or live update). */
  setTagIdentity: (identity: BoatTagIdentity) => void
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

  const root = new THREE.Group()
  root.name = `boat-${id}`

  let visual: THREE.Object3D = createProceduralBoatVisual()
  applyBoatVisualOffset(visual)
  root.add(visual)

  const tag: BoatTagHandle = createBoatTag({
    id,
    displayName,
    color: options.color,
  })
  root.add(tag.root)

  root.visible = false

  let cancelled = false
  if (tryGltf) {
    void loadBoatModelTemplate().then((template) => {
      if (cancelled) return
      const next = template.clone(true)
      root.remove(visual)
      disposeObject3D(visual)
      visual = next
      root.add(visual)
      // Keep tag as last child for stable draw order
      root.add(tag.root)
    })
  }

  return {
    root,
    id,
    applyPose(pose: PoseEvent): void {
      const { x, y, z } = pose.position
      root.position.set(x, y, z)
      root.quaternion.copy(poseRotationToQuaternion(pose.rotation))
      root.visible = true
    },
    updateTag(camera: THREE.Camera, viewportHeightPx: number): void {
      tag.update(camera, viewportHeightPx)
    },
    setTagIdentity(identity: BoatTagIdentity): void {
      tag.setTagIdentity(identity)
    },
    dispose(): void {
      cancelled = true
      tag.dispose()
      disposeObject3D(root)
      root.clear()
    },
  }
}
