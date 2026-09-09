/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import * as GeoOrigin from '../../geodesy/geoOrigin.ts'
import {
  BUILDINGS_ERROR_TARGET,
  BUILDINGS_LOAD_SIBLINGS,
  BUILDINGS_SESSION_ENABLED_KEY,
  BUILDINGS_VRAM_BYTES_TARGET,
  CESIUM_ION_OSM_BUILDINGS_ASSET_ID,
  DEFAULT_BUILDINGS_ENABLED,
  OSM_BUILDINGS_CREDIT_FALLBACK,
} from './constants.ts'
import { createBuildings, type BuildingsTilesAdapter } from './createBuildings.ts'
import {
  applyOccupancyMeshHide,
  isEnuXzInOccupancyHole,
  patchOccupancyMaterial,
  patchOccupancyMaterials,
  createOccupancyUniforms,
  readSessionBuildingsEnabled,
  withOsmCreditFallback,
  writeSessionBuildingsEnabled,
} from './occupancy.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CREATE_SRC = readFileSync(resolve(__dirname, './createBuildings.ts'), 'utf8')

function stubTiles(): {
  adapter: BuildingsTilesAdapter
  updateCount: { n: number }
  visibleTiles: Set<unknown>
} {
  const group = new THREE.Group()
  group.name = 'stubBuildingTiles'
  const updateCount = { n: 0 }
  const visibleTiles = new Set<unknown>()
  const adapter: BuildingsTilesAdapter = {
    group,
    registerPlugin: () => undefined,
    setCamera: () => true,
    deleteCamera: () => true,
    setResolutionFromRenderer: () => true,
    update: () => {
      updateCount.n += 1
    },
    getAttributions: (target = []) => target,
    addEventListener: () => undefined,
    dispose: () => {
      group.clear()
    },
    loadSiblings: true,
    errorTarget: 6,
    visibleTiles,
  }
  return { adapter, updateCount, visibleTiles }
}

function fakeRenderer(): THREE.WebGLRenderer {
  return {} as THREE.WebGLRenderer
}

describe('OSM Buildings ion asset', () => {
  it('is Cesium OSM Buildings 96188', () => {
    expect(CESIUM_ION_OSM_BUILDINGS_ASSET_ID).toBe(96188)
  })

  it('defaults on and uses a 256 MiB unload budget', () => {
    expect(DEFAULT_BUILDINGS_ENABLED).toBe(true)
    expect(BUILDINGS_VRAM_BYTES_TARGET).toBe(256 * 1024 * 1024)
  })

  it('createBuildings source has GLTFExtensionsPlugin, no quantized-mesh/Bing/NDI/STUDIO_TICK_FPS', () => {
    expect(CREATE_SRC).toMatch(/GLTFExtensionsPlugin/)
    expect(CREATE_SRC).toMatch(/loadSiblings/)
    expect(CREATE_SRC).not.toMatch(/QuantizedMeshPlugin/)
    expect(CREATE_SRC).not.toMatch(/ImageOverlayPlugin/)
    expect(CREATE_SRC).not.toMatch(/CesiumIonOverlay/)
    expect(CREATE_SRC).not.toMatch(/STUDIO_TICK_FPS/)
    expect(CREATE_SRC).not.toMatch(/\bNDI\b/)
    expect(CREATE_SRC).toMatch(/96188/)
    expect(CREATE_SRC).toMatch(/isolateTilesRendererCaches/)
  })

  it('ADD/REGION traversal uses loadSiblings false and errorTarget 16', () => {
    expect(BUILDINGS_LOAD_SIBLINGS).toBe(false)
    expect(BUILDINGS_ERROR_TARGET).toBe(16)
  })

  it('session key missing means on; 0 means off', () => {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.removeItem(BUILDINGS_SESSION_ENABLED_KEY)
    expect(readSessionBuildingsEnabled()).toBe(true)
    writeSessionBuildingsEnabled(false)
    expect(readSessionBuildingsEnabled()).toBe(false)
    writeSessionBuildingsEnabled(true)
    expect(readSessionBuildingsEnabled()).toBe(true)
    sessionStorage.removeItem(BUILDINGS_SESSION_ENABLED_KEY)
  })
})

