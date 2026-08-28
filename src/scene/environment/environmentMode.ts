/**
 * Scene environment dressing mode (Phase 13.2).
 *
 * | Mode | Behaviour |
 * | --- | --- |
 * | `simple` | Clear color + localized `waterCue` pad only (AR-safe default) |
 * | `realistic` | Gerstner ocean + `Sky` (+ fog) when opaque clear allows it |
 *
 * Realistic meshes must **never** draw under `transparent` / `chroma` clears —
 * they would paint opaque sea/sky into the AR alpha plate.
 */
export type EnvironmentMode = 'simple' | 'realistic'

/** Clipmap / shore-foam LOD for the Gerstner sea (Phase 15.2). */
export type SeaQuality = 'high' | 'low'

export const DEFAULT_ENVIRONMENT_MODE: EnvironmentMode = 'simple'

/**
 * Default **high**: inner 32 segs + 7 rings (rim 6144 m, past fogFar 5200) +
 * half-res shore foam. **low** (`?sea=low` or Ops): same near-field, 5 rings
 * (rim 1536 m — edge can show before fog) + quarter-res foam. High keeps the
 * horizon; inner 48→32 is the default cost cut (near-field verts 49²→33²).
 * Rings 7→5 as the *default* would put the rim at 1536 m (~15% fogged).
 */
export const DEFAULT_SEA_QUALITY: SeaQuality = 'high'

export const SEA_QUALITY_PRESETS = {
  high: {
    innerSegments: 32,
    ringCount: 7,
    shoreDepthScale: 0.5,
  },
  low: {
    innerSegments: 32,
    ringCount: 5,
    shoreDepthScale: 0.25,
  },
} as const satisfies Record<
  SeaQuality,
  { innerSegments: number; ringCount: number; shoreDepthScale: number }
>

const MODES: readonly EnvironmentMode[] = ['simple', 'realistic']
const SEA_QUALITIES: readonly SeaQuality[] = ['high', 'low']

export function isEnvironmentMode(v: unknown): v is EnvironmentMode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v)
}

/** Soft parse — invalid / missing → `simple`. */
export function normalizeEnvironmentMode(v: unknown): EnvironmentMode {
  return isEnvironmentMode(v) ? v : DEFAULT_ENVIRONMENT_MODE
}

export function isSeaQuality(v: unknown): v is SeaQuality {
  return typeof v === 'string' && (SEA_QUALITIES as readonly string[]).includes(v)
}

/** Soft parse — invalid / missing → `high`. */
export function normalizeSeaQuality(v: unknown): SeaQuality {
  return isSeaQuality(v) ? v : DEFAULT_SEA_QUALITY
}

/**
 * Whether realistic sea/sky may be mounted.
 * Requires both user mode `realistic` and an opaque-safe clear context
 * (`preview` today; future dedicated 3D opaque channel later).
 */
export function shouldShowRealisticEnvironment(
  mode: EnvironmentMode,
  opaqueClearSafe: boolean,
): boolean {
  return normalizeEnvironmentMode(mode) === 'realistic' && opaqueClearSafe === true
}

/**
 * Parse boot query `?env=realistic|simple`. Unknown / missing → `null`
 * (caller keeps default).
 */
export function parseEnvironmentModeQuery(
  search: string | URLSearchParams,
): EnvironmentMode | null {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search
  const raw = params.get('env')
  if (raw === null || raw.trim() === '') return null
  const trimmed = raw.trim()
  return isEnvironmentMode(trimmed) ? trimmed : null
}

/**
 * Parse boot query `?sea=high|low`. Unknown / missing → `null`
 * (caller keeps default).
 */
export function parseSeaQualityQuery(
  search: string | URLSearchParams,
): SeaQuality | null {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search
  const raw = params.get('sea')
  if (raw === null || raw.trim() === '') return null
  const trimmed = raw.trim()
  return isSeaQuality(trimmed) ? trimmed : null
}
