/**
 * Shared SRT caller URL template → per-POV URL (L9).
 * Telemetry `povId` is never substituted; only `{srtId}` / `{id}` (alias).
 *
 * Relay `streamid` token is a secret (RULES §11). Do not log composed URLs
 * at info; use `redactSrtUrl`. Pack save uses `redactSrtTemplateForPack`.
 */

import { serializeSrtHref, validateSrtUrl } from './srtBridge.ts'

/** L5 — keep this many POVs warm. */
export const SRT_WARM_POV_CAP = 4

export type SrtCallerUrlOk = { ok: true; href: string }
export type SrtCallerUrlErr = { ok: false; error: string }
export type SrtCallerUrlResult = SrtCallerUrlOk | SrtCallerUrlErr

const PLACEHOLDER_SRT = '{srtId}'
const PLACEHOLDER_ID = '{id}'

function trimString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** Placeholder hostnames from the Fleet template hint — never a real relay. */
const DUMMY_SRT_HOSTS = new Set(['host', 'hostname'])

/**
 * Empty template **or** a dummy `srt://host:…` placeholder → use the cam catalog.
 * A filled template on a real host is still the escape hatch.
 */
export function shouldUseSrtCatalog(template: unknown): boolean {
  const t = trimString(template)
  if (!t) return true
  try {
    const host = new URL(t).hostname.toLowerCase()
    return DUMMY_SRT_HOSTS.has(host)
  } catch {
    return false
  }
}

export const SRT_LIVE_BITRATE_FLOOR_KBPS = 50
/** Copy-path WebCodecs stall → ffmpeg HEVC→H.264. */
export const SRT_DECODE_STALL_MS = 2500
/** After transcode started, still no picture → libx264 / demux failure. */
export const SRT_TRANSCODE_STALL_MS = 8000

export type SrtSituationRow = {
  povId: string
  srtId: string
  state: string
  bitrateKbps: number
  lastError: string | null
  redactedUrl: string
  framesDecoded: number | null
  hasPicture: boolean
  codec?: string | null
  accessUnits?: number | null
  bytesPushed?: number | null
  waitingForKeyframe?: boolean
  transcoding?: boolean
}

/** Live bitrate with no decoded frame — name the layer that stalled. */
export function srtDecodeStallHint(input: {
  liveLongEnough: boolean
  state: string
  bitrateKbps: number
  framesDecoded: number | null
  accessUnits: number | null
  bytesPushed: number | null
  waitingForKeyframe?: boolean
}): string | null {
  if (!input.liveLongEnough) return null
  if (input.state !== 'live') return null
  if (input.bitrateKbps < SRT_LIVE_BITRATE_FLOOR_KBPS) return null
  if ((input.framesDecoded ?? 0) > 0) return null
  const bytes = input.bytesPushed
  const aus = input.accessUnits
  if (bytes == null) {
    return 'SRT live but renderer has no demux slot — srt:data not arriving'
  }
  if (bytes === 0) {
    return 'SRT live but renderer received 0 MPEG-TS bytes'
  }
  if ((aus ?? 0) === 0) {
    return `TS demux emitted 0 access units (${bytes} B in)`
  }
  if (input.waitingForKeyframe) {
    return `demux=${aus} waiting for a keyframe`
  }
  return `demux=${aus} WebCodecs produced 0 frames`
}

export function pickSrtRowError(input: {
  decodeError: string | null
  decodeNote: string | null
  srtLastError: string | null
  liveLongEnough: boolean
  state: string
  bitrateKbps: number
  framesDecoded: number | null
  accessUnits: number | null
  bytesPushed: number | null
  waitingForKeyframe?: boolean
}): string | null {
  if (input.decodeError) return input.decodeError
  if (input.decodeNote) return input.decodeNote
  if (input.srtLastError) return input.srtLastError
  return srtDecodeStallHint(input)
}

/** Ops-only text. Never include a raw streamid token. */
export function formatSrtSituation(input: {
  studio: boolean
  arBackground: string
  hasPicture: boolean
  rows: readonly SrtSituationRow[]
}): string {
  const picture =
    input.arBackground === 'video'
      ? input.hasPicture
        ? 'AR bg=video picture=yes'
        : 'AR bg=video picture=no (colour bars = placeholder, not the drone)'
      : `AR bg=${input.arBackground}`
  const lines = [`SRT  studio=${input.studio ? 'yes' : 'no'}  ${picture}`]
  if (!input.studio) {
    lines.push('  needs Electron studio — Chrome cannot open SRT')
  }
  if (input.rows.length === 0) {
    lines.push(
      '  no Vid-enabled POV — check Vid, set SRT id (1–27), leave template empty, Connect SRT',
    )
    return lines.join('\n')
  }
  for (const row of input.rows) {
    const err = row.lastError ? `  err=${row.lastError}` : ''
    const decoded =
      row.framesDecoded == null ? '—' : String(row.framesDecoded)
    const bits: string[] = [
      `pov ${row.povId} srt=${row.srtId}`,
      row.state,
      `${Math.round(row.bitrateKbps)} kbps`,
    ]
    if (row.codec) bits.push(`codec=${row.codec}`)
    if (row.bytesPushed != null) bits.push(`${row.bytesPushed}B`)
    if (row.accessUnits != null) bits.push(`demux=${row.accessUnits}`)
    bits.push(`decoded=${decoded}`)
    if (row.transcoding) bits.push('ffmpeg→h264')
    if (row.waitingForKeyframe && (row.framesDecoded ?? 0) === 0) {
      bits.push('waiting-key')
    }
    lines.push(`  ${bits.join('  ')}${err}`)
    if (row.redactedUrl && row.redactedUrl !== '—') {
      lines.push(`    ${row.redactedUrl}`)
    }
  }
  return lines.join('\n')
}

