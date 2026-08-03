/**
 * Build per-id live WebSocket URLs from a base endpoint.
 * Base must not carry a specific id — registry ids are appended as `id=`.
 *
 * VPS pattern: `ws://host:8080/ws` → `ws://host:8080/ws?type=drone&id=40`
 * (server uses `type=drone` for boat feeds as well).
 */

export const DEFAULT_LIVE_WS_BASE = 'ws://49.13.20.49:8080/ws'

/** Strip id/type query params; keep host/path and other params. */
export function stripLiveWsId(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (trimmed === '') return ''
  try {
    const u = new URL(trimmed)
    u.searchParams.delete('id')
    u.searchParams.delete('type')
    const q = u.searchParams.toString()
    return q ? `${u.origin}${u.pathname}?${q}` : `${u.origin}${u.pathname}`
  } catch {
    return trimmed.replace(/([?&])(id|type)=[^&]*/g, '').replace(/[?&]$/, '')
  }
}

/**
 * Append `type` + `id` for one registered channel.
 * Always sets `type=drone` (VPS convention for boat and drone streams).
 */
export function buildLiveWsUrlForId(baseUrl: string, id: string): string {
  const base = stripLiveWsId(baseUrl)
  const channelId = id.trim()
  if (base === '' || channelId === '') return ''
  try {
    const u = new URL(base)
    u.searchParams.set('type', 'drone')
    u.searchParams.set('id', channelId)
    return u.toString()
  } catch {
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}type=drone&id=${encodeURIComponent(channelId)}`
  }
}

/** One URL per id (skips empties / dup ids). */
export function buildLiveWsUrlsForIds(
  baseUrl: string,
  ids: readonly string[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const trimmed = id.trim()
    if (trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    const url = buildLiveWsUrlForId(baseUrl, trimmed)
    if (url !== '') out.push(url)
  }
  return out
}
