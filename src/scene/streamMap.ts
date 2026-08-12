import { createMap2d, type Map2dHandle, type Map2dOptions } from './map2d.ts'

/**
 * Default stream PiP canvas size (CSS + backing store).
 * Sized for on-air glanceability as a corner graphic (~480–560 band).
 */
export const STREAM_MAP_SIZE_PX = 520

/** Tasteful default when no RaceProject name is wired yet. */
export const STREAM_MAP_DEFAULT_TITLE = 'Race map'

export type StreamMapResolvedOptions = {
  sizePx: number
  title: string
  visible: boolean
  variant: 'stream'
}

/** Pure defaults for stream map (unit-testable; no DOM). */
export function resolveStreamMapOptions(
  options: Omit<Map2dOptions, 'variant'> = {},
): StreamMapResolvedOptions {
  return {
    sizePx: options.sizePx ?? STREAM_MAP_SIZE_PX,
    title: options.title ?? STREAM_MAP_DEFAULT_TITLE,
    visible: options.visible ?? false,
    variant: 'stream',
  }
}

/**
 * Stream / on-air 2D race map (Phase 8.1 + 8.7 chrome + Phase 11 broadcast graphic).
 *
 * **Choice: CSS overlay canvas 2D** (same `createMap2d` + `mapChrome` path as
 * ops), not a Three.js HUD layer — never steals WebGL cameras or NDI air POV.
 *
 * `variant: 'stream'` gets a distinct broadcast look (larger icons, compass
 * ring, branded title strip, framed card CSS). Ops/authoring map stays
 * utilitarian and is drawn on a separate code path / metrics set.
 *
 * Chrome: category-tinted sailboat icons (yaw from pose), thicker S/F / gate
 * overlays, procedural CW/RCW glyphs when features exist.
 *
 * Visible in browser preview and Chrome chroma window capture when toggled on.
 * Electron NDI `readPixels` is WebGL-only, so this DOM PiP is **not** on the
 * NDI plate (OUT follow-up if on-air NDI map burn-in is required).
 *
 * Default **hidden** (air clutter). Toggle from ops HUD.
 */
export function createStreamMap2d(
  options: Omit<Map2dOptions, 'variant'> = {},
): Map2dHandle {
  return createMap2d(resolveStreamMapOptions(options))
}
