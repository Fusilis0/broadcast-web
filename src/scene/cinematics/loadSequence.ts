import { parseSequence } from './parseSequence.ts'
import type { CinematicSequence } from './types.ts'

/**
 * Fetch `/cinematics/*.json` and parse. Missing/invalid → null (no throw).
 */
export async function loadSequence(
  url: string,
): Promise<CinematicSequence | null> {
  const trimmed = url.trim()
  if (trimmed === '') return null
  let raw: unknown
  try {
    const res = await fetch(trimmed)
    if (!res.ok) {
      console.warn(`[cinematics] failed to load ${trimmed}: HTTP ${res.status}`)
      return null
    }
    raw = await res.json()
  } catch (err) {
    console.warn(`[cinematics] failed to load ${trimmed}`, err)
    return null
  }
  const parsed = parseSequence(raw)
  if (!parsed.ok) {
    console.warn(`[cinematics] invalid ${trimmed}: ${parsed.error}`)
    return null
  }
  return parsed.sequence
}
