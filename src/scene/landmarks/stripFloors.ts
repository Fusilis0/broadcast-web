/**
 * Drop SketchUp Google-Earth terrain/snapshot slabs and Sketchfab ground/sea planes.
 * Name match only — do not strip unnamed thin decks (bridges).
 */

import type { Material, Mesh, Object3D } from 'three'

const FLOOR_NAME =
  /google[_ ]?earth[_ ]?(?:terrain|snapshot)|(?:^|[._\s-])ground(?:\d+)?(?:$|[._\s-])|(?:^|[._\s-])(?:sea|floor|zemin)(?:$|[._\s-])/i

export function isLandmarkFloorName(name: string | undefined): boolean {
  const trimmed = (name ?? '').trim()
  if (trimmed === '') return false
  return FLOOR_NAME.test(trimmed)
}

export function stripLandmarkFloors(root: Object3D): number {
  const doomed: Object3D[] = []
  root.traverse((obj) => {
    if (obj === root) return
    if (isLandmarkFloorName(obj.name)) {
      doomed.push(obj)
      return
    }
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mats: Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    for (const mat of mats) {
      if (mat && isLandmarkFloorName(mat.name)) {
        doomed.push(obj)
        return
      }
    }
  })
  const doomedSet = new Set(doomed)
  let removed = 0
  for (const obj of doomed) {
    let ancestor = obj.parent
    let skip = false
    while (ancestor) {
      if (doomedSet.has(ancestor)) {
        skip = true
        break
      }
      ancestor = ancestor.parent
    }
    if (skip) continue
    obj.removeFromParent()
    removed += 1
  }
  return removed
}
