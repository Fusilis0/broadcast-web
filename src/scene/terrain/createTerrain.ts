/**
 * Mount Cesium ion World Terrain into the Three.js scene via 3d-tiles-renderer.
 * Not CesiumJS — tiles are ordinary meshes under our renderer/camera.
 */

import * as THREE from 'three'
import { TilesRenderer } from '3d-tiles-renderer'
import {
  CesiumIonAuthPlugin,
  CesiumIonOverlay,
  ImageOverlayPlugin,
  QuantizedMeshPlugin,
  ReorientationPlugin,
  TilesFadePlugin,
  UnloadTilesPlugin,
  UpdateOnChangePlugin,
} from '3d-tiles-renderer/plugins'
import * as GeoOrigin from '../../geodesy/geoOrigin.ts'
import { creditsToLines } from './attribution.ts'
import {
  CESIUM_ION_BING_AERIAL_ASSET_ID,
  CESIUM_ION_BING_ROAD_ASSET_ID,
  CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
  DEFAULT_TERRAIN_OVERLAY,
  REORIENTATION_AZIMUTH_RAD,
  TERRAIN_STATUS_NO_TOKEN,
  TERRAIN_STATUS_OFF,
  TERRAIN_STATUS_ON,
  TERRAIN_UNLOAD_DELAY_MS,
  TERRAIN_VRAM_BYTES_TARGET,
} from './constants.ts'
import { overlayKindFromImageryAssetId, overlayToImageryAssetId } from './terrainOverlay.ts'
import { shouldShowTerrain } from './terrainGate.ts'
import {
  DEFAULT_TERRAIN_WATER_DISCARD_Y,
  createTerrainWaterUniforms,
  patchTerrainWaterMaterials,
  sceneFromLoadModelEvent,
} from './terrainWaterMask.ts'
import { installCinematicTileFetchCache } from '../cinematics/tileDiskCache.ts'
import {
  isolateTilesRendererCaches,
  syncTilesRendererCameras,
} from './isolateTilesCaches.ts'

export type TerrainAttribution = { type: string; value: unknown }

