/**
 * Persist VenuePack documents for offline `?race=` fallback (IndexedDB).
 * Memory map used when IndexedDB is unavailable (tests / private mode).
 */

import { parseVenuePack } from './parseVenuePack.ts'
import type { VenuePack } from './types.ts'

export const VENUE_PACK_DB_NAME = 'broadcast-web-venue-packs'
export const VENUE_PACK_STORE = 'packs'
const DB_VERSION = 1

export type VenuePackCache = {
  put(pack: VenuePack): Promise<void>
  get(id: string): Promise<VenuePack | null>
  listIds(): Promise<string[]>
  delete(id: string): Promise<void>
}

const memory = new Map<string, VenuePack>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'))
      return
    }
    const req = indexedDB.open(VENUE_PACK_DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(VENUE_PACK_STORE)) {
        db.createObjectStore(VENUE_PACK_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'))
  })
}

/** In-memory cache (tests / fallback). */
export function createMemoryVenuePackCache(
  seed?: Iterable<VenuePack>,
): VenuePackCache {
  const map = new Map<string, VenuePack>()
  if (seed) {
    for (const p of seed) map.set(p.id, p)
  }
  return {
    async put(pack) {
      map.set(pack.id, pack)
    },
    async get(id) {
      return map.get(id.trim()) ?? null
    },
    async listIds() {
      return [...map.keys()].sort()
    },
    async delete(id) {
      map.delete(id.trim())
    },
  }
}

/** Default IndexedDB cache with memory fallback on failure. */
export function createIndexedDbVenuePackCache(): VenuePackCache {
  return {
    async put(pack) {
      const parsed = parseVenuePack(pack)
      memory.set(parsed.id, parsed)
      try {
        const db = await openDb()
        try {
          const tx = db.transaction(VENUE_PACK_STORE, 'readwrite')
          await idbReq(tx.objectStore(VENUE_PACK_STORE).put(parsed))
        } finally {
          db.close()
        }
      } catch (err) {
        console.warn('[venuePack] IndexedDB put failed; memory only', err)
      }
    },
    async get(id) {
      const trimmed = id.trim()
      try {
        const db = await openDb()
        try {
          const tx = db.transaction(VENUE_PACK_STORE, 'readonly')
          const raw = await idbReq(
            tx.objectStore(VENUE_PACK_STORE).get(trimmed),
          )
          if (raw === undefined) return memory.get(trimmed) ?? null
          const pack = parseVenuePack(raw)
          memory.set(pack.id, pack)
          return pack
        } finally {
          db.close()
        }
      } catch {
        return memory.get(trimmed) ?? null
      }
    },
    async listIds() {
      try {
        const db = await openDb()
        try {
          const tx = db.transaction(VENUE_PACK_STORE, 'readonly')
          const keys = await idbReq(
            tx.objectStore(VENUE_PACK_STORE).getAllKeys(),
          )
          const ids = keys
            .map((k) => String(k))
            .filter((k) => k.length > 0)
            .sort()
          if (ids.length > 0) return ids
        } finally {
          db.close()
        }
      } catch {
        /* memory */
      }
      return [...memory.keys()].sort()
    },
    async delete(id) {
      const trimmed = id.trim()
      memory.delete(trimmed)
      try {
        const db = await openDb()
        try {
          const tx = db.transaction(VENUE_PACK_STORE, 'readwrite')
          await idbReq(tx.objectStore(VENUE_PACK_STORE).delete(trimmed))
        } finally {
          db.close()
        }
      } catch {
        /* ignore */
      }
    },
  }
}

let defaultCache: VenuePackCache | null = null

/** Shared process cache (IndexedDB + memory). */
export function getDefaultVenuePackCache(): VenuePackCache {
  if (!defaultCache) defaultCache = createIndexedDbVenuePackCache()
  return defaultCache
}

/** Test helper — reset singleton. */
export function setDefaultVenuePackCacheForTests(
  cache: VenuePackCache | null,
): void {
  defaultCache = cache
}
