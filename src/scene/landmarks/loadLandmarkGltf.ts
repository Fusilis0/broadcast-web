import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { LANDMARK_AUTHORED_UNIT_M } from './constants.ts'

export type LandmarkGltfLoader = {
  load: (
    url: string,
    onLoad: (gltf: { scene: THREE.Object3D }) => void,
    onProgress: undefined,
    onError: (err: unknown) => void,
  ) => void
}

/**
 * Load one landmark glTF. Authored unit is metres (`LANDMARK_AUTHORED_UNIT_M`).
 * Missing / failed file: warn and return `null` — do not throw.
 */
export function loadLandmarkGltf(
  url: string,
  loaderFactory: () => LandmarkGltfLoader = () => new GLTFLoader(),
): Promise<THREE.Group | null> {
  const trimmed = url.trim()
  if (trimmed === '') {
    console.warn('[landmarks] empty glTF URL; skipping')
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    try {
      const loader = loaderFactory()
      loader.load(
        trimmed,
        (gltf) => {
          const group =
            gltf.scene instanceof THREE.Group
              ? gltf.scene
              : new THREE.Group().add(gltf.scene)
          group.name = group.name || 'landmarkGltf'
          if (LANDMARK_AUTHORED_UNIT_M !== 1) {
            group.scale.multiplyScalar(LANDMARK_AUTHORED_UNIT_M)
          }
          group.traverse((obj) => {
            obj.castShadow = false
            obj.receiveShadow = false
          })
          resolve(group)
        },
        undefined,
        (err) => {
          console.warn(
            `[landmarks] glTF load failed (${trimmed}); skipping that id`,
            err,
          )
          resolve(null)
        },
      )
    } catch (err) {
      console.warn(
        `[landmarks] glTF load failed (${trimmed}); skipping that id`,
        err,
      )
      resolve(null)
    }
  })
}
