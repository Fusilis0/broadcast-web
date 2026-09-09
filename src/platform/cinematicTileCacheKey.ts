/**
 * SPA-safe cinematic tile cache key (no node:fs).
 * Filename = SHA-256 hex of the content URL with token query stripped.
 * Must match `cinematicTileCacheFileName` in `cinematicTileCache.ts` (Node).
 */

const AUTH_QUERY_KEY = /token/i

/**
 * Drop ion / bearer query params so the cache key is not token-scoped.
 */
export function stripCinematicTileAuthQuery(contentUrl: string): string {
  try {
    const parsed = new URL(contentUrl)
    for (const key of [...parsed.searchParams.keys()]) {
      if (AUTH_QUERY_KEY.test(key)) parsed.searchParams.delete(key)
    }
    return parsed.toString()
  } catch {
    const q = contentUrl.indexOf('?')
    return q === -1 ? contentUrl : contentUrl.slice(0, q)
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let hex = ''
  for (let i = 0; i < view.length; i++) {
    hex += view[i]!.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * SHA-256 hex of the stripped content URL. Uses Web Crypto (SPA + Node 19).
 */
export async function cinematicTileCacheFileNameAsync(
  contentUrl: string,
): Promise<string> {
  const canonical = stripCinematicTileAuthQuery(contentUrl)
  const encoded = new TextEncoder().encode(canonical)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return bytesToHex(digest)
}

/** 64-char lowercase hex SHA-256 filename. */
export function isCinematicTileCacheFileName(name: string): boolean {
  return /^[0-9a-f]{64}$/.test(name)
}
