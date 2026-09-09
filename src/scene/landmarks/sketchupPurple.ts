/**
 * SketchUp missing-texture magenta (153, 0, 255) on unmapped PBR.
 * Recolor to mosque stone — do not delete minaret bands.
 */

import * as THREE from 'three'

/** Anakutle stone used on Sultan Ahmed walls (199, 191, 185). */
export const LANDMARK_STONE_FALLBACK = new THREE.Color(
  199 / 255,
  191 / 255,
  185 / 255,
)

export function isSketchupPurpleColor(color: THREE.Color): boolean {
  return color.r > 0.45 && color.b > 0.85 && color.g < 0.12
}

export function isSketchupPurpleName(name: string | undefined): boolean {
  return /153[_-]?0[_-]?255/.test(name ?? '')
}

function shouldRecolor(
  mat: THREE.MeshStandardMaterial,
  meshName: string,
): boolean {
  if (!mat.color || mat.map) return false
  if (mat.color.getHex() === LANDMARK_STONE_FALLBACK.getHex()) return false
  if (isSketchupPurpleColor(mat.color)) return true
  if (isSketchupPurpleName(mat.name) || isSketchupPurpleName(meshName)) {
    return true
  }
  return false
}

function applyStone(mat: THREE.MeshStandardMaterial): void {
  mat.color.copy(LANDMARK_STONE_FALLBACK)
  if (mat.emissive instanceof THREE.Color) {
    mat.emissive.setRGB(0, 0, 0)
  }
  mat.needsUpdate = true
}

export function recolorSketchupPurple(root: THREE.Object3D): number {
  const seen = new Set<THREE.Material>()
  let n = 0
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue
      const std = mat as THREE.MeshStandardMaterial
      if (!shouldRecolor(std, mesh.name)) continue
      applyStone(std)
      seen.add(mat)
      n += 1
    }
  })
  return n
}
