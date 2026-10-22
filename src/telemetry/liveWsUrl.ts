/**
 * Build per-id live WebSocket URLs from a base endpoint.
 * Base must not carry a specific subscribe/id — registry ids are appended.
 *
 * VPS client subscribe pattern:
 *   `ws://host:8080/ws` → `ws://host:8080/ws?type=client&subscribe=40`
 * (`type=drone&id=` is a producer URL and does not deliver telemetry to us.)
 */

/** Empty in git — operators set Fleet Drone/Boat base (or local config). */
export const DEFAULT_LIVE_WS_BASE = ''

/** Strip subscribe/id/type query params; keep host/path and other params. */
export function stripLiveWsId(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (trimmed === '') return ''
  try {
    const u = new URL(trimmed)
    u.searchParams.delete('id')
    u.searchParams.delete('type')
    u.searchParams.delete('subscribe')
    const q = u.searchParams.toString()
    return q ? `${u.origin}${u.pathname}?${q}` : `${u.origin}${u.pathname}`
  } catch {
    return trimmed
      .replace(/([?&])(id|type|subscribe)=[^&]*/g, '')
      .replace(/[?&]$/, '')
  }
}

/**
 * Append `type=client` + `subscribe=<id>` for one registered channel.
 * Same pattern for boat and drone ids on this VPS.
 */
export function buildLiveWsUrlForId(baseUrl: string, id: string): string {
  const base = stripLiveWsId(baseUrl)
  const channelId = id.trim()
  if (base === '' || channelId === '') return ''
  try {
    const u = new URL(base)
    u.searchParams.set('type', 'client')
    u.searchParams.set('subscribe', channelId)
    return u.toString()
  } catch {
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}type=client&subscribe=${encodeURIComponent(channelId)}`
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
