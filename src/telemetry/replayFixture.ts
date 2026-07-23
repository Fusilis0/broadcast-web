import type { MockChannel } from './mockSource.ts'

/** Default sample fixture URL (served from `public/`). */
export const DEFAULT_REPLAY_URL = '/fixtures/telemetry/spine-demo.json'

export type ReplayChannel = MockChannel

/** One timed packet in a v1 replay fixture. */
export type ReplayFixturePacket = {
  /** Milliseconds from replay start (monotonic non-decreasing). */
  t_ms: number
  channel: ReplayChannel
  /** Wire DTO object; serialized to JSON text before `ingestPacket`. */
  payload: Record<string, unknown>
}

/** Versioned replay fixture envelope (v1). */
export type ReplayFixtureV1 = {
  version: 1
  name: string
  loop: boolean
  packets: ReplayFixturePacket[]
}

export type ParseReplayFixtureResult =
  | { ok: true; fixture: ReplayFixtureV1 }
  | { ok: false; error: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parsePacket(
  raw: unknown,
  index: number,
  prevTMs: number | null,
): { ok: true; packet: ReplayFixturePacket } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `packets[${index}]: expected object` }
  }

  const tMs = raw.t_ms
  if (typeof tMs !== 'number' || !Number.isFinite(tMs) || tMs < 0) {
    return {
      ok: false,
      error: `packets[${index}]: t_ms must be a finite number >= 0`,
    }
  }
  if (prevTMs !== null && tMs < prevTMs) {
    return {
      ok: false,
      error: `packets[${index}]: t_ms must be monotonic non-decreasing (got ${tMs} < ${prevTMs})`,
    }
  }

  const channel = raw.channel
  if (channel !== 'drone' && channel !== 'boat') {
    return {
      ok: false,
      error: `packets[${index}]: channel must be "drone" | "boat"`,
    }
  }

  if (!isPlainObject(raw.payload)) {
    return {
      ok: false,
      error: `packets[${index}]: payload must be an object`,
    }
  }

  return {
    ok: true,
    packet: {
      t_ms: tMs,
      channel,
      payload: raw.payload,
    },
  }
}

/**
 * Validate and normalize a parsed JSON value as a v1 replay fixture.
 * Does not throw — returns `{ ok: false, error }` on failure.
 */
export function parseReplayFixture(raw: unknown): ParseReplayFixtureResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'fixture root must be an object' }
  }

  if (raw.version !== 1) {
    return { ok: false, error: `unsupported fixture version (expected 1, got ${String(raw.version)})` }
  }

  if (typeof raw.name !== 'string') {
    return { ok: false, error: 'name must be a string' }
  }

  if (typeof raw.loop !== 'boolean') {
    return { ok: false, error: 'loop must be a boolean' }
  }

  if (!Array.isArray(raw.packets)) {
    return { ok: false, error: 'packets must be an array' }
  }
  if (raw.packets.length === 0) {
    return { ok: false, error: 'packets must be non-empty' }
  }

  const packets: ReplayFixturePacket[] = []
  let prevTMs: number | null = null
  for (let i = 0; i < raw.packets.length; i += 1) {
    const parsed = parsePacket(raw.packets[i], i, prevTMs)
    if (!parsed.ok) return parsed
    packets.push(parsed.packet)
    prevTMs = parsed.packet.t_ms
  }

  return {
    ok: true,
    fixture: {
      version: 1,
      name: raw.name,
      loop: raw.loop,
      packets,
    },
  }
}

/**
 * Fetch a fixture URL and parse as v1. Fail-soft: never throws.
 */
export async function loadReplayFixture(
  url: string,
): Promise<ParseReplayFixtureResult> {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return { ok: false, error: `fetch ${url} failed: HTTP ${res.status}` }
    }
    const json: unknown = await res.json()
    return parseReplayFixture(json)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `fetch/parse ${url} failed: ${msg}` }
  }
}
