/**
 * Universal asset library types (Phase 11.3).
 * Matches server manifest + GET/POST /api/assets.
 */

export type LibraryAssetKind = 'image' | 'model'

export type LibraryAsset = {
  id: string
  kind: LibraryAssetKind
  /** Relative path under `/assets/library/`, e.g. `image/logo-a1b2c3d4.png`. */
  filename: string
  label: string
  addedAt: string
  sizeBytes: number
}

/** Static catalogue URL when no projects API is configured. */
export const LIBRARY_MANIFEST_URL = '/assets/library/index.json'

/** Public URL prefix for stored files. */
export const LIBRARY_PUBLIC_PREFIX = '/assets/library'
