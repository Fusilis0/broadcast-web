import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  DEFAULT_TERRAIN_WATER_DISCARD_Y,
  createTerrainWaterUniforms,
  patchTerrainWaterMaterial,
  patchTerrainWaterMaterials,
  sceneFromLoadModelEvent,
  shouldHideTerrainWater,
} from './terrainWaterMask.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('shouldHideTerrainWater', () => {
  it('is on only while the realistic ocean is mounted', () => {
    expect(shouldHideTerrainWater({ realisticOceanMounted: true })).toBe(true)
    expect(shouldHideTerrainWater({ realisticOceanMounted: false })).toBe(false)
  })
})

describe('terrain water uniforms', () => {
  it('defaults the height-fallback threshold to +0.5 m AMSL and hide off', () => {
    expect(DEFAULT_TERRAIN_WATER_DISCARD_Y).toBe(0.5)
    const u = createTerrainWaterUniforms()
    expect(u.uHideTerrainWater.value).toBe(0)
    expect(u.uTerrainWaterY.value).toBe(0.5)
  })

  it('toggles the hide uniform without allocating a new object identity for materials', () => {
    const u = createTerrainWaterUniforms(true, 1.25)
    expect(u.uHideTerrainWater.value).toBe(1)
    expect(u.uTerrainWaterY.value).toBe(1.25)
    u.uHideTerrainWater.value = 0
    expect(u.uHideTerrainWater.value).toBe(0)
  })
})

describe('patchTerrainWaterMaterial', () => {
  it('injects water-mask discard plus height fallback into onBeforeCompile', () => {
    const uniforms = createTerrainWaterUniforms(true)
    const mat = new THREE.MeshStandardMaterial()
    patchTerrainWaterMaterial(mat, uniforms)
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <begin_vertex>\nvoid main() { }',
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    }
    mat.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer)
    expect(shader.uniforms['uHideTerrainWater']).toBe(uniforms.uHideTerrainWater)
    expect(shader.uniforms['uTerrainWaterY']).toBe(uniforms.uTerrainWaterY)
    expect(shader.vertexShader).toContain('vTerrainWorldY')
    expect(shader.fragmentShader).toContain('uHideTerrainWater')
    expect(shader.fragmentShader).toContain('discard')
    expect(shader.fragmentShader).toContain('USE_ROUGHNESSMAP')
    expect(shader.fragmentShader).toContain('uTerrainWaterY')
    mat.dispose()
  })

  it('is idempotent on the same material', () => {
    const uniforms = createTerrainWaterUniforms()
    const mat = new THREE.MeshStandardMaterial()
    patchTerrainWaterMaterial(mat, uniforms)
    const first = mat.onBeforeCompile
    patchTerrainWaterMaterial(mat, uniforms)
    expect(mat.onBeforeCompile).toBe(first)
    mat.dispose()
  })
})

describe('patchTerrainWaterMaterials', () => {
  it('walks meshes under a tileset root', () => {
    const uniforms = createTerrainWaterUniforms(true)
    const root = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial())
    root.add(mesh)
    patchTerrainWaterMaterials(root, uniforms)
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <begin_vertex>\nvoid main() { }',
      fragmentShader: 'void main() { }',
    }
    ;(mesh.material as THREE.MeshStandardMaterial).onBeforeCompile(
      shader as never,
      {} as THREE.WebGLRenderer,
    )
    expect(shader.fragmentShader).toContain('discard')
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
  })
})

describe('sceneFromLoadModelEvent', () => {
  it('reads the tiles renderer load-model payload', () => {
    const scene = new THREE.Group()
    expect(sceneFromLoadModelEvent({ scene, tile: {} })).toBe(scene)
    expect(sceneFromLoadModelEvent({ tile: {} })).toBeNull()
    expect(sceneFromLoadModelEvent(null)).toBeNull()
  })
})

describe('no GPU readback', () => {
  it('terrainWaterMask.ts does not call readPixels / getImageData', () => {
    const src = readFileSync(resolve(__dirname, 'terrainWaterMask.ts'), 'utf8')
    expect(src).not.toMatch(/\breadPixels\s*\(/)
    expect(src).not.toMatch(/\bgetImageData\s*\(/)
    expect(src).not.toMatch(/\breadRenderTargetPixels\s*\(/)
  })
})
