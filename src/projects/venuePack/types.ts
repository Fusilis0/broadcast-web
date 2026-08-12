/**
 * Offline / venue pack (Phase 9.2).
 * Single JSON download: RaceProject + referenced fixture/asset bytes.
 */

import type { RaceProject } from '../types.ts'

export const VENUE_PACK_KIND = 'broadcast-web-venue-pack' as const

export type VenuePackFileEncoding = 'utf-8' | 'base64'

/** One embedded file under a site-relative path key (e.g. `/fixtures/…`). */
export type VenuePackFile = {
  contentType: string
  encoding: VenuePackFileEncoding
  body: string
}

/**
 * Downloadable venue pack document.
 * Keys in `files` are absolute-path URLs as used at runtime (`/fixtures/…`).
 */
export type VenuePack = {
  schemaVersion: number
  kind: typeof VENUE_PACK_KIND
  id: string
  name: string
  createdAt: string
  project: RaceProject
  files: Record<string, VenuePackFile>
}

/** Result of turning pack file bytes into blob: URLs for offline fetch/load. */
export type MaterializedVenuePack = {
  project: RaceProject
  /** path → blob: URL */
  urls: ReadonlyMap<string, string>
  /** Revoke all blob URLs created for this materialization. */
  revoke: () => void
}
