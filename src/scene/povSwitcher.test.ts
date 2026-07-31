import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POV_IDS,
  clampActivePovId,
  formatPovStatus,
  isAllowedPovId,
  orphanPovCacheIds,
  povIdAllowSet,
  resolveInitialPovId,
  resolvePovIdList,
} from './povSwitcher.ts'

describe('povIdAllowSet', () => {
  it('uses provided povIds', () => {
    const allow = povIdAllowSet(['1', '2', '11'])
    expect(allow.has('1')).toBe(true)
    expect(allow.has('11')).toBe(true)
    expect(allow.has('3')).toBe(false)
  })

  it('defaults when omitted or empty', () => {
    expect([...povIdAllowSet()].sort()).toEqual([...DEFAULT_POV_IDS].sort())
    expect([...povIdAllowSet([])].sort()).toEqual([...DEFAULT_POV_IDS].sort())
  })
})

describe('resolvePovIdList', () => {
  it('preserves config order', () => {
    expect(resolvePovIdList(['2', '1'])).toEqual(['2', '1'])
  })

  it('falls back to deprecated droneId then default', () => {
    expect(resolvePovIdList(undefined, '11')).toEqual(['11'])
    expect(resolvePovIdList()).toEqual([...DEFAULT_POV_IDS])
  })
})

describe('isAllowedPovId', () => {
  it('filters to allow-set only', () => {
    const allow = povIdAllowSet(['1', '2'])
    expect(isAllowedPovId('1', allow)).toBe(true)
    expect(isAllowedPovId('2', allow)).toBe(true)
    expect(isAllowedPovId('3', allow)).toBe(false)
    expect(isAllowedPovId('21', allow)).toBe(false)
  })
})

describe('resolveInitialPovId', () => {
  it('uses first pov id by default', () => {
    expect(resolveInitialPovId(['1', '2'])).toBe('1')
    expect(resolveInitialPovId(['2', '1'])).toBe('2')
  })

  it('prefers deprecated droneId when allowed', () => {
    expect(resolveInitialPovId(['1', '2'], '2')).toBe('2')
    expect(resolveInitialPovId(['1', '2'], '9')).toBe('1')
  })
})

describe('clampActivePovId', () => {
  it('keeps active when still allowed', () => {
    expect(clampActivePovId('2', ['1', '2'])).toBe('2')
  })

  it('clamps to first id when active leaves the list', () => {
    expect(clampActivePovId('2', ['1', '11'])).toBe('1')
    expect(clampActivePovId('11', ['2'])).toBe('2')
  })

  it('falls back to default drone id on empty list', () => {
    expect(clampActivePovId('1', [])).toBe('1')
  })
})

describe('orphanPovCacheIds', () => {
  it('lists cached ids outside the allow-set', () => {
    const allow = povIdAllowSet(['1'])
    expect(orphanPovCacheIds(['1', '2', '11'], allow).sort()).toEqual([
      '11',
      '2',
    ])
  })
})

describe('formatPovStatus', () => {
  it('shows active and sorted seen ids', () => {
    expect(formatPovStatus('1', new Set(['2', '1']))).toBe('pov=1  seen=1,2')
    expect(formatPovStatus('2', [])).toBe('pov=2  seen=—')
  })
})
