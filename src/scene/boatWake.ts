import * as THREE from 'three'
import {
  normalizeBoatVisibilityMode,
  type BoatVisibilityMode,
} from './boatVisibility.ts'
import { getWaterPlaneY } from './waterPlanePlacement.ts'

/**
 * Phase 19.13 — short foam ribbon on the water behind a moving hull.
 *
 * One triangle strip (not Gerstner displacement, not a physics wake). Flat on
 * the water plane (`y ≈ 0.05`). Same scene as the hull so 3D + AR both see it.
 * No extra FBO / `readPixels`. Tick from the existing studio/preview clock —
 * do not raise `STUDIO_TICK_FPS`.
 */
export const BOAT_WAKE_DEFAULTS = {
  waterY: 0.05,
  lengthMinM: 8,
  lengthMaxM: 12,
  /** Spatial fade along the tail ≈ this many seconds of travel. */
  fadeSeconds: 2.5,
  widthM: 1.8,
  /** Below this, treat as idle (static / parked hull). */
  minSpeedMs: 0.35,
  segments: 8,
  solidPeak: 0.55,
  ghostPeak: 0.2,
} as const

export type BoatWakeSyncInput = {
  speedMs: number
  mode: BoatVisibilityMode
  dtSeconds: number
}

export type BoatWakeHandle = {
  root: THREE.Mesh
  sync: (input: BoatWakeSyncInput) => void
  getLengthM: () => number
  getStrength: () => number
  dispose: () => void
}

/** along01: 0 at the stern, 1 at the tail. */
export function boatWakeTailAlpha(along01: number): number {
  const t = Math.min(1, Math.max(0, along01))
  return (1 - t) * (1 - t)
}

/**
 * Drawn length for a moving hull. Idle / sub-threshold speed → 0.
 * Moving → clamp `speed × fadeSeconds` into 8–12 m.
 */
export function boatWakeLengthM(
  speedMs: number,
  opts: {
    minSpeedMs?: number
    fadeSeconds?: number
    lengthMinM?: number
    lengthMaxM?: number
  } = {},
): number {
  const minSpeed = opts.minSpeedMs ?? BOAT_WAKE_DEFAULTS.minSpeedMs
  const fade = opts.fadeSeconds ?? BOAT_WAKE_DEFAULTS.fadeSeconds
  const lo = opts.lengthMinM ?? BOAT_WAKE_DEFAULTS.lengthMinM
  const hi = opts.lengthMaxM ?? BOAT_WAKE_DEFAULTS.lengthMaxM
  if (!Number.isFinite(speedMs) || speedMs < minSpeed) return 0
  const fromTime = speedMs * fade
  return Math.min(hi, Math.max(lo, fromTime))
}

export function boatWakePeakRgb(mode: BoatVisibilityMode): number {
  const m = normalizeBoatVisibilityMode(mode)
  if (m === 'hidden') return 0
  if (m === 'ghost') return BOAT_WAKE_DEFAULTS.ghostPeak
  return BOAT_WAKE_DEFAULTS.solidPeak
}

export function boatWakeShouldDraw(
  mode: BoatVisibilityMode,
  strength: number,
): boolean {
  if (normalizeBoatVisibilityMode(mode) === 'hidden') return false
  return strength > 0.01
}

/** 1 while moving; decays to 0 over `fadeSeconds` when idle. */
export function boatWakeStrengthStep(
  prev: number,
  speedMs: number,
  dtSeconds: number,
  opts: { minSpeedMs?: number; fadeSeconds?: number } = {},
): number {
  const minSpeed = opts.minSpeedMs ?? BOAT_WAKE_DEFAULTS.minSpeedMs
  const fade = opts.fadeSeconds ?? BOAT_WAKE_DEFAULTS.fadeSeconds
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0
  const prevClamped = Math.min(1, Math.max(0, prev))
  if (Number.isFinite(speedMs) && speedMs >= minSpeed) return 1
  if (dt <= 0) return prevClamped
  return Math.max(0, prevClamped - dt / fade)
}

