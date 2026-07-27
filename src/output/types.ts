/**
 * Output clear modes (architecture §5.5).
 * Phase 3.1 implements `preview` | `chroma` only.
 * Unknown / future modes normalize to `preview`.
 */
export type OutputMode = 'preview' | 'chroma'

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

/** Modes implemented in Phase 3.1. */
export const SUPPORTED_OUTPUT_MODES: readonly OutputMode[] = [
  'preview',
  'chroma',
] as const
