import { describe, expect, it } from 'vitest'
import { upsertBoatNameEntry, removeBoatNameEntry } from './mergeBoatName.ts'

describe('upsertBoatNameEntry', () => {
  it('adds name/category and keyword color', () => {
    const next = upsertBoatNameEntry(new Map(), {
      id: '40',
      name: 'Test',
      category: 'Mavi Kategori',
    })
    expect(next.get('40')).toEqual({
      name: 'Test',
      category: 'Mavi Kategori',
      color: '#0000ff',
    })
  })

  it('uses explicit palette colour over category keywords', () => {
    const next = upsertBoatNameEntry(new Map(), {
      id: '40',
      name: 'Test',
      category: 'Ops',
      color: '#e53935',
    })
    expect(next.get('40')).toEqual({
      name: 'Test',
      category: 'Ops',
      color: '#e53935',
    })
  })

  it('removes an entry', () => {
    const cat = upsertBoatNameEntry(new Map(), {
      id: '40',
      name: 'Test',
      category: 'Mavi',
    })
    const gone = removeBoatNameEntry(cat, '40')
    expect(gone.has('40')).toBe(false)
  })
})
