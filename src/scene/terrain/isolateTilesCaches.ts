/**
 * 3d-tiles-renderer shares one LRU + download/parse/node queue across every
 * TilesRenderer by default. Terrain, OSM Buildings, and cinematic remounts
 * then starve each other — race 3D ends up with a handful of visible tiles.
 * Assign unique caches **before** the first `update()`.
 */

import type { Camera, WebGLRenderer } from 'three'
import {
  DEFAULT_LRU_CACHE,
  LRUCache,
  PriorityQueue,
  type TilesRenderer,
  unifiedPriorityCallback,
} from '3d-tiles-renderer'

export const TILES_DOWNLOAD_MAX_JOBS = 25
export const TILES_PARSE_MAX_JOBS = 5
export const TILES_NODE_MAX_JOBS = 25

export type TilesCameraHost = {
  setCamera: (camera: Camera) => boolean
  deleteCamera: (camera: Camera) => boolean
  setResolutionFromRenderer: (
    camera: Camera,
    renderer: WebGLRenderer,
  ) => boolean
}

/**
 * Own LRU + queues on this tileset. Must run before `tiles.update()`.
 */
export function isolateTilesRendererCaches(tiles: TilesRenderer): void {
  const lru = new LRUCache()
  lru.unloadPriorityCallback = DEFAULT_LRU_CACHE.unloadPriorityCallback
  tiles.lruCache = lru

  const download = new PriorityQueue()
  download.maxJobs = TILES_DOWNLOAD_MAX_JOBS
  download.priorityCallback = unifiedPriorityCallback
  tiles.downloadQueue = download

  const parse = new PriorityQueue()
  parse.maxJobs = TILES_PARSE_MAX_JOBS
  parse.priorityCallback = unifiedPriorityCallback
  tiles.parseQueue = parse

  const nodes = new PriorityQueue()
  nodes.maxJobs = TILES_NODE_MAX_JOBS
  tiles.processNodeQueue = nodes
}

/**
 * Keep only the cameras this tick wants. A parked drone at the origin used to
 * stay registered forever and pin SSE to a few origin tiles.
 */
export function syncTilesRendererCameras(
  tiles: TilesCameraHost,
  preview: Camera,
  air: Camera,
  renderer: WebGLRenderer,
  registered: Set<Camera>,
): void {
  const wanted = new Set<Camera>([preview])
  if (air !== preview) wanted.add(air)

  for (const camera of [...registered]) {
    if (wanted.has(camera)) continue
    tiles.deleteCamera(camera)
    registered.delete(camera)
  }

  for (const camera of wanted) {
    tiles.setCamera(camera)
    tiles.setResolutionFromRenderer(camera, renderer)
    registered.add(camera)
  }
}
