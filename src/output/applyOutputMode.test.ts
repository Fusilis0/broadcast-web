import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyOutputMode,
  normalizeArBackground,
  normalizeOutputMode,
  parseChromaKey,
  resolveClearAppearance,
} from './applyOutputMode.ts'
import {
  DEFAULT_CHROMA_KEY,
  PREVIEW_CLEAR_COLOR,
  TRANSPARENT_CLEAR_COLOR,
} from './types.ts'

describe('normalizeOutputMode', () => {
  it('keeps preview, chroma, and transparent', () => {
    expect(normalizeOutputMode('preview')).toBe('preview')
    expect(normalizeOutputMode('chroma')).toBe('chroma')
    expect(normalizeOutputMode('transparent')).toBe('transparent')
  })

  it('maps unknown / future modes to preview', () => {
    expect(normalizeOutputMode('webrtc-underlay')).toBe('preview')
    expect(normalizeOutputMode('egress')).toBe('preview')
    expect(normalizeOutputMode('')).toBe('preview')
    expect(normalizeOutputMode(undefined)).toBe('preview')
    expect(normalizeOutputMode(42)).toBe('preview')
  })
})

describe('normalizeArBackground', () => {
  it('keeps alpha and video', () => {
    expect(normalizeArBackground('alpha')).toBe('alpha')
    expect(normalizeArBackground('video')).toBe('video')
  })

  it('maps unknown / missing to alpha', () => {
    expect(normalizeArBackground(undefined)).toBe('alpha')
    expect(normalizeArBackground('')).toBe('alpha')
    expect(normalizeArBackground('underlay')).toBe('alpha')
  })
})

describe('parseChromaKey', () => {
  it('defaults to 0x00ff00', () => {
    expect(parseChromaKey(undefined)).toBe(DEFAULT_CHROMA_KEY)
    expect(parseChromaKey('')).toBe(DEFAULT_CHROMA_KEY)
    expect(parseChromaKey('nope')).toBe(DEFAULT_CHROMA_KEY)
  })

  it('accepts #rrggbb and rrggbb', () => {
    expect(parseChromaKey('#00ff00')).toBe(0x00ff00)
    expect(parseChromaKey('00FF00')).toBe(0x00ff00)
    expect(parseChromaKey('#ff00ff')).toBe(0xff00ff)
  })

  it('accepts numeric hex in range', () => {
    expect(parseChromaKey(0x00ff00)).toBe(0x00ff00)
    expect(parseChromaKey(0)).toBe(0)
  })
})

describe('resolveClearAppearance', () => {
  it('preview → dark clear', () => {
    expect(resolveClearAppearance('preview')).toEqual({
      color: PREVIEW_CLEAR_COLOR,
      alpha: 1,
    })
  })

  it('chroma → default green', () => {
    expect(resolveClearAppearance('chroma')).toEqual({
      color: DEFAULT_CHROMA_KEY,
      alpha: 1,
    })
  })

  it('chroma honors chromaKey override', () => {
    expect(
      resolveClearAppearance('chroma', { chromaKey: '#ff00ff' }),
    ).toEqual({ color: 0xff00ff, alpha: 1 })
  })

  it('transparent → black clear with alpha 0', () => {
    expect(resolveClearAppearance('transparent')).toEqual({
      color: TRANSPARENT_CLEAR_COLOR,
      alpha: 0,
    })
  })

  it('unknown mode → preview dark', () => {
    expect(resolveClearAppearance('egress')).toEqual({
      color: PREVIEW_CLEAR_COLOR,
      alpha: 1,
    })
  })
})

describe('applyOutputMode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls setClearColor with mapped appearance', () => {
    const setClearColor = vi.fn()
    const appearance = applyOutputMode({ setClearColor }, 'chroma')
    expect(appearance).toEqual({ color: DEFAULT_CHROMA_KEY, alpha: 1 })
    expect(setClearColor).toHaveBeenCalledWith(DEFAULT_CHROMA_KEY, 1)
  })

  it('preview maps to dark clear', () => {
    const setClearColor = vi.fn()
    applyOutputMode({ setClearColor }, 'preview')
    expect(setClearColor).toHaveBeenCalledWith(PREVIEW_CLEAR_COLOR, 1)
  })

  it('transparent maps to alpha 0', () => {
    const setClearColor = vi.fn()
    applyOutputMode({ setClearColor }, 'transparent')
    expect(setClearColor).toHaveBeenCalledWith(TRANSPARENT_CLEAR_COLOR, 0)
  })
})
