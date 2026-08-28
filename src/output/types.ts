/**
 * Output clear modes (architecture §5.5 / NDI alpha contract).
 * Unknown modes normalize to `preview`.
 */
export type OutputMode = 'preview' | 'chroma' | 'transparent'

/** Resolved WebGL clear appearance. */
export type ClearAppearance = {
  color: number
  alpha: number
}

/** Options for resolve / apply (chroma key override). */
export type ApplyOutputModeOptions = {
  /**
   * Chroma key when mode is `chroma`.
   * Accepts hex number (`0x00ff00`) or CSS-like `"#00ff00"` / `"00ff00"`.
   */
  chromaKey?: number | string
}

/** Minimal renderer surface needed to set clear color. */
export type ClearColorTarget = {
  setClearColor: (color: number | string, alpha?: number) => void
}

/** Dark ops preview clear (matches prior `createScene` default). */
export const PREVIEW_CLEAR_COLOR = 0x1a1a1a

/** Default vMix key green `(0, 255, 0)`. */
export const DEFAULT_CHROMA_KEY = 0x00ff00

/**
 * Transparent NDI plate clear RGB (alpha 0). Color is irrelevant when alpha is 0;
 * black keeps any accidental opaque composite dark.
 */
export const TRANSPARENT_CLEAR_COLOR = 0x000000

/** Modes exposed in OUT control + normalize. */
export const SUPPORTED_OUTPUT_MODES: readonly OutputMode[] = [
  'preview',
  'chroma',
  'transparent',
] as const

/**
 * AR plate background (Phase 17.1 / L1).
 * `alpha` = today's transparent plate (default, fallback).
 * `video` = in-WebGL fullscreen texture behind the scene (NDI-visible).
 */
export type ArBackgroundMode = 'alpha' | 'video'

/** Modes exposed in OUT AR-background control + normalize. */
export const SUPPORTED_AR_BACKGROUNDS: readonly ArBackgroundMode[] = [
  'alpha',
  'video',
] as const
