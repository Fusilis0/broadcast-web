/**
 * World Terrain imagery overlay: Bing Maps Road (ion 4) vs Bing Aerial (ion 2).
 * Overlay switch remounts the terrain tileset — not a Rec.709 grey filter.
 */

import {
  CESIUM_ION_BING_AERIAL_ASSET_ID,
  CESIUM_ION_BING_ROAD_ASSET_ID,
  DEFAULT_TERRAIN_OVERLAY,
  TERRAIN_SESSION_OVERLAY_KEY,
} from './constants.ts'

export type TerrainOverlayKind = 'road' | 'aerial'

export function isTerrainOverlayKind(
  value: unknown,
): value is TerrainOverlayKind {
  return value === 'road' || value === 'aerial'
}

export function normalizeTerrainOverlay(
  value: unknown,
): TerrainOverlayKind {
  return isTerrainOverlayKind(value) ? value : DEFAULT_TERRAIN_OVERLAY
}

export function overlayToImageryAssetId(kind: TerrainOverlayKind): number {
  return kind === 'aerial'
    ? CESIUM_ION_BING_AERIAL_ASSET_ID
    : CESIUM_ION_BING_ROAD_ASSET_ID
}

export function overlayKindFromImageryAssetId(id: number): TerrainOverlayKind {
  return id === CESIUM_ION_BING_AERIAL_ASSET_ID ? 'aerial' : 'road'
}

export function readSessionTerrainOverlay(
  fallback: TerrainOverlayKind = DEFAULT_TERRAIN_OVERLAY,
): TerrainOverlayKind {
  try {
    const raw = sessionStorage.getItem(TERRAIN_SESSION_OVERLAY_KEY)
    if (raw == null || raw === '') return fallback
    return normalizeTerrainOverlay(raw)
  } catch {
    return fallback
  }
}

export function writeSessionTerrainOverlay(kind: TerrainOverlayKind): void {
  try {
    sessionStorage.setItem(TERRAIN_SESSION_OVERLAY_KEY, kind)
  } catch {
    // sessionStorage may be blocked
  }
}
