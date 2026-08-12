import * as THREE from 'three'
import { COURSE_WATER_Y } from './courseLayout.ts'

/**
 * Mild water / shore cue under the race area (Phase 8.8).
 * Not a globe / Cesium terrain — a localized pad so air clear stays clean outside.
 *
 * **Clear behaviour (document for ops):**
 * - `preview` — teal pad visible under course on dark clear.
 * - `transparent` — pad is semi-transparent (`depthWrite: false`); only the
 *   race footprint writes partial alpha; empty sky/sea stay see-through.
 * - `chroma` — same localized pad; green key clear remains outside the pad.
 * Tune opacity down for cleaner alpha plates if the pad reads too heavy.
 */
export const WATER_CUE_DEFAULTS = {
  /** Inner water fill. */
  waterColor: 0x1a5f7a,
  waterOpacity: 0.4,
  /** Outer shore tint ring/plane. */
  shoreColor: 0x3a4a3c,
  shoreOpacity: 0.22,
  /** Pad beyond course AABB (meters). */
  paddingM: 70,
  /** Extra pad for shore plane beyond water (meters). */
  shoreExtraPadM: 45,
  /** Slightly below water overlays (line signs / markers at y≈0). */
  waterY: COURSE_WATER_Y - 0.12,
  shoreY: COURSE_WATER_Y - 0.18,
} as const

export type WaterCueOptions = {
  waterColor: number
  waterOpacity: number
  shoreColor: number
  shoreOpacity: number
  paddingM: number
  shoreExtraPadM: number
  waterY: number
  shoreY: number
}

export type WaterCueBounds = {
  centerX: number
  centerZ: number
  /** Full width (East), meters. */
  sizeX: number
  /** Full depth (North), meters. */
  sizeZ: number
}

export type WaterShoreCueHandle = {
  root: THREE.Group
  bounds: WaterCueBounds
  dispose: () => void
}

/**
 * Axis-aligned pad around ENU points + padding. Null if no finite points.
 */
export function courseWaterCueBounds(
  points: readonly { x: number; z: number }[],
  paddingM: number = WATER_CUE_DEFAULTS.paddingM,
): WaterCueBounds | null {
  if (points.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.z < minZ) minZ = p.z
    if (p.z > maxZ) maxZ = p.z
  }
  if (!Number.isFinite(minX)) return null
  const pad = Math.max(0, paddingM)
  const sizeX = Math.max(maxX - minX + pad * 2, 40)
  const sizeZ = Math.max(maxZ - minZ + pad * 2, 40)
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    sizeX,
    sizeZ,
  }
}

function makePad(
  name: string,
  sizeX: number,
  sizeZ: number,
  y: number,
  color: number,
  opacity: number,
): { mesh: THREE.Mesh; dispose: () => void } {
  const geo = new THREE.PlaneGeometry(sizeX, sizeZ)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(1, Math.max(0, opacity)),
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = name
  // PlaneGeometry faces +Z; rotate to lie on XZ (face sky).
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  mesh.renderOrder = -10
  return {
    mesh,
    dispose(): void {
      geo.dispose()
      mat.dispose()
    },
  }
}

/**
 * Shore tint + water fill planes centered on course bounds.
 */
export function createWaterShoreCue(
  points: readonly { x: number; z: number }[],
  options?: Partial<WaterCueOptions>,
): WaterShoreCueHandle | null {
  const opts: WaterCueOptions = { ...WATER_CUE_DEFAULTS, ...options }
  const bounds = courseWaterCueBounds(points, opts.paddingM)
  if (!bounds) return null

  const root = new THREE.Group()
  root.name = 'waterShoreCue'
  root.position.set(bounds.centerX, 0, bounds.centerZ)

  const disposers: Array<() => void> = []

  const shore = makePad(
    'shorePad',
    bounds.sizeX + opts.shoreExtraPadM * 2,
    bounds.sizeZ + opts.shoreExtraPadM * 2,
    opts.shoreY,
    opts.shoreColor,
    opts.shoreOpacity,
  )
  root.add(shore.mesh)
  disposers.push(shore.dispose)

  const water = makePad(
    'waterPad',
    bounds.sizeX,
    bounds.sizeZ,
    opts.waterY,
    opts.waterColor,
    opts.waterOpacity,
  )
  root.add(water.mesh)
  disposers.push(water.dispose)

  return {
    root,
    bounds,
    dispose(): void {
      for (const d of disposers) d()
      disposers.length = 0
      root.clear()
    },
  }
}
