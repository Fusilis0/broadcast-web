/**
 * Hardcoded SRT id → caller URL catalog (L9).
 * Empty Fleet template looks this up; a filled `{srtId}` template is the escape hatch.
 * Tokens are session credentials (RULES §11) — never log; use `redactSrtUrl`.
 * Public git ships placeholder tokens + localhost; operators override via Fleet
 * SRT template or a local (gitignored) catalog.
 */

import { validateSrtUrl } from './srtBridge.ts'
import type { SrtCallerUrlResult } from './srtCallerUrl.ts'

export const SRT_RELAY_HOST = '127.0.0.1'
export const SRT_RELAY_PORT = '9000'

/** Placeholder last-segment — not a live relay credential. */
export const SRT_CATALOG_TOKEN = 'example'

function catalogStreamId(id: string): string {
  return `read:cam${id}:pub${id}:${SRT_CATALOG_TOKEN}`
}

/** Operator SRT id → relay `streamid`. Host is always `SRT_RELAY_HOST`. */
export const SRT_STREAM_CATALOG: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Array.from({ length: 27 }, (_, i) => {
      const id = String(i + 1)
      return [id, catalogStreamId(id)]
    }),
  ),
)

function trimString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** `"18"` and `"cam18"` / `"CAM18"` are the same row. `"1"` does not match cam10. */
export function normalizeSrtCatalogId(raw: unknown): string | undefined {
  const trimmed = trimString(raw)
  if (!trimmed) return undefined
  if (Object.prototype.hasOwnProperty.call(SRT_STREAM_CATALOG, trimmed)) {
    return trimmed
  }
  if (/^cam/i.test(trimmed)) {
    const rest = trimmed.slice(3)
    if (Object.prototype.hasOwnProperty.call(SRT_STREAM_CATALOG, rest)) {
      return rest
    }
  }
  return undefined
}

/**
 * Catalog lookup → caller URL with query `streamid` + `mode=caller`.
 * Path-style `/read:camN:…` is not emitted (ffmpeg/libsrt want the query form).
 */
export function resolveSrtUrlForId(srtId: unknown): SrtCallerUrlResult {
  const id = trimString(srtId)
  if (!id) {
    return { ok: false, error: 'SRT id is empty' }
  }
  const key = normalizeSrtCatalogId(id)
  const streamid = key ? SRT_STREAM_CATALOG[key] : undefined
  if (!key || !streamid) {
    return { ok: false, error: `SRT id "${id}" is not in the catalog` }
  }
  const href = `srt://${SRT_RELAY_HOST}:${SRT_RELAY_PORT}?mode=caller&streamid=${streamid}`
  const validated = validateSrtUrl(href)
  if (!validated.ok) return validated
  return { ok: true, href: validated.href }
}
