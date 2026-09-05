import { describe, expect, it } from 'vitest'
import {
  defaultNdiChannelWanted,
  isNdiChannelWanted,
  loadNdiChannelWanted,
  NDI_CHANNEL_WANTED_DEFAULTS,
  NDI_CHANNEL_WANTED_STORAGE_KEY,
  normalizeNdiChannelWanted,
  saveNdiChannelWanted,
} from './ndiChannelWanted.ts'

describe('ndiChannelWanted (Phase 19.4)', () => {
  it('defaults all channels on', () => {
    expect(defaultNdiChannelWanted()).toEqual({
      ar: true,
      '3d': true,
      '2d': true,
    })
    expect(NDI_CHANNEL_WANTED_DEFAULTS.ar).toBe(true)
  })

  it('normalizes partial overrides and ignores junk', () => {
    expect(normalizeNdiChannelWanted({ ar: false })).toEqual({
      ar: false,
      '3d': true,
      '2d': true,
    })
    expect(
      normalizeNdiChannelWanted({
        ar: 'nope' as unknown as boolean,
        '3d': false,
      }),
    ).toEqual({
      ar: true,
      '3d': false,
      '2d': true,
    })
  })

  it('loads all-on when sessionStorage missing or invalid', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
    }
    expect(loadNdiChannelWanted(storage)).toEqual(defaultNdiChannelWanted())
    mem.set(NDI_CHANNEL_WANTED_STORAGE_KEY, '{not-json')
    expect(loadNdiChannelWanted(storage)).toEqual(defaultNdiChannelWanted())
  })

  it('round-trips sessionStorage without touching project.json', () => {
    const mem = new Map<string, string>()
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v)
      },
    }
    const next = saveNdiChannelWanted({ '3d': false, '2d': false }, storage)
    expect(next).toEqual({ ar: true, '3d': false, '2d': false })
    expect(mem.get(NDI_CHANNEL_WANTED_STORAGE_KEY)).toContain('"3d":false')
    expect(loadNdiChannelWanted(storage)).toEqual(next)
    expect(isNdiChannelWanted('ar', next)).toBe(true)
    expect(isNdiChannelWanted('3d', next)).toBe(false)
  })
})
