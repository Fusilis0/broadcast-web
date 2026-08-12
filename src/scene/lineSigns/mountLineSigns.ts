import * as THREE from 'three'
import { gpsToEnuAmsl } from '../../geodesy/index.ts'
import type { WorldFeature } from '../features/types.ts'
import { buildLineSignLayout } from './lineSignLayout.ts'
import {
  createLineSignMesh,
  type LineSignHandle,
} from './lineSignMesh.ts'
import type { GpsToEnuAmslFn } from './types.ts'

export type LineSignsHandle = {
  root: THREE.Group
  dispose: () => void
}

/**
 * Mount start/finish water signs from WorldFeature[].
 * Call after GEO origin + EGM96. Empty list → empty group (still disposable).
 */
export function mountLineSignsFromFeatures(
  scene: THREE.Scene,
  features: readonly WorldFeature[],
  convert: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): LineSignsHandle {
  const layout = buildLineSignLayout(features, convert)
  const root = new THREE.Group()
  root.name = 'lineSigns'

  const parts: LineSignHandle[] = []
  for (const sign of layout) {
    try {
      const mesh = createLineSignMesh(sign)
      parts.push(mesh)
      root.add(mesh.root)
    } catch (err) {
      console.warn(`[lineSigns] skip ${sign.id}`, err)
    }
  }

  scene.add(root)

  return {
    root,
    dispose(): void {
      scene.remove(root)
      for (const p of parts) p.dispose()
      parts.length = 0
      root.clear()
    },
  }
}
