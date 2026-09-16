import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  loadFromBuffer,
  resetForTests as resetEgm96,
} from '../../geodesy/egm96.ts'
import * as GeoOrigin from '../../geodesy/geoOrigin.ts'
import { creditsToLines, htmlToPlainText } from './attribution.ts'
import {
  CESIUM_ION_BING_AERIAL_ASSET_ID,
  CESIUM_ION_BING_ROAD_ASSET_ID,
  CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
  DEFAULT_TERRAIN_ENABLED,
  REORIENTATION_AZIMUTH_RAD,
  SRT_PLATE_TERRAIN_ERROR_TARGET,
} from './constants.ts'
import {
  createTerrain,
  describeIonLoadError,
  shouldRegisterReorientation,
  type TerrainTilesAdapter,
} from './createTerrain.ts'
import { pluginFrameToScene, reorientationHeightHae } from './reorient.ts'
import { shouldShowTerrain } from './terrainGate.ts'
import { DEFAULT_TERRAIN_WATER_DISCARD_Y, shouldHideTerrainWater } from './terrainWaterMask.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN_PATH = resolve(__dirname, '../../../public/EGM96_1deg.bin')

function stubTiles(): {
  adapter: TerrainTilesAdapter
  updateCount: { n: number }
  cameras: { set: THREE.Camera[]; deleted: THREE.Camera[] }
} {
  const group = new THREE.Group()
  group.name = 'stubTiles'
  const updateCount = { n: 0 }
  const cameras = { set: [] as THREE.Camera[], deleted: [] as THREE.Camera[] }
  const adapter: TerrainTilesAdapter = {
    group,
    registerPlugin: () => undefined,
    setCamera: (camera) => {
      cameras.set.push(camera)
      return true
    },
    deleteCamera: (camera) => {
      cameras.deleted.push(camera)
      return true
    },
    setResolutionFromRenderer: () => true,
    update: () => {
      updateCount.n += 1
    },
    getAttributions: (target = []) => target,
    addEventListener: () => undefined,
    dispose: () => {
      group.clear()
    },
  }
  return { adapter, updateCount, cameras }
}

function fakeRenderer(): THREE.WebGLRenderer {
  return {} as THREE.WebGLRenderer
}

describe('shouldShowTerrain', () => {
  it('shows only when enabled and opaque-clear-safe', () => {
    expect(shouldShowTerrain(true, true)).toBe(true)
    expect(shouldShowTerrain(true, false)).toBe(false)
    expect(shouldShowTerrain(false, true)).toBe(false)
    expect(shouldShowTerrain(false, false)).toBe(false)
  })

  it('defaults on (opaque-safe)', () => {
    expect(DEFAULT_TERRAIN_ENABLED).toBe(true)
    expect(shouldShowTerrain(DEFAULT_TERRAIN_ENABLED, true)).toBe(true)
  })
})

describe('reorientation azimuth (plugin X-west/Z-north → scene X-east/Z-−north)', () => {
  it('is a 180° yaw about +Y', () => {
    expect(REORIENTATION_AZIMUTH_RAD).toBeCloseTo(Math.PI, 12)
  })

  it('maps plugin west (+X) to scene west (−X) and plugin north (+Z) to scene north (−Z)', () => {
    const west = pluginFrameToScene(new THREE.Vector3(1, 0, 0))
    const north = pluginFrameToScene(new THREE.Vector3(0, 0, 1))
    expect(west.x).toBeCloseTo(-1)
    expect(west.y).toBeCloseTo(0)
    expect(west.z).toBeCloseTo(0)
    expect(north.x).toBeCloseTo(0)
    expect(north.y).toBeCloseTo(0)
    expect(north.z).toBeCloseTo(-1)
  })

  it('matches a Y-180 matrix', () => {
    const y180 = new THREE.Matrix4().makeRotationY(REORIENTATION_AZIMUTH_RAD)
    const pluginNorth = new THREE.Vector3(0, 0, 1).applyMatrix4(y180)
    expect(pluginNorth.z).toBeCloseTo(-1)
  })
})

describe('reorientationHeightHae', () => {
  beforeAll(() => {
    const bytes = readFileSync(BIN_PATH)
    const ok = loadFromBuffer(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    )
    expect(ok).toBe(true)
  })

  afterEach(() => {
    GeoOrigin.resetForTests()
  })

  it('uses amslToHae, not raw altMsl (Istanbul geoid N ≠ 0)', () => {
    const lat = 41.0082
    const lon = 28.9784
    const altMsl = 0
    const hae = reorientationHeightHae(lat, lon, altMsl)
    expect(hae).not.toBe(altMsl)
    expect(Math.abs(hae)).toBeGreaterThan(1)
  })
})

