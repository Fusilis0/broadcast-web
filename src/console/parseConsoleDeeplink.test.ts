import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDeeplinkToBoot } from './applyDeeplinkToBoot.ts'
import { parseConsoleDeeplink } from './parseConsoleDeeplink.ts'
import type { AppConfig } from '../config/types.ts'

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const { origin: originOverride, ...rest } = overrides
  return {
    telemetryMode: 'mock',
    replayUrl: '',
    courseUrl: '',
    sponsorsUrl: '',
    flagsUrl: '',
    boatNamesUrl: '',
    wsUrl: '',
    wsBoatUrl: '',
    boatIds: ['21', '22'],
    povIds: ['1', '2'],
    origin: {
      lat: 41.0,
      lon: 29.0,
      altMsl: 5,
      ...originOverride,
    },
    takeoffAltitudeMSL: 0,
    outputMode: 'preview',
    chromaKey: '',
    timecodeEnabled: true,
    timecodeCorner: 'bottom-right',
    timecodeSizePx: 96,
    ...rest,
  }
}

describe('parseConsoleDeeplink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses happy path query string', () => {
    const d = parseConsoleDeeplink(
      '?race=istanbul-demo&token=opaque-abc&mode=replay&originLat=41.0082&originLon=28.9784&originAltMsl=12.5&outputMode=chroma',
    )
    expect(d).toEqual({
      race: 'istanbul-demo',
      token: 'opaque-abc',
      mode: 'replay',
      originLat: 41.0082,
      originLon: 28.9784,
      originAltMsl: 12.5,
      outputMode: 'chroma',
    })
  })

  it('accepts URLSearchParams and leading-less search', () => {
    expect(parseConsoleDeeplink(new URLSearchParams({ mode: 'live' }))).toEqual({
      mode: 'live',
    })
    expect(parseConsoleDeeplink('mode=mock')).toEqual({ mode: 'mock' })
  })

  it('returns empty object when query missing', () => {
    expect(parseConsoleDeeplink('')).toEqual({})
    expect(parseConsoleDeeplink('?')).toEqual({})
  })

  it('ignores invalid mode with warn (does not crash)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(parseConsoleDeeplink('?mode=bogus&originLat=1')).toEqual({
      originLat: 1,
    })
    expect(warn).toHaveBeenCalled()
  })

  it('ignores non-finite origin numbers', () => {
    expect(
      parseConsoleDeeplink('?originLat=NaN&originLon=abc&originAltMsl='),
    ).toEqual({})
  })

  it('trims race/token; drops empty', () => {
    expect(parseConsoleDeeplink('?race=%20&token=  x  ')).toEqual({
      token: 'x',
    })
  })
})

describe('applyDeeplinkToBoot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('overrides mode, origin, outputMode; leaves rest', () => {
    const config = baseConfig()
    const handle = applyDeeplinkToBoot(config, {
      mode: 'live',
      originLat: 41.0082,
      originLon: 28.9784,
      originAltMsl: 3,
      outputMode: 'chroma',
    })
    expect(config.telemetryMode).toBe('live')
    expect(config.origin).toEqual({
      lat: 41.0082,
      lon: 28.9784,
      altMsl: 3,
    })
    expect(config.outputMode).toBe('chroma')
    expect(handle).toEqual({})
  })

  it('no-ops when deeplink empty', () => {
    const config = baseConfig({ telemetryMode: 'replay' })
    applyDeeplinkToBoot(config, {})
    expect(config.telemetryMode).toBe('replay')
    expect(config.origin).toEqual({ lat: 41.0, lon: 29.0, altMsl: 5 })
  })

  it('stashes race/token without validating token', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const config = baseConfig()
    const handle = applyDeeplinkToBoot(config, {
      race: 'r1',
      token: 'not-a-jwt',
    })
    expect(handle).toEqual({ race: 'r1', token: 'not-a-jwt' })
    expect(info).toHaveBeenCalledWith(
      '[console] deeplink handoff',
      expect.objectContaining({ race: 'r1', tokenPresent: true }),
    )
  })
})
