import * as THREE from 'three'
import {
  poseRotationToQuaternion,
  type PoseEvent,
} from '../pose/index.ts'

/** Mini 4 Pro default hFOV until CAL owns FOV (architecture / roadmap 1.6). */
export const TEMP_HFOV_DEG = 66.8832

/**
 * Unity cameras look along local +Z; Three.js PerspectiveCamera looks along −Z.
 * Right-multiply so pose ENU attitude aims the Three camera the same world way.
 */
const UNITY_CAM_TO_THREE = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI,
)

export type DroneCameraHandle = {
  camera: THREE.PerspectiveCamera
  applyPose: (pose: PoseEvent) => void
  setAspect: (aspect: number) => void
}

/**
 * Convert horizontal FOV (degrees) to Three.js vertical FOV for the given aspect.
 */
export function horizontalToVerticalFovDeg(
  hFovDeg: number,
  aspect: number,
): number {
  const safeAspect = Math.max(aspect, 1e-6)
  const hRad = THREE.MathUtils.degToRad(hFovDeg)
  const vRad = 2 * Math.atan(Math.tan(hRad / 2) / safeAspect)
  return THREE.MathUtils.radToDeg(vRad)
}

/**
 * Main PerspectiveCamera driven by drone ENU pose from poseBus.
 * Near/far sized for tens–hundreds of meters ENU.
 */
export function createDroneCamera(
  aspect = 1,
  hFovDeg = TEMP_HFOV_DEG,
): DroneCameraHandle {
  let currentHFov = hFovDeg
  const camera = new THREE.PerspectiveCamera(
    horizontalToVerticalFovDeg(currentHFov, aspect),
    aspect,
    0.5,
    4000,
  )
  const _q = new THREE.Quaternion()

  function updateProjection(): void {
    camera.fov = horizontalToVerticalFovDeg(currentHFov, camera.aspect)
    camera.updateProjectionMatrix()
  }

  return {
    camera,
    applyPose(pose: PoseEvent): void {
      const { x, y, z } = pose.position
      camera.position.set(x, y, z)
      _q.copy(poseRotationToQuaternion(pose.rotation))
      camera.quaternion.copy(_q).multiply(UNITY_CAM_TO_THREE)
      const nextFov = pose.fovHDeg > 0 ? pose.fovHDeg : TEMP_HFOV_DEG
      if (Math.abs(nextFov - currentHFov) > 1e-6) {
        currentHFov = nextFov
        updateProjection()
      }
    },
    setAspect(nextAspect: number): void {
      camera.aspect = Math.max(nextAspect, 1e-6)
      updateProjection()
    },
  }
}