describe('createTerrain (stubbed tileset, no ion network)', () => {
  afterEach(() => {
    GeoOrigin.resetForTests()
  })

  it('places the tiles group at the origin; nudge moves the root in Y', () => {
    GeoOrigin.setOriginHAE(41.0082, 28.9784, 36)
    const { adapter } = stubTiles()
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    expect(handle.root.position.x).toBe(0)
    expect(handle.root.position.y).toBe(0)
    expect(handle.root.position.z).toBe(0)
    expect(adapter.group.position.x).toBe(0)
    expect(adapter.group.position.y).toBe(0)
    expect(adapter.group.position.z).toBe(0)

    handle.setAltitudeNudgeM(2.5)
    expect(handle.getAltitudeNudgeM()).toBe(2.5)
    expect(handle.root.position.y).toBe(2.5)
    expect(adapter.group.position.y).toBe(0)
    handle.dispose()
  })

  it('hides terrain when opaque-unsafe even if enabled (AR alpha clean)', () => {
    const { adapter } = stubTiles()
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    handle.setOpaqueClearSafe(false)
    expect(handle.root.visible).toBe(false)
    handle.setOpaqueClearSafe(true)
    expect(handle.root.visible).toBe(true)
    handle.dispose()
  })

  it('starts hidden (default off) even with a token', () => {
    const { adapter } = stubTiles()
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    expect(handle.getEnabled()).toBe(false)
    expect(handle.root.visible).toBe(false)
    handle.dispose()
  })

  it('skips tiles.update when lock-tiles is on', () => {
    const { adapter, updateCount } = stubTiles()
    const handle = createTerrain({
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

  it('unregisters a parked air camera when tick uses preview only', () => {
    const { adapter, cameras } = stubTiles()
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    handle.setEnabled(true)
    const preview = new THREE.PerspectiveCamera()
    const air = new THREE.PerspectiveCamera()
    handle.tick(preview, air, fakeRenderer())
    expect(cameras.set).toContain(preview)
    expect(cameras.set).toContain(air)
    handle.tick(preview, preview, fakeRenderer())
    expect(cameras.deleted).toContain(air)
    handle.dispose()
  })

  it('hides water only when asked; default threshold is +0.5 m', () => {
    const { adapter } = stubTiles()
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => adapter,
    })
    expect(handle.getHideWater()).toBe(false)
    expect(handle.getWaterDiscardYM()).toBe(DEFAULT_TERRAIN_WATER_DISCARD_Y)
    expect(shouldHideTerrainWater({ realisticOceanMounted: false })).toBe(false)

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshStandardMaterial(),
    )
    handle.root.add(mesh)
    handle.setHideWater(true)
    expect(handle.getHideWater()).toBe(true)
    expect(shouldHideTerrainWater({ realisticOceanMounted: true })).toBe(true)

    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <begin_vertex>\nvoid main() { }',
      fragmentShader: 'void main() { }',
    }
    ;(mesh.material as THREE.MeshStandardMaterial).onBeforeCompile(
      shader as never,
      {} as THREE.WebGLRenderer,
    )
    expect(shader.uniforms['uHideTerrainWater']?.value).toBe(1)
    expect(shader.fragmentShader).toContain('discard')
    expect(shader.uniforms['uTerrainGrey']).toBeUndefined()
    expect(shader.fragmentShader).not.toContain('uTerrainGrey')

    handle.setHideWater(false)
    expect(handle.getHideWater()).toBe(false)
    expect(shader.uniforms['uHideTerrainWater']?.value).toBe(0)

    handle.setWaterDiscardYM(1.5)
    expect(handle.getWaterDiscardYM()).toBe(1.5)
    handle.setAltitudeNudgeM(2)
    expect(shader.uniforms['uTerrainWaterY']?.value).toBe(3.5)

    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    handle.dispose()
  })

  it('defaults overlay to Bing Aerial ion 2; road 4 stays available', () => {
    const { adapter } = stubTiles()
    let factoryCalls = 0
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      tilesFactory: () => {
        factoryCalls += 1
        return adapter
      },
    })
    expect(factoryCalls).toBe(1)
    expect(handle.getImageryAssetId()).toBe(CESIUM_ION_BING_AERIAL_ASSET_ID)
    expect(handle.getImageryAssetId()).toBe(2)
    expect(handle.getStatusMessage()).toBe('Terrain: off')

    handle.setEnabled(true)
    handle.setOpaqueClearSafe(true)
    expect(handle.getStatusMessage()).toContain('aerial')
    expect(handle.getStatusMessage()).not.toContain('grey')

    handle.dispose()
  })

  it('accepts aerial overlay 2 without remounting in the stub factory', () => {
    const { adapter } = stubTiles()
    const handle = createTerrain({
      renderer: fakeRenderer(),
      token: 'test-token',
      skipIonPlugins: true,
      imageryAssetId: CESIUM_ION_BING_AERIAL_ASSET_ID,
      tilesFactory: () => adapter,
    })
    expect(handle.getImageryAssetId()).toBe(2)
    handle.setEnabled(true)
    handle.setOpaqueClearSafe(true)
    expect(handle.getStatusMessage()).toContain('aerial')
    handle.dispose()
  })
})

