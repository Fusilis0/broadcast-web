/**
 * @vitest-environment happy-dom
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as GeoOrigin from '../../geodesy/geoOrigin.ts'
import { isEnuXzInOccupancyHole } from '../buildings/index.ts'
import { LANDMARK_CATALOGUE } from './catalogue.ts'
import {
  DEFAULT_HEROES_ENABLED,
  LANDMARK_CCBY_CREDIT,
  LANDMARK_FOCUS_RADIUS_CAP_M,
  LANDMARKS_OFFSETS_LOCAL_KEY,
  LANDMARKS_OFFSETS_SESSION_KEY,
  LANDMARKS_SESSION_ENABLED_KEY,
  MAX_LANDMARKS,
  readSessionHeroesEnabled,
  shouldShowLandmarks,
  writeSessionHeroesEnabled,
} from './constants.ts'
import { createLandmarks } from './createLandmarks.ts'
import { defaultLandmarkPose } from './defaultOffsets.ts'
import {
  applyLandmarkOffset,
  landmarkEnuFromGps,
  landmarkFocusRadiusM,
  occupancyHolesForCatalogue,
  occupancyHolesFromEnu,
} from './layout.ts'
import { isLandmarkFloorName } from './stripFloors.ts'
import {
  LANDMARK_STONE_FALLBACK,
  recolorSketchupPurple,
} from './sketchupPurple.ts'
import { glbJsonImageCount } from './glbImages.ts'
import { loadLandmarkGltf } from './loadLandmarkGltf.ts'
import {
  mergeLandmarkOffsetLayers,
  persistLandmarkOffsets,
  readGlobalLandmarkOffsets,
  readSessionLandmarkOffsets,
} from './projectLandmarks.ts'
import type { GpsToEnuAmslFn, LandmarkEntry } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CREATE_SRC = readFileSync(resolve(__dirname, './createLandmarks.ts'), 'utf8')
const CATALOGUE_SRC = readFileSync(resolve(__dirname, './catalogue.ts'), 'utf8')

const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
  x: lon * 1000,
  y: alt + 12,
  z: -lat * 1000,
})

const PACK_IDS = [
  'maidens-tower',
  'galata-tower',
  'rumeli-hisari',
  'hagia-sophia',
  'sultan-ahmed',
  'topkapi',
  'suleymaniye',
  'aya-irini',
  'dolmabahce',
  'ciragan',
  'bogazici-bridge',
  'fsm-bridge',
  'yavuz-selim-bridge',
] as const

function stubGltf(_url: string): Promise<THREE.Group> {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4)))
  return Promise.resolve(g)
}

function mountPack(
  extra: Partial<Parameters<typeof createLandmarks>[0]> = {},
) {
  return createLandmarks({
    gpsToEnuAmsl: mockEnu,
    loadGltf: stubGltf,
    ...extra,
  })
}

afterEach(() => {
  GeoOrigin.resetForTests()
  vi.restoreAllMocks()
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(LANDMARKS_SESSION_ENABLED_KEY)
  }
})

describe('landmark catalogue', () => {
  it('ships the operator pack in dispatch order with MAX_LANDMARKS covering it', () => {
    expect(LANDMARK_CATALOGUE).toHaveLength(PACK_IDS.length)
    expect(MAX_LANDMARKS).toBeGreaterThanOrEqual(LANDMARK_CATALOGUE.length)
    expect(LANDMARK_CATALOGUE.length).toBeLessThanOrEqual(MAX_LANDMARKS)
    expect(LANDMARK_CATALOGUE.map((e) => e.id)).toEqual([...PACK_IDS])
    expect(LANDMARK_CATALOGUE[0]?.displayName).toMatch(/Maiden/i)
    expect(LANDMARK_CATALOGUE.find((e) => e.id === 'rumeli-hisari')?.displayName).toMatch(
      /Rumeli/i,
    )
    expect(LANDMARK_CATALOGUE.find((e) => e.id === 'galata-tower')?.displayName).toMatch(
      /Galata/i,
    )
  })

  it('mounts Rumeli as glTF from hisar2; others are glTF with local urls', () => {
    const rumeli = LANDMARK_CATALOGUE.find((e) => e.id === 'rumeli-hisari')
    expect(rumeli).toMatchObject({
      kind: 'gltf',
      gltfUrl: '/models/landmarks/rumeli-hisari.glb',
      lat: 41.0848,
      lon: 29.0567,
      altMsl: 0,
      yawDeg: 0,
    })
    expect(rumeli?.licence).toMatch(/operator-provided SKP/i)

    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')
    expect(maidens).toMatchObject({
      kind: 'gltf',
      gltfUrl: '/models/landmarks/maidens-tower.glb',
      lat: 41.0211,
      lon: 29.0041,
      altMsl: 0,
    })
    expect(maidens?.licence).toMatch(/CC-BY/i)

    const galata = LANDMARK_CATALOGUE.find((e) => e.id === 'galata-tower')
    expect(galata).toMatchObject({
      kind: 'gltf',
      gltfUrl: '/models/landmarks/galata-tower.glb',
      lat: 41.0256,
      lon: 28.9741,
    })
    expect(galata?.licence).toMatch(/not the 419 MB/i)

    for (const e of LANDMARK_CATALOGUE) {
      expect(e.altMsl).toBe(0)
      expect(e.yawDeg).toBe(0)
      expect(e.occupancyRadiusM).toBeGreaterThan(0)
      expect(e.kind).toBe('gltf')
      expect(e.gltfUrl).toMatch(/^\/models\/landmarks\/.+\.glb$/)
    }
  })

  it('keeps bridge occupancy disks at 80 m (does not erase Beşiktaş)', () => {
    for (const id of [
      'bogazici-bridge',
      'fsm-bridge',
      'yavuz-selim-bridge',
    ] as const) {
      const row = LANDMARK_CATALOGUE.find((e) => e.id === id)
      expect(row?.occupancyRadiusM).toBe(80)
    }
  })

  it('exposes a short CC-BY line for the 3D DOM overlay', () => {
    expect(LANDMARK_CCBY_CREDIT).toMatch(/oblo\.3d/)
    expect(LANDMARK_CCBY_CREDIT).toMatch(/CC-BY/)
  })
})

describe('ENU placement via gpsToEnuAmsl', () => {
  it('passes catalogue lat/lon/altMsl into the GEO convert (no second geoid)', () => {
    const calls: Array<[number, number, number]> = []
    const convert: GpsToEnuAmslFn = (lat, lon, alt) => {
      calls.push([lat, lon, alt])
      return mockEnu(lat, lon, alt)
    }
    for (const entry of LANDMARK_CATALOGUE) {
      const enu = landmarkEnuFromGps(entry, convert)
      expect(enu.x).toBeCloseTo(entry.lon * 1000)
      expect(enu.y).toBeCloseTo(entry.altMsl + 12)
      expect(enu.z).toBeCloseTo(-entry.lat * 1000)
      expect(enu.radiusM).toBe(entry.occupancyRadiusM)
    }
    expect(calls).toEqual(
      LANDMARK_CATALOGUE.map((e) => [e.lat, e.lon, e.altMsl]),
    )
  })

  it('occupancy disks match catalogue XZ from the same convert', () => {
    const holes = occupancyHolesForCatalogue(LANDMARK_CATALOGUE, mockEnu)
    expect(holes).toHaveLength(LANDMARK_CATALOGUE.length)
    for (const entry of LANDMARK_CATALOGUE) {
      const enu = mockEnu(entry.lat, entry.lon, entry.altMsl)
      expect(
        holes.some(
          (h) =>
            h.x === enu.x &&
            h.z === enu.z &&
            h.radiusM === entry.occupancyRadiusM,
        ),
      ).toBe(true)
      expect(isEnuXzInOccupancyHole(enu.x, enu.z, holes)).toBe(true)
    }
    expect(occupancyHolesForCatalogue([], mockEnu)).toEqual([])
  })
})

describe('createLandmarks', () => {
  it('places heroes at mock GEO ENU and emits matching occupancy disks when opaque-safe', async () => {
    const seen: Array<readonly { x: number; z: number; radiusM: number }[]> = []
    const handle = mountPack({
      onOccupancyHoles: (holes) => {
        seen.push(holes)
      },
    })
    await handle.ready
    handle.setOpaqueClearSafe(true)
    const expected = occupancyHolesFromEnu(
      LANDMARK_CATALOGUE.map((entry) =>
        applyLandmarkOffset(
          landmarkEnuFromGps(entry, mockEnu),
          defaultLandmarkPose(entry.id),
        ),
      ),
    )
    expect(handle.getOccupancyHoles()).toEqual(expected)
    expect(seen.at(-1)).toEqual(expected)
    expect(handle.root.children).toHaveLength(LANDMARK_CATALOGUE.length)
    for (const entry of LANDMARK_CATALOGUE) {
      const child = handle.root.children.find(
        (c) => c.userData.landmarkId === entry.id,
      )
      expect(child).toBeTruthy()
      const enu = mockEnu(entry.lat, entry.lon, entry.altMsl)
      const offset = defaultLandmarkPose(entry.id)
      expect(child!.position.x).toBeCloseTo(enu.x + offset.x)
      expect(child!.position.y).toBeCloseTo(enu.y + offset.y)
      expect(child!.position.z).toBeCloseTo(enu.z + offset.z)
    }
    handle.dispose()
  })

  it('applies XYZ offsets live; occupancy follows offset XZ not rotation', async () => {
    const handle = mountPack()
    await handle.ready
    handle.setOpaqueClearSafe(true)
    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')!
    const base = mockEnu(maidens.lat, maidens.lon, maidens.altMsl)
    handle.setLandmarkPoseOffset('maidens-tower', {
      x: 10,
      y: 2,
      z: -4,
      yawDeg: 45,
    })
    const obj = handle.root.children.find(
      (c) => c.userData.landmarkId === 'maidens-tower',
    )!
    expect(obj.position.x).toBeCloseTo(base.x + 10)
    expect(obj.position.y).toBeCloseTo(base.y + 2)
    expect(obj.position.z).toBeCloseTo(base.z - 4)
    const holes = handle.getOccupancyHoles()
    expect(
      holes.some(
        (h) =>
          Math.abs(h.x - (base.x + 10)) < 1e-6 &&
          Math.abs(h.z - (base.z - 4)) < 1e-6,
      ),
    ).toBe(true)
    expect(isEnuXzInOccupancyHole(base.x + 10, base.z - 4, holes)).toBe(true)
    const world = handle.getLandmarkWorldPosition('maidens-tower')
    expect(world).toEqual({
      x: obj.position.x,
      y: obj.position.y,
      z: obj.position.z,
    })
    const pin = handle.getLandmarkPinAnchor('maidens-tower')
    expect(pin).not.toBeNull()
    expect(pin!.x).toBeCloseTo(obj.position.x, 5)
    expect(pin!.z).toBeCloseTo(obj.position.z, 5)
    expect(pin!.y).toBeGreaterThan(obj.position.y)
    expect(handle.getLandmarkFocusRadius('bogazici-bridge')).toBeLessThanOrEqual(
      LANDMARK_FOCUS_RADIUS_CAP_M,
    )
    handle.dispose()
  })

  it('applies uniform authoring scale without moving ENU', async () => {
    const handle = mountPack()
    await handle.ready
    const obj = handle.root.children.find(
      (c) => c.userData.landmarkId === 'maidens-tower',
    )!
    const x = obj.position.x
    handle.setLandmarkPoseOffset('maidens-tower', { scale: 2.5 })
    expect(obj.scale.x).toBeCloseTo(2.5)
    expect(obj.scale.y).toBeCloseTo(2.5)
    expect(obj.position.x).toBeCloseTo(x)
    expect(handle.getLandmarkPoseOffsets()['maidens-tower']?.scale).toBe(2.5)
    handle.dispose()
  })

  it('strips Google Earth terrain and Sketchfab ground/sea planes', async () => {
    expect(isLandmarkFloorName('ground')).toBe(true)
    expect(isLandmarkFloorName('ground2.003_Material_ground2_0')).toBe(true)
    expect(isLandmarkFloorName('sea_Material_sea_0')).toBe(true)
    expect(
      isLandmarkFloorName(
        'mesh_34_ROOT__Google_Earth_Terrain_Location Terrain_113_113_113_ss',
      ),
    ).toBe(true)
    expect(
      isLandmarkFloorName(
        'mesh_417_ROOT__Google_Earth_Snapshot_Location Snapshot_83_83_83_ss',
      ),
    ).toBe(true)
    expect(isLandmarkFloorName('tile_plane8.002_Material_tile_plane8.002_0')).toBe(
      false,
    )
    expect(isLandmarkFloorName('landmarkBox:rumeli-hisari')).toBe(false)

    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')!
    const handle = createLandmarks({
      gpsToEnuAmsl: mockEnu,
      catalogue: [maidens],
      loadGltf: async () => {
        const g = new THREE.Group()
        const keep = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2))
        keep.name = 'tower'
        const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.05, 40))
        floor.name = 'ground'
        const terrain = new THREE.Mesh(new THREE.BoxGeometry(80, 0.02, 80))
        terrain.name =
          'mesh_0_ROOT__Google_Earth_Terrain_Location Terrain_136_136_136_ss'
        g.add(keep, floor, terrain)
        return g
      },
    })
    await handle.ready
    const root = handle.root.children.find(
      (c) => c.userData.landmarkId === 'maidens-tower',
    )!
    const names: string[] = []
    root.traverse((o) => {
      if (o.name) names.push(o.name)
    })
    expect(names).toContain('tower')
    expect(names.some((n) => n.includes('ground'))).toBe(false)
    expect(names.some((n) => n.includes('Google_Earth_Terrain'))).toBe(false)
    handle.dispose()
  })

  it('recolors SketchUp magenta (153,0,255) to stone and keeps the mesh', async () => {
    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')!
    const handle = createLandmarks({
      gpsToEnuAmsl: mockEnu,
      catalogue: [maidens],
      loadGltf: async () => {
        const g = new THREE.Group()
        const keep = new THREE.Mesh(
          new THREE.BoxGeometry(2, 8, 2),
          new THREE.MeshStandardMaterial({ color: 0xc7bfb9 }),
        )
        keep.name = 'tower'
        const purple = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0x9900ff }),
        )
        purple.name = 'Yanlar_153_0_255_ss'
        g.add(keep, purple)
        return g
      },
    })
    await handle.ready
    const root = handle.root.children.find(
      (c) => c.userData.landmarkId === 'maidens-tower',
    )!
    const band = root.getObjectByName('Yanlar_153_0_255_ss') as THREE.Mesh
    expect(band).toBeTruthy()
    const mat = band.material as THREE.MeshStandardMaterial
    expect(mat.color.getHex()).toBe(LANDMARK_STONE_FALLBACK.getHex())
    expect(recolorSketchupPurple(root)).toBe(0)
    handle.dispose()
  })

  it('round-trips pack offsets via applyLandmarkPoseOffsets', async () => {
    const handle = mountPack()
    await handle.ready
    handle.applyLandmarkPoseOffsets({
      byId: {
        'maidens-tower': { offsetM: { x: 5, y: 0, z: 0 }, yawDeg: 20 },
      },
    })
    expect(handle.getLandmarkPoseOffsets()['maidens-tower']?.x).toBe(5)
    expect(handle.getLandmarkPoseOffsets()['maidens-tower']?.yawDeg).toBe(20)
    handle.applyLandmarkPoseOffsets(undefined)
    expect(handle.getLandmarkPoseOffsets()['maidens-tower']).toEqual(
      defaultLandmarkPose('maidens-tower'),
    )
    handle.dispose()
  })

  it('uses empty-pack defaults when a race has no landmarks.byId', async () => {
    const handle = mountPack()
    await handle.ready
    expect(handle.getLandmarkPoseOffsets()['galata-tower']).toEqual(
      defaultLandmarkPose('galata-tower'),
    )
    expect(handle.getLandmarkPoseOffsets()['yavuz-selim-bridge']?.x).toBe(-600)
    expect(handle.getLandmarkPoseOffsets()['hagia-sophia']).toEqual({
      x: 0,
      y: 0,
      z: 0,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      scale: 1,
    })
    handle.dispose()
  })

  it('pack byId overrides catalogue defaults for that id only', async () => {
    const handle = mountPack()
    await handle.ready
    handle.applyLandmarkPoseOffsets({
      byId: {
        'galata-tower': { offsetM: { x: 1, y: 2, z: 3 } },
      },
    })
    expect(handle.getLandmarkPoseOffsets()['galata-tower']).toEqual({
      x: 1,
      y: 2,
      z: 3,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      scale: 1,
    })
    expect(handle.getLandmarkPoseOffsets()['fsm-bridge']?.x).toBe(90)
    handle.dispose()
  })

  it('reports proxy / no image before textured glTF maps exist', async () => {
    const handle = mountPack()
    await handle.ready
    const report = handle.getLandmarkTextureReport()
    expect(report).toHaveLength(LANDMARK_CATALOGUE.length)
    expect(report.find((r) => r.id === 'rumeli-hisari')?.kind).toBe('no image')
    expect(report.find((r) => r.id === 'maidens-tower')?.kind).toBe('no image')
    handle.dispose()
  })

  it('hides heroes and clears occupancy when opaque-unsafe (AR)', async () => {
    const handle = mountPack()
    await handle.ready
    handle.setOpaqueClearSafe(true)
    expect(handle.root.visible).toBe(true)
    expect(handle.getOccupancyHoles()).toHaveLength(LANDMARK_CATALOGUE.length)
    handle.setOpaqueClearSafe(false)
    expect(handle.root.visible).toBe(false)
    expect(handle.getOccupancyHoles()).toEqual([])
    handle.dispose()
  })

  it('checkbox off hides meshes and clears occupancy (OSM boxes return)', async () => {
    const handle = mountPack()
    await handle.ready
    handle.setOpaqueClearSafe(true)
    handle.setEnabled(false)
    expect(handle.root.visible).toBe(false)
    expect(handle.getOccupancyHoles()).toEqual([])
    handle.setEnabled(true)
    expect(handle.root.visible).toBe(true)
    expect(handle.getOccupancyHoles()).toHaveLength(LANDMARK_CATALOGUE.length)
    handle.dispose()
  })

  it('re-layouts on GeoOrigin.onChanged through the injected convert', async () => {
    let scale = 1000
    const convert: GpsToEnuAmslFn = (lat, lon, alt) => ({
      x: lon * scale,
      y: alt,
      z: -lat * scale,
    })
    const handle = mountPack({ gpsToEnuAmsl: convert })
    await handle.ready
    handle.setOpaqueClearSafe(true)
    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')!
    const maidensObj = handle.root.children.find(
      (c) => c.userData.landmarkId === 'maidens-tower',
    )!
    const first = maidensObj.position.x
    scale = 2000
    GeoOrigin.setOriginHAE(41.0082, 28.9784, 0)
    expect(maidensObj.position.x).toBeCloseTo(maidens.lon * 2000)
    expect(maidensObj.position.x).not.toBeCloseTo(first)
    handle.dispose()
  })

  it('empty catalogue emits no occupancy disks', async () => {
    const handle = mountPack({
      catalogue: [],
    })
    await handle.ready
    handle.setOpaqueClearSafe(true)
    expect(handle.getOccupancyHoles()).toEqual([])
    expect(handle.root.children).toHaveLength(0)
    handle.dispose()
  })

  it('missing glTF warns and skips that id without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const gltfEntry: LandmarkEntry = {
      ...LANDMARK_CATALOGUE[0]!,
      id: 'missing-hero',
      kind: 'gltf',
      gltfUrl: '/models/landmarks/does-not-exist.glb',
    }
    const handle = createLandmarks({
      gpsToEnuAmsl: mockEnu,
      catalogue: [gltfEntry],
      loadGltf: async (url) => {
        console.warn(`[landmarks] glTF load failed (${url}); skipping that id`)
        return null
      },
    })
    await expect(handle.ready).resolves.toBeUndefined()
    handle.setOpaqueClearSafe(true)
    expect(handle.root.children).toHaveLength(0)
    expect(handle.getOccupancyHoles()).toEqual([])
    expect(warn).toHaveBeenCalled()
    handle.dispose()
  })

  it('logs world-space AABB metres once after a glTF mount', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')!
    const handle = createLandmarks({
      gpsToEnuAmsl: mockEnu,
      catalogue: [maidens],
      loadGltf: stubGltf,
    })
    await handle.ready
    expect(info.mock.calls.some((c) => String(c[0]).includes('maidens-tower AABB'))).toBe(
      true,
    )
    handle.dispose()
  })

  it('loadLandmarkGltf does not throw when the loader errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const group = await loadLandmarkGltf('/missing.glb', () => ({
      load(_url, _onLoad, _onProgress, onError) {
        onError(new Error('404'))
      },
    }))
    expect(group).toBeNull()
    expect(warn).toHaveBeenCalled()
  })
})

describe('hero offset persist', () => {
  afterEach(() => {
    sessionStorage.removeItem(LANDMARKS_OFFSETS_SESSION_KEY)
    localStorage.removeItem(LANDMARKS_OFFSETS_LOCAL_KEY)
  })

  it('merges pack then global then session (tab wins)', () => {
    const merged = mergeLandmarkOffsetLayers(
      { 'maidens-tower': { ...defaultLandmarkPose('maidens-tower'), y: 1 } },
      { 'maidens-tower': { ...defaultLandmarkPose('maidens-tower'), y: 2 }, 'rumeli-hisari': { ...defaultLandmarkPose('rumeli-hisari'), x: -10 } },
      { 'maidens-tower': { ...defaultLandmarkPose('maidens-tower'), y: 9, scale: 12 } },
    )
    expect(merged['maidens-tower']?.y).toBe(9)
    expect(merged['maidens-tower']?.scale).toBe(12)
    expect(merged['rumeli-hisari']?.x).toBe(-10)
  })

  it('persistLandmarkOffsets writes session and localStorage', () => {
    persistLandmarkOffsets({
      'rumeli-hisari': {
        x: -60,
        y: 31,
        z: -4,
        yawDeg: 0,
        pitchDeg: 0,
        rollDeg: 0,
        scale: 1,
      },
    })
    expect(readSessionLandmarkOffsets()['rumeli-hisari']?.x).toBe(-60)
    expect(readGlobalLandmarkOffsets()['rumeli-hisari']?.y).toBe(31)
  })
})

describe('heroes session + gate', () => {
  it('defaults on; session 0 means off', () => {
    expect(DEFAULT_HEROES_ENABLED).toBe(true)
    expect(shouldShowLandmarks(true, true)).toBe(true)
    expect(shouldShowLandmarks(true, false)).toBe(false)
    expect(shouldShowLandmarks(false, true)).toBe(false)
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.removeItem(LANDMARKS_SESSION_ENABLED_KEY)
    expect(readSessionHeroesEnabled()).toBe(true)
    writeSessionHeroesEnabled(false)
    expect(readSessionHeroesEnabled()).toBe(false)
    writeSessionHeroesEnabled(true)
    expect(readSessionHeroesEnabled()).toBe(true)
  })
})

describe('scope lock', () => {
  it('does not pull CesiumJS, Google Photorealistic, IBB, NDI, or STUDIO_TICK_FPS', () => {
    expect(CREATE_SRC).not.toMatch(/CesiumJS/)
    expect(CREATE_SRC).not.toMatch(/Photorealistic/)
    expect(CREATE_SRC).not.toMatch(/\bIBB\b/)
    expect(CREATE_SRC).not.toMatch(/STUDIO_TICK_FPS/)
    expect(CREATE_SRC).not.toMatch(/\bNDI\b/)
    expect(CREATE_SRC).toMatch(/gpsToEnuAmsl/)
    expect(CREATE_SRC).toMatch(/GeoOrigin\.onChanged/)
    expect(CATALOGUE_SRC).not.toMatch(/CesiumJS/)
  })
})

describe('landmarkFocusRadiusM', () => {
  it('caps bridge AABB so Focus does not pull to space', () => {
    const bridge = LANDMARK_CATALOGUE.find((e) => e.id === 'bogazici-bridge')!
    expect(landmarkFocusRadiusM(bridge, 3000)).toBe(LANDMARK_FOCUS_RADIUS_CAP_M)
    const maidens = LANDMARK_CATALOGUE.find((e) => e.id === 'maidens-tower')!
    expect(landmarkFocusRadiusM(maidens, 40)).toBeGreaterThanOrEqual(
      maidens.occupancyRadiusM,
    )
  })
})

describe('SKP glb textures', () => {
  const skpFiles = [
    'galata-tower.glb',
    'hagia-sophia.glb',
    'sultan-ahmed.glb',
    'topkapi.glb',
    'suleymaniye.glb',
    'aya-irini.glb',
    'dolmabahce.glb',
    'ciragan.glb',
    'bogazici-bridge.glb',
    'fsm-bridge.glb',
    'yavuz-selim-bridge.glb',
    'rumeli-hisari.glb',
  ] as const

  it('embeds images after OpenSKP textures=True re-export', () => {
    const dir = resolve(__dirname, '../../../public/models/landmarks')
    for (const name of skpFiles) {
      const path = resolve(dir, name)
      expect(existsSync(path), name).toBe(true)
      const bytes = new Uint8Array(readFileSync(path))
      expect(glbJsonImageCount(bytes), name).toBeGreaterThan(0)
    }
    const maidens = resolve(dir, 'maidens-tower.glb')
    if (existsSync(maidens)) {
      const bytes = new Uint8Array(readFileSync(maidens))
      expect(glbJsonImageCount(bytes)).toBeGreaterThan(0)
    }
  })
})