export function writeBoatWakeStrip(
  positions: Float32Array,
  colors: Float32Array,
  opts: {
    lengthM: number
    widthM?: number
    waterY?: number
    peakRgb?: number
    segments?: number
  },
): void {
  const segs = opts.segments ?? BOAT_WAKE_DEFAULTS.segments
  const lengthM = Number.isFinite(opts.lengthM) && opts.lengthM > 0 ? opts.lengthM : 0
  const widthM = opts.widthM ?? BOAT_WAKE_DEFAULTS.widthM
  const waterY = opts.waterY ?? BOAT_WAKE_DEFAULTS.waterY
  const peak = Math.min(1, Math.max(0, opts.peakRgb ?? BOAT_WAKE_DEFAULTS.solidPeak))
  const vertCount = (segs + 1) * 2
  if (positions.length < vertCount * 3 || colors.length < vertCount * 3) {
    throw new Error('writeBoatWakeStrip: buffer too small')
  }

  for (let i = 0; i <= segs; i++) {
    const along = i / segs
    const z = -along * lengthM
    const half = (widthM * 0.5) * (1 - 0.45 * along)
    const rgb = peak * boatWakeTailAlpha(along)
    const left = i * 2
    const right = left + 1
    positions[left * 3] = -half
    positions[left * 3 + 1] = waterY
    positions[left * 3 + 2] = z
    positions[right * 3] = half
    positions[right * 3 + 1] = waterY
    positions[right * 3 + 2] = z
    colors[left * 3] = rgb
    colors[left * 3 + 1] = rgb
    colors[left * 3 + 2] = rgb
    colors[right * 3] = rgb
    colors[right * 3 + 1] = rgb
    colors[right * 3 + 2] = rgb
  }
}

function buildWakeIndex(segments: number): Uint16Array {
  const indices = new Uint16Array(segments * 6)
  let p = 0
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices[p++] = a
    indices[p++] = b
    indices[p++] = c
    indices[p++] = b
    indices[p++] = d
    indices[p++] = c
  }
  return indices
}

export function createBoatWake(
  options: { segments?: number } = {},
): BoatWakeHandle {
  const segments = options.segments ?? BOAT_WAKE_DEFAULTS.segments
  const vertCount = (segments + 1) * 2
  const positions = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  writeBoatWakeStrip(positions, colors, {
    lengthM: 0,
    peakRgb: 0,
    segments,
    waterY: 0,
  })

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  const colorAttr = new THREE.BufferAttribute(colors, 3)
  posAttr.setUsage(THREE.DynamicDrawUsage)
  colorAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('color', colorAttr)
  geometry.setIndex(new THREE.BufferAttribute(buildWakeIndex(segments), 1))

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'boatWake'
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  mesh.visible = false
  mesh.position.y = getWaterPlaneY() + BOAT_WAKE_DEFAULTS.waterY

  let strength = 0
  let lengthM = 0
  let lastMovingLengthM: number = BOAT_WAKE_DEFAULTS.lengthMinM
  let disposed = false

  function sync(input: BoatWakeSyncInput): void {
    if (disposed) return
    mesh.position.y = getWaterPlaneY() + BOAT_WAKE_DEFAULTS.waterY
    const mode = normalizeBoatVisibilityMode(input.mode)
    if (mode === 'hidden') {
      strength = 0
      lengthM = 0
      mesh.visible = false
      return
    }
    const speed = Number.isFinite(input.speedMs) ? Math.max(0, input.speedMs) : 0
    strength = boatWakeStrengthStep(strength, speed, input.dtSeconds)
    const movingLength = boatWakeLengthM(speed)
    if (movingLength > 0) {
      lastMovingLengthM = movingLength
      lengthM = movingLength
    } else {
      lengthM = strength > 0.01 ? lastMovingLengthM : 0
    }
    const draw = boatWakeShouldDraw(mode, strength)
    mesh.visible = draw
    if (!draw) return
    writeBoatWakeStrip(positions, colors, {
      lengthM,
      peakRgb: boatWakePeakRgb(mode) * strength,
      segments,
      waterY: 0,
    })
    posAttr.needsUpdate = true
    colorAttr.needsUpdate = true
    geometry.computeBoundingSphere()
  }

  return {
    root: mesh,
    sync,
    getLengthM: () => lengthM,
    getStrength: () => strength,
    dispose(): void {
      if (disposed) return
      disposed = true
      mesh.removeFromParent()
      geometry.dispose()
      material.dispose()
    },
  }
}
