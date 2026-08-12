/**
 * Build a VenuePack by fetching RaceProject-linked fixtures + nested assets.
 */

import type { RaceProject } from '../types.ts'
import {
  collectNestedAssetUrls,
  DEFAULT_VENUE_EXTRA_URLS,
  seedVenuePackUrls,
} from './collectVenuePackUrls.ts'
import { VENUE_PACK_KIND, type VenuePack, type VenuePackFile } from './types.ts'

export type BuildVenuePackOptions = {
  fetchImpl?: typeof fetch
  /** Extra site-relative paths to embed (default scene extras). */
  extraUrls?: readonly string[]
  createdAt?: string
  /**
   * When a URL fails to fetch, skip it (default true) so a pack still exports.
   * Set false to fail the whole build.
   */
  skipMissing?: boolean
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function guessContentType(path: string, header: string | null): string {
  const fromHeader = header?.split(';')[0]?.trim()
  if (fromHeader) return fromHeader
  const lower = path.toLowerCase()
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.glb')) return 'model/gltf-binary'
  if (lower.endsWith('.bin')) return 'application/octet-stream'
  return 'application/octet-stream'
}

function isJsonPath(path: string, contentType: string): boolean {
  if (path.toLowerCase().endsWith('.json')) return true
  return contentType.includes('json')
}

/**
 * Assemble a venue pack for `project` by fetching linked assets.
 * JSON fixtures are scanned for nested `/fixtures|textures|models|races/…` paths.
 */
export async function buildVenuePack(
  project: RaceProject,
  options: BuildVenuePackOptions = {},
): Promise<VenuePack> {
  const fetchImpl = options.fetchImpl ?? fetch
  const skipMissing = options.skipMissing !== false
  const queue = seedVenuePackUrls(
    project,
    options.extraUrls ?? DEFAULT_VENUE_EXTRA_URLS,
  )
  const files: Record<string, VenuePackFile> = {}
  const seen = new Set<string>()

  while (queue.length > 0) {
    const path = queue.shift()!
    if (seen.has(path)) continue
    seen.add(path)

    let res: Response
    try {
      res = await fetchImpl(path)
    } catch (err) {
      if (skipMissing) {
        console.warn(`[venuePack] skip (network): ${path}`, err)
        continue
      }
      throw err
    }
    if (!res.ok) {
      if (skipMissing) {
        console.warn(`[venuePack] skip (HTTP ${res.status}): ${path}`)
        continue
      }
      throw new Error(`Failed to fetch ${path} (${res.status})`)
    }

    const contentType = guessContentType(path, res.headers.get('content-type'))
    if (isJsonPath(path, contentType)) {
      const text = await res.text()
      files[path] = {
        contentType: contentType.includes('json')
          ? contentType
          : 'application/json',
        encoding: 'utf-8',
        body: text,
      }
      try {
        const nested = new Set<string>()
        collectNestedAssetUrls(JSON.parse(text) as unknown, nested)
        for (const n of nested) {
          if (!seen.has(n)) queue.push(n)
        }
      } catch {
        // Non-JSON body despite extension — keep as text file.
      }
    } else {
      const buf = new Uint8Array(await res.arrayBuffer())
      files[path] = {
        contentType,
        encoding: 'base64',
        body: bytesToBase64(buf),
      }
    }
  }

  return {
    schemaVersion: 1,
    kind: VENUE_PACK_KIND,
    id: project.id,
    name: project.name,
    createdAt: options.createdAt ?? new Date().toISOString(),
    project,
    files,
  }
}

/** Pretty-print VenuePack for download. */
export function serializeVenuePack(pack: VenuePack): string {
  return `${JSON.stringify(pack, null, 2)}\n`
}

/** Trigger browser download of `{id}-venue-pack.json`. */
export function downloadVenuePack(
  pack: VenuePack,
  filename = `${pack.id}-venue-pack.json`,
): void {
  const text = serializeVenuePack(pack)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
