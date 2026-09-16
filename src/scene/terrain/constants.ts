/**
 * Cesium ion World Terrain + alignment constants (Phase 14.1).
 *
 * Ocean (sibling 14.2 / 16.1) draws at scene `y ≈ 0` plus a tiny z-fight lift.
 * While realistic ocean is mounted, this module discards Cesium **water**
 * fragments (quantized-mesh water mask, height fallback ~+0.5 m AMSL) so land
 * is the only tileset surface.
 */

/** Ops default — World Terrain on (needs ion token). AR SRT plate still forces off. */
export const DEFAULT_TERRAIN_ENABLED = true

/** Cesium ion Asset Depot: Cesium World Terrain. */
export const CESIUM_ION_WORLD_TERRAIN_ASSET_ID = 1

/**
 * Cesium ion Asset Depot: Bing Maps Aerial (IMAGERY).
 * Draped via `ImageOverlayPlugin` + `CesiumIonOverlay`; not Google Photorealistic.
 * Default Ops map overlay.
 */
export const CESIUM_ION_BING_AERIAL_ASSET_ID = 2

/**
 * Cesium ion Asset Depot: Bing Maps Road (IMAGERY).
 * Cesium preset “World Terrain + Bing Maps Road”. Cartographic streets/labels
 * on quantized-mesh heights. Ops compare overlay. Not Google 2D Map Tiles.
 */
export const CESIUM_ION_BING_ROAD_ASSET_ID = 4

/**
 * `UnloadTilesPlugin.bytesTarget` — GPU budget for uploaded tile meshes/textures.
 * 384 MiB is a conservative studio default (1080p × AR+3D). Tune if hitching.
 */
export const TERRAIN_VRAM_BYTES_TARGET = 384 * 1024 * 1024

/**
 * Cinematic remounts skip UnloadTilesPlugin (fine Aerial must not evict).
 * If unload is re-enabled, use this higher budget instead of 384 MiB.
 */
export const CINEMATIC_TERRAIN_VRAM_BYTES_TARGET = 768 * 1024 * 1024

/** Wait after a tile is hidden before freeing GPU data (ms). */
export const TERRAIN_UNLOAD_DELAY_MS = 1000

/**
 * QuantizedMeshPlugin `useRecommendedSettings` pins `errorTarget = 2` (very
 * fine). The SRT 3D plate is a second WebGL/ion client; at 2 it never fills
 * the frustum (OSM + sea still show). Coarser SSE so land actually appears.
 */
export const SRT_PLATE_TERRAIN_ERROR_TARGET = 8

/**
 * `ReorientationPlugin` places the origin with **X west, Z north**.
 * Our scene is **X east, Z −north**. A 180° yaw about +Y maps:
 *   plugin +X (west) → scene −X (west)
 *   plugin +Z (north) → scene −Z (north)
 * See `reorient.ts` + tests — do not change without updating both.
 */
export const REORIENTATION_AZIMUTH_RAD = Math.PI

export const TERRAIN_STATUS_NO_TOKEN =
  'Terrain: off — no ion token (Ops ion token + Apply, or public/config.json)'

export const TERRAIN_STATUS_OFF = 'Terrain: off'

export const TERRAIN_STATUS_ON = 'Terrain: on · AR-gated'

export const TERRAIN_SESSION_NUDGE_KEY = 'bw.terrain.altitudeNudgeM'
export const TERRAIN_SESSION_LOCK_KEY = 'bw.terrain.tilesLocked'
/**
 * Ops map overlay: Bing Road ion 4 vs Bing Aerial ion 2.
 * Missing session → aerial. Leftover `bw.terrain.imageryLook` is ignored.
 */
export const TERRAIN_SESSION_OVERLAY_KEY = 'bw.terrain.overlay'
export const DEFAULT_TERRAIN_OVERLAY = 'aerial' as const
