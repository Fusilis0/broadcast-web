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
  CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
  REORIENTATION_AZIMUTH_RAD,
  TERRAIN_STATUS_NO_TOKEN,
  TERRAIN_STATUS_OFF,
  TERRAIN_STATUS_ON,
  TERRAIN_UNLOAD_DELAY_MS,
  TERRAIN_VRAM_BYTES_TARGET,
} from './constants.ts'
import { shouldShowTerrain } from './terrainGate.ts'
import {
  DEFAULT_TERRAIN_WATER_DISCARD_Y,
  createTerrainWaterUniforms,
  patchTerrainWaterMaterials,
  sceneFromLoadModelEvent,
} from './terrainWaterMask.ts'

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
  getCredits: () => readonly string[]
  getStatusMessage: () => string
  getImageryOverlayActive: () => boolean
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
  }
}

function defaultTilesFactory(): TerrainTilesAdapter {
  return wrapTilesRenderer(new TilesRenderer())
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
  const imageryAssetId =
    options.imageryAssetId !== undefined
      ? Math.floor(options.imageryAssetId)
      : CESIUM_ION_BING_AERIAL_ASSET_ID

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
  let statusExtra = ''
  let lastPreview: THREE.Camera | null = null
  let reorient: ReorientationPlugin | null = null

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
    if (statusExtra) return `${TERRAIN_STATUS_ON} · ${statusExtra}`
    return TERRAIN_STATUS_ON
  }

  function onLoadError(event: unknown): void {
    const { rootFailed, detail } = describeIonLoadError(event)
    console.warn('[terrain] ion load-error', detail)
    if (!rootFailed) return
    statusExtra = `ion load failed (${detail})`
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
        },
      }),
    )
    tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 250 }))
    tiles.registerPlugin(
      new UnloadTilesPlugin({
        bytesTarget: TERRAIN_VRAM_BYTES_TARGET,
        delay: TERRAIN_UNLOAD_DELAY_MS,
      }),
    )
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

    if (imageryAssetId > 0) {
      try {
        const overlay = new CesiumIonOverlay({
          apiToken: token,
          assetId: imageryAssetId,
          autoRefreshToken: true,
        })
        tiles.registerPlugin(
          new ImageOverlayPlugin({
            overlays: [overlay],
            renderer: options.renderer,
          }),
        )
        imageryOverlayActive = true
      } catch (err) {
        imageryOverlayActive = false
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[terrain] imagery overlay skipped', msg)
        statusExtra = `bare terrain (imagery overlay failed; Bing asset ${imageryAssetId})`
      }
    }

    tiles.addEventListener('load-error', onLoadError)
  }

  tiles.addEventListener('load-model', onLoadModel)

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
    getCredits: () => credits,
    getStatusMessage: () => statusMessage(),
    getImageryOverlayActive: () => imageryOverlayActive,
    tick(previewCamera, airCamera, renderer): void {
      if (disposed || token === '' || !enabled) return

      if (lastPreview && lastPreview !== previewCamera && lastPreview !== airCamera) {
        tiles.deleteCamera(lastPreview)
      }
      lastPreview = previewCamera

      tiles.setCamera(previewCamera)
      tiles.setResolutionFromRenderer(previewCamera, renderer)
      if (airCamera !== previewCamera) {
        tiles.setCamera(airCamera)
        tiles.setResolutionFromRenderer(airCamera, renderer)
      }

      if (!tilesLocked) {
        tiles.update()
      }

      const raw = tiles.getAttributions([])
      credits = creditsToLines(raw)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      unsubOrigin()
      tiles.removeEventListener?.('load-model', onLoadModel)
      tiles.dispose()
      root.clear()
      reorient = null
      credits = []
    },
  }
}
