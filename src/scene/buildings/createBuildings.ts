/**
 * Mount Cesium OSM Buildings (ion 96188) as a second TilesRenderer.
 * 3D Tiles batched meshes — not quantized-mesh terrain, no Bing drape.
 */

import * as THREE from 'three'
import { TilesRenderer } from '3d-tiles-renderer'
import {
  CesiumIonAuthPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
  TilesFadePlugin,
  UnloadTilesPlugin,
  UpdateOnChangePlugin,
} from '3d-tiles-renderer/plugins'
import * as GeoOrigin from '../../geodesy/geoOrigin.ts'
import { creditsToLines } from '../terrain/attribution.ts'
import {
  describeIonLoadError,
  reorientArgsFromGeoOrigin,
  type TerrainTilesAdapter,
} from '../terrain/createTerrain.ts'
import { REORIENTATION_AZIMUTH_RAD } from '../terrain/constants.ts'
import { shouldShowTerrain } from '../terrain/terrainGate.ts'
import {
  BUILDINGS_ERROR_TARGET,
  BUILDINGS_LOAD_SIBLINGS,
  BUILDINGS_STATUS_NO_TOKEN,
  BUILDINGS_STATUS_OFF,
  BUILDINGS_STATUS_ON,
  BUILDINGS_UNLOAD_DELAY_MS,
  BUILDINGS_VISIBLE_ZERO_LOG_MS,
  BUILDINGS_VRAM_BYTES_TARGET,
  CESIUM_ION_OSM_BUILDINGS_ASSET_ID,
  DEFAULT_BUILDINGS_ENABLED,
} from './constants.ts'
import { installCinematicTileFetchCache } from '../cinematics/tileDiskCache.ts'
import {
  isolateTilesRendererCaches,
  syncTilesRendererCameras,
} from '../terrain/isolateTilesCaches.ts'
import {
  applyOccupancyMeshHide,
  createOccupancyUniforms,
  normalizeOccupancyHoles,
  patchOccupancyMaterials,
  sceneFromLoadModelEvent,
  type OccupancyHole,
  withOsmCreditFallback,
  writeOccupancyUniforms,
} from './occupancy.ts'

export type BuildingsTilesAdapter = TerrainTilesAdapter & {
  loadSiblings?: boolean
  errorTarget?: number
  visibleTiles?: { readonly size: number }
}

export type CreateBuildingsOptions = {
  renderer: THREE.WebGLRenderer
  token: string
  assetId?: number
  /** Test seam — omit in production (constructs a real `TilesRenderer`). */
  tilesFactory?: () => BuildingsTilesAdapter
  /** Skip ion/network plugins (CI stub). Alignment math is still applied. */
  skipIonPlugins?: boolean
  /**
   * Dithered tile fade. Off for cinematic remounts — locking mid-fade
   * leaves a grey stipple over heroes.
   */
  fadeTiles?: boolean
  /**
   * UnloadTilesPlugin. Off while a cinematic is filling so OSM is not evicted.
   */
  unloadTiles?: boolean
}

