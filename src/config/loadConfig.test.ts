import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_BOAT_IDS,
  DEFAULT_BUOY_IDS,
  DEFAULT_POV_IDS,
  normalizeBoatIds,
  normalizeBuoyIds,
  normalizeConfig,
  normalizePovIds,
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

describe('normalizePovIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns default ["1","2"] when missing', () => {
    expect(normalizePovIds(undefined)).toEqual([...DEFAULT_POV_IDS])
    expect(normalizePovIds(null)).toEqual([...DEFAULT_POV_IDS])
  })

  it('keeps drone and cam band ids', () => {
    expect(normalizePovIds(['1', '2', '5', '11', '12'])).toEqual([
      '1',
      '2',
      '5',
      '11',
      '12',
    ])
  })

  it('filters boats / pilots / junk and falls back if empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(normalizePovIds(['21', '81', '99'])).toEqual([...DEFAULT_POV_IDS])
    expect(warn).toHaveBeenCalled()
  })

  it('allows cams 11/12 alone', () => {
    expect(normalizePovIds(['11', '12'])).toEqual(['11', '12'])
  })

  it('dedupes and drops empty strings', () => {
    expect(normalizePovIds(['1', '', '1', '2'])).toEqual(['1', '2'])
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

describe('normalizeConfig povIds', () => {
  it('exposes povIds on AppConfig', () => {
    const cfg = normalizeConfig({
      telemetryMode: 'mock',
      povIds: ['1', '11'],
    })
    expect(cfg.povIds).toEqual(['1', '11'])
  })

  it('defaults povIds when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.povIds).toEqual([...DEFAULT_POV_IDS])
  })
})

describe('normalizeBuoyIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty when missing', () => {
    expect(normalizeBuoyIds(undefined)).toEqual([...DEFAULT_BUOY_IDS])
    expect(normalizeBuoyIds(null)).toEqual([])
  })

  it('keeps free-form ids (no boat band filter)', () => {
    expect(normalizeBuoyIds(['91', 'mark-a'])).toEqual(['91', 'mark-a'])
  })

  it('preserves explicit empty array', () => {
    expect(normalizeBuoyIds([])).toEqual([])
  })

  it('dedupes and drops empty / non-string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(normalizeBuoyIds(['91', '', '91', 7 as unknown as string])).toEqual([
      '91',
    ])
    expect(warn).toHaveBeenCalled()
  })
})

describe('normalizeConfig buoyIds', () => {
  it('exposes buoyIds on AppConfig', () => {
    const cfg = normalizeConfig({
      telemetryMode: 'mock',
      buoyIds: ['91'],
    })
    expect(cfg.buoyIds).toEqual(['91'])
  })

  it('defaults buoyIds to empty when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.buoyIds).toEqual([])
  })
})

describe('normalizeConfig courseUrl', () => {
  it('defaults courseUrl when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.courseUrl).toBe('/fixtures/course/demo-istanbul.json')
  })

  it('keeps custom courseUrl', () => {
    const cfg = normalizeConfig({
      courseUrl: '/fixtures/course/custom.json',
    })
    expect(cfg.courseUrl).toBe('/fixtures/course/custom.json')
  })
})

describe('normalizeConfig sponsorsUrl', () => {
  it('defaults sponsorsUrl when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.sponsorsUrl).toBe('/fixtures/sponsors/demo-istanbul.json')
  })

  it('keeps custom sponsorsUrl', () => {
    const cfg = normalizeConfig({
      sponsorsUrl: '/fixtures/sponsors/custom.json',
    })
    expect(cfg.sponsorsUrl).toBe('/fixtures/sponsors/custom.json')
  })
})

describe('normalizeConfig flagsUrl', () => {
  it('defaults flagsUrl when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.flagsUrl).toBe('/fixtures/flags/demo-istanbul-countdown.json')
  })

  it('keeps custom flagsUrl', () => {
    const cfg = normalizeConfig({
      flagsUrl: '/fixtures/flags/custom.json',
    })
    expect(cfg.flagsUrl).toBe('/fixtures/flags/custom.json')
  })
})

describe('normalizeConfig boatNamesUrl', () => {
  it('defaults boatNamesUrl when absent', () => {
    const cfg = normalizeConfig({})
    expect(cfg.boatNamesUrl).toBe('/fixtures/boats/demo-istanbul-names.json')
  })

  it('keeps custom boatNamesUrl', () => {
    const cfg = normalizeConfig({
      boatNamesUrl: '/fixtures/boats/custom.json',
    })
    expect(cfg.boatNamesUrl).toBe('/fixtures/boats/custom.json')
  })
})

