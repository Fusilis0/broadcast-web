import type { CinematicCatalogueEntry } from './types.ts'

/** Locked play/record clock. Do not use rAF dt to advance the spline. */
export const CINEMATIC_FPS = 30

export const CINEMATIC_WIDTH = 1920
export const CINEMATIC_HEIGHT = 1080

/** ECEF globe: near/far so World Terrain at hundreds of km still resolves. */
export const CINEMATIC_GLOBE_NEAR_M = 1_000
export const CINEMATIC_GLOBE_FAR_M = 50_000_000

/** ENU race tangent plane — same order as the drone camera. */
export const CINEMATIC_ENU_NEAR_M = 0.5
/**
 * Clip unloaded far tiles. 80 km showed a white slab (missing Cesium + sky).
 * Nearby heroes stay inside ~1 km.
 */
export const CINEMATIC_ENU_FAR_M = 4_200
/** Same teal as the ENU clear so the clip line can fade out. */
export const CINEMATIC_ENU_FOG_COLOR = 0x2a4a52
export const CINEMATIC_ENU_FOG_NEAR_M = 1_600
export const CINEMATIC_ENU_FOG_FAR_M = 3_900

export const CINEMATIC_SEQUENCES_DIR = '/cinematics'

/** Built-in catalogue. `_empty` is the 2 s fixture; `intro-bosphorus` is the ~72 s take. */
export const CINEMATIC_CATALOGUE: readonly CinematicCatalogueEntry[] = [
  {
    id: 'intro-bosphorus',
    label: 'intro-bosphorus (72 s)',
    url: `${CINEMATIC_SEQUENCES_DIR}/intro-bosphorus.json`,
  },
  {
    id: '_empty',
    label: '_empty (fixture)',
    url: `${CINEMATIC_SEQUENCES_DIR}/_empty.json`,
  },
]

export function cinematicSequenceUrl(id: string): string {
  const trimmed = id.trim()
  const known = CINEMATIC_CATALOGUE.find((e) => e.id === trimmed)
  if (known) return known.url
  return `${CINEMATIC_SEQUENCES_DIR}/${trimmed}.json`
}
