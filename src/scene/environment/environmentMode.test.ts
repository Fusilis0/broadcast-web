import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENVIRONMENT_MODE,
  isEnvironmentMode,
  normalizeEnvironmentMode,
  parseEnvironmentModeQuery,
  shouldShowRealisticEnvironment,
} from './environmentMode.ts'

describe('normalizeEnvironmentMode', () => {
  it('accepts known modes', () => {
    expect(isEnvironmentMode('simple')).toBe(true)
    expect(isEnvironmentMode('realistic')).toBe(true)
    expect(normalizeEnvironmentMode('realistic')).toBe('realistic')
  })

  it('defaults invalid values to simple', () => {
    expect(normalizeEnvironmentMode(undefined)).toBe(DEFAULT_ENVIRONMENT_MODE)
    expect(normalizeEnvironmentMode('nope')).toBe('simple')
    expect(normalizeEnvironmentMode(1)).toBe('simple')
  })
})

describe('shouldShowRealisticEnvironment', () => {
  it('shows only when realistic + opaque-clear-safe', () => {
    expect(shouldShowRealisticEnvironment('realistic', true)).toBe(true)
    expect(shouldShowRealisticEnvironment('realistic', false)).toBe(false)
    expect(shouldShowRealisticEnvironment('simple', true)).toBe(false)
    expect(shouldShowRealisticEnvironment('simple', false)).toBe(false)
  })

  it('soft-normalizes invalid mode to simple (off)', () => {
    expect(shouldShowRealisticEnvironment(normalizeEnvironmentMode('nope'), true)).toBe(
      false,
    )
  })
})

describe('parseEnvironmentModeQuery', () => {
  it('reads ?env=realistic|simple', () => {
    expect(parseEnvironmentModeQuery('?env=realistic')).toBe('realistic')
    expect(parseEnvironmentModeQuery('?env=simple')).toBe('simple')
    expect(parseEnvironmentModeQuery('?foo=1')).toBe(null)
    expect(parseEnvironmentModeQuery('?env=nope')).toBe(null)
  })
})
