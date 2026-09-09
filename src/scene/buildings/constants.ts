/**
 * Cesium OSM Buildings (Phase 20.1a) — batched 3D Tiles, not terrain.
 * Same ion token / ReorientationPlugin origin as World Terrain.
 */

/** Ops default — buildings on until the operator unchecks. */
export const DEFAULT_BUILDINGS_ENABLED = true

/** Cesium ion Asset Depot: Cesium OSM Buildings (batched 3D Tiles). */
export const CESIUM_ION_OSM_BUILDINGS_ASSET_ID = 96188

/**
 * `UnloadTilesPlugin.bytesTarget` for the buildings tileset only.
 * Separate from World Terrain's 384 MiB budget.
 */
export const BUILDINGS_VRAM_BYTES_TARGET = 256 * 1024 * 1024

/** Wait after a tile is hidden before freeing GPU data (ms). */
export const BUILDINGS_UNLOAD_DELAY_MS = 1000

/**
 * Cesium OSM Buildings is a planet-sized tileset with **ADD** refinement and
 * REGION bounds. Default `loadSiblings = true` queues siblings across the
 * globe and can leave `visibleTiles` empty (NASA-AMMOS/3DTilesRendererJS#662,
 * #663). Buildings renderer only — do not copy onto World Terrain.
 */
export const BUILDINGS_LOAD_SIBLINGS = false

/**
 * Screen-space error target for OSM Buildings. Library default is already 16
 * (Cesium-like). Named so we do not inherit QuantizedMeshPlugin's `errorTarget = 2`.
 * See ADD/REGION notes on `BUILDINGS_LOAD_SIBLINGS`.
 */
export const BUILDINGS_ERROR_TARGET = 16

/** How often to log `visibleTiles.size === 0` after root load (ms). */
export const BUILDINGS_VISIBLE_ZERO_LOG_MS = 5000

export const BUILDINGS_STATUS_NO_TOKEN =
  'Buildings: off — no ion token (Ops ion token + Apply, or public/config.json)'

export const BUILDINGS_STATUS_OFF = 'Buildings: off'

export const BUILDINGS_STATUS_ON = 'Buildings: on'

/** sessionStorage: missing → on; `'0'` → off. */
export const BUILDINGS_SESSION_ENABLED_KEY = 'bw.buildings.enabled'

/** ODbL fallback when ion attribution omits OpenStreetMap. */
export const OSM_BUILDINGS_CREDIT_FALLBACK = '© OpenStreetMap contributors'

/** Max occupancy disks (hero clip). Extra holes are ignored. */
export const MAX_OCCUPANCY_HOLES = 8
