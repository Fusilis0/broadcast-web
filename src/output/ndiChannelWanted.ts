import { NDI_CHANNEL_IDS, type NdiChannelId } from './studioBridge.ts'

/**
 * Session-only hand toggles for NDI AR / 3D / 2D (Phase 19.4).
 * Never written to `project.json` / race packs.
 */
export type NdiChannelWanted = Record<NdiChannelId, boolean>

export const NDI_CHANNEL_WANTED_STORAGE_KEY = 'bw.ndi.channelWanted'

/** Cold start / missing session → all senders off. Session still wins. */
export const NDI_CHANNEL_WANTED_DEFAULTS: NdiChannelWanted = {
  ar: false,
  '3d': false,
  '2d': false,
}

export function defaultNdiChannelWanted(): NdiChannelWanted {
  return { ...NDI_CHANNEL_WANTED_DEFAULTS }
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Merge partial overrides onto defaults (unknown keys ignored). */
export function normalizeNdiChannelWanted(
  partial?: Partial<NdiChannelWanted> | null,
): NdiChannelWanted {
  const base = defaultNdiChannelWanted()
  if (!partial) return base
  for (const id of NDI_CHANNEL_IDS) {
    if (id in partial) base[id] = asBool(partial[id], base[id])
  }
  return base
}

type SessionStorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function getSessionStorage(): SessionStorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

/**
 * Load wanted flags from `sessionStorage`. Missing / invalid → all off.
 * Never reads race / `project.json`.
 */
export function loadNdiChannelWanted(
  storage: SessionStorageLike | null = getSessionStorage(),
): NdiChannelWanted {
  if (!storage) return defaultNdiChannelWanted()
  try {
    const raw = storage.getItem(NDI_CHANNEL_WANTED_STORAGE_KEY)
    if (raw == null || raw === '') return defaultNdiChannelWanted()
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultNdiChannelWanted()
    return normalizeNdiChannelWanted(parsed as Partial<NdiChannelWanted>)
  } catch {
    return defaultNdiChannelWanted()
  }
}

/**
 * Persist wanted flags for this browser session only.
 * Returns the normalized full map after merge.
 */
export function saveNdiChannelWanted(
  partial: Partial<NdiChannelWanted>,
  storage: SessionStorageLike | null = getSessionStorage(),
  current?: NdiChannelWanted,
): NdiChannelWanted {
  const next = normalizeNdiChannelWanted({
    ...(current ?? loadNdiChannelWanted(storage)),
    ...partial,
  })
  if (storage) {
    try {
      storage.setItem(NDI_CHANNEL_WANTED_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* quota / private mode — in-memory still returned */
    }
  }
  return next
}

export function isNdiChannelWanted(
  channel: NdiChannelId,
  wanted: NdiChannelWanted,
): boolean {
  return wanted[channel] !== false
}
