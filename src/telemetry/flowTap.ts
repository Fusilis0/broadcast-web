/**
 * Per-id ring of recent ingest/debug events for the SCN Flow panel.
 * Pure: no DOM. Never store raw SRT URLs with relay tokens.
 */

export const DEFAULT_FLOW_TAP_PER_ID = 12

export type FlowTapKind = 'drone' | 'boat' | 'buoy' | 'anchor' | 'srt'

export type FlowTapEvent = {
  receivedAtMs: number
  kind: FlowTapKind
  id: string
  body: unknown
}

export type FlowTapPushInput = {
  kind: FlowTapKind
  id: string
  body: unknown
  receivedAtMs?: number
}

export type FlowTap = {
  push(event: FlowTapPushInput): void
  snapshot(): FlowTapEvent[]
  /** Drop one id's ring. Empty / whitespace id is a no-op. */
  remove(id: string): void
  /** Keep only these ids; drop every other ring. */
  retain(ids: Iterable<string>): void
  reset(): void
}

export type FlowTapOptions = {
  perId?: number
  nowMs?: () => number
}

const KINDS = new Set<FlowTapKind>(['drone', 'boat', 'buoy', 'anchor', 'srt'])

function redactStreamIdLastSegment(sid: string): string {
  const parts = sid.split(':')
  if (parts.length >= 2) {
    parts[parts.length - 1] = '***'
    return parts.join(':')
  }
  return sid
}

/** Redact `streamid` last segment and `passphrase`. Safe if the string is not a URL. */
export function redactSrtish(value: string): string {
  let out = value
  out = out.replace(/(passphrase=)[^&]*/gi, '$1***')
  out = out.replace(/(streamid=)([^&]*)/gi, (_m, prefix: string, sid: string) => {
    let decoded = sid
    try {
      decoded = decodeURIComponent(sid)
    } catch {
      /* keep raw */
    }
    return prefix + redactStreamIdLastSegment(decoded)
  })
  // Path-style `srt://host/read:camN:pubN:token`
  out = out.replace(
    /(srt:\/\/[^\s"'\\]*)(\/)((?:read|publish):[^"'\\?\s]+)/gi,
    (_m, host: string, slash: string, pathSid: string) =>
      host + slash + redactStreamIdLastSegment(pathSid),
  )
  return out
}

function jsonSafe(value: unknown): unknown {
  const seen = new WeakSet<object>()
  const walk = (v: unknown): unknown => {
    if (v == null) return v
    if (typeof v === 'string') return redactSrtish(v)
    if (typeof v === 'number' || typeof v === 'boolean') return v
    if (typeof v !== 'object') return undefined
    if (seen.has(v as object)) return undefined
    seen.add(v as object)
    if (Array.isArray(v)) return v.map(walk)
    const out: Record<string, unknown> = {}
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      const next = walk(child)
      if (next !== undefined) out[k] = next
    }
    return out
  }
  try {
    return JSON.parse(JSON.stringify(walk(value)))
  } catch {
    return null
  }
}

export function createFlowTap(options: FlowTapOptions = {}): FlowTap {
  const perId = Math.max(1, options.perId ?? DEFAULT_FLOW_TAP_PER_ID)
  const nowMs = options.nowMs ?? (() => Date.now())
  const rings = new Map<string, FlowTapEvent[]>()

  return {
    push(event) {
      if (!KINDS.has(event.kind)) return
      const id = typeof event.id === 'string' ? event.id.trim() : ''
      if (!id) return
      const receivedAtMs =
        typeof event.receivedAtMs === 'number' && Number.isFinite(event.receivedAtMs)
          ? event.receivedAtMs
          : nowMs()
      const row: FlowTapEvent = {
        receivedAtMs,
        kind: event.kind,
        id,
        body: jsonSafe(event.body),
      }
      let ring = rings.get(id)
      if (!ring) {
        ring = []
        rings.set(id, ring)
      }
      ring.push(row)
      while (ring.length > perId) ring.shift()
    },
    snapshot() {
      const all: FlowTapEvent[] = []
      for (const ring of rings.values()) all.push(...ring)
      all.sort((a, b) => b.receivedAtMs - a.receivedAtMs)
      return all
    },
    remove(id) {
      const key = typeof id === 'string' ? id.trim() : ''
      if (!key) return
      rings.delete(key)
    },
    retain(ids) {
      const keep = new Set<string>()
      for (const id of ids) {
        const key = typeof id === 'string' ? id.trim() : ''
        if (key) keep.add(key)
      }
      for (const key of [...rings.keys()]) {
        if (!keep.has(key)) rings.delete(key)
      }
    },
    reset() {
      rings.clear()
    },
  }
}

/** Shared tap the pose pipeline fills; SCN-10 polls `snapshot()`. */
export const flowTap = createFlowTap()

export function resetFlowTap(): void {
  flowTap.reset()
}
