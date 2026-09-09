/**
 * Phase 16.1 — hide Cesium World Terrain **water** while the Gerstner ocean
 * is mounted. Quantized-mesh tiles already request/parse the `watermask`
 * extension (`3d-tiles-renderer` QuantizedMeshLoader puts the inverted mask
 * on `material.roughnessMap`: 0 = water, 1 = land). We `discard` water
 * fragments via `onBeforeCompile`. Tiles with no mask fall back to a world-Y
 * threshold (default +0.5 m AMSL, plus the altitude nudge).
 *
 * Plugin registration order in `createTerrain` is unchanged — this only
 * patches materials after parse (`load-model` + a root traverse). Overlay
 * look is the ion imagery asset (Road 4 / Aerial 2), not a luma filter.
 */

import * as THREE from 'three'

export const DEFAULT_TERRAIN_WATER_DISCARD_Y = 0.5

const PATCHED = Symbol('bwTerrainWaterPatch')

export type TerrainWaterUniforms = {
  uHideTerrainWater: { value: number }
  uTerrainWaterY: { value: number }
}

export function createTerrainWaterUniforms(
  hide = false,
  discardYM = DEFAULT_TERRAIN_WATER_DISCARD_Y,
): TerrainWaterUniforms {
  return {
    uHideTerrainWater: { value: hide ? 1 : 0 },
    uTerrainWaterY: {
      value: Number.isFinite(discardYM) ? discardYM : DEFAULT_TERRAIN_WATER_DISCARD_Y,
    },
  }
}

/** Gate: only discard water while the realistic ocean is actually on screen. */
export function shouldHideTerrainWater(options: {
  realisticOceanMounted: boolean
}): boolean {
  return options.realisticOceanMounted === true
}

function isPatched(
  material: THREE.Material,
): material is THREE.Material & { [PATCHED]: true } {
  return (material as { [PATCHED]?: boolean })[PATCHED] === true
}

/**
 * Inject water-fragment `discard` into a tile material.
 * Chains any existing `onBeforeCompile` (fade / Bing overlay wrap first).
 */
export function patchTerrainWaterMaterial(
  material: THREE.Material,
  uniforms: TerrainWaterUniforms,
): void {
  if (isPatched(material)) return
  ;(material as THREE.Material & { [PATCHED]: true })[PATCHED] = true

  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer)
    shader.uniforms['uHideTerrainWater'] = uniforms.uHideTerrainWater
    shader.uniforms['uTerrainWaterY'] = uniforms.uTerrainWaterY

    shader.vertexShader =
      'varying float vTerrainWorldY;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vTerrainWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`,
      )

    shader.fragmentShader =
      'varying float vTerrainWorldY;\n' +
      'uniform float uHideTerrainWater;\n' +
      'uniform float uTerrainWaterY;\n' +
      shader.fragmentShader.replace(
        /void\s+main\s*\(\s*\)\s*\{/,
        (match) => `${match}
            if (uHideTerrainWater > 0.5) {
            float waterAmt = 0.0;
            #ifdef USE_ROUGHNESSMAP
              vec3 rm = texture2D(roughnessMap, vRoughnessMapUv).rgb;
              float chroma = max(abs(rm.r - rm.g), abs(rm.g - rm.b));
              if (chroma < 0.08) {
                waterAmt = 1.0 - rm.g;
              } else {
                waterAmt = vTerrainWorldY < uTerrainWaterY ? 1.0 : 0.0;
              }
            #else
              waterAmt = vTerrainWorldY < uTerrainWaterY ? 1.0 : 0.0;
            #endif
            if (waterAmt > 0.5) discard;
          }`,
      )
  }
  material.needsUpdate = true
}

export function patchTerrainWaterMaterials(
  root: THREE.Object3D,
  uniforms: TerrainWaterUniforms,
): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (mat) patchTerrainWaterMaterial(mat, uniforms)
    }
  })
}

export function sceneFromLoadModelEvent(event: unknown): THREE.Object3D | null {
  if (!event || typeof event !== 'object' || !('scene' in event)) return null
  const scene = (event as { scene?: unknown }).scene
  return scene instanceof THREE.Object3D ? scene : null
}
