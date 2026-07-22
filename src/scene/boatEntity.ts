import * as THREE from 'three'
import {
  poseRotationToQuaternion,
  type PoseEvent,
} from '../pose/index.ts'

/** Mock boat id from TEL (`src/telemetry/mockSource.ts`). */
export const DEFAULT_BOAT_ID = '21'

export type BoatEntityHandle = {
  root: THREE.Group
  applyPose: (pose: PoseEvent) => void
  dispose: () => void
}

/**
 * Simple elongated box boat — no glTF in this DSP.
 * Length along local Z (north when yaw = 0).
 */
export function createBoatEntity(): BoatEntityHandle {
  const root = new THREE.Group()
  root.name = 'boat'

  // Sized for mock ENU separation (~hundreds of m) so the boat reads on-air.
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 18),
    new THREE.MeshBasicMaterial({ color: 0xc45c26 }),
  )
  hull.position.y = 1
  root.add(hull)

  // Cabin so yaw is readable when the drone gimbal sweeps past.
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2.5, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8dcc8 }),
  )
  cabin.position.set(0, 3.2, -2)
  root.add(cabin)

  root.visible = false

  return {
    root,
    applyPose(pose: PoseEvent): void {
      const { x, y, z } = pose.position
      root.position.set(x, y, z)
      root.quaternion.copy(poseRotationToQuaternion(pose.rotation))
      root.visible = true
    },
    dispose(): void {
      for (const child of root.children) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const mat = child.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      }
      root.clear()
    },
  }
}
