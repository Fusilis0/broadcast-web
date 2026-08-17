import * as THREE from 'three'
import {
  poseRotationToQuaternion,
  type PoseEvent,
  type PoseRotation,
} from '../pose/index.ts'

/** Mini 4 Pro default hFOV until CAL owns FOV (architecture / roadmap 1.6). */
export const TEMP_HFOV_DEG = 66.8832

/**
 * Compass yaw (0°=N, 90°=E, CW) → Three.js Euler Y for right-handed ENU
 * (`x=East`, `y=Up`, `z=−North`). Unity/DJI yaw is clockwise from north;
 * Three Y is CCW and north is −Z, so scene yaw is negated.
 *
 * Measured: yaw 0 looks −Z (north); yaw 90 looks +X (east). Positive Unity
 * pitch (look down) must be negated for Three's X rotation after the Z packing
 * change. The old `UNITY_CAM_TO_THREE` 180° Y was correct only while packing
 * used `z=+North`; after packing, identity + negated yaw/pitch is the match.
 */
function poseRotationToSceneCameraQuaternion(
  rotation: PoseRotation,
): THREE.Quaternion {
  return poseRotationToQuaternion({
    pitchDeg: -rotation.pitchDeg,
    yawDeg: -rotation.yawDeg,
    rollDeg: rotation.rollDeg,
  })
}

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
 * Near/far sized for local ENU; far is race-scale so distant boats stay visible.
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
    80_000,
  )

  function updateProjection(): void {
    camera.fov = horizontalToVerticalFovDeg(currentHFov, camera.aspect)
    camera.updateProjectionMatrix()
  }

  return {
    camera,
    applyPose(pose: PoseEvent): void {
      const { x, y, z } = pose.position
      camera.position.set(x, y, z)
      camera.quaternion.copy(poseRotationToSceneCameraQuaternion(pose.rotation))
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
