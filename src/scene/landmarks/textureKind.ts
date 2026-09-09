import * as THREE from 'three'
import type { LandmarkTextureKind } from './types.ts'

function materialHasImageMap(mat: THREE.Material): boolean {
  const std = mat as THREE.MeshStandardMaterial
  return Boolean(
    std.map ||
      std.emissiveMap ||
      std.normalMap ||
      std.roughnessMap ||
      std.metalnessMap ||
      std.aoMap,
  )
}

/** True when a glTF mesh carries an image map (ignore proxy name sprites). */
export function objectHasImageTexture(object: THREE.Object3D): boolean {
  let found = false
  object.traverse((child) => {
    if (found) return
    if (child.name === 'landmarkName') return
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (mat && materialHasImageMap(mat)) {
        found = true
        return
      }
    }
  })
  return found
}

export function landmarkTextureKindFromVisual(
  kind: 'gltf' | 'proxy',
  visual: THREE.Object3D,
): LandmarkTextureKind {
  if (kind === 'proxy') return 'proxy'
  return objectHasImageTexture(visual) ? 'textured' : 'no image'
}
