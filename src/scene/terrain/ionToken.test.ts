import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseCesiumIonAssetId,
  readSessionCesiumIonToken,
  resolveCesiumIonToken,
  writeSessionCesiumIonToken,
} from './ionToken.ts'

describe('resolveCesiumIonToken', () => {
  it('prefers config.json over session and env (local studio token)', () => {
    expect(resolveCesiumIonToken('  from-git  ', 'from-session')).toBe(
      'from-git',
    )
  })

  it('uses session when config is empty', () => {
    expect(resolveCesiumIonToken('', '  pasted  ')).toBe('pasted')
    expect(resolveCesiumIonToken('   ', 'pasted')).toBe('pasted')
  })

  it('falls through to empty when config and session are empty', () => {
    expect(resolveCesiumIonToken('', '')).toBe(
      typeof import.meta.env.VITE_CESIUM_ION_TOKEN === 'string'
        ? import.meta.env.VITE_CESIUM_ION_TOKEN.trim()
        : '',
    )
  })
})

describe('session ion token', () => {
  const mem = new Map<string, string>()
  const stub = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value)
    },
    removeItem: (key: string) => {
      mem.delete(key)
    },
  }

  beforeEach(() => {
    mem.clear()
    vi.stubGlobal('sessionStorage', stub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips a trimmed token and clears on empty', () => {
    writeSessionCesiumIonToken('  abc123  ')
    expect(readSessionCesiumIonToken()).toBe('abc123')
    writeSessionCesiumIonToken('   ')
    expect(readSessionCesiumIonToken()).toBe('')
  })
})

describe('parseCesiumIonAssetId', () => {
  it('accepts positive ints and falls back otherwise', () => {
    expect(parseCesiumIonAssetId(2, 1)).toBe(2)
    expect(parseCesiumIonAssetId('3', 1)).toBe(3)
    expect(parseCesiumIonAssetId(0, 1)).toBe(1)
    expect(parseCesiumIonAssetId('nope', 9)).toBe(9)
  })
})
