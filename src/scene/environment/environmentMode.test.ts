import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENVIRONMENT_MODE,
  DEFAULT_SEA_QUALITY,
  SEA_QUALITY_PRESETS,
  isEnvironmentMode,
  normalizeEnvironmentMode,
  normalizeSeaQuality,
  parseEnvironmentModeQuery,
  parseSeaQualityQuery,
  shouldShowRealisticEnvironment,
} from './environmentMode.ts'

describe('normalizeEnvironmentMode', () => {
  it('accepts known modes', () => {
    expect(isEnvironmentMode('simple')).toBe(true)
    expect(isEnvironmentMode('realistic')).toBe(true)
    expect(normalizeEnvironmentMode('realistic')).toBe('realistic')
  })

  it('defaults missing to realistic; garbage stays simple', () => {
    expect(DEFAULT_ENVIRONMENT_MODE).toBe('realistic')
    expect(normalizeEnvironmentMode(undefined)).toBe(DEFAULT_ENVIRONMENT_MODE)
    expect(normalizeEnvironmentMode('nope')).toBe('simple')
    expect(normalizeEnvironmentMode(1)).toBe('simple')
  })
})

describe('normalizeSeaQuality', () => {
  it('defaults to high; low is valid', () => {
    expect(normalizeSeaQuality('high')).toBe('high')
    expect(normalizeSeaQuality('low')).toBe('low')
    expect(normalizeSeaQuality(undefined)).toBe(DEFAULT_SEA_QUALITY)
    expect(SEA_QUALITY_PRESETS.high.ringCount).toBe(7)
    expect(SEA_QUALITY_PRESETS.low.ringCount).toBe(5)
    expect(SEA_QUALITY_PRESETS.low.shoreDepthScale).toBe(0.25)
    expect(SEA_QUALITY_PRESETS.high.innerSegments).toBe(32)
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

describe('parseSeaQualityQuery', () => {
  it('reads ?sea=high|low', () => {
    expect(parseSeaQualityQuery('?sea=low')).toBe('low')
    expect(parseSeaQualityQuery('?sea=high')).toBe('high')
    expect(parseSeaQualityQuery('?foo=1')).toBe(null)
    expect(parseSeaQualityQuery('?sea=nope')).toBe(null)
  })
})
