import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { TEMP_HFOV_DEG, horizontalToVerticalFovDeg } from './droneCamera.ts'

/** On-screen ops preview: follow active POV lens, or free orbit/pan/zoom. */
export type OpsViewMode = 'follow' | 'free'

/** Cold-start Race ops view. */
export const DEFAULT_OPS_VIEW_MODE: OpsViewMode = 'free'

export function isOpsViewMode(value: string): value is OpsViewMode {
  return value === 'follow' || value === 'free'
}

/** Compact HUD status fragment. Example: `view=free`. */
export function formatOpsViewStatus(mode: OpsViewMode): string {
  return `view=${mode}`
}

export type FreeCamView = {
  px: number
  py: number
  pz: number
  tx: number
  ty: number
  tz: number
}

export function isFreeCamView(raw: unknown): raw is FreeCamView {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return (
    Number.isFinite(Number(o.px)) &&
    Number.isFinite(Number(o.py)) &&
    Number.isFinite(Number(o.pz)) &&
    Number.isFinite(Number(o.tx)) &&
    Number.isFinite(Number(o.ty)) &&
    Number.isFinite(Number(o.tz))
  )
}

export type FreeCamHandle = {
  camera: THREE.PerspectiveCamera
  setEnabled: (enabled: boolean) => void
  setAspect: (aspect: number) => void
  getView: () => FreeCamView
  setView: (view: FreeCamView) => void
  /**
   * Orbit around a world point (ENU meters). Used to find boats that sit
   * kilometers from the geo origin when the race anchor is elsewhere.
   */
  frameTarget: (center: THREE.Vector3, radiusM?: number) => void
  /** Call each frame while free cam is the preview camera (damping + WASD). */
  update: (dtSec?: number) => void
  dispose: () => void
}

const DEFAULT_EYE = new THREE.Vector3(120, 80, -120)
const TARGET = new THREE.Vector3(0, 0, 0)
/** Race-scale ENU — boats may be km from origin until ops Apply a local anchor. */
const FAR_PLANE_M = 80_000
const MAX_ORBIT_M = 80_000

/** Metres per second at 1 m camera height. Same key hold covers more ground higher up. */
export const WASD_SPEED_PER_HEIGHT = 1.2
/** Floor so a camera sitting on the sea is still steerable. */
export const WASD_MIN_HEIGHT_M = 12
const WASD_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const
type WasdCode = (typeof WASD_CODES)[number]

export type WasdHeld = ReadonlySet<string>

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function wasdSpeedMps(heightM: number): number {
  const h = Number.isFinite(heightM) ? heightM : WASD_MIN_HEIGHT_M
  return WASD_SPEED_PER_HEIGHT * Math.max(h, WASD_MIN_HEIGHT_M)
}

/**
 * Horizontal WASD step on the ENU ground plane (x=East, z=−North).
 * Speed scales with camera height so the same hold covers more metres when far.
 */
export function wasdGroundDelta(
  held: WasdHeld,
  forwardXZ: THREE.Vector3,
  rightXZ: THREE.Vector3,
  heightM: number,
  dtSec: number,
): THREE.Vector3 {
  const out = new THREE.Vector3()
  if (!(dtSec > 0) || !Number.isFinite(dtSec)) return out
  let f = 0
  let r = 0
  if (held.has('KeyW')) f += 1
  if (held.has('KeyS')) f -= 1
  if (held.has('KeyD')) r += 1
  if (held.has('KeyA')) r -= 1
  const mag = Math.hypot(f, r)
  if (mag < 1e-8) return out
  const step = wasdSpeedMps(heightM) * dtSec
  out.addScaledVector(forwardXZ, (f / mag) * step)
  out.addScaledVector(rightXZ, (r / mag) * step)
  out.y = 0
  return out
}

/** Camera look projected onto XZ. Looking straight down uses the camera yaw. */
export function cameraGroundBasis(camera: THREE.Camera): {
  forward: THREE.Vector3
  right: THREE.Vector3
} {
  camera.updateMatrixWorld()
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  if (forward.lengthSq() < 1e-8) {
    const xAxis = new THREE.Vector3()
    const yAxis = new THREE.Vector3()
    const zAxis = new THREE.Vector3()
    camera.matrixWorld.extractBasis(xAxis, yAxis, zAxis)
    xAxis.y = 0
    if (xAxis.lengthSq() > 1e-8) {
      xAxis.normalize()
      // World +Y × camera-right → ground forward (yaw from a nadir view).
      forward.crossVectors(camera.up, xAxis)
      forward.y = 0
    }
  }
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1)
  forward.normalize()
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
  return { forward, right }
}

/**
 * Ops free-look camera: map pan (left drag) + orbit (right drag) + wheel zoom.
 * WASD translates camera and pivot together; speed grows with altitude.
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

  const controls = new MapControls(camera, domElement)
  controls.target.copy(TARGET)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = true
  controls.screenSpacePanning = false
  controls.zoomToCursor = true
  controls.minDistance = 5
  controls.maxDistance = MAX_ORBIT_M
  controls.maxPolarAngle = Math.PI * 0.49
  controls.enabled = false
  controls.update()

  const held = new Set<string>()

  function onKeyDown(ev: KeyboardEvent): void {
    if (!controls.enabled) return
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return
    if (isTypingTarget(ev.target)) return
    if (!(WASD_CODES as readonly string[]).includes(ev.code)) return
    ev.preventDefault()
    held.add(ev.code as WasdCode)
  }

  function onKeyUp(ev: KeyboardEvent): void {
    held.delete(ev.code)
  }

  function onBlur(): void {
    held.clear()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return {
    camera,
    setEnabled(enabled: boolean): void {
      controls.enabled = enabled
      if (!enabled) held.clear()
      if (enabled) controls.update()
    },
    setAspect(nextAspect: number): void {
      camera.aspect = Math.max(nextAspect, 1e-6)
      camera.fov = horizontalToVerticalFovDeg(hFovDeg, camera.aspect)
      camera.updateProjectionMatrix()
    },
    getView(): FreeCamView {
      return {
        px: camera.position.x,
        py: camera.position.y,
        pz: camera.position.z,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      }
    },
    setView(view: FreeCamView): void {
      camera.position.set(view.px, view.py, view.pz)
      controls.target.set(view.tx, view.ty, view.tz)
      camera.lookAt(controls.target)
      controls.update()
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
    update(dtSec = 1 / 60): void {
      if (!controls.enabled) return
      if (held.size > 0) {
        const { forward, right } = cameraGroundBasis(camera)
        const delta = wasdGroundDelta(
          held,
          forward,
          right,
          camera.position.y,
          dtSec,
        )
        camera.position.add(delta)
        controls.target.add(delta)
      }
      controls.update()
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      held.clear()
      controls.dispose()
    },
  }
}
