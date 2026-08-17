/**
 * Phase 14.2c — terrain depth prepass for Gerstner shore foam.
 *
 * One extra FBO, **only** while realistic ocean is mounted **and** terrain is
 * on **and** the opaque-clear gate is true. Terrain-only (the tileset group),
 * not a full scene re-draw. Half-res depth keeps the 3D-NDI ~10 fps budget.
 * No `readPixels` / `getImageData` / `readRenderTargetPixels`.
 *
 * Ocean stays on top of Cesium's baked sea — this pass does not clip the
 * tileset and does not use `polygonOffset`.
 */

import * as THREE from 'three'

export const SHORE_FOAM_DEFAULTS = {
  /**
   * Depth target scale vs the current drawing buffer. 0.5 = one quarter of
   * the pixels; foam is a soft band so full-res is wasted.
   */
  depthScale: 0.5,
  /** World Y (m) where reconstructed terrain starts counting as land. */
  landY0: 0.5,
  /** World Y (m) where the land mask is fully on. */
  landY1: 2.25,
  /** Inner neighbourhood tap (pixels of the *colour* buffer). */
  tapPxInner: 10,
  /** Outer neighbourhood tap — wider shallow tint. */
  tapPxOuter: 28,
  foamStrength: 0.9,
  shallowStrength: 0.62,
} as const

const _size = new THREE.Vector2()
const _clearColor = new THREE.Color()

export function shouldEnableShoreFoam(options: {
  realisticMounted: boolean
  terrainEnabled: boolean
  opaqueClearSafe: boolean
}): boolean {
  return (
    options.realisticMounted === true &&
    options.terrainEnabled === true &&
    options.opaqueClearSafe === true
  )
}

export function currentDrawingSize(renderer: THREE.WebGLRenderer): {
  width: number
  height: number
} {
  const rt = renderer.getRenderTarget()
  if (rt) {
    return { width: Math.max(1, rt.width | 0), height: Math.max(1, rt.height | 0) }
  }
  renderer.getDrawingBufferSize(_size)
  return {
    width: Math.max(1, _size.x | 0),
    height: Math.max(1, _size.y | 0),
  }
}

export function shoreDepthSize(
  drawingW: number,
  drawingH: number,
  scale = SHORE_FOAM_DEFAULTS.depthScale,
): { width: number; height: number } {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1
  return {
    width: Math.max(1, Math.floor(drawingW * s)),
    height: Math.max(1, Math.floor(drawingH * s)),
  }
}

export function createShoreDepthTarget(
  width = 1,
  height = 1,
): THREE.WebGLRenderTarget {
  const w = Math.max(1, width | 0)
  const h = Math.max(1, height | 0)
  const depthTexture = new THREE.DepthTexture(w, h)
  depthTexture.format = THREE.DepthFormat
  depthTexture.type = THREE.UnsignedIntType
  depthTexture.minFilter = THREE.NearestFilter
  depthTexture.magFilter = THREE.NearestFilter
  const target = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture,
  })
  target.texture.generateMipmaps = false
  return target
}

export function resizeShoreDepthTarget(
  target: THREE.WebGLRenderTarget,
  width: number,
  height: number,
): void {
  const w = Math.max(1, width | 0)
  const h = Math.max(1, height | 0)
  if (target.width === w && target.height === h) return
  target.setSize(w, h)
  const depth = target.depthTexture
  if (depth) {
    depth.image.width = w
    depth.image.height = h
    depth.needsUpdate = true
  }
}

export function disposeShoreDepthTarget(
  target: THREE.WebGLRenderTarget | null,
): void {
  if (!target) return
  target.depthTexture?.dispose()
  target.dispose()
}

/**
 * Render `terrainRoot` (tileset group) into `target`'s depth texture.
 * Restores the previous render target, clear colour, and autoClear.
 * Nested `renderer.render` is safe: the ocean mesh is not under this root.
 */
export function renderTerrainDepthPrepass(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  terrainRoot: THREE.Object3D,
  target: THREE.WebGLRenderTarget,
): void {
  if (!terrainRoot.visible) return

  const prevTarget = renderer.getRenderTarget()
  const prevXr = renderer.xr.enabled
  const prevShadow = renderer.shadowMap.autoUpdate
  const prevAutoClear = renderer.autoClear
  renderer.getClearColor(_clearColor)
  const prevAlpha = renderer.getClearAlpha()

  renderer.xr.enabled = false
  renderer.shadowMap.autoUpdate = false
  renderer.autoClear = true
  renderer.setClearColor(0x000000, 0)
  renderer.setRenderTarget(target)
  renderer.state.buffers.depth.setMask(true)
  renderer.clear()
  renderer.render(terrainRoot, camera)

  renderer.xr.enabled = prevXr
  renderer.shadowMap.autoUpdate = prevShadow
  renderer.autoClear = prevAutoClear
  renderer.setClearColor(_clearColor, prevAlpha)
  renderer.setRenderTarget(prevTarget)

  const viewport = (camera as THREE.Camera & { viewport?: THREE.Vector4 }).viewport
  if (viewport !== undefined) {
    renderer.state.viewport(viewport)
  }
}
