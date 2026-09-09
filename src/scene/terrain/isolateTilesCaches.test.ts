import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_DOWNLOAD_QUEUE,
  DEFAULT_LRU_CACHE,
  DEFAULT_PARSE_QUEUE,
  TilesRenderer,
} from '3d-tiles-renderer'
import {
  isolateTilesRendererCaches,
  syncTilesRendererCameras,
  TILES_DOWNLOAD_MAX_JOBS,
  TILES_PARSE_MAX_JOBS,
} from './isolateTilesCaches.ts'

afterEach(() => {
  // TilesRenderer.dispose is unused here; nothing to leak.
})

describe('isolateTilesRendererCaches', () => {
  it('gives each tileset its own LRU and queues', () => {
    const tiles = new TilesRenderer()
    expect(tiles.lruCache).toBe(DEFAULT_LRU_CACHE)
    expect(tiles.downloadQueue).toBe(DEFAULT_DOWNLOAD_QUEUE)
    isolateTilesRendererCaches(tiles)
    expect(tiles.lruCache).not.toBe(DEFAULT_LRU_CACHE)
    expect(tiles.downloadQueue).not.toBe(DEFAULT_DOWNLOAD_QUEUE)
    expect(tiles.parseQueue).not.toBe(DEFAULT_PARSE_QUEUE)
    expect(tiles.downloadQueue.maxJobs).toBe(TILES_DOWNLOAD_MAX_JOBS)
    expect(tiles.parseQueue.maxJobs).toBe(TILES_PARSE_MAX_JOBS)
    const other = new TilesRenderer()
    isolateTilesRendererCaches(other)
    expect(other.lruCache).not.toBe(tiles.lruCache)
    expect(other.downloadQueue).not.toBe(tiles.downloadQueue)
  })
})

describe('syncTilesRendererCameras', () => {
  it('drops a parked air camera when race view uses preview only', () => {
    const preview = new THREE.PerspectiveCamera()
    const air = new THREE.PerspectiveCamera()
    const set: THREE.Camera[] = []
    const deleted: THREE.Camera[] = []
    const tiles = {
      setCamera(camera: THREE.Camera) {
        set.push(camera)
        return true
      },
      deleteCamera(camera: THREE.Camera) {
        deleted.push(camera)
        return true
      },
      setResolutionFromRenderer() {
        return true
      },
    }
    const registered = new Set<THREE.Camera>()
    const renderer = {} as THREE.WebGLRenderer
    syncTilesRendererCameras(tiles, preview, air, renderer, registered)
    expect(registered.has(preview)).toBe(true)
    expect(registered.has(air)).toBe(true)
    syncTilesRendererCameras(tiles, preview, preview, renderer, registered)
    expect(deleted).toContain(air)
    expect(registered.has(air)).toBe(false)
    expect(registered.has(preview)).toBe(true)
  })
})