describe('attribution strings', () => {
  it('strips ion HTML credits to a DOM-safe line', () => {
    expect(htmlToPlainText('<span>© Cesium</span> <a href="#">Bing</a>')).toBe(
      '© Cesium Bing',
    )
    expect(
      creditsToLines([
        { type: 'html', value: '<div>Data © Cesium</div>' },
        { type: 'string', value: 'Bing Maps' },
      ]),
    ).toEqual(['Data © Cesium', 'Bing Maps'])
  })
})

describe('ion asset defaults', () => {
  it('defaults World Terrain to asset 1, Aerial overlay 2, Road compare 4', () => {
    expect(CESIUM_ION_WORLD_TERRAIN_ASSET_ID).toBe(1)
    expect(CESIUM_ION_BING_ROAD_ASSET_ID).toBe(4)
    expect(CESIUM_ION_BING_AERIAL_ASSET_ID).toBe(2)
    expect(SRT_PLATE_TERRAIN_ERROR_TARGET).toBe(8)
    expect(SRT_PLATE_TERRAIN_ERROR_TARGET).toBeGreaterThan(2)
  })

  it('createTerrain defaults overlay from DEFAULT_TERRAIN_OVERLAY; grey Rec.709 is gone', () => {
    const src = readFileSync(resolve(__dirname, 'createTerrain.ts'), 'utf8')
    expect(src).toContain('overlayToImageryAssetId(DEFAULT_TERRAIN_OVERLAY)')
    expect(src).toContain('CESIUM_ION_BING_ROAD_ASSET_ID')
    expect(src).toContain('CESIUM_ION_BING_AERIAL_ASSET_ID')
    expect(src).toContain('CesiumIonOverlay')
    expect(src).toContain('ImageOverlayPlugin')
    expect(src).toContain('falling back to Aerial')
    expect(src).not.toContain('setImageryLook')
    expect(src).not.toContain('uTerrainGrey')
    expect(src).not.toContain('GoogleMapsOverlay')
    expect(src).not.toContain('GoogleCloudAuth')
    expect(src).not.toMatch(/imageryAssetId\s*[:=]\s*0/)
    expect(src).toMatch(/isolateTilesRendererCaches/)
    expect(src).toMatch(/applyPinnedErrorTarget/)
    expect(src).toContain('options.errorTarget')
  })

  it('createScene remounts terrain on overlay switch without disposing OSM Buildings', () => {
    const src = readFileSync(resolve(__dirname, '../createScene.ts'), 'utf8')
    expect(src).toContain('setTerrainOverlay')
    expect(src).toContain('remountTerrainOnly')
    expect(src).toContain('CESIUM_ION_BING_ROAD_ASSET_ID')
    expect(src).not.toContain('setTerrainImageryLook')
    expect(src).not.toContain('setImageryLook')
    expect(src).toMatch(
      /function remountTerrainOnly\([\s\S]{0,600}disposeTerrainInstance/,
    )
    expect(src).not.toMatch(
      /function remountTerrainOnly\([\s\S]{0,400}disposeBuildingsInstance/,
    )
    expect(src).toMatch(
      /function restoreCinematicLook\(\)[\s\S]{0,1400}disposeBuildingsInstance/,
    )
    expect(src).toContain('BUILDINGS_ERROR_TARGET')
    expect(src).toContain('SRT_PLATE_TERRAIN_ERROR_TARGET')
    expect(src).toMatch(/errorTarget:\s*plate \? SRT_PLATE_TERRAIN_ERROR_TARGET/)
    expect(src).toMatch(/terrain\.tick\(tilesCam, tilesCam, renderer\)/)
    expect(src).toContain('parkedGlobeTerrain')
    expect(src).toContain('parkedEnuTerrain')
    expect(src).toContain('reuseParked')
    expect(src).toMatch(/cinematicPlayer\.seek\(0\)/)
  })
})

describe('describeIonLoadError', () => {
  it('treats tile=null as a root failure and keeps the ion message', () => {
    const err = new Error('CesiumIonAuthPlugin: Failed to load data with error code 401')
    expect(describeIonLoadError({ tile: null, error: err })).toEqual({
      rootFailed: true,
      detail: err.message,
    })
  })

  it('does not treat a missing child tile as a dead mount', () => {
    expect(
      describeIonLoadError({ tile: { content: { uri: 'x.terrain' } }, error: '404' }),
    ).toEqual({ rootFailed: false, detail: '404' })
  })
})

describe('cinematic globe tiles (no ReorientationPlugin)', () => {
  it('skips ENU reorientation when reorient is false', () => {
    expect(shouldRegisterReorientation(undefined)).toBe(true)
    expect(shouldRegisterReorientation(true)).toBe(true)
    expect(shouldRegisterReorientation(false)).toBe(false)
  })
})
