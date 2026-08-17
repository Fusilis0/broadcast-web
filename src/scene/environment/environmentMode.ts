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

export const DEFAULT_ENVIRONMENT_MODE: EnvironmentMode = 'simple'

const MODES: readonly EnvironmentMode[] = ['simple', 'realistic']

export function isEnvironmentMode(v: unknown): v is EnvironmentMode {
  return typeof v === 'string' && (MODES as readonly string[]).includes(v)
}

/** Soft parse — invalid / missing → `simple`. */
export function normalizeEnvironmentMode(v: unknown): EnvironmentMode {
  return isEnvironmentMode(v) ? v : DEFAULT_ENVIRONMENT_MODE
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
