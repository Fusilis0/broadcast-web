import type { PerspectiveCamera } from 'three'
import {
  CINEMATIC_ENU_FAR_M,
  CINEMATIC_ENU_NEAR_M,
  CINEMATIC_GLOBE_FAR_M,
  CINEMATIC_GLOBE_NEAR_M,
} from './constants.ts'
import type { CinematicSample } from './types.ts'

/**
 * Apply a sampled cinematic pose to a Three.js camera.
 * Globe: ECEF eye + ellipsoid up + lookAt(target). ENU: scene metres, +Y up.
 */
export function applyCinematicCamera(
  camera: PerspectiveCamera,
  sample: CinematicSample,
): void {
  const globe = sample.domain === 'globe'
  const near = globe ? CINEMATIC_GLOBE_NEAR_M : CINEMATIC_ENU_NEAR_M
  const far = globe ? CINEMATIC_GLOBE_FAR_M : CINEMATIC_ENU_FAR_M
  if (camera.near !== near || camera.far !== far) {
    camera.near = near
    camera.far = far
    camera.updateProjectionMatrix()
  }
  const { eye, target, up } = sample.pose
  camera.up.set(up.x, up.y, up.z)
  camera.position.set(eye.x, eye.y, eye.z)
  camera.lookAt(target.x, target.y, target.z)
}
