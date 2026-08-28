import * as THREE from 'three'
import {
  effectiveRounding,
  roundingYawRad,
  ROUNDING_REVOLUTION_SEC,
  type RoundingSense,
} from '../features/rounding.ts'

export type RoundingArrowsHandle = {
  root: THREE.Group
  dispose: () => void
}

/** Lift above water so the ring reads over Gerstner / cue pads. */
export const ROUNDING_RING_LIFT_Y = 0.22

/**
 * Default ring radius (meters). Sized to read from ~150–400 m drone views
 * without filling the frame as a target reticle.
 */
export const DEFAULT_ROUNDING_RADIUS_M = 8

const RING_COLOR = 0xffffff
const HEAD_COLOR = 0xd81c1c

export type RoundingArrowsOptions = {
  /** Omit → CW (universal default). Explicit `'none'` → no glyph. */
  sense?: RoundingSense
  /** Ring radius (meters). Default `DEFAULT_ROUNDING_RADIUS_M`. */
  radiusM?: number
  /**
   * Shared clock in seconds (ocean pattern). Default `performance.now() * 0.001`
   * so 3D NDI `directRender` still spins without `createScene.tick`.
   */
  nowSec?: () => number
}

function arrowHeadGeometry(len: number, halfW: number): THREE.BufferGeometry {
  // XZ plane, tip toward +Z (CW tangent at +X).
  const tipZ = len * 0.55
  const backZ = -len * 0.45
  const notchZ = -len * 0.12
  const positions = new Float32Array([
    0,
    0,
    tipZ,
    -halfW,
    0,
    backZ,
    0,
    0,
    notchZ,
    0,
    0,
    tipZ,
    0,
    0,
    notchZ,
    halfW,
    0,
    backZ,
  ])
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.computeVertexNormals()
  return geom
}

/**
 * Procedural water-level circle + two arrow heads 180° apart.
 * Returns null when sense is `none`.
 */
export function createRoundingArrowRing(
  options: RoundingArrowsOptions,
): RoundingArrowsHandle | null {
  const sense = effectiveRounding(options.sense)
  if (sense === 'none') return null

  const radiusM = options.radiusM ?? DEFAULT_ROUNDING_RADIUS_M
  const tube = Math.max(0.14, radiusM * 0.028)
  const arrowLen = Math.max(1.4, radiusM * 0.28)
  const arrowHalfW = Math.max(0.5, radiusM * 0.1)
  const nowSec = options.nowSec ?? (() => performance.now() * 0.001)

  const root = new THREE.Group()
  root.name = 'roundingArrows'
  root.position.y = ROUNDING_RING_LIFT_Y

  const spin = new THREE.Group()
  spin.name = 'roundingSpin'
  root.add(spin)

  const disposables: Array<{
    geom?: THREE.BufferGeometry
    mat?: THREE.Material
  }> = []

  const ringMat = new THREE.MeshBasicMaterial({
    color: RING_COLOR,
    side: THREE.DoubleSide,
  })
  const headMat = new THREE.MeshBasicMaterial({
    color: HEAD_COLOR,
    side: THREE.DoubleSide,
  })
  disposables.push({ mat: ringMat }, { mat: headMat })

  const torusGeom = new THREE.TorusGeometry(radiusM, tube, 8, 48)
  disposables.push({ geom: torusGeom })
  const torus = new THREE.Mesh(torusGeom, ringMat)
  torus.name = 'roundingTorus'
  torus.rotation.x = Math.PI / 2
  spin.add(torus)

  const headGeom = arrowHeadGeometry(arrowLen, arrowHalfW)
  disposables.push({ geom: headGeom })

  const aim = sense === 'cw' ? 1 : -1
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI
    const head = new THREE.Mesh(headGeom, headMat)
    head.name = `roundingHead${i}`
    const x = radiusM * Math.cos(a)
    const z = radiusM * Math.sin(a)
    head.position.set(x, 0, z)
    const tx = -Math.sin(a) * aim
    const tz = Math.cos(a) * aim
    head.rotation.y = Math.atan2(tx, tz)
    spin.add(head)
  }

  torus.onBeforeRender = () => {
    spin.rotation.y = roundingYawRad(
      sense,
      nowSec(),
      ROUNDING_REVOLUTION_SEC,
    )
  }

  return {
    root,
    dispose(): void {
      torus.onBeforeRender = () => {}
      for (const d of disposables) {
        d.geom?.dispose()
        d.mat?.dispose()
      }
      disposables.length = 0
      root.clear()
    },
  }
}
