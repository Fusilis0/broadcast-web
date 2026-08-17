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
  CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
  DEFAULT_TERRAIN_ENABLED,
  REORIENTATION_AZIMUTH_RAD,
} from './constants.ts'
import { createTerrain, type TerrainTilesAdapter } from './createTerrain.ts'
import { pluginFrameToScene, reorientationHeightHae } from './reorient.ts'
import { shouldShowTerrain } from './terrainGate.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN_PATH = resolve(__dirname, '../../../public/EGM96_1deg.bin')

function stubTiles(): { adapter: TerrainTilesAdapter; updateCount: { n: number } } {
  const group = new THREE.Group()
  group.name = 'stubTiles'
  const updateCount = { n: 0 }
  const adapter: TerrainTilesAdapter = {
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
  }
  return { adapter, updateCount }
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

  it('defaults off', () => {
    expect(DEFAULT_TERRAIN_ENABLED).toBe(false)
    expect(shouldShowTerrain(DEFAULT_TERRAIN_ENABLED, true)).toBe(false)
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
  it('defaults World Terrain to asset 1', () => {
    expect(CESIUM_ION_WORLD_TERRAIN_ASSET_ID).toBe(1)
  })
})
