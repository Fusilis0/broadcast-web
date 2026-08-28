import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { applyBoatVisualOffset } from './boatVisualOffset.ts'
import { createProceduralBoatVisual } from './createProceduralBoatVisual.ts'
import { markBoatTintableByNodeName } from './tintBoatVisual.ts'

export const DEFAULT_BOAT_MODEL_URL = '/models/boat.glb'

/** Cached template (not added to any scene). Cloned per entity. */
let templatePromise: Promise<THREE.Group> | null = null

function hasSailboatAnchors(root: THREE.Object3D): boolean {
  return Boolean(root.getObjectByName('sail') || root.getObjectByName('mastTop'))
}

function prepareTemplate(root: THREE.Object3D): THREE.Group {
  const group = root instanceof THREE.Group ? root : new THREE.Group().add(root)
  group.name = group.name || 'boatVisualGltf'
  applyBoatVisualOffset(group)
  markBoatTintableByNodeName(group)
  group.traverse((obj) => {
    obj.castShadow = false
    obj.receiveShadow = false
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      // Broadcast preview: keep PBR readable on dark clear without an env map.
      if (
        mat instanceof THREE.MeshStandardMaterial ||
        mat instanceof THREE.MeshPhysicalMaterial
      ) {
        if (mat.emissiveIntensity < 0.2) {
          mat.emissive.copy(mat.color)
          mat.emissiveIntensity = 0.22
        }
        mat.needsUpdate = true
      }
    }
  })
  return group
}

/**
 * Load and cache the boat glTF template. On failure, caches the procedural hull
 * so callers always get a clonable visual (never an empty fleet).
 */
export function loadBoatModelTemplate(
  url: string = DEFAULT_BOAT_MODEL_URL,
): Promise<THREE.Group> {
  if (!templatePromise) {
    templatePromise = new Promise((resolve) => {
      const loader = new GLTFLoader()
      loader.load(
        url,
        (gltf) => {
          if (!hasSailboatAnchors(gltf.scene)) {
            console.info(
              `[assets] boat glTF (${url}) has no sail/mastTop; using procedural sailboat`,
            )
            resolve(prepareTemplate(createProceduralBoatVisual()))
            return
          }
          resolve(prepareTemplate(gltf.scene))
        },
        undefined,
        (err) => {
          console.warn(
            `[assets] boat glTF load failed (${url}); using procedural hull`,
            err,
          )
          resolve(prepareTemplate(createProceduralBoatVisual()))
        },
      )
    })
  }
  return templatePromise
}

/** Clone a boat visual from the cached template (loads on first call). */
export async function cloneBoatVisual(
  url?: string,
): Promise<THREE.Group> {
  const template = await loadBoatModelTemplate(url)
  return template.clone(true)
}

/** Test helper: clear module cache between tests. */
export function resetBoatModelCacheForTests(): void {
  templatePromise = null
}
