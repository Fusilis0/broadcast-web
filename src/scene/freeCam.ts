import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TEMP_HFOV_DEG, horizontalToVerticalFovDeg } from './droneCamera.ts'

/** On-screen ops preview: follow active POV lens, or free orbit/pan/zoom. */
export type OpsViewMode = 'follow' | 'free'

export function isOpsViewMode(value: string): value is OpsViewMode {
  return value === 'follow' || value === 'free'
}

/** Compact HUD status fragment. Example: `view=free`. */
export function formatOpsViewStatus(mode: OpsViewMode): string {
  return `view=${mode}`
}

export type FreeCamHandle = {
  camera: THREE.PerspectiveCamera
  setEnabled: (enabled: boolean) => void
  setAspect: (aspect: number) => void
  /**
   * Orbit around a world point (ENU meters). Used to find boats that sit
   * kilometers from the geo origin when the race anchor is elsewhere.
   */
  frameTarget: (center: THREE.Vector3, radiusM?: number) => void
  /** Call each frame while free cam is the preview camera (damping). */
  update: () => void
  dispose: () => void
}

const DEFAULT_EYE = new THREE.Vector3(120, 80, -120)
const TARGET = new THREE.Vector3(0, 0, 0)
/** Race-scale ENU — boats may be km from origin until ops Apply a local anchor. */
const FAR_PLANE_M = 80_000
const MAX_ORBIT_M = 50_000

/**
 * Ops free-look camera: OrbitControls around ENU origin / scene center.
 * Does not own air framing — active POV stays on the drone camera.
 */
export function createFreeCam(
  domElement: HTMLElement,
  aspect = 1,
  hFovDeg = TEMP_HFOV_DEG,
): FreeCamHandle {
  const camera = new THREE.PerspectiveCamera(
    horizontalToVerticalFovDeg(hFovDeg, aspect),
    Math.max(aspect, 1e-6),
    0.5,
    FAR_PLANE_M,
  )
  camera.name = 'opsFreeCam'
  camera.position.copy(DEFAULT_EYE)
  camera.lookAt(TARGET)

  const controls = new OrbitControls(camera, domElement)
  controls.target.copy(TARGET)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.minDistance = 5
  controls.maxDistance = MAX_ORBIT_M
  controls.maxPolarAngle = Math.PI * 0.49
  controls.enabled = false
  controls.update()

  return {
    camera,
    setEnabled(enabled: boolean): void {
      controls.enabled = enabled
      if (enabled) controls.update()
    },
    setAspect(nextAspect: number): void {
      camera.aspect = Math.max(nextAspect, 1e-6)
      camera.fov = horizontalToVerticalFovDeg(hFovDeg, camera.aspect)
      camera.updateProjectionMatrix()
    },
    frameTarget(center, radiusM = 80): void {
      const r = Math.max(radiusM, 40)
      controls.target.copy(center)
      const eye = center
        .clone()
        .add(new THREE.Vector3(r * 1.2, r * 0.7, -r * 1.2))
      camera.position.copy(eye)
      camera.lookAt(center)
      controls.update()
    },
    update(): void {
      if (controls.enabled) controls.update()
    },
    dispose(): void {
      controls.dispose()
    },
  }
}
