import * as THREE from 'three'

/** Materials with this `userData` flag are category-tinted (procedural hull). */
export const CATEGORY_TINT_USERDATA_KEY = 'categoryTint'

/** Materials with this `userData` flag are sail-tinted (mainsail + jib). */
export const SAIL_TINT_USERDATA_KEY = 'sailTint'

const HULL_NODE_NAMES = new Set(['hull', 'hullMid', 'hullBow', 'hullStern'])
const SAIL_NODE_NAMES = new Set(['sail', 'jib', 'mainsail'])

/**
 * Parse `#rrggbb` → Three.Color. Invalid / missing → null.
 * Pure enough for unit tests (no GPU).
 */
export function parseCssHexToThreeColor(
  hex: string | undefined,
): THREE.Color | null {
  if (!hex) return null
  const s = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null
  return new THREE.Color(s)
}

function isTintableMaterial(
  mat: THREE.Material,
): mat is
  | THREE.MeshStandardMaterial
  | THREE.MeshPhysicalMaterial
  | THREE.MeshBasicMaterial
  | THREE.MeshLambertMaterial
  | THREE.MeshPhongMaterial {
  return (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial ||
    mat instanceof THREE.MeshBasicMaterial ||
    mat instanceof THREE.MeshLambertMaterial ||
    mat instanceof THREE.MeshPhongMaterial
  )
}

function collectMaterials(visual: THREE.Object3D): THREE.Material[] {
  const mats: THREE.Material[] = []
  visual.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const list = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of list) mats.push(mat)
  })
  return mats
}

function meshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

/**
 * Re-mark hull/sail materials from node names (glTF often drops `userData`).
 * Idempotent — already-flagged materials stay flagged.
 */
export function markBoatTintableByNodeName(visual: THREE.Object3D): void {
  visual.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.name) return
    const key = HULL_NODE_NAMES.has(obj.name)
      ? CATEGORY_TINT_USERDATA_KEY
      : SAIL_NODE_NAMES.has(obj.name)
        ? SAIL_TINT_USERDATA_KEY
        : null
    if (!key) return
    for (const mat of meshMaterials(obj)) {
      mat.userData[key] = true
    }
  })
}

/**
 * Boat colour → lighter, less saturated sail fabric so tags still read.
 */
export function boatColorToSailTint(color: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  hsl.s = Math.min(1, hsl.s * 0.42)
  hsl.l = Math.min(0.94, 0.64 + hsl.l * 0.26)
  return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l)
}

function applyColorToMaterial(mat: THREE.Material, color: THREE.Color): void {
  if (!isTintableMaterial(mat)) return
  mat.color.copy(color)
  if (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial
  ) {
    mat.emissive.copy(color)
    if (mat.emissiveIntensity < 0.2) mat.emissiveIntensity = 0.22
  }
  mat.needsUpdate = true
}

/**
 * Tint sail materials (named `sail` / `jib` or `userData.sailTint`).
 * Fabric is a lifted/desaturated copy of the boat colour.
 */
export function applyBoatSailTint(
  visual: THREE.Object3D,
  colorCss: string | undefined,
): void {
  const color = parseCssHexToThreeColor(colorCss)
  if (!color) return
  markBoatTintableByNodeName(visual)
  const sailColor = boatColorToSailTint(color)
  const seen = new Set<THREE.Material>()
  for (const mat of collectMaterials(visual)) {
    if (mat.userData[SAIL_TINT_USERDATA_KEY] !== true) continue
    if (seen.has(mat)) continue
    seen.add(mat)
    applyColorToMaterial(mat, sailColor)
    if (
      mat instanceof THREE.MeshStandardMaterial ||
      mat instanceof THREE.MeshPhysicalMaterial
    ) {
      mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 0.14)
    }
  }
}

/**
 * Optional sail albedo (flag / cloth). Replaces tint with white × map.
 * No picker UI — callers pass a URL when they have one.
 */
export function applyBoatSailTexture(
  visual: THREE.Object3D,
  url: string | undefined,
): void {
  const src = url?.trim()
  if (!src) return
  markBoatTintableByNodeName(visual)
  const targets = collectMaterials(visual).filter(
    (m) => m.userData[SAIL_TINT_USERDATA_KEY] === true,
  )
  if (targets.length === 0) return
  const loader = new THREE.TextureLoader()
  loader.load(src, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace
    const white = new THREE.Color(0xffffff)
    for (const mat of targets) {
      if (!isTintableMaterial(mat)) continue
      mat.map = tex
      mat.color.copy(white)
      mat.needsUpdate = true
    }
  })
}

/**
 * Apply catalogue category colour to a boat visual.
 *
 * **Strategy (document for SCN):**
 * - Procedural: only materials marked `userData.categoryTint` (hull body).
 *   Sail materials (`userData.sailTint`) get a lighter fabric tint.
 * - glTF with named `hull` / `sail` nodes: same split after name-marking.
 * - glTF with no marks: all tintable materials except sails — `material.color`
 *   set to the category CSS colour (Three.js multiplies any albedo map) and
 *   `emissive` matched for dark-preview readability.
 * - Not a custom shader multiply; standard Three colour × map + emissive replace.
 */
export function applyBoatHullTint(
  visual: THREE.Object3D,
  colorCss: string | undefined,
): void {
  const color = parseCssHexToThreeColor(colorCss)
  if (!color) return

  markBoatTintableByNodeName(visual)
  const mats = collectMaterials(visual)
  const markedHull = mats.filter(
    (m) => m.userData[CATEGORY_TINT_USERDATA_KEY] === true,
  )
  const targets =
    markedHull.length > 0
      ? markedHull
      : mats.filter((m) => m.userData[SAIL_TINT_USERDATA_KEY] !== true)

  const seen = new Set<THREE.Material>()
  for (const mat of targets) {
    if (seen.has(mat)) continue
    seen.add(mat)
    applyColorToMaterial(mat, color)
  }
  applyBoatSailTint(visual, colorCss)
}
