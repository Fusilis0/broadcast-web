/**
 * Turn VenuePack file bytes into blob: URLs and rewrite project / JSON pointers.
 */

import type { RaceProject } from '../types.ts'
import {
  isVenueAssetPath,
  normalizeVenueAssetPath,
} from './collectVenuePackUrls.ts'
import type { MaterializedVenuePack, VenuePack, VenuePackFile } from './types.ts'

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function fileToBytes(file: VenuePackFile): Uint8Array {
  if (file.encoding === 'base64') return base64ToBytes(file.body)
  return new TextEncoder().encode(file.body)
}

function fileToText(file: VenuePackFile): string {
  if (file.encoding === 'utf-8') return file.body
  return new TextDecoder().decode(base64ToBytes(file.body))
}

function rewriteAssetStrings(
  value: unknown,
  urlMap: ReadonlyMap<string, string>,
): unknown {
  if (typeof value === 'string') {
    const n = normalizeVenueAssetPath(value)
    if (n && urlMap.has(n)) return urlMap.get(n)!
    if (isVenueAssetPath(value) && urlMap.has(value.trim())) {
      return urlMap.get(value.trim())!
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAssetStrings(item, urlMap))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteAssetStrings(v, urlMap)
    }
    return out
  }
  return value
}

function rewriteProjectUrls(
  project: RaceProject,
  urlMap: ReadonlyMap<string, string>,
): RaceProject {
  // Preserve soft fields (e.g. feature textureUrl) that parseRaceProject may drop.
  const clone = JSON.parse(JSON.stringify(project)) as RaceProject
  return rewriteAssetStrings(clone, urlMap) as RaceProject
}

/**
 * Materialize pack files as blob: URLs.
 * JSON bodies are rewritten so nested texture/fixture paths also resolve offline.
 */
export function materializeVenuePack(pack: VenuePack): MaterializedVenuePack {
  const blobUrls: string[] = []
  const pathToBlob = new Map<string, string>()

  // Pass 1: binary / non-JSON → blob URLs (targets for JSON rewrites).
  for (const [path, file] of Object.entries(pack.files)) {
    const lower = path.toLowerCase()
    const isJson =
      lower.endsWith('.json') || file.contentType.includes('json')
    if (isJson) continue
    const bytes = fileToBytes(file)
    const blob = new Blob([Uint8Array.from(bytes)], {
      type: file.contentType,
    })
    const url = URL.createObjectURL(blob)
    blobUrls.push(url)
    pathToBlob.set(path, url)
  }

  // Pass 2: JSON → rewrite nested paths → blob URLs.
  for (const [path, file] of Object.entries(pack.files)) {
    const lower = path.toLowerCase()
    const isJson =
      lower.endsWith('.json') || file.contentType.includes('json')
    if (!isJson) continue
    let text = fileToText(file)
    try {
      const rewritten = rewriteAssetStrings(JSON.parse(text) as unknown, pathToBlob)
      text = JSON.stringify(rewritten)
    } catch {
      // Keep original text.
    }
    const blob = new Blob([text], {
      type: file.contentType.includes('json')
        ? file.contentType
        : 'application/json',
    })
    const url = URL.createObjectURL(blob)
    blobUrls.push(url)
    pathToBlob.set(path, url)
  }

  const project = rewriteProjectUrls(pack.project, pathToBlob)

  return {
    project,
    urls: pathToBlob,
    revoke: () => {
      for (const u of blobUrls) URL.revokeObjectURL(u)
      blobUrls.length = 0
      pathToBlob.clear()
    },
  }
}
