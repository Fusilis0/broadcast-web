/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  CESIUM_ION_BING_AERIAL_ASSET_ID,
  CESIUM_ION_BING_ROAD_ASSET_ID,
  DEFAULT_TERRAIN_OVERLAY,
  TERRAIN_SESSION_OVERLAY_KEY,
} from './constants.ts'
import {
  isTerrainOverlayKind,
  normalizeTerrainOverlay,
  overlayKindFromImageryAssetId,
  overlayToImageryAssetId,
  readSessionTerrainOverlay,
  writeSessionTerrainOverlay,
} from './terrainOverlay.ts'

afterEach(() => {
  sessionStorage.removeItem(TERRAIN_SESSION_OVERLAY_KEY)
  sessionStorage.removeItem('bw.terrain.imageryLook')
})

describe('terrain overlay', () => {
  it('defaults to aerial (Bing Aerial ion 2); road stays 4', () => {
    expect(DEFAULT_TERRAIN_OVERLAY).toBe('aerial')
    expect(CESIUM_ION_BING_ROAD_ASSET_ID).toBe(4)
    expect(CESIUM_ION_BING_AERIAL_ASSET_ID).toBe(2)
    expect(normalizeTerrainOverlay(undefined)).toBe('aerial')
    expect(normalizeTerrainOverlay('')).toBe('aerial')
    expect(normalizeTerrainOverlay('grey')).toBe('aerial')
    expect(normalizeTerrainOverlay('color')).toBe('aerial')
    expect(isTerrainOverlayKind('road')).toBe(true)
    expect(isTerrainOverlayKind('aerial')).toBe(true)
    expect(isTerrainOverlayKind('grey')).toBe(false)
  })

  it('maps road → overlay 4 and aerial → overlay 2', () => {
    expect(overlayToImageryAssetId('road')).toBe(4)
    expect(overlayToImageryAssetId('aerial')).toBe(2)
    expect(overlayKindFromImageryAssetId(4)).toBe('road')
    expect(overlayKindFromImageryAssetId(2)).toBe('aerial')
  })

  it('reads missing session as aerial and ignores leftover imageryLook', () => {
    expect(readSessionTerrainOverlay()).toBe('aerial')
    sessionStorage.setItem('bw.terrain.imageryLook', 'color')
    expect(readSessionTerrainOverlay()).toBe('aerial')
    writeSessionTerrainOverlay('aerial')
    expect(sessionStorage.getItem(TERRAIN_SESSION_OVERLAY_KEY)).toBe('aerial')
    expect(readSessionTerrainOverlay()).toBe('aerial')
    writeSessionTerrainOverlay('road')
    expect(readSessionTerrainOverlay()).toBe('road')
  })
})