describe('normalizeConfig outputMode / chromaKey', () => {
  it('defaults outputMode to preview and chromaKey empty', () => {
    const cfg = normalizeConfig({})
    expect(cfg.outputMode).toBe('preview')
    expect(cfg.chromaKey).toBe('')
    expect(cfg.arBackground).toBe('alpha')
  })

  it('keeps chroma outputMode and chromaKey', () => {
    const cfg = normalizeConfig({
      outputMode: 'chroma',
      chromaKey: '#00ff00',
    })
    expect(cfg.outputMode).toBe('chroma')
    expect(cfg.chromaKey).toBe('#00ff00')
  })

  it('keeps transparent outputMode string (OUT normalizes)', () => {
    expect(normalizeConfig({ outputMode: 'transparent' }).outputMode).toBe(
      'transparent',
    )
  })

  it('defaults arBackground to alpha when missing', () => {
    expect(normalizeConfig({}).arBackground).toBe('alpha')
  })

  it('keeps video arBackground string (OUT normalizes)', () => {
    expect(normalizeConfig({ arBackground: 'video' }).arBackground).toBe(
      'video',
    )
  })
})

describe('normalizeConfig whepUrl', () => {
  it('defaults whepUrl to empty', () => {
    expect(normalizeConfig({}).whepUrl).toBe('')
  })

  it('trims whepUrl', () => {
    expect(
      normalizeConfig({ whepUrl: '  http://127.0.0.1:8889/cam1/whep  ' })
        .whepUrl,
    ).toBe('http://127.0.0.1:8889/cam1/whep')
  })
})

describe('normalizeConfig projectsApiBase', () => {
  it('defaults projectsApiBase to empty', () => {
    expect(normalizeConfig({}).projectsApiBase).toBe('')
  })

  it('trims projectsApiBase', () => {
    expect(
      normalizeConfig({ projectsApiBase: '  /api  ' }).projectsApiBase,
    ).toBe('/api')
  })
})

describe('normalizeConfig projectsRole / projectsApiToken', () => {
  it('defaults role editor and empty token', () => {
    const cfg = normalizeConfig({})
    expect(cfg.projectsRole).toBe('editor')
    expect(cfg.projectsApiToken).toBe('')
  })

  it('normalizes air role and trims token', () => {
    const cfg = normalizeConfig({
      projectsRole: 'AIR-ONLY',
      projectsApiToken: '  secret  ',
    })
    expect(cfg.projectsRole).toBe('air')
    expect(cfg.projectsApiToken).toBe('secret')
  })
})

describe('normalizeConfig cesium ion', () => {
  it('defaults empty token and World Terrain asset 1 + Bing Aerial 2', () => {
    const cfg = normalizeConfig({})
    expect(cfg.cesiumIonToken).toBe('')
    expect(cfg.cesiumIonAssetId).toBe(1)
    expect(cfg.cesiumIonImageryAssetId).toBe(2)
  })

  it('trims token and parses asset ids', () => {
    const cfg = normalizeConfig({
      cesiumIonToken: '  abc  ',
      cesiumIonAssetId: 1,
      cesiumIonImageryAssetId: 0,
    })
    expect(cfg.cesiumIonToken).toBe('abc')
    expect(cfg.cesiumIonAssetId).toBe(1)
    expect(cfg.cesiumIonImageryAssetId).toBe(0)
  })
})

describe('normalizeConfig timecode', () => {
  it('defaults timecodeEnabled true, bottom-right, 96px', () => {
    const cfg = normalizeConfig({})
    expect(cfg.timecodeEnabled).toBe(true)
    expect(cfg.timecodeCorner).toBe('bottom-right')
    expect(cfg.timecodeSizePx).toBe(96)
  })

  it('honors timecodeEnabled false and corner / size', () => {
    const cfg = normalizeConfig({
      timecodeEnabled: false,
      timecodeCorner: 'bottom-left',
      timecodeSizePx: 128,
    })
    expect(cfg.timecodeEnabled).toBe(false)
    expect(cfg.timecodeCorner).toBe('bottom-left')
    expect(cfg.timecodeSizePx).toBe(128)
  })

  it('clamps size and rejects unknown corner', () => {
    expect(normalizeConfig({ timecodeSizePx: 8 }).timecodeSizePx).toBe(32)
    expect(normalizeConfig({ timecodeSizePx: 999 }).timecodeSizePx).toBe(256)
    expect(normalizeConfig({ timecodeCorner: 'top-left' }).timecodeCorner).toBe(
      'bottom-right',
    )
  })
})