/**
 * Last `streamid` colon-segment is the relay token when it has no `{…}`.
 * `read:cam30:pub30:SECRET` → `read:cam30:pub30:***`
 */
export function redactStreamIdParam(streamid: string): string {
  const parts = streamid.split(':')
  if (parts.length >= 4) {
    const last = parts[parts.length - 1] ?? ''
    if (last !== '' && !/[{}]/.test(last)) {
      parts[parts.length - 1] = '***'
      return parts.join(':')
    }
  }
  return streamid === '' ? streamid : '***'
}

function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

/** Path `/read:camN:pubN:token` (or legacy `/publish:…`) — slash form ffmpeg does not send as streamid. */
function pathStreamId(pathname: string): string | null {
  const stripped = decodePathname(pathname).replace(/^\//, '')
  if (!/^(read|publish):cam\d+:/i.test(stripped)) return null
  if (stripped.split(':').length < 4) return null
  return stripped
}

/**
 * Move `/read:camN:…` (or `/publish:…`) off the path into query `streamid` so libsrt sees it.
 */
export function promotePublishPathToStreamId(href: string): string {
  try {
    const parsed = new URL(href)
    const streamid = pathStreamId(parsed.pathname)
    if (!streamid) return href
    if (!parsed.searchParams.has('streamid')) {
      parsed.searchParams.set('streamid', streamid)
    }
    parsed.pathname = '/'
    return serializeSrtHref(parsed)
  } catch {
    return href
  }
}

/** Redact `streamid` + path-style `read:` / `publish:` token + `passphrase`. Never print the composed URL raw. */
export function redactSrtUrl(href: string): string {
  try {
    const parsed = new URL(href)
    if (parsed.searchParams.has('passphrase')) {
      parsed.searchParams.set('passphrase', '***')
    }
    const sid = parsed.searchParams.get('streamid')
    if (sid) {
      parsed.searchParams.set('streamid', redactStreamIdParam(sid))
    }
    const pathSid = pathStreamId(parsed.pathname)
    if (pathSid) {
      parsed.pathname = '/' + redactStreamIdParam(pathSid)
    }
    return serializeSrtHref(parsed)
  } catch {
    return 'srt://***'
  }
}

/**
 * Strip the relay token / passphrase so a committed race pack cannot leak
 * the session secret. Leaves `{srtId}` placeholders intact — do **not** round
 * trip through `URL.href` (it percent-encodes `{` `}` and breaks substitution).
 */
export function redactSrtTemplateForPack(template: string): string {
  const t = template.trim()
  if (!t) return ''
  let out = t.replace(/(passphrase=)[^&]*/gi, '$1')
  out = out.replace(/(streamid=)([^&]*)/i, (_m, prefix: string, sid: string) => {
    let decoded = sid
    try {
      decoded = decodeURIComponent(sid)
    } catch {
      /* keep raw */
    }
    const parts = decoded.split(':')
    const last = parts[parts.length - 1] ?? ''
    if (parts.length >= 4 && last !== '' && !/[{}]/.test(last)) {
      parts[parts.length - 1] = ''
      return prefix + parts.join(':')
    }
    return prefix + sid
  })
  return out
}

function finalizeCallerUrl(raw: string): SrtCallerUrlResult {
  const promoted = promotePublishPathToStreamId(raw)
  const validated = validateSrtUrl(promoted)
  if (!validated.ok) return validated
  let parsed: URL
  try {
    parsed = new URL(validated.href)
  } catch {
    return { ok: false, error: 'SRT URL is not a valid URL' }
  }
  const mode = (parsed.searchParams.get('mode') ?? '').trim().toLowerCase()
  if (mode === 'listener') {
    return { ok: false, error: 'SRT URL must be caller mode (listener rejected)' }
  }
  if (!mode) parsed.searchParams.set('mode', 'caller')
  return { ok: true, href: serializeSrtHref(parsed) }
}

/**
 * Compose a caller `srt://` URL from a shared template and a per-POV SRT id.
 *
 * - Empty `srtId` → do not open.
 * - `{srtId}` and `{id}` (alias) are replaced everywhere; telemetry id is not used.
 * - Empty template + a full `srt://…` in `srtId` is the escape hatch.
 * - Listener URLs and `mode=listener` are rejected; `mode=caller` is set if missing.
 */
export function buildSrtCallerUrl(
  template: unknown,
  srtId: unknown,
): SrtCallerUrlResult {
  const id = trimString(srtId)
  if (!id) {
    return { ok: false, error: 'SRT id is empty' }
  }
  const tmpl = trimString(template)
  if (!tmpl) {
    return finalizeCallerUrl(id)
  }
  const hasPlaceholder =
    tmpl.includes(PLACEHOLDER_SRT) || tmpl.includes(PLACEHOLDER_ID)
  if (!hasPlaceholder) {
    return {
      ok: false,
      error: 'SRT template missing {srtId} placeholder',
    }
  }
  const href = tmpl.split(PLACEHOLDER_SRT).join(id).split(PLACEHOLDER_ID).join(id)
  return finalizeCallerUrl(href)
}

/** Soft id → SRT-id map. Empty keys/values dropped. */
export function parseSrtByPovId(
  raw: unknown,
): Record<string, string> | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    if (id === '' || typeof value !== 'string') continue
    const srtId = value.trim()
    if (srtId === '') continue
    out[id] = srtId
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function compactSrtByPovId(
  raw: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!raw) return undefined
  return parseSrtByPovId(raw)
}
