/**
 * DIAG: NDI channel killswitches for frame-identity A/B.
 * Temporary OUT-crossing debug wiring — default on when param absent.
 *
 *   ?ndi2d=off
 *   ?ndi3d=off
 */

function flagOff(raw: string | null): boolean {
  if (raw == null) return false
  const t = raw.trim().toLowerCase()
  return t === '0' || t === 'false' || t === 'no' || t === 'off'
}

export function parseNdi2dEnabled(search: string | URLSearchParams): boolean {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          search.startsWith('?') ? search.slice(1) : search,
        )
  return !flagOff(params.get('ndi2d'))
}

export function parseNdi3dEnabled(search: string | URLSearchParams): boolean {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          search.startsWith('?') ? search.slice(1) : search,
        )
  return !flagOff(params.get('ndi3d'))
}