describe('occupancy holes (scene ENU x=East, z=−North)', () => {
  it('hides a point inside the disk and leaves a point outside', () => {
    const holes = [{ x: 10, z: -4, radiusM: 5 }]
    expect(isEnuXzInOccupancyHole(10, -4, holes)).toBe(true)
    expect(isEnuXzInOccupancyHole(10, -4, [])).toBe(false)
    expect(isEnuXzInOccupancyHole(40, -4, holes)).toBe(false)
    expect(isEnuXzInOccupancyHole(10, 20, holes)).toBe(false)
  })

  it('injects fragment discard for occupancy disks', () => {
    const uniforms = createOccupancyUniforms([{ x: 0, z: 0, radiusM: 8 }])
    const material = new THREE.MeshStandardMaterial()
    patchOccupancyMaterial(material, uniforms)
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <begin_vertex>\nvoid main() { }',
      fragmentShader: 'void main() { }',
    }
    material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer)
    expect(shader.fragmentShader).toContain('discard')
    expect(shader.fragmentShader).toContain('uOccupancyHoles')
    expect(shader.uniforms['uOccupancyCount']?.value).toBe(1)
    material.dispose()
  })

  it('skips occupancy shader patch when holes are empty (fade-like main still works)', () => {
    const uniforms = createOccupancyUniforms([])
    const material = new THREE.MeshStandardMaterial()
    const before = material.onBeforeCompile
    const group = new THREE.Group()
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material))
    patchOccupancyMaterials(group, uniforms)
    expect(material.onBeforeCompile).toBe(before)
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: 'void main() { }',
      fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
    }
    material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer)
    expect(shader.fragmentShader).toMatch(/void\s+main\s*\(/)
    expect(shader.fragmentShader).not.toContain('uOccupancyHoles')
    material.dispose()
  })

  it('keeps a working main after occupancy patch on a fade-like shader', () => {
    const uniforms = createOccupancyUniforms([{ x: 0, z: 0, radiusM: 4 }])
    const material = new THREE.MeshStandardMaterial()
    const previous = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace(
        /void\s+main\s*\(\s*\)\s*\{/,
        (match) => `float fadeN = 1.0;\n${match}`,
      )
    }
    patchOccupancyMaterial(material, uniforms)
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <begin_vertex>\nvoid main() { }',
      fragmentShader: 'void main() { }',
    }
    material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer)
    expect(shader.fragmentShader).toMatch(/void\s+main\s*\(\s*\)/)
    expect(shader.fragmentShader).toContain('fadeN')
    expect(shader.fragmentShader).toContain('discard')
    material.dispose()
  })

  it('empty occupancy hide restores and does not hide the city', () => {
    const group = new THREE.Group()
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    )
    mesh.position.set(0, 4, 0)
    group.add(mesh)
    group.updateMatrixWorld(true)
    applyOccupancyMeshHide(group, [])
    expect(mesh.visible).toBe(true)
    applyOccupancyMeshHide(group, [{ x: 0, z: 0, radiusM: 8 }])
    expect(mesh.visible).toBe(false)
    applyOccupancyMeshHide(group, [])
    expect(mesh.visible).toBe(true)
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
  })
})

describe('OSM credit fallback', () => {
  it('appends ODbL when ion omits OpenStreetMap', () => {
    expect(withOsmCreditFallback(['© Cesium'])).toEqual([
      '© Cesium',
      OSM_BUILDINGS_CREDIT_FALLBACK,
    ])
    expect(withOsmCreditFallback(['Data © OpenStreetMap contributors'])).toEqual([
      'Data © OpenStreetMap contributors',
    ])
  })
})

