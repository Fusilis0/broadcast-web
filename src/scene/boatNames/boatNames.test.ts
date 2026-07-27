import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COLOR_FALLBACK,
  CATEGORY_COLOR_MAVI,
  CATEGORY_COLOR_PEMBE,
  CATEGORY_COLOR_SARI,
  CATEGORY_COLOR_TURUNCU,
  CATEGORY_COLOR_YESIL,
  parseCategoryColor,
} from './categoryColor.ts'
import { normalizeBoatNames } from './normalizeBoatNames.ts'

describe('parseCategoryColor', () => {
  it('maps Turkish keywords (Unity ParseCategoryColor)', () => {
    expect(parseCategoryColor('Pembe Kategori')).toBe(CATEGORY_COLOR_PEMBE)
    expect(parseCategoryColor('Mavi Kategori')).toBe(CATEGORY_COLOR_MAVI)
    expect(parseCategoryColor('Sarı Filo')).toBe(CATEGORY_COLOR_SARI)
    expect(parseCategoryColor('Sari Filo')).toBe(CATEGORY_COLOR_SARI)
    expect(parseCategoryColor('Yeşil Takım')).toBe(CATEGORY_COLOR_YESIL)
    expect(parseCategoryColor('Yesil Takim')).toBe(CATEGORY_COLOR_YESIL)
    expect(parseCategoryColor('Turuncu')).toBe(CATEGORY_COLOR_TURUNCU)
  })

  it('falls back to white when no keyword', () => {
    expect(parseCategoryColor('Open Class')).toBe(CATEGORY_COLOR_FALLBACK)
  })
})

describe('normalizeBoatNames', () => {
  const demoUnity = {
    'Pembe Kategori': { '21': 'Bora', '22': 'Aksu' },
    'Mavi Kategori': { '23': 'Mira', '24': 'Lira' },
  }

  it('flattens Unity nested JSON for default boatIds 21–24', () => {
    const map = normalizeBoatNames(demoUnity)
    expect(map.get('21')).toEqual({
      name: 'Bora',
      category: 'Pembe Kategori',
      color: CATEGORY_COLOR_PEMBE,
    })
    expect(map.get('22')?.name).toBe('Aksu')
    expect(map.get('22')?.color).toBe(CATEGORY_COLOR_PEMBE)
    expect(map.get('23')).toEqual({
      name: 'Mira',
      category: 'Mavi Kategori',
      color: CATEGORY_COLOR_MAVI,
    })
    expect(map.get('24')?.name).toBe('Lira')
    expect(map.get('24')?.color).toBe(CATEGORY_COLOR_MAVI)
  })

  it('returns undefined for unknown id (caller uses stub)', () => {
    const map = normalizeBoatNames(demoUnity)
    expect(map.get('99')).toBeUndefined()
  })

  it('accepts per-category _color and per-entry object overrides', () => {
    const map = normalizeBoatNames({
      Custom: {
        _color: '#abcdef',
        '21': 'Alpha',
        '22': { name: 'Beta', color: '#112233' },
      },
    })
    expect(map.get('21')?.color).toBe('#abcdef')
    expect(map.get('22')).toEqual({
      name: 'Beta',
      category: 'Custom',
      color: '#112233',
    })
  })

  it('returns empty map for junk input', () => {
    expect(normalizeBoatNames(null).size).toBe(0)
    expect(normalizeBoatNames([]).size).toBe(0)
    expect(normalizeBoatNames('nope').size).toBe(0)
  })
})