export type BuildingsHandle = {
  root: THREE.Group
  setEnabled: (enabled: boolean) => void
  getEnabled: () => boolean
  setOpaqueClearSafe: (safe: boolean) => void
  setAltitudeNudgeM: (nudgeM: number) => void
  getAltitudeNudgeM: () => number
  setTilesLocked: (locked: boolean) => void
  getTilesLocked: () => boolean
  setErrorTarget: (value: number) => void
  getErrorTarget: () => number
  isDownloadIdle: () => boolean
  getVisibleTileCount: () => number
  setOccupancyHoles: (holes: readonly OccupancyHole[]) => void
  getOccupancyHoles: () => readonly OccupancyHole[]
  getCredits: () => readonly string[]
  getStatusMessage: () => string
  tick: (
    previewCamera: THREE.Camera,
    airCamera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => void
  dispose: () => void
}

function wrapTilesRenderer(tiles: TilesRenderer): BuildingsTilesAdapter {
  // ADD/REGION globe: do not queue the whole planet's siblings (see constants).
  tiles.loadSiblings = BUILDINGS_LOAD_SIBLINGS
  tiles.errorTarget = BUILDINGS_ERROR_TARGET
  return {
    group: tiles.group,
    registerPlugin: (plugin) => {
      tiles.registerPlugin(plugin)
    },
    setCamera: (camera) => tiles.setCamera(camera),
    deleteCamera: (camera) => tiles.deleteCamera(camera),
    setResolutionFromRenderer: (camera, renderer) =>
      tiles.setResolutionFromRenderer(camera, renderer),
    update: () => {
      tiles.update()
    },
    getAttributions: (target) => tiles.getAttributions(target),
    addEventListener: (name, cb) => {
      tiles.addEventListener(name, cb)
    },
    removeEventListener: (name, cb) => {
      tiles.removeEventListener?.(name, cb)
    },
    dispose: () => {
      tiles.dispose()
    },
    get loadSiblings() {
      return tiles.loadSiblings
    },
    set loadSiblings(value: boolean) {
      tiles.loadSiblings = value
    },
    get errorTarget() {
      return tiles.errorTarget
    },
    set errorTarget(value: number) {
      tiles.errorTarget = value
    },
    get visibleTiles() {
      return tiles.visibleTiles
    },
    get downloadQueue() {
      return tiles.downloadQueue
    },
  }
}

function defaultTilesFactory(): BuildingsTilesAdapter {
  const tiles = new TilesRenderer()
  isolateTilesRendererCaches(tiles)
  return wrapTilesRenderer(tiles)
}

function finiteNudge(nudgeM: number): number {
  return Number.isFinite(nudgeM) ? nudgeM : 0
}

function is3dTilesAssetType(type: string): boolean {
  const t = type.trim().toUpperCase().replace(/[\s_-]/g, '')
  return t === '3DTILES' || t === 'TILES'
}

export function createBuildings(options: CreateBuildingsOptions): BuildingsHandle {
  const token = options.token.trim()
  const assetId =
    options.assetId !== undefined && options.assetId > 0
      ? Math.floor(options.assetId)
      : CESIUM_ION_OSM_BUILDINGS_ASSET_ID

  const root = new THREE.Group()
  root.name = 'cesiumOsmBuildings'

  const tiles = (options.tilesFactory ?? defaultTilesFactory)()
  root.add(tiles.group)
  tiles.loadSiblings = BUILDINGS_LOAD_SIBLINGS
  tiles.errorTarget = BUILDINGS_ERROR_TARGET

  let enabled = DEFAULT_BUILDINGS_ENABLED
  let opaqueClearSafe = false
  let nudgeM = 0
  let tilesLocked = false
  let disposed = false
  let credits: string[] = []
  let statusExtra = ''
  const registeredCameras = new Set<THREE.Camera>()
  let reorient: ReorientationPlugin | null = null
  let occupancyHoles: OccupancyHole[] = []
  const occupancyUniforms = createOccupancyUniforms([])
  let visibleCount = 0
  let rootLoaded = false
  let loggedFirstVisible = false
  let lastZeroLogMs = 0
  let zeroLogCount = 0
  const _sampleBox = new THREE.Box3()

  function occupancyActive(): boolean {
    return normalizeOccupancyHoles(occupancyHoles).length > 0
  }

  function applyNudge(): void {
    root.position.set(0, finiteNudge(nudgeM), 0)
  }

  function applyOccupancy(): void {
    writeOccupancyUniforms(occupancyUniforms, occupancyHoles)
    if (!occupancyActive()) {
      applyOccupancyMeshHide(root, [])
      return
    }
    patchOccupancyMaterials(root, occupancyUniforms)
    applyOccupancyMeshHide(root, occupancyHoles)
  }

  function onLoadModel(event: unknown): void {
    const scene = sceneFromLoadModelEvent(event)
    if (!scene) return
    if (!occupancyActive()) return
    patchOccupancyMaterials(scene, occupancyUniforms)
    applyOccupancyMeshHide(scene, occupancyHoles)
  }

  function applyReorient(): void {
    if (!reorient) return
    const pose = reorientArgsFromGeoOrigin()
    if (!pose) return
    reorient.transformLatLonHeightToOrigin(
      pose.latRad,
      pose.lonRad,
      pose.heightHae,
      pose.azimuthRad,
    )
  }

  function syncVisible(): void {
    root.visible = shouldShowTerrain(enabled, opaqueClearSafe) && token !== ''
  }

  function statusMessage(): string {
    if (token === '') return BUILDINGS_STATUS_NO_TOKEN
    if (!enabled) return BUILDINGS_STATUS_OFF
    if (statusExtra) return `${BUILDINGS_STATUS_ON} · ${statusExtra}`
    return `${BUILDINGS_STATUS_ON} · tiles ${visibleCount}`
  }

  function onLoadError(event: unknown): void {
    const { rootFailed, detail } = describeIonLoadError(event)
    console.warn('[buildings] ion load-error', detail)
    if (!rootFailed) return
    statusExtra = `ion load failed (${detail})`
  }

  function onLoadRoot(): void {
    rootLoaded = true
    console.info(
      '[buildings] load-root',
      `ion ${assetId}`,
      `loadSiblings=${tiles.loadSiblings === false ? 'false' : String(tiles.loadSiblings)}`,
      `errorTarget=${tiles.errorTarget ?? BUILDINGS_ERROR_TARGET}`,
    )
  }

  function logVisibleTiles(n: number): void {
    if (n > 0) {
      if (loggedFirstVisible) return
      loggedFirstVisible = true
      tiles.group.updateMatrixWorld(true)
      _sampleBox.setFromObject(tiles.group)
      if (_sampleBox.isEmpty()) {
        console.info('[buildings] visibleTiles', n)
        return
      }
      const yMin = _sampleBox.min.y
      const yMax = _sampleBox.max.y
      console.info('[buildings] visibleTiles', n, 'worldY', yMin, yMax)
      if (yMax < -50 || Math.abs(yMin) > 10_000 || Math.abs(yMax) > 10_000) {
        console.warn(
          '[buildings] meshes loaded but world Y looks buried or ECEF; vertical datum is GEO — not guessing geoid',
          { yMin, yMax },
        )
      }
      return
    }
    if (!rootLoaded || zeroLogCount >= 4) return
    const now = performance.now()
    if (now - lastZeroLogMs < BUILDINGS_VISIBLE_ZERO_LOG_MS && zeroLogCount > 0) {
      return
    }
    lastZeroLogMs = now
    zeroLogCount += 1
    console.info('[buildings] visibleTiles', 0)
  }

  if (!options.skipIonPlugins && token !== '') {
    tiles.registerPlugin(
      new CesiumIonAuthPlugin({
        apiToken: token,
        assetId: String(assetId),
        autoRefreshToken: true,
        // Override the Three.js default handler that would auto-register
        // quantized-mesh on TERRAIN. OSM Buildings is 3D Tiles only.
        assetTypeHandler: (type) => {
          const raw = String(type ?? '')
          if (is3dTilesAssetType(raw)) return
          if (raw.toUpperCase() === 'TERRAIN') {
            console.warn(
              '[buildings] ion asset type "TERRAIN" unhandled (expected 3DTILES)',
            )
            return
          }
          console.warn(
            `[buildings] ion asset type "${raw}" unhandled (expected 3DTILES)`,
          )
        },
      }),
    )
    tiles.registerPlugin(
      new GLTFExtensionsPlugin({
        rtc: true,
        // Plugin dispose() calls ktx/draco dispose when autoDispose is true.
        autoDispose: false,
      }),
    )
    if (options.fadeTiles !== false) {
      tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 250 }))
    }
    if (options.unloadTiles !== false) {
      tiles.registerPlugin(
        new UnloadTilesPlugin({
          bytesTarget: BUILDINGS_VRAM_BYTES_TARGET,
          delay: BUILDINGS_UNLOAD_DELAY_MS,
        }),
      )
    }
    tiles.registerPlugin(new UpdateOnChangePlugin())

    const origin = reorientArgsFromGeoOrigin()
    reorient = new ReorientationPlugin({
      lat: origin?.latRad ?? null,
      lon: origin?.lonRad ?? null,
      height: origin?.heightHae ?? 0,
      recenter: true,
      azimuth: REORIENTATION_AZIMUTH_RAD,
    })
    tiles.registerPlugin(reorient)

    tiles.addEventListener('load-error', onLoadError)
    tiles.addEventListener('load-root-tileset', onLoadRoot)
  }

  tiles.addEventListener('load-model', onLoadModel)

  let uninstallTileCache: (() => void) | null = null
  if (!options.skipIonPlugins && token !== '') {
    uninstallTileCache = installCinematicTileFetchCache()
  }

  const unsubOrigin = GeoOrigin.onChanged(() => {
    if (disposed) return
    applyReorient()
  })

  applyNudge()
  applyReorient()
  syncVisible()

  return {
    root,
    setEnabled(next: boolean): void {
      if (disposed) return
      enabled = next === true
      syncVisible()
    },
    getEnabled: () => enabled,
    setOpaqueClearSafe(safe: boolean): void {
      if (disposed) return
      opaqueClearSafe = safe === true
      syncVisible()
    },
    setAltitudeNudgeM(next: number): void {
      if (disposed) return
      nudgeM = finiteNudge(next)
      applyNudge()
    },
    getAltitudeNudgeM: () => nudgeM,
    setTilesLocked(locked: boolean): void {
      if (disposed) return
      tilesLocked = locked === true
    },
    getTilesLocked: () => tilesLocked,
    setErrorTarget(value: number): void {
      if (disposed) return
      const next =
        Number.isFinite(value) && value > 0 ? value : BUILDINGS_ERROR_TARGET
      tiles.errorTarget = next
    },
    getErrorTarget: () => tiles.errorTarget ?? BUILDINGS_ERROR_TARGET,
    isDownloadIdle: () => tiles.downloadQueue?.running !== true,
    getVisibleTileCount: () => tiles.visibleTiles?.size ?? 0,
    setOccupancyHoles(holes: readonly OccupancyHole[]): void {
      if (disposed) return
      occupancyHoles = holes.map((h) => ({
        x: h.x,
        z: h.z,
        radiusM: h.radiusM,
      }))
      applyOccupancy()
    },
    getOccupancyHoles: () => occupancyHoles,
    getCredits: () => {
      if (token === '' || !enabled) return credits
      return withOsmCreditFallback(credits)
    },
    getStatusMessage: () => statusMessage(),
    tick(previewCamera, airCamera, renderer): void {
      if (disposed || token === '' || !enabled) return

      syncTilesRendererCameras(
        tiles,
        previewCamera,
        airCamera,
        renderer,
        registeredCameras,
      )

      if (!tilesLocked) {
        tiles.update()
      }

      visibleCount = tiles.visibleTiles?.size ?? 0
      logVisibleTiles(visibleCount)

      const raw = tiles.getAttributions([])
      credits = creditsToLines(raw)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      uninstallTileCache?.()
      uninstallTileCache = null
      unsubOrigin()
      tiles.removeEventListener?.('load-model', onLoadModel)
      tiles.removeEventListener?.('load-error', onLoadError)
      tiles.removeEventListener?.('load-root-tileset', onLoadRoot)
      tiles.dispose()
      root.clear()
      reorient = null
      credits = []
      occupancyHoles = []
    },
  }
}