describe('createBuildings (stubbed tileset, no ion network)', () => {
  afterEach(() => {
    GeoOrigin.resetForTests()
  })

  it('hides buildings when opaque-unsafe even if enabled (AR alpha clean)', () => {
    const { adapter } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    expect(handle.getEnabled()).toBe(true)
    handle.setOpaqueClearSafe(false)
    expect(handle.root.visible).toBe(false)
    handle.setOpaqueClearSafe(true)
    expect(handle.root.visible).toBe(true)
    handle.dispose()
  })

  it('shows when enabled + opaque-safe + token (stub)', () => {
    const { adapter } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    handle.setOpaqueClearSafe(true)
    expect(handle.root.visible).toBe(true)
    handle.dispose()
  })

  it('sets loadSiblings false and errorTarget 16 on the stub tileset', () => {
    const { adapter } = stubTiles()
    expect(adapter.loadSiblings).toBe(true)
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    expect(adapter.loadSiblings).toBe(false)
    expect(adapter.errorTarget).toBe(16)
    handle.dispose()
  })

  it('status distinguishes tiles 0 from tiles N', () => {
    const { adapter, visibleTiles } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    const cam = new THREE.PerspectiveCamera()
    handle.tick(cam, cam, fakeRenderer())
    expect(handle.getStatusMessage()).toMatch(/tiles 0/)
    visibleTiles.add({})
    handle.tick(cam, cam, fakeRenderer())
    expect(handle.getStatusMessage()).toMatch(/tiles 1/)
    expect(handle.getStatusMessage()).not.toMatch(/ion load failed/)
    handle.dispose()
  })

  it('stays off with an empty token and does not throw', () => {
    const { adapter } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: '  ',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    handle.setOpaqueClearSafe(true)
    expect(handle.root.visible).toBe(false)
    expect(handle.getStatusMessage()).toMatch(/no ion token/i)
    handle.dispose()
  })

  it('applies the same altitude nudge on the root Y', () => {
    const { adapter } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setAltitudeNudgeM(2.5)
    expect(handle.getAltitudeNudgeM()).toBe(2.5)
    expect(handle.root.position.y).toBe(2.5)
    handle.dispose()
  })

  it('skips tiles.update when lock-tiles is on', () => {
    const { adapter, updateCount } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    const cam = new THREE.PerspectiveCamera()
    handle.tick(cam, cam, fakeRenderer())
    expect(updateCount.n).toBe(1)
    handle.setTilesLocked(true)
    handle.tick(cam, cam, fakeRenderer())
    expect(updateCount.n).toBe(1)
    handle.dispose()
  })

  it('setOccupancyHoles hides a mesh inside the disk and leaves one outside', () => {
    const { adapter } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    const inside = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    )
    inside.position.set(0, 8, 0)
    handle.root.add(inside)
    const outside = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    )
    outside.position.set(80, 8, 80)
    handle.root.add(outside)
    handle.root.updateMatrixWorld(true)

    handle.setOccupancyHoles([])
    expect(inside.visible).toBe(true)
    expect(outside.visible).toBe(true)

    handle.setOccupancyHoles([{ x: 0, z: 0, radiusM: 5 }])
    expect(isEnuXzInOccupancyHole(0, 0, handle.getOccupancyHoles())).toBe(true)
    expect(isEnuXzInOccupancyHole(80, 80, handle.getOccupancyHoles())).toBe(false)
    expect(inside.visible).toBe(false)
    expect(outside.visible).toBe(true)

    handle.setOccupancyHoles([])
    expect(inside.visible).toBe(true)
    expect(outside.visible).toBe(true)

    inside.geometry.dispose()
    ;(inside.material as THREE.Material).dispose()
    outside.geometry.dispose()
    ;(outside.material as THREE.Material).dispose()
    handle.dispose()
  })

  it('registers ion + GLTF plugins on a real TilesRenderer without throwing', () => {
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
    })
    expect(handle.root.name).toBe('cesiumOsmBuildings')
    expect(handle.getStatusMessage()).toMatch(/tiles 0/)
    handle.dispose()
  })

  it('includes OSM fallback credits when ion omits them', () => {
    const { adapter } = stubTiles()
    const handle = createBuildings({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    expect(handle.getCredits()).toContain(OSM_BUILDINGS_CREDIT_FALLBACK)
    handle.dispose()
  })
})
