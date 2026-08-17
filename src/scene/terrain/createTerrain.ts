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
  let tilesLocked = false
  let disposed = false
  let credits: string[] = []
  let imageryOverlayActive = false
  let statusExtra = ''
  let lastPreview: THREE.Camera | null = null
  let reorient: ReorientationPlugin | null = null

  function applyNudge(): void {
    root.position.set(0, finiteNudge(nudgeM), 0)
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
    const err =
      event && typeof event === 'object' && 'error' in event
        ? (event as { error: unknown }).error
        : event
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[terrain] ion load-error', msg)
    statusExtra = 'ion load failed (check token / network)'
  }

  if (!options.skipIonPlugins && token !== '') {
    tiles.registerPlugin(
      new QuantizedMeshPlugin({
        // JS default is generateNormals: true (missing from 0.5.1 .d.ts).
        useRecommendedSettings: true,
        smoothSkirtNormals: true,
      }),
    )
    tiles.registerPlugin(
      new CesiumIonAuthPlugin({
        apiToken: token,
        assetId: String(assetId),
        autoRefreshToken: true,
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
      tiles.dispose()
      root.clear()
      reorient = null
      credits = []
    },
  }
}