export type TerrainTilesAdapter = {
  group: THREE.Object3D
  registerPlugin: (plugin: object) => void
  setCamera: (camera: THREE.Camera) => boolean
  deleteCamera: (camera: THREE.Camera) => boolean
  setResolutionFromRenderer: (
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => boolean
  update: () => void
  getAttributions: (target?: TerrainAttribution[]) => TerrainAttribution[]
  addEventListener: (name: string, cb: (event: unknown) => void) => void
  removeEventListener?: (name: string, cb: (event: unknown) => void) => void
  dispose: () => void
  errorTarget?: number
  downloadQueue?: { readonly running: boolean }
  visibleTiles?: { readonly size: number }
}

export type CreateTerrainOptions = {
  renderer: THREE.WebGLRenderer
  token: string
  assetId?: number
  imageryAssetId?: number
  /** Test seam — omit in production (constructs a real `TilesRenderer`). */
  tilesFactory?: () => TerrainTilesAdapter
  /** Skip ion/network plugins (CI stub). Alignment math is still applied. */
  skipIonPlugins?: boolean
  /**
   * ENU race tangent (default). `false` = cinematic globe: World Terrain stays
   * in ECEF — **no** `ReorientationPlugin`. Never mount both frames at once.
   */
  reorient?: boolean
  /**
   * Dithered tile fade. Off for cinematic remounts — locking mid-fade leaves
   * a grey stipple over the peninsula.
   */
  fadeTiles?: boolean
  /**
   * UnloadTilesPlugin. Off while a cinematic is filling so fine Aerial is not
   * evicted down to mush.
   */
  unloadTiles?: boolean
  /**
   * GPU budget when `unloadTiles` is on. Cinematic remounts pass the higher
   * cinematic target in case unload is re-enabled.
   */
  vramBytesTarget?: number
  /**
   * Pin `TilesRenderer.errorTarget` after QuantizedMeshPlugin registers
   * (`useRecommendedSettings` otherwise overwrites it to 2).
   */
  errorTarget?: number
  /**
   * Road overlay (ion 4) failed — parent may remount with Aerial 2.
   * Not called for World Terrain root 401s.
   */
  onImageryRejected?: (fromAssetId: number) => void
}

/** Globe cinematic tiles skip the ENU ReorientationPlugin. */
export function shouldRegisterReorientation(reorient?: boolean): boolean {
  return reorient !== false
}

export type TerrainHandle = {
  root: THREE.Group
  setEnabled: (enabled: boolean) => void
  getEnabled: () => boolean
  setOpaqueClearSafe: (safe: boolean) => void
  setAltitudeNudgeM: (nudgeM: number) => void
  getAltitudeNudgeM: () => number
  /**
   * Discard Cesium water fragments while the realistic ocean is mounted.
   * `simple` env / unmounted ocean leave terrain untouched.
   */
  setHideWater: (hide: boolean) => void
  getHideWater: () => boolean
  /** World-Y AMSL threshold for the no-mask height fallback (default +0.5 m). */
  setWaterDiscardYM: (yM: number) => void
  getWaterDiscardYM: () => number
  setTilesLocked: (locked: boolean) => void
  getTilesLocked: () => boolean
  setErrorTarget: (value: number) => void
  getErrorTarget: () => number
  isDownloadIdle: () => boolean
  getVisibleTileCount: () => number
  getCredits: () => readonly string[]
  getStatusMessage: () => string
  getImageryOverlayActive: () => boolean
  /** ion imagery overlay actually registered (4, 2 after fallback, or 0). */
  getImageryAssetId: () => number
  /**
   * Register preview + air cameras and advance LOD unless lock-tiles is on.
   * Call every scene tick while the instance exists.
   */
  tick: (
    previewCamera: THREE.Camera,
    airCamera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => void
  dispose: () => void
}

function wrapTilesRenderer(tiles: TilesRenderer): TerrainTilesAdapter {
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
    get errorTarget() {
      return tiles.errorTarget
    },
    set errorTarget(value: number) {
      tiles.errorTarget = value
    },
    get downloadQueue() {
      return tiles.downloadQueue
    },
    get visibleTiles() {
      return tiles.visibleTiles
    },
  }
}

function defaultTilesFactory(): TerrainTilesAdapter {
  const tiles = new TilesRenderer()
  isolateTilesRendererCaches(tiles)
  return wrapTilesRenderer(tiles)
}

function finiteNudge(nudgeM: number): number {
  return Number.isFinite(nudgeM) ? nudgeM : 0
}

const ION_ERROR_DETAIL_MAX = 120

/**
 * Root tileset failures (`tile == null`) are operator-visible.
 * Per-tile 404s are logged only — World Terrain often misses a skirt tile
 * without the whole mount being dead.
 */
export function describeIonLoadError(event: unknown): {
  rootFailed: boolean
  detail: string
} {
  const rec =
    event && typeof event === 'object'
      ? (event as { error?: unknown; tile?: unknown })
      : null
  const err = rec?.error ?? event
  let detail = 'check token / network'
  if (err instanceof Error && err.message.trim() !== '') {
    detail = err.message.trim()
  } else if (typeof err === 'string' && err.trim() !== '') {
    detail = err.trim()
  }
  if (detail.length > ION_ERROR_DETAIL_MAX) {
    detail = `${detail.slice(0, ION_ERROR_DETAIL_MAX)}…`
  }
  return { rootFailed: rec == null || rec.tile == null, detail }
}

/**
 * Reorient from the live GeoOrigin. Height is `GeoOrigin.altitudeHAE`, which
 * is `amslToHae(lat, lon, altMsl)` after `setOriginAMSL` / `applyConfigOrigin`.
 */
export function reorientArgsFromGeoOrigin(): {
  latRad: number
  lonRad: number
  heightHae: number
  azimuthRad: number
} | null {
  if (!GeoOrigin.isValid) return null
  return {
    latRad: (GeoOrigin.latitudeDeg * Math.PI) / 180,
    lonRad: (GeoOrigin.longitudeDeg * Math.PI) / 180,
    heightHae: GeoOrigin.altitudeHAE,
    azimuthRad: REORIENTATION_AZIMUTH_RAD,
  }
}

export function createTerrain(options: CreateTerrainOptions): TerrainHandle {
  const token = options.token.trim()
  const assetId =
    options.assetId !== undefined && options.assetId > 0
      ? Math.floor(options.assetId)
      : CESIUM_ION_WORLD_TERRAIN_ASSET_ID
  const imageryAssetIdRequested =
    options.imageryAssetId !== undefined
      ? Math.floor(options.imageryAssetId)
      : overlayToImageryAssetId(DEFAULT_TERRAIN_OVERLAY)
  let imageryAssetIdUsed = imageryAssetIdRequested


  const root = new THREE.Group()
  root.name = 'cesiumTerrain'

  const tiles = (options.tilesFactory ?? defaultTilesFactory)()
  root.add(tiles.group)

  let enabled = false
  let opaqueClearSafe = false
  let nudgeM = 0
  let hideWater = false
  let waterDiscardYM = DEFAULT_TERRAIN_WATER_DISCARD_Y
  const waterUniforms = createTerrainWaterUniforms(false, waterDiscardYM)
  let tilesLocked = false
  let disposed = false
  let credits: string[] = []
  let imageryOverlayActive = false
  let overlayFallbackArmed =
    imageryAssetIdRequested === CESIUM_ION_BING_ROAD_ASSET_ID
  let statusExtra = ''
  const registeredCameras = new Set<THREE.Camera>()
  let reorient: ReorientationPlugin | null = null
  let pinnedErrorTarget =
    Number.isFinite(options.errorTarget) && (options.errorTarget as number) > 0
      ? Number(options.errorTarget)
      : null

  function applyPinnedErrorTarget(): void {
    if (pinnedErrorTarget == null) return
    tiles.errorTarget = pinnedErrorTarget
  }

  function applyNudge(): void {
    root.position.set(0, finiteNudge(nudgeM), 0)
    syncWaterDiscardY()
  }

  function syncWaterDiscardY(): void {
    waterUniforms.uTerrainWaterY.value = waterDiscardYM + finiteNudge(nudgeM)
  }

  function applyHideWater(): void {
    waterUniforms.uHideTerrainWater.value = hideWater ? 1 : 0
    patchTerrainWaterMaterials(root, waterUniforms)
  }

  function onLoadModel(event: unknown): void {
    const scene = sceneFromLoadModelEvent(event)
    if (!scene) return
    patchTerrainWaterMaterials(scene, waterUniforms)
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
    if (token === '') return TERRAIN_STATUS_NO_TOKEN
    if (!enabled) return TERRAIN_STATUS_OFF
    const overlayBit = overlayKindFromImageryAssetId(imageryAssetIdUsed)
    const tileBit = `tiles ${tiles.visibleTiles?.size ?? 0}`
    if (statusExtra) {
      return `${TERRAIN_STATUS_ON} · ${overlayBit} · ${statusExtra} · ${tileBit}`
    }
    return `${TERRAIN_STATUS_ON} · ${overlayBit} · ${tileBit}`
  }

  function isOverlayAuthFailure(detail: string): boolean {
    const d = detail.toLowerCase()
    if (
      !d.includes('401') &&
      !d.includes('unauthorized') &&
      !d.includes('not imagery') &&
      !d.includes('unhandled')
    ) {
      return false
    }
    return (
      d.includes('overlay') ||
      d.includes('imagery') ||
      d.includes(String(CESIUM_ION_BING_ROAD_ASSET_ID))
    )
  }

  function markRoadOverlayFailed(detail: string): void {
    overlayFallbackArmed = false
    console.warn(
      `[terrain] Bing Road overlay (ion ${CESIUM_ION_BING_ROAD_ASSET_ID}) failed; falling back to Aerial ${CESIUM_ION_BING_AERIAL_ASSET_ID}`,
      detail,
    )
    statusExtra = `road overlay failed; using aerial ${CESIUM_ION_BING_AERIAL_ASSET_ID}`
  }

  function onLoadError(event: unknown): void {
    const { rootFailed, detail } = describeIonLoadError(event)
    console.warn('[terrain] ion load-error', detail)
    if (rootFailed) {
      statusExtra = `ion load failed (${detail})`
      return
    }
    if (!overlayFallbackArmed || !isOverlayAuthFailure(detail)) return
    markRoadOverlayFailed(detail)
    options.onImageryRejected?.(CESIUM_ION_BING_ROAD_ASSET_ID)
  }

  if (!options.skipIonPlugins && token !== '') {
    // Do not register QuantizedMeshPlugin up front. It has priority -1000, so
    // TilesRenderer would call its loadRootTileset *before* ion auth, parse the
    // endpoint JSON as layer.json, and throw `available.length` (null).
    // Register it from assetTypeHandler after rootURL is the terrain CDN.
    tiles.registerPlugin(
      new CesiumIonAuthPlugin({
        apiToken: token,
        assetId: String(assetId),
        autoRefreshToken: true,
        assetTypeHandler: (type, renderer) => {
          if (type !== 'TERRAIN') {
            console.warn(
              `[terrain] ion asset type "${type}" unhandled (expected TERRAIN)`,
            )
            return
          }
          const hasMesh =
            typeof renderer.getPluginByName === 'function' &&
            renderer.getPluginByName('QUANTIZED_MESH_PLUGIN') != null
          if (hasMesh) return
          renderer.registerPlugin(
            new QuantizedMeshPlugin({
              useRecommendedSettings: true,
              smoothSkirtNormals: true,
            }),
          )
          applyPinnedErrorTarget()
        },
      }),
    )
    if (options.fadeTiles !== false) {
      tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 250 }))
    }
    if (options.unloadTiles !== false) {
      tiles.registerPlugin(
        new UnloadTilesPlugin({
          bytesTarget:
            options.vramBytesTarget ?? TERRAIN_VRAM_BYTES_TARGET,
          delay: TERRAIN_UNLOAD_DELAY_MS,
        }),
      )
    }
    tiles.registerPlugin(new UpdateOnChangePlugin())

    if (shouldRegisterReorientation(options.reorient)) {
      const origin = reorientArgsFromGeoOrigin()
      reorient = new ReorientationPlugin({
        lat: origin?.latRad ?? null,
        lon: origin?.lonRad ?? null,
        height: origin?.heightHae ?? 0,
        recenter: true,
        azimuth: REORIENTATION_AZIMUTH_RAD,
      })
      tiles.registerPlugin(reorient)
    }

    if (imageryAssetIdRequested > 0) {
      const tryOverlay = (assetId: number): boolean => {
        try {
          const overlay = new CesiumIonOverlay({
            apiToken: token,
            assetId,
            autoRefreshToken: true,
          })
          tiles.registerPlugin(
            new ImageOverlayPlugin({
              overlays: [overlay],
              renderer: options.renderer,
            }),
          )
          imageryOverlayActive = true
          imageryAssetIdUsed = assetId
          return true
        } catch (err) {
          imageryOverlayActive = false
          const msg = err instanceof Error ? err.message : String(err)
          console.warn('[terrain] imagery overlay skipped', msg)
          statusExtra = `bare terrain (imagery overlay failed; Bing asset ${assetId})`
          return false
        }
      }

      if (!tryOverlay(imageryAssetIdRequested)) {
        if (imageryAssetIdRequested === CESIUM_ION_BING_ROAD_ASSET_ID) {
          markRoadOverlayFailed(
            statusExtra || 'imagery overlay constructor failed',
          )
          if (tryOverlay(CESIUM_ION_BING_AERIAL_ASSET_ID)) {
            statusExtra = `road overlay failed; using aerial ${CESIUM_ION_BING_AERIAL_ASSET_ID}`
          }
        }
      }
    }

    tiles.addEventListener('load-error', onLoadError)
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
    setHideWater(hide: boolean): void {
      if (disposed) return
      hideWater = hide === true
      applyHideWater()
    },
    getHideWater: () => hideWater,
    setWaterDiscardYM(yM: number): void {
      if (disposed) return
      waterDiscardYM = Number.isFinite(yM) ? yM : DEFAULT_TERRAIN_WATER_DISCARD_Y
      syncWaterDiscardY()
    },
    getWaterDiscardYM: () => waterDiscardYM,
    setTilesLocked(locked: boolean): void {
      if (disposed) return
      tilesLocked = locked === true
    },
    getTilesLocked: () => tilesLocked,
    setErrorTarget(value: number): void {
      if (disposed) return
      const next = Number.isFinite(value) && value > 0 ? value : 16
      if (pinnedErrorTarget != null) pinnedErrorTarget = next
      tiles.errorTarget = next
    },
    getErrorTarget: () => tiles.errorTarget ?? 16,
    isDownloadIdle: () => tiles.downloadQueue?.running !== true,
    getVisibleTileCount: () => tiles.visibleTiles?.size ?? 0,
    getCredits: () => credits,
    getStatusMessage: () => statusMessage(),
    getImageryOverlayActive: () => imageryOverlayActive,
    getImageryAssetId: () => imageryAssetIdUsed,
    tick(previewCamera, airCamera, renderer): void {
      if (disposed || token === '' || !enabled) return

      syncTilesRendererCameras(
        tiles,
        previewCamera,
        airCamera,
        renderer,
        registeredCameras,
      )

      applyPinnedErrorTarget()
      if (!tilesLocked) {
        tiles.update()
      }

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
      tiles.dispose()
      root.clear()
      reorient = null
      credits = []
    },
  }
}
