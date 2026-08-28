/**
 * Hardcoded SRT id → caller URL catalog (L9).
 * Empty Fleet template looks this up; a filled `{srtId}` template is the escape hatch.
 * Tokens are session credentials (RULES §11) — never log; use `redactSrtUrl`.
 */

import { validateSrtUrl } from './srtBridge.ts'
import type { SrtCallerUrlResult } from './srtCallerUrl.ts'

export const SRT_RELAY_HOST = '49.13.20.49'
export const SRT_RELAY_PORT = '9000'

/** Operator SRT id → relay `streamid`. Host is always `SRT_RELAY_HOST`. */
export const SRT_STREAM_CATALOG: Readonly<Record<string, string>> = Object.freeze({
  '1': 'read:cam1:pub1:k3q9x7',
  '2': 'read:cam2:pub2:m8t2c4',
  '3': 'read:cam3:pub3:r7n1b5',
  '4': 'read:cam4:pub4:z2h8d6',
  '5': 'read:cam5:pub5:p4v9e1',
  '6': 'read:cam6:pub6:s6j3k8',
  '7': 'read:cam7:pub7:n1w5m2',
  '8': 'read:cam8:pub8:b9c2t7',
  '9': 'read:cam9:pub9:h5l4q3',
  '10': 'read:cam10:pub10:d8f1g6',
  '11': 'read:cam11:pub11:q2w8r4',
  '12': 'read:cam12:pub12:v7k3p9',
  '13': 'read:cam13:pub13:t6c1z5',
  '14': 'read:cam14:pub14:m4s9h2',
  '15': 'read:cam15:pub15:y3n7d8',
  '16': 'read:cam16:pub16:a9l2x6',
  '17': 'read:cam17:pub17:c5b1t9',
  '18': 'read:cam18:pub18:e8r4m3',
  '19': 'read:cam19:pub19:j1q6v2',
  '20': 'read:cam20:pub20:k7h9p1',
  '21': 'read:cam21:pub21:u2d5n7',
  '22': 'read:cam22:pub22:w3x8l4',
  '23': 'read:cam23:pub23:r9t2g6',
  '24': 'read:cam24:pub24:z4m7c1',
  '25': 'read:cam25:pub25:p6v3k8',
  '26': 'read:cam26:pub26:n8h1s4',
  '27': 'read:cam27:pub27:b2j9q5',
})

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
