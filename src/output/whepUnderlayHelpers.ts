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
 * Chroma and transparent suppress underlay so the plate stays clean
 * (green key / alpha NDI).
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
 * Clear alpha for underlay compositing.
 * Transparent mode always alpha 0; preview goes transparent only while underlay is active.
 */
export function resolveUnderlayClearAlpha(options: {
  mode: unknown
  underlayActive: boolean
}): number {
  const mode = normalizeOutputMode(options.mode)
  if (mode === 'transparent') return 0
  if (mode === 'preview' && options.underlayActive) return 0
  return 1
}

export type { OutputMode }
