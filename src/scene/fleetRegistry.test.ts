import { describe, expect, it } from 'vitest'
import {
  boatIdAllowSet,
  formatBoatEnuStatus,
  isAllowedBoatId,
  orphanBoatIds,
} from './fleetRegistry.ts'

describe('boatIdAllowSet', () => {
  it('uses provided boatIds', () => {
    const allow = boatIdAllowSet(['21', '22', '23', '24'])
    expect(allow.has('21')).toBe(true)
    expect(allow.has('24')).toBe(true)
    expect(allow.has('30')).toBe(false)
  })

  it('defaults to single id 21 when omitted or empty', () => {
    expect([...boatIdAllowSet()]).toEqual(['21'])
    expect([...boatIdAllowSet([])]).toEqual(['21'])
  })
})

describe('isAllowedBoatId', () => {
  it('filters to allow-set only', () => {
    const allow = boatIdAllowSet(['21', '22'])
    expect(isAllowedBoatId('21', allow)).toBe(true)
    expect(isAllowedBoatId('22', allow)).toBe(true)
    expect(isAllowedBoatId('23', allow)).toBe(false)
    expect(isAllowedBoatId('81', allow)).toBe(false)
  })
})

describe('orphanBoatIds', () => {
  it('lists registered ids outside the allow-set', () => {
    const allow = boatIdAllowSet(['21', '22'])
    expect(orphanBoatIds(['21', '22', '23', '24'], allow).sort()).toEqual([
      '23',
      '24',
    ])
  })

  it('returns empty when all registered ids remain allowed', () => {
    const allow = boatIdAllowSet(['21', '22'])
    expect(orphanBoatIds(['21', '22'], allow)).toEqual([])
  })

  it('drops a previous 4-boat pack when the next pack has one boat', () => {
    const allow = boatIdAllowSet(['1'])
    expect(
      orphanBoatIds(['21', '22', '23', '24'], allow).sort(),
    ).toEqual(['21', '22', '23', '24'])
    expect(allow.has('1')).toBe(true)
    expect(allow.has('21')).toBe(false)
  })
})

describe('formatBoatEnuStatus', () => {
  it('reports empty fleet', () => {
    expect(formatBoatEnuStatus(new Map())).toBe('boats=0')
  })

  it('lists sorted boat ENUs', () => {
    const m = new Map([
      ['22', '(2.0, 0.0, 2.0)'],
      ['21', '(1.0, 0.0, 1.0)'],
    ])
    expect(formatBoatEnuStatus(m)).toBe(
      'boats=2  21=(1.0, 0.0, 1.0) 22=(2.0, 0.0, 2.0)',
    )
  })

  it('truncates long lines', () => {
    const m = new Map([
      ['21', '(100.0, 0.0, 100.0)'],
      ['22', '(200.0, 0.0, 200.0)'],
    ])
    const line = formatBoatEnuStatus(m, 40)
    expect(line.length).toBeLessThanOrEqual(40)
    expect(line.endsWith('…')).toBe(true)
    expect(line.startsWith('boats=2')).toBe(true)
  })
})
