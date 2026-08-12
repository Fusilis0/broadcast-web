/**
 * LAN auth stub (Phase 9.1): editor vs air bearer roles.
 * Reads stay open; only mutating methods consult this module.
 */

export type ProjectsApiRole = 'editor' | 'air'

export type WriteAuthTokens = {
  /** Bearer that may POST/PUT/DELETE. */
  editorToken?: string
  /**
   * Optional air bearer. Presenting it on a write → 403 (known role, no write).
   * Reads never require a token.
   */
  airToken?: string
}

export type WriteAuthResult =
  | { ok: true; role: 'editor' }
  /** No token configured → open writes (local dev). */
  | { ok: true; role: 'open' }
  | { ok: false; status: 401; error: 'unauthorized' }
  | { ok: false; status: 403; error: 'forbidden'; role: 'air' }

/**
 * Parse `Authorization: Bearer <token>`.
 * Returns the raw token string, or undefined if missing/malformed.
 */
export function parseBearerToken(
  authorizationHeader: string | undefined,
): string | undefined {
  if (typeof authorizationHeader !== 'string') return undefined
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  if (!match) return undefined
  const token = match[1]!.trim()
  return token === '' ? undefined : token
}

/**
 * Decide whether a mutating request may proceed.
 *
 * - Neither editor nor air token configured → open (dev).
 * - Matching editor token → ok.
 * - Matching air token (and air ≠ editor) → 403.
 * - Missing / unknown → 401.
 */
export function authorizeWrite(
  authorizationHeader: string | undefined,
  tokens: WriteAuthTokens,
): WriteAuthResult {
  const editor = tokens.editorToken?.trim() || undefined
  const air = tokens.airToken?.trim() || undefined

  if (!editor && !air) {
    return { ok: true, role: 'open' }
  }

  const presented = parseBearerToken(authorizationHeader)

  if (editor && presented === editor) {
    return { ok: true, role: 'editor' }
  }

  // Air token only matters when distinct from editor (misconfig: same value → editor wins above).
  if (air && presented === air) {
    return { ok: false, status: 403, error: 'forbidden', role: 'air' }
  }

  return { ok: false, status: 401, error: 'unauthorized' }
}
