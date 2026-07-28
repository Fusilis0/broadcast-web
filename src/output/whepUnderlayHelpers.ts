import { normalizeOutputMode } from './applyOutputMode.ts'
import type { OutputMode } from './types.ts'

/** Ops-visible WHEP underlay lifecycle. */
export type WhepStatus = 'off' | 'connecting' | 'live' | 'error'

/** Trim / coerce config `whepUrl`. Empty → idle (no connect). */
export function normalizeWhepUrl(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

/**
 * Underlay runs only with a non-empty URL in **preview**.
 * Chroma always suppresses underlay so the green key stays clean.
 */
export function shouldRunWhepUnderlay(
  whepUrl: unknown,
  mode: unknown,
): boolean {
  return (
    normalizeWhepUrl(whepUrl) !== '' && normalizeOutputMode(mode) === 'preview'
  )
}

/** Format status for OUT control HUD: `whep=off|connecting|live|error`. */
export function formatWhepStatusLabel(status: WhepStatus): string {
  return `whep=${status}`
}

/**
 * Preview clear alpha when underlay is trying to / is showing video.
 * Opaque (1) otherwise so dark ops preview / chroma stay solid.
 */
export function resolveUnderlayClearAlpha(options: {
  mode: unknown
  underlayActive: boolean
}): number {
  const mode = normalizeOutputMode(options.mode)
  if (mode === 'preview' && options.underlayActive) return 0
  return 1
}

export type { OutputMode }
