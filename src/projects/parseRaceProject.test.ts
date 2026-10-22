import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllOffsets,
  getOffsets,
} from '../calibration/index.ts'
import type { AppConfig } from '../config/types.ts'
import { applyRaceProjectToConfig } from './applyRaceProjectToConfig.ts'
import { isSafeRaceId, parseRaceProject } from './parseRaceProject.ts'

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
    buoyIds: [],
    origin: { lat: 0, lon: 0, altMsl: 0 },
    takeoffAltitudeMSL: 0,
    outputMode: 'preview',
    arBackground: 'alpha',
    chromaKey: '',
    timecodeEnabled: true,
    timecodeCorner: 'bottom-right',
    timecodeSizePx: 96,
    whepUrl: '',
    projectsApiBase: '',
    projectsRole: 'editor',
    projectsApiToken: '',
  }
}

describe('parseRaceProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearAllOffsets()
  })

  it('accepts a minimal valid project', () => {
    const p = parseRaceProject(minimal)
    expect(p.id).toBe('demo-istanbul')
    expect(p.name).toBe('Demo Istanbul')
    expect(p.origin).toEqual(minimal.origin)
    expect(p.fleet.boatIds).toEqual(['21', '22', '23', '24'])
    expect(p.povIds).toEqual(['1', '2'])
    expect(p.calibration).toBeUndefined()
    expect(p.landmarks).toBeUndefined()
  })

  it('soft-parses optional calibration.byPovId (aliases + junk ignored)', () => {
    const p = parseRaceProject({
      ...minimal,
      calibration: {
        byPovId: {
          '1': { yawDeg: 2.5, fovHDeg: 40, mystery: true },
          '2': { yaw: 1, alt: -0.5 },
          '': { yawDeg: 9 },
        },
        extraTop: 1,
      },
    })
    expect(p.calibration?.byPovId['1']).toMatchObject({
      yawDeg: 2.5,
      fovHDeg: 40,
    })
    expect(p.calibration?.byPovId['2']).toMatchObject({
      yawDeg: 1,
      altMeters: -0.5,
    })
    expect(p.calibration?.byPovId['']).toBeUndefined()
  })

  it('soft-parses optional landmarks.byId (junk / omit ignored)', () => {
    const p = parseRaceProject({
      ...minimal,
      landmarks: {
        byId: {
          'maidens-tower': {
            offsetM: { x: 2, y: 1, z: -3 },
            yawDeg: 15,
            mystery: true,
          },
          'galata-tower': { pitchDeg: 4 },
          '': { yawDeg: 9 },
          bad: 'nope',
        },
      },
    })
    expect(p.landmarks?.byId['maidens-tower']).toEqual({
      offsetM: { x: 2, y: 1, z: -3 },
      yawDeg: 15,
    })
    expect(p.landmarks?.byId['galata-tower']).toEqual({ pitchDeg: 4 })
    expect(p.landmarks?.byId['']).toBeUndefined()
    expect(p.landmarks?.byId.bad).toBeUndefined()

    const scaled = parseRaceProject({
      ...minimal,
      landmarks: { byId: { 'maidens-tower': { scale: 3 } } },
    })
    expect(scaled.landmarks?.byId['maidens-tower']).toEqual({ scale: 3 })

    const missing = parseRaceProject({
      ...minimal,
      landmarks: { byId: { junk: { offsetM: { x: 'nope' } } } },
    })
    expect(missing.landmarks).toBeUndefined()

    const omitted = parseRaceProject(minimal)
    expect(omitted.landmarks).toBeUndefined()
  })

  it('soft-parses optional fleet.boatVisibility (drops junk)', () => {
    const p = parseRaceProject({
      ...minimal,
      fleet: {
        boatIds: ['21', '22'],
        boatVisibility: {
          '21': 'ghost',
          '22': 'hidden',
          '23': 'nope',
          '': 'solid',
        },
      },
    })
    expect(p.fleet.boatVisibility).toEqual({
      '21': 'ghost',
      '22': 'hidden',
    })
  })

  it('accepts any non-empty fleet id and does not inject DEFAULT_BOAT_IDS', () => {
    const p = parseRaceProject({
      ...minimal,
      fleet: { boatIds: ['1', '2'] },
    })
    expect(p.fleet.boatIds).toEqual(['1', '2'])
    expect(p.fleet.boats).toBeUndefined()
  })

  it('empty fleet stays empty (boats [] and omitted boats)', () => {
    const withBoats = parseRaceProject({
      ...minimal,
      fleet: { boatIds: [], boats: [] },
    })
    expect(withBoats.fleet.boatIds).toEqual([])
    expect(withBoats.fleet.boats).toEqual([])

    const legacyEmpty = parseRaceProject({
      ...minimal,
      fleet: { boatIds: [] },
    })
    expect(legacyEmpty.fleet.boatIds).toEqual([])
    expect(legacyEmpty.fleet.boats).toBeUndefined()
  })

  it('when boats is present it is the complete fleet even if boatIds disagrees', () => {
    const p = parseRaceProject({
      ...minimal,
      fleet: {
        boatIds: ['21', '22', '23', '24'],
        boats: [
          { id: '1', name: '1', category: '' },
          { id: '2', name: '2', category: '' },
        ],
      },
    })
    expect(p.fleet.boatIds).toEqual(['1', '2'])
    expect(p.fleet.boats?.map((b) => b.id)).toEqual(['1', '2'])
  })

  it('soft-parses optional fleet.boats (drops junk; old packs omit the field)', () => {
    const p = parseRaceProject({
      ...minimal,
      fleet: {
        boatIds: ['25', '26'],
        boats: [
          {
            id: '25',
            name: 'Custom One',
            category: 'pembe',
            color: '#1e88e5',
            visibility: 'ghost',
            plannedLat: 41.01,
            plannedLon: 29.02,
          },
          { id: '26', name: 'Custom Two', category: 'mavi', mapVisible: false, color: 'red' },
          { name: 'no-id' },
          null,
        ],
      },
    })
    expect(p.fleet.boats).toEqual([
      {
        id: '25',
        name: 'Custom One',
        category: 'pembe',
        color: '#1e88e5',
        visibility: 'ghost',
        plannedLat: 41.01,
        plannedLon: 29.02,
      },
      {
        id: '26',
        name: 'Custom Two',
        category: 'mavi',
        mapVisible: false,
      },
    ])
    const old = parseRaceProject(minimal)
    expect(old.fleet.boats).toBeUndefined()
  })

  it('soft-parses fleet.boatMapVisible / povMapVisible and feature visible* flags', () => {
    const p = parseRaceProject({
      ...minimal,
      fleet: {
        boatIds: ['21'],
        boatMapVisible: { '21': false, '22': true, junk: 'x' },
        povMapVisible: { '1': false },
      },
      features: [
        {
          id: 'buoy:1',
          name: 'B1',
          type: 'buoy',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          visible3d: false,
          visible2d: true,
        },
      ],
    })
    expect(p.fleet.boatMapVisible).toEqual({ '21': false, '22': true })
    expect(p.fleet.povMapVisible).toEqual({ '1': false })
    expect(p.features?.[0]?.visible3d).toBe(false)
    expect(p.features?.[0]?.visible2d).toBe(true)
  })

  it('soft-parses feature visibleBuoyMesh / visibleTag (omit stays unset)', () => {
    const p = parseRaceProject({
      ...minimal,
      features: [
        {
          id: 'buoy:1',
          name: 'B1',
          type: 'buoy',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          visibleBuoyMesh: false,
          visibleTag: true,
        },
        {
          id: 'course:Mark-NW',
          name: 'Mark-NW',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
        },
      ],
    })
    expect(p.features?.[0]?.visibleBuoyMesh).toBe(false)
    expect(p.features?.[0]?.visibleTag).toBe(true)
    expect(p.features?.[1]?.visibleBuoyMesh).toBeUndefined()
    expect(p.features?.[1]?.visibleTag).toBeUndefined()
  })

  it('soft-parses feature rounding (unknown → none; omit stays unset)', () => {
    const p = parseRaceProject({
      ...minimal,
      features: [
        {
          id: 'course:Mark-NW',
          name: 'Mark-NW',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          rounding: 'cw',
        },
        {
          id: 'buoy:1',
          name: 'B1',
          type: 'buoy',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
          rounding: 'spinwise',
        },
        {
          id: 'course:Mark-SE',
          name: 'Mark-SE',
          type: 'mark',
          points: [{ lat: 41, lon: 29, altMsl: 0 }],
        },
      ],
    })
    expect(p.features?.[0]?.rounding).toBe('cw')
    expect(p.features?.[1]?.rounding).toBe('none')
    expect(p.features?.[2]?.rounding).toBeUndefined()
  })

  it('soft-parses additive panelColor / frameColor (hex or number; omit stays unset)', () => {
    const p = parseRaceProject({
      ...minimal,
      features: [
        {
          id: 'sponsor:sp1',
          name: 'sp1',
          type: 'sponsor',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29, altMsl: 0 },
          ],
          panelColor: '#f4f4f2',
          frameColor: 0x2c3338,
        },
        {
          id: 'sponsor:sp2',
          name: 'sp2',
          type: 'sponsor',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29, altMsl: 0 },
          ],
        },
        {
          id: 'chain:1',
          name: 'chain-1',
          type: 'billboardChain',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29.01, altMsl: 0 },
          ],
          panelColor: 'not-a-color',
        },
      ],
    })
    expect(p.features?.[0]?.panelColor).toBe(0xf4f4f2)
    expect(p.features?.[0]?.frameColor).toBe(0x2c3338)
    expect(p.features?.[1]?.panelColor).toBeUndefined()
    expect(p.features?.[1]?.frameColor).toBeUndefined()
    expect(p.features?.[2]?.panelColor).toBeUndefined()
  })

  it('soft-parses additive panelAlpha / boardAspect (omit stays unset)', () => {
    const p = parseRaceProject({
      ...minimal,
      features: [
        {
          id: 'sponsor:sp1',
          name: 'sp1',
          type: 'sponsor',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29, altMsl: 0 },
          ],
          panelAlpha: 0.35,
          boardAspect: 2.5,
        },
        {
          id: 'sponsor:sp2',
          name: 'sp2',
          type: 'sponsor',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29, altMsl: 0 },
          ],
        },
        {
          id: 'chain:1',
          name: 'chain-1',
          type: 'billboardChain',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29.01, altMsl: 0 },
          ],
          panelAlpha: '0.2',
        },
      ],
    })
    expect(p.features?.[0]?.panelAlpha).toBe(0.35)
    expect(p.features?.[0]?.boardAspect).toBe(2.5)
    expect(p.features?.[1]?.panelAlpha).toBeUndefined()
    expect(p.features?.[1]?.boardAspect).toBeUndefined()
    expect(p.features?.[2]?.panelAlpha).toBe(0.2)
  })

  it('round-trips billboardChain logos weights; empty array stays empty', () => {
    const built = parseRaceProject({
      ...minimal,
      features: [
        {
          id: 'chain:1',
          name: 'chain-1',
          type: 'billboardChain',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29.01, altMsl: 0 },
          ],
          logos: [
            { url: '/assets/library/image/rolex-f724a5ba.png', weight: 3 },
            { url: '/assets/library/image/senexus-57797468.png', weight: 2 },
          ],
        },
        {
          id: 'chain:2',
          name: 'chain-2',
          type: 'billboardChain',
          points: [
            { lat: 41, lon: 29, altMsl: 0 },
            { lat: 41.01, lon: 29.01, altMsl: 0 },
          ],
          logos: [],
        },
      ],
    })
    expect(built.features?.[0]?.logos).toEqual([
      { url: '/assets/library/image/rolex-f724a5ba.png', weight: 3 },
      { url: '/assets/library/image/senexus-57797468.png', weight: 2 },
    ])
    expect(built.features?.[1]?.logos).toEqual([])
    expect(built.features?.[1]?.textureUrl).toBeUndefined()
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

  it('soft-parses optional output.srtUrlTemplate + srtByPovId; old packs omit them', () => {
    const p = parseRaceProject({
      ...minimal,
      output: {
        outputMode: 'preview',
        srtUrlTemplate:
          'srt://127.0.0.1:9000?mode=caller&streamid=read:cam{srtId}:pub{srtId}:',
        srtByPovId: { '5': '30', '6': ' 31 ', '': 'x', junk: 2 },
      },
    })
    expect(p.output?.srtUrlTemplate).toContain('{srtId}')
    expect(p.output?.srtByPovId).toEqual({ '5': '30', '6': '31' })
    const old = parseRaceProject(minimal)
    expect(old.output).toBeUndefined()
    expect(old.output?.srtUrlTemplate).toBeUndefined()
    expect(old.output?.srtByPovId).toBeUndefined()
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

  it('keeps features: [] as a complete world even when fixture URLs are present', () => {
    const p = parseRaceProject({
      ...minimal,
      features: [],
      courseUrl: '/fixtures/course/demo-istanbul.json',
      sponsorsUrl: '/fixtures/sponsors/demo-istanbul.json',
      flagsUrl: '/fixtures/flags/demo-istanbul-countdown.json',
    })
    expect(p.features).toEqual([])
    expect(p.courseUrl).toBe('/fixtures/course/demo-istanbul.json')
  })

  it('omits features when the key is absent (legacy URL packs)', () => {
    const p = parseRaceProject({
      ...minimal,
      courseUrl: '/fixtures/course/demo-istanbul.json',
    })
    expect(p.features).toBeUndefined()
    expect(p.courseUrl).toBe('/fixtures/course/demo-istanbul.json')
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
  afterEach(() => {
    clearAllOffsets()
  })

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

  it('copies an empty or out-of-band project fleet onto config as-is', () => {
    const empty = baseConfig()
    applyRaceProjectToConfig(
      empty,
      parseRaceProject({ ...minimal, fleet: { boatIds: [], boats: [] } }),
    )
    expect(empty.boatIds).toEqual([])

    const oob = baseConfig()
    applyRaceProjectToConfig(
      oob,
      parseRaceProject({ ...minimal, fleet: { boatIds: ['1', '2'] } }),
    )
    expect(oob.boatIds).toEqual(['1', '2'])
  })

  it('pack output.timecodeEnabled true overrides a false config default', () => {
    const config = baseConfig()
    config.timecodeEnabled = false
    applyRaceProjectToConfig(
      config,
      parseRaceProject({
        ...minimal,
        output: { timecodeEnabled: true },
      }),
    )
    expect(config.timecodeEnabled).toBe(true)
  })

  it('omitted pack timecodeEnabled leaves the config default', () => {
    const config = baseConfig()
    config.timecodeEnabled = false
    applyRaceProjectToConfig(config, parseRaceProject(minimal))
    expect(config.timecodeEnabled).toBe(false)
  })

  it('hydrates offsetsStore from calibration; old packs leave store alone', () => {
    const config = baseConfig()
    applyRaceProjectToConfig(config, parseRaceProject(minimal))
    expect(getOffsets('1').yawDeg).toBe(0)

    const withCal = parseRaceProject({
      ...minimal,
      calibration: {
        byPovId: { '1': { yawDeg: 7, fovHDeg: 42 } },
      },
    })
    applyRaceProjectToConfig(config, withCal)
    expect(getOffsets('1').yawDeg).toBe(7)
    expect(getOffsets('1').fovHDeg).toBe(42)
  })
})
