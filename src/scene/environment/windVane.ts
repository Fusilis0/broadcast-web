import * as THREE from 'three'
import { COURSE_WATER_Y } from '../course/courseLayout.ts'
import { msToKnots } from '../../telemetry/windDirection.ts'

/**
 * Cheap 3D wind vane (14.3f lite): a short pole + two-sided arrow, tens of
 * tris. Yaw follows Gerstner / `windTravelSceneXZ` travel; length scales with
 * kt but never collapses so a set from-deg stays readable at 0 m/s.
 *
 * Sits at a fixed ENU offset from the geo origin so it is not buried under a
 * mark at (0,0). No particles, cloth, or extra FBO.
 */
export const WIND_VANE_DEFAULTS = {
  /** East of origin (m). */
  offsetX: 16,
  /** South of origin in scene XZ (m, +Z). */
  offsetZ: 12,
  poleHeightM: 2.7,
  /** Arrow length at 0 kt — still visible when only from-deg is set. */
  minLengthM: 6,
  /** Extra metres per knot of wind. 6 kt ≈ 8.7 m; 12 kt ≈ 11.4 m. */
  lengthPerKt: 0.45,
  color: 0xffb000,
} as const

export type WindVaneOptions = {
  offsetX: number
  offsetZ: number
  poleHeightM: number
  minLengthM: number
  lengthPerKt: number
  color: number
  liftY: number
}

export type WindVaneHandle = {
  root: THREE.Group
  getDirectionRad: () => number
  getLengthM: () => number
  setTravel: (directionRad: number, speedMs: number) => void
  dispose: () => void
}

/** Arrow length in metres. Always ≥ minLength so from-deg is never invisible. */
export function vaneLengthM(
  speedMs: number,
  minLengthM: number = WIND_VANE_DEFAULTS.minLengthM,
  lengthPerKt: number = WIND_VANE_DEFAULTS.lengthPerKt,
): number {
  const min = Number.isFinite(minLengthM) && minLengthM > 0 ? minLengthM : 1
  const per = Number.isFinite(lengthPerKt) && lengthPerKt > 0 ? lengthPerKt : 0
  return min + per * msToKnots(speedMs)
}

/**
 * Yaw so a mesh authored along +Z aligns with Gerstner travel
 * (`θ = 0` → +X, `θ = π/2` → +Z). From-000° travel is +Z → yaw 0.
 */
export function vaneYawY(directionRad: number): number {
  // Same XZ travel as Gerstner `waveDirectionXZ`: (cos θ, sin θ).
  return Math.atan2(Math.cos(directionRad), Math.sin(directionRad))
}

export function createWindVane(
  options?: Partial<WindVaneOptions>,
): WindVaneHandle {
  const opts: WindVaneOptions = {
    offsetX: WIND_VANE_DEFAULTS.offsetX,
    offsetZ: WIND_VANE_DEFAULTS.offsetZ,
    poleHeightM: WIND_VANE_DEFAULTS.poleHeightM,
    minLengthM: WIND_VANE_DEFAULTS.minLengthM,
    lengthPerKt: WIND_VANE_DEFAULTS.lengthPerKt,
    color: WIND_VANE_DEFAULTS.color,
    liftY: 0.45,
    ...options,
  }

  const root = new THREE.Group()
  root.name = 'windVane'
  root.position.set(
    opts.offsetX,
    COURSE_WATER_Y + opts.liftY + 0.05,
    opts.offsetZ,
  )

  const mat = new THREE.MeshBasicMaterial({
    color: opts.color,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
  })

  const poleH = Math.max(0.6, opts.poleHeightM)
  const poleGeo = new THREE.BoxGeometry(0.1, poleH, 0.1)
  const pole = new THREE.Mesh(poleGeo, mat)
  pole.name = 'windVanePole'
  pole.position.y = poleH * 0.5
  root.add(pole)

  const arrow = new THREE.Group()
  arrow.name = 'windVaneArrow'
  arrow.position.y = poleH

  const bodyGeo = new THREE.BoxGeometry(0.16, 0.16, 1)
  const body = new THREE.Mesh(bodyGeo, mat)
  body.name = 'windVaneShaft'
  arrow.add(body)

  const headGeo = new THREE.ConeGeometry(0.42, 1, 4)
  const head = new THREE.Mesh(headGeo, mat)
  head.name = 'windVaneHead'
  head.rotation.x = Math.PI / 2
  arrow.add(head)
  root.add(arrow)

  let directionRad = Math.PI / 2
  let lengthM = opts.minLengthM
  let disposed = false

  function layoutArrow(length: number): void {
    const len = Math.max(opts.minLengthM, length)
    const headLen = Math.min(1.8, len * 0.28)
    const bodyLen = Math.max(0.4, len - headLen)
    body.scale.set(1, 1, bodyLen)
    body.position.z = bodyLen * 0.5
    head.scale.set(1, headLen, 1)
    head.position.z = bodyLen + headLen * 0.5
  }

  function apply(): void {
    root.rotation.y = vaneYawY(directionRad)
    layoutArrow(lengthM)
  }

  apply()

  return {
    root,
    getDirectionRad: () => directionRad,
    getLengthM: () => lengthM,
    setTravel(nextRad: number, speedMs: number): void {
      if (disposed) return
      directionRad = nextRad
      lengthM = vaneLengthM(speedMs, opts.minLengthM, opts.lengthPerKt)
      apply()
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      poleGeo.dispose()
      bodyGeo.dispose()
      headGeo.dispose()
      mat.dispose()
      root.clear()
    },
  }
}
