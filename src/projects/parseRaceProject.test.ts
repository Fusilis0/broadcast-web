import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyRaceProjectToConfig } from './applyRaceProjectToConfig.ts'
import { isSafeRaceId, parseRaceProject } from './parseRaceProject.ts'
import type { AppConfig } from '../config/types.ts'

const minimal = {
  schemaVersion: 1,
  id: 'demo-istanbul',
  name: 'Demo Istanbul',
  origin: { lat: 41.0082, lon: 28.9784, altMsl: 0 },
  fleet: { boatIds: ['21', '22', '23', '24'] },
  povIds: ['1', '2'],
}

function baseConfig(): AppConfig {
  return {
    telemetryMode: 'mock',
    replayUrl: '/fixtures/telemetry/spine-demo.json',
    courseUrl: '/fixtures/course/demo-istanbul.json',
    sponsorsUrl: '/fixtures/sponsors/demo-istanbul.json',
    flagsUrl: '/fixtures/flags/demo-istanbul-countdown.json',
    boatNamesUrl: '/fixtures/boats/demo-istanbul-names.json',
    wsUrl: '',
    wsBoatUrl: '',
    boatIds: ['21'],
    povIds: ['1'],
    origin: { lat: 0, lon: 0, altMsl: 0 },
    takeoffAltitudeMSL: 0,
    outputMode: 'preview',
    chromaKey: '',
    timecodeEnabled: true,
    timecodeCorner: 'bottom-right',
    timecodeSizePx: 96,
    whepUrl: '',
  }
}

describe('parseRaceProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts a minimal valid project', () => {
    const p = parseRaceProject(minimal)
    expect(p.id).toBe('demo-istanbul')
    expect(p.name).toBe('Demo Istanbul')
    expect(p.origin).toEqual(minimal.origin)
    expect(p.fleet.boatIds).toEqual(['21', '22', '23', '24'])
    expect(p.povIds).toEqual(['1', '2'])
  })

  it('accepts embedded WorldFeature list', () => {
    const p = parseRaceProject({
      ...minimal,
      features: [
        {
          id: 'course:Mark-NW',
          name: 'Mark-NW',
          type: 'mark',
          points: [{ lat: 41.0087, lon: 28.9778, altMsl: 0 }],
        },
      ],
      courseUrl: '/fixtures/course/demo-istanbul.json',
      output: { outputMode: 'chroma' },
    })
    expect(p.features).toHaveLength(1)
    expect(p.features?.[0]?.type).toBe('mark')
    expect(p.courseUrl).toBe('/fixtures/course/demo-istanbul.json')
    expect(p.output?.outputMode).toBe('chroma')
  })

  it('rejects garbage / non-objects', () => {
    expect(() => parseRaceProject(null)).toThrow(/JSON object/)
    expect(() => parseRaceProject('nope')).toThrow(/JSON object/)
    expect(() => parseRaceProject(42)).toThrow(/JSON object/)
  })

  it('rejects missing required fields', () => {
    expect(() => parseRaceProject({})).toThrow(/schemaVersion/)
    expect(() =>
      parseRaceProject({ schemaVersion: 1, name: 'x', origin: minimal.origin }),
    ).toThrow(/id/)
    expect(() =>
      parseRaceProject({
        schemaVersion: 1,
        id: 'x',
        name: 'x',
        origin: { lat: 1, lon: 2 },
        fleet: { boatIds: ['21'] },
        povIds: ['1'],
      }),
    ).toThrow(/origin/)
    expect(() =>
      parseRaceProject({
        schemaVersion: 1,
        id: 'x',
        name: 'x',
        origin: minimal.origin,
        povIds: ['1'],
      }),
    ).toThrow(/fleet/)
  })

  it('rejects invalid features entries', () => {
    expect(() =>
      parseRaceProject({
        ...minimal,
        features: [{ id: 'bad', name: 'bad', type: 'not-a-type', points: [] }],
      }),
    ).toThrow(/invalid WorldFeature/)
  })
})

describe('isSafeRaceId', () => {
  it('allows simple pack ids', () => {
    expect(isSafeRaceId('demo-istanbul')).toBe(true)
    expect(isSafeRaceId('heat_2')).toBe(true)
  })

  it('rejects path traversal / empty', () => {
    expect(isSafeRaceId('')).toBe(false)
    expect(isSafeRaceId('../etc')).toBe(false)
    expect(isSafeRaceId('a/b')).toBe(false)
    expect(isSafeRaceId('a b')).toBe(false)
  })
})

describe('applyRaceProjectToConfig', () => {
  it('merges origin, fleet, URLs, and output defaults', () => {
    const config = baseConfig()
    const project = parseRaceProject({
      ...minimal,
      takeoffAltitudeMSL: 12,
      fleet: {
        boatIds: ['21', '22'],
        boatNamesUrl: '/fixtures/boats/demo-istanbul-names.json',
      },
      povIds: ['1', '11'],
      replayUrl: '/fixtures/telemetry/spine-fleet.json',
      courseUrl: '/races/demo-istanbul/course.json',
      output: { outputMode: 'chroma', whepUrl: 'http://127.0.0.1:8889/c/whep' },
    })
    applyRaceProjectToConfig(config, project)
    expect(config.origin).toEqual(minimal.origin)
    expect(config.boatIds).toEqual(['21', '22'])
    expect(config.povIds).toEqual(['1', '11'])
    expect(config.takeoffAltitudeMSL).toBe(12)
    expect(config.replayUrl).toBe('/fixtures/telemetry/spine-fleet.json')
    expect(config.courseUrl).toBe('/races/demo-istanbul/course.json')
    expect(config.outputMode).toBe('chroma')
    expect(config.whepUrl).toBe('http://127.0.0.1:8889/c/whep')
  })
})
