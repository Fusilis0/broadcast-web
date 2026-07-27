import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_BOAT_IDS,
  normalizeBoatIds,
  normalizeConfig,
} from './loadConfig.ts'

describe('normalizeBoatIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns four-id default when missing', () => {
    expect(normalizeBoatIds(undefined)).toEqual([...DEFAULT_BOAT_IDS])
    expect(normalizeBoatIds(null)).toEqual([...DEFAULT_BOAT_IDS])
  })

  it('keeps valid band ids', () => {
    expect(normalizeBoatIds(['21', '22', '23', '24'])).toEqual([
      '21',
      '22',
      '23',
      '24',
    ])
  })

  it('filters pilots / out-of-band and falls back if empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(normalizeBoatIds(['81', '84'])).toEqual([...DEFAULT_BOAT_IDS])
    expect(warn).toHaveBeenCalled()
  })

  it('dedupes and drops empty strings', () => {
    expect(normalizeBoatIds(['21', '', '21', '22'])).toEqual(['21', '22'])
  })
})

describe('normalizeConfig boatIds', () => {
  it('exposes boatIds on AppConfig', () => {
    const cfg = normalizeConfig({
      telemetryMode: 'mock',
      boatIds: ['21', '30'],
    })
    expect(cfg.boatIds).toEqual(['21', '30'])
  })

  it('defaults boatIds when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.boatIds).toEqual([...DEFAULT_BOAT_IDS])
  })
})
