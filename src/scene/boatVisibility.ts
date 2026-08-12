import * as THREE from 'three'

/**
 * Per-boat air/ops draw mode (Phase 8.6).
 *
 * | Mode | 3D hull | Tag | Map dot |
 * | --- | --- | --- | --- |
 * | `solid` | opaque | yes | yes (tracks) |
 * | `ghost` | translucent + water ring | yes | yes (tracks) |
 * | `hidden` | off | off | yes (tracks) |
 *
 * Hidden keeps pose updates + ops map tracking without drawing a hull on air.
 */
export type BoatVisibilityMode = 'solid' | 'ghost' | 'hidden'

export const DEFAULT_BOAT_VISIBILITY_MODE: BoatVisibilityMode = 'solid'

/** Hull material opacity in ghost mode. */
export const GHOST_HULL_OPACITY = 0.32

const MODES: readonly BoatVisibilityMode[] = ['solid', 'ghost', 'hidden']

export function isBoatVisibilityMode(v: unknown): v is BoatVisibilityMode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v)
}

/** Soft parse — invalid / missing → `solid`. */
export function normalizeBoatVisibilityMode(v: unknown): BoatVisibilityMode {
  return isBoatVisibilityMode(v) ? v : DEFAULT_BOAT_VISIBILITY_MODE
}

/**
 * Soft-parse `{ "<boatId>": "solid"|"ghost"|"hidden", … }`.
 * Drops empty ids and unknown mode strings (treat as omit, not solid).
 */
export function normalizeBoatVisibilityMap(
  raw: unknown,
): Map<string, BoatVisibilityMode> {
  const out = new Map<string, BoatVisibilityMode>()
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    if (id === '' || !isBoatVisibilityMode(value)) continue
    out.set(id, value)
  }
  return out
}

type OpacityCapable = THREE.Material & {
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

function isOpacityCapable(mat: THREE.Material): mat is OpacityCapable {
  return (
    'opacity' in mat &&
    'transparent' in mat &&
    typeof (mat as OpacityCapable).opacity === 'number'
  )
}

/**
 * Set hull mesh material opacity for solid/ghost.
 * Pure traverse — does not change Object3D.visible.
 */
export function applyHullMaterialOpacity(
  visual: THREE.Object3D,
  opacity: number,
  transparent: boolean,
): void {
  visual.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const list = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of list) {
      if (!isOpacityCapable(mat)) continue
      mat.transparent = transparent
      mat.opacity = opacity
      // Ghost: reduce depth-write fighting; solid restores default.
      mat.depthWrite = !transparent
      mat.needsUpdate = true
    }
  })
}

/** Create a flat water-plane ring marker for ghost mode (category-tintable). */
export function createGhostBoatRing(colorCss?: string): THREE.Mesh {
  const geo = new THREE.RingGeometry(4.2, 5.4, 48)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'ghostBoatRing'
  // Flat on water (XZ), slight lift to avoid z-fight with water plane.
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.05
  tintGhostBoatRing(mesh, colorCss)
  return mesh
}

/** Apply `#rrggbb` to the ghost ring; invalid → soft white. */
export function tintGhostBoatRing(
  ring: THREE.Mesh,
  colorCss: string | undefined,
): void {
  const mat = ring.material
  if (!(mat instanceof THREE.MeshBasicMaterial)) return
  if (colorCss && /^#[0-9a-fA-F]{6}$/.test(colorCss.trim())) {
    mat.color.set(colorCss.trim())
  } else {
    mat.color.set(0xe8eef5)
  }
}

export type BoatVisibilityTargets = {
  visual: THREE.Object3D
  ghostRing: THREE.Object3D
  tagRoot: THREE.Object3D
}

/**
 * Apply draw mode to hull / ring / tag children (does not touch pose root).
 * Pure enough for unit tests without canvas / WebGL.
 */
export function applyBoatVisibilityMode(
  mode: BoatVisibilityMode,
  targets: BoatVisibilityTargets,
): void {
  const m = normalizeBoatVisibilityMode(mode)
  if (m === 'solid') {
    targets.visual.visible = true
    applyHullMaterialOpacity(targets.visual, 1, false)
    targets.ghostRing.visible = false
    targets.tagRoot.visible = true
  } else if (m === 'ghost') {
    targets.visual.visible = true
    applyHullMaterialOpacity(targets.visual, GHOST_HULL_OPACITY, true)
    targets.ghostRing.visible = true
    targets.tagRoot.visible = true
  } else {
    targets.visual.visible = false
    applyHullMaterialOpacity(targets.visual, 1, false)
    targets.ghostRing.visible = false
    targets.tagRoot.visible = false
  }
}
