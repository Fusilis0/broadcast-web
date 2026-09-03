/**
 * DIAG:ndi-upload-probe — temporary killswitch for the VideoFrame texImage2D
 * upload. Default (no query) is production texImage2D.
 *
 *   ?ndiUploadProbe=texSubImage  — restore texStorage + texSubImage2D
 *   ?ndiUploadProbe=texImage     — accepted, same as default (old probe URL)
 */

export type NdiUploadProbe = 'off' | 'texImage' | 'texSubImage'

export function parseNdiUploadProbe(
  search: string | URLSearchParams,
): NdiUploadProbe {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          search.startsWith('?') ? search.slice(1) : search,
        )
  const raw = (params.get('ndiUploadProbe') ?? '').trim().toLowerCase()
  if (raw === 'texsubimage' || raw === 'tex-sub-image' || raw === 'legacy') {
    return 'texSubImage'
  }
  if (raw === 'teximage' || raw === 'tex-image') return 'texImage'
  return 'off'
}
