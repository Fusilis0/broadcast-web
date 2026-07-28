import { describe, expect, it } from 'vitest'
import {
  formatWhepStatusLabel,
  normalizeWhepUrl,
  resolveUnderlayClearAlpha,
  shouldRunWhepUnderlay,
} from './whepUnderlayHelpers.ts'

describe('normalizeWhepUrl', () => {
  it('trims strings and maps non-strings to empty', () => {
    expect(normalizeWhepUrl('  http://127.0.0.1:8889/cam1/whep  ')).toBe(
      'http://127.0.0.1:8889/cam1/whep',
    )
    expect(normalizeWhepUrl('')).toBe('')
    expect(normalizeWhepUrl('   ')).toBe('')
    expect(normalizeWhepUrl(undefined)).toBe('')
    expect(normalizeWhepUrl(null)).toBe('')
    expect(normalizeWhepUrl(42)).toBe('')
  })
})

describe('shouldRunWhepUnderlay', () => {
  it('requires non-empty URL and preview mode', () => {
    expect(
      shouldRunWhepUnderlay('http://127.0.0.1:8889/cam1/whep', 'preview'),
    ).toBe(true)
    expect(
      shouldRunWhepUnderlay('http://127.0.0.1:8889/cam1/whep', 'chroma'),
    ).toBe(false)
    expect(shouldRunWhepUnderlay('', 'preview')).toBe(false)
    expect(shouldRunWhepUnderlay('  ', 'preview')).toBe(false)
  })
})

describe('formatWhepStatusLabel', () => {
  it('formats whep=status', () => {
    expect(formatWhepStatusLabel('off')).toBe('whep=off')
    expect(formatWhepStatusLabel('connecting')).toBe('whep=connecting')
    expect(formatWhepStatusLabel('live')).toBe('whep=live')
    expect(formatWhepStatusLabel('error')).toBe('whep=error')
  })
})

describe('resolveUnderlayClearAlpha', () => {
  it('is transparent only for active underlay in preview', () => {
    expect(
      resolveUnderlayClearAlpha({ mode: 'preview', underlayActive: true }),
    ).toBe(0)
    expect(
      resolveUnderlayClearAlpha({ mode: 'preview', underlayActive: false }),
    ).toBe(1)
    expect(
      resolveUnderlayClearAlpha({ mode: 'chroma', underlayActive: true }),
    ).toBe(1)
  })
})
