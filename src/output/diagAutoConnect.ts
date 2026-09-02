/**
 * DIAG:auto-connect — query-param boot hooks for no-click SRT repro.
 * Revert after diagnosis. Default off: missing/invalid params do nothing.
 *
 *   ?arBackground=video
 *   &autoConnectLive=1&livePov=1
 *   &autoConnectSrt=1&srtPov=1
 *
 * Does not guess a POV. autoConnect* without ids is a no-op + console.warn.
 */

export type DiagAutoConnect = {
  arBackground: 'video' | 'alpha' | null
  autoConnectLive: boolean
  autoConnectSrt: boolean
  livePovIds: string[]
  srtPovIds: string[]
}

function flagOn(raw: string | null): boolean {
  if (raw == null) return false
  const t = raw.trim().toLowerCase()
  return t === '1' || t === 'true' || t === 'yes'
}

export function parseIdList(raw: string | null): string[] {
  if (raw == null || raw.trim() === '') return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function parseDiagAutoConnect(
  search: string | URLSearchParams,
): DiagAutoConnect {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          search.startsWith('?') ? search.slice(1) : search,
        )
  const bgRaw = (params.get('arBackground') ?? '').trim().toLowerCase()
  const arBackground =
    bgRaw === 'video' ? 'video' : bgRaw === 'alpha' ? 'alpha' : null
  return {
    arBackground,
    autoConnectLive: flagOn(params.get('autoConnectLive')),
    autoConnectSrt: flagOn(params.get('autoConnectSrt')),
    livePovIds: parseIdList(params.get('livePov')),
    srtPovIds: parseIdList(params.get('srtPov')),
  }
}

export function diagAutoConnectIsNoop(boot: DiagAutoConnect): boolean {
  return (
    boot.arBackground == null &&
    !boot.autoConnectLive &&
    !boot.autoConnectSrt &&
    boot.livePovIds.length === 0 &&
    boot.srtPovIds.length === 0
  )
}
