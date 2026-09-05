import { createMap2d, type Map2dHandle, type Map2dOptions } from './map2d.ts'

/**
 * Stream-map source canvas is 16:9 **1920×1080** (same studio lock as AR/3D).
 * `letterboxRect(1920, 1080, 1920, 1080)` is identity. Phase 19.2b /
 * DSP-SCN-20260905-01 (overrides the 19.2 520–960 / 960×540 store).
 */
export const STREAM_MAP_HEIGHT_PX = 1080
export const STREAM_MAP_WIDTH_PX = 1920
/** Height alias (historical square `sizePx` key). Prefer width × height. */
export const STREAM_MAP_SIZE_PX = STREAM_MAP_HEIGHT_PX

/** Tasteful default when no RaceProject name is wired yet. */
export const STREAM_MAP_DEFAULT_TITLE = 'Race map'

export type StreamMapResolvedOptions = {
  sizePx: number
  widthPx: number
  heightPx: number
  title: string
  visible: boolean
  variant: 'stream'
}

/** Pure defaults for stream map (unit-testable; no DOM). */
export function resolveStreamMapOptions(
  options: Omit<Map2dOptions, 'variant'> = {},
): StreamMapResolvedOptions {
  const heightPx =
    options.heightPx ?? options.sizePx ?? STREAM_MAP_HEIGHT_PX
  const widthPx =
    options.widthPx ?? Math.round(heightPx * (16 / 9))
  return {
    sizePx: options.sizePx ?? heightPx,
    widthPx,
    heightPx,
    title: options.title ?? STREAM_MAP_DEFAULT_TITLE,
    visible: options.visible ?? true,
    variant: 'stream',
  }
}

/**
 * Stream / on-air 2D race map (Phase 8.1 + 8.7 chrome + Phase 11 broadcast graphic).
 *
 * **Choice: CSS overlay canvas 2D** (same `createMap2d` + `mapChrome` path as
 * ops), not a Three.js HUD layer — never steals WebGL cameras or NDI air POV.
 *
 * `variant: 'stream'` gets a distinct broadcast look (compact pills, compass
 * ring, canvas title strip, framed card CSS). Ops/authoring map stays
 * utilitarian and is drawn on a separate code path / metrics set.
 *
 * Chrome: category-tinted sailboat icons (yaw from pose), thicker S/F / gate
 * overlays, procedural CW/RCW glyphs when features exist. OSM tiles draw on
 * the stream canvas when `geoBridge` is set (no checkbox; wash if offline).
 *
 * Phase **19.2**: the PiP corner card and ops checkbox are gone. The canvas
 * stays alive off-screen (`.local-2d-map-host`) so channel `'2d'`
 * (`broadcast-web-2d`) can sample `getCanvas()`. Local 2D focus CSS-hosts the
 * same element full-screen. To restore a PiP overlay later: re-add
 * `#ops-stream-map`, stop using the off-screen host, and put `.stream-map`
 * back to absolute top-left card positioning (chrome CSS is kept).
 *
 * Electron **AR** NDI (`readPixels` / WebGL) never burns this DOM map into the
 * air plate.
 */
export function createStreamMap2d(
  options: Omit<Map2dOptions, 'variant'> = {},
): Map2dHandle {
  return createMap2d(resolveStreamMapOptions(options))
}
