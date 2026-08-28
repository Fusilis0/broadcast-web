import {
  DEFAULT_CHROMA_KEY,
  PREVIEW_CLEAR_COLOR,
  TRANSPARENT_CLEAR_COLOR,
  type ApplyOutputModeOptions,
  type ArBackgroundMode,
  type ClearAppearance,
  type ClearColorTarget,
  type OutputMode,
} from './types.ts'

/**
 * Normalize config / UI mode string.
 * Unknown, empty, or future modes → `preview`.
 */
export function normalizeOutputMode(raw: unknown): OutputMode {
  if (raw === 'chroma') return 'chroma'
  if (raw === 'transparent') return 'transparent'
  if (raw === 'preview') return 'preview'
  return 'preview'
}

/**
 * Normalize AR background mode.
 * Unknown, empty, or future modes → `alpha` (today's plate).
 */
export function normalizeArBackground(raw: unknown): ArBackgroundMode {
  if (raw === 'video') return 'video'
  return 'alpha'
}

/**
 * Parse a chroma key hex. Invalid → `fallback` (default `0x00ff00`).
 */
export function parseChromaKey(
  raw: unknown,
  fallback: number = DEFAULT_CHROMA_KEY,
): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    if (n >= 0 && n <= 0xffffff) return n
    return fallback
  }
  if (typeof raw !== 'string') return fallback
  const s = raw.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return fallback
  return Number.parseInt(s, 16)
}

/** Map mode → clear color + alpha (OUT owns the values). */
export function resolveClearAppearance(
  mode: unknown,
  options?: ApplyOutputModeOptions,
): ClearAppearance {
  const resolved = normalizeOutputMode(mode)
  if (resolved === 'chroma') {
    return {
      color: parseChromaKey(options?.chromaKey),
      alpha: 1,
    }
  }
  if (resolved === 'transparent') {
    return { color: TRANSPARENT_CLEAR_COLOR, alpha: 0 }
  }
  return { color: PREVIEW_CLEAR_COLOR, alpha: 1 }
}

/**
 * Apply output clear mode to a WebGL renderer (`setClearColor`).
 * Returns the appearance applied.
 */
export function applyOutputMode(
  renderer: ClearColorTarget,
  mode: unknown,
  options?: ApplyOutputModeOptions,
): ClearAppearance {
  const appearance = resolveClearAppearance(mode, options)
  renderer.setClearColor(appearance.color, appearance.alpha)
  return appearance
}
