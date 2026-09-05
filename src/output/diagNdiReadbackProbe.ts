/**
 * DIAG:ndi-readback-probe — temporary, revert after this diagnosis round.
 * Default off. Does not change production pack order unless the query is set.
 *
 *   ?ndiReadbackProbe=idle   — time packPbo of a 16×16 idle FBO after this
 *                              tick’s AR composite, before the real AR pack
 *   ?ndiReadbackProbe=early  — pack the previous AR FBO before present() and
 *                              before this tick’s arFboRender
 */

export type NdiReadbackProbe = 'off' | 'idle' | 'early'

export function parseNdiReadbackProbe(
  search: string | URLSearchParams,
): NdiReadbackProbe {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          search.startsWith('?') ? search.slice(1) : search,
        )
  const raw = (params.get('ndiReadbackProbe') ?? '').trim().toLowerCase()
  if (raw === 'idle' || raw === 'early') return raw
  return 'off'
}
