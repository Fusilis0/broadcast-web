import * as THREE from 'three'

/** Materials with this `userData` flag are category-tinted (procedural hull). */
export const CATEGORY_TINT_USERDATA_KEY = 'categoryTint'

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

/**
 * Apply catalogue category colour to a boat visual.
 *
 * **Strategy (document for SCN):**
 * - Procedural: only materials marked `userData.categoryTint` (hull body).
 * - glTF (no marks): all tintable materials — `material.color` set to the
 *   category CSS colour (Three.js multiplies any albedo map) and
 *   `emissive` matched for dark-preview readability.
 * - Not a custom shader multiply; standard Three colour × map + emissive replace.
 */
export function applyBoatHullTint(
  visual: THREE.Object3D,
  colorCss: string | undefined,
): void {
  const color = parseCssHexToThreeColor(colorCss)
  if (!color) return

  const mats = collectMaterials(visual)
  const marked = mats.filter(
    (m) => m.userData[CATEGORY_TINT_USERDATA_KEY] === true,
  )
  const targets = marked.length > 0 ? marked : mats

  for (const mat of targets) {
    if (!isTintableMaterial(mat)) continue
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
}
