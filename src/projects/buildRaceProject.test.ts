import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllOffsets,
  getOffsets,
  setOffsets,
  snapshotCalibrationByPovId,
} from '../calibration/index.ts'
import {
  buildRaceProject,
  defaultEditedRaceId,
  serializeRaceProject,
} from './buildRaceProject.ts'
import { listLocalRaceIds } from './listLocalRaces.ts'
import { parseRaceProject } from './parseRaceProject.ts'

describe('buildRaceProject', () => {
  afterEach(() => {
    clearAllOffsets()
  })

  it('embeds features and round-trips through parseRaceProject', () => {
    const project = buildRaceProject({
      id: 'edited-test',
      name: 'Edited Test',
      origin: { lat: 41.0082, lon: 28.9784, altMsl: 0 },
      boatIds: ['21', '22'],
      povIds: ['1', '2'],
      features: [
        {
          id: 'course:Mark-NW',
          name: 'Mark-NW',
          type: 'mark',
          points: [{ lat: 41.0087, lon: 28.9778, altMsl: 0 }],
          heightM: 5,
        },
      ],
      courseUrl: '/fixtures/course/demo-istanbul.json',
      boatNamesUrl: '/fixtures/boats/demo-istanbul-names.json',
      replayUrl: '/fixtures/telemetry/spine-demo.json',
      takeoffAltitudeMSL: 0,
      output: { outputMode: 'preview' },
      updatedAt: '2026-07-31T12:00:00.000Z',
    })

    expect(project.schemaVersion).toBe(1)
    expect(project.id).toBe('edited-test')
    expect(project.features).toHaveLength(1)
    expect(project.features?.[0]?.name).toBe('Mark-NW')
    expect(project.fleet.boatNamesUrl).toBe(
      '/fixtures/boats/demo-istanbul-names.json',
    )
    expect(project.courseUrl).toBe('/fixtures/course/demo-istanbul.json')
    expect(project.output?.outputMode).toBe('preview')

    const again = parseRaceProject(JSON.parse(serializeRaceProject(project)))
    expect(again.features).toHaveLength(1)
    expect(again.origin).toEqual(project.origin)
  })

  it('clones feature points (no shared refs)', () => {
    const points = [{ lat: 1, lon: 2, altMsl: 0 }]
    const project = buildRaceProject({
      id: 'x',
      name: 'X',
      origin: { lat: 1, lon: 2, altMsl: 0 },
      boatIds: ['21'],
      povIds: ['1'],
      features: [{ id: 'a', name: 'A', type: 'mark', points }],
    })
    points[0]!.lat = 99
    expect(project.features?.[0]?.points[0]?.lat).toBe(1)
  })

  it('defaultEditedRaceId is a safe-looking pack id prefix', () => {
    const id = defaultEditedRaceId(new Date('2026-07-31T12:34:56.789Z'))
    expect(id).toMatch(/^edited-2026-07-31T12-34-56$/)
  })

  it('captures runtime origin + fleet + povIds for Save as', () => {
    const origin = { lat: 41.08673822819249, lon: 29.061803205100848, altMsl: 2.5 }
    const project = buildRaceProject({
      id: 'bosphorus-heat',
      name: 'Bosphorus Heat',
      origin,
      boatIds: ['21', '25', '30'],
      povIds: ['1', '3', '11'],
      boatNamesUrl: '/fixtures/boats/demo-istanbul-names.json',
      courseUrl: '/fixtures/course/demo-istanbul.json',
      sponsorsUrl: '/fixtures/sponsors/demo-istanbul.json',
      flagsUrl: '/fixtures/flags/demo-istanbul-countdown.json',
      replayUrl: '/fixtures/telemetry/spine-demo.json',
      updatedAt: '2026-08-03T15:00:00.000Z',
    })

    expect(project.origin).toEqual(origin)
    expect(project.fleet.boatIds).toEqual(['21', '25', '30'])
    expect(project.fleet.boatNamesUrl).toBe(
      '/fixtures/boats/demo-istanbul-names.json',
    )
    expect(project.povIds).toEqual(['1', '3', '11'])
    expect(project.id).toBe('bosphorus-heat')
    expect(project.name).toBe('Bosphorus Heat')
  })

  it('embeds calibration.byPovId and round-trips through parse', () => {
    clearAllOffsets()
    setOffsets('1', { yawDeg: 8, fovHDeg: 40, altMeters: -1 })
    const calibration = snapshotCalibrationByPovId(['1', '2'])
    const project = buildRaceProject({
      id: 'calib-pack',
      name: 'Calib Pack',
      origin: { lat: 41, lon: 29, altMsl: 0 },
      boatIds: ['21'],
      povIds: ['1', '2'],
      calibration,
      updatedAt: '2026-08-04T12:00:00.000Z',
    })
    expect(project.calibration?.byPovId['1']?.yawDeg).toBe(8)
    expect(project.calibration?.byPovId['1']?.fovHDeg).toBe(40)
    expect(project.calibration?.byPovId['2']?.fovHDeg).toBe(66.8832)

    const again = parseRaceProject(JSON.parse(serializeRaceProject(project)))
    clearAllOffsets()
    expect(getOffsets('1').yawDeg).toBe(0)
    // hydrate path covered in applyRaceProjectToConfig tests; parse retains field
    expect(again.calibration?.byPovId['1']?.yawDeg).toBe(8)
    clearAllOffsets()
  })
})

describe('listLocalRaceIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads ids from manifest JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ids: ['demo-istanbul', 'heat-2'] }),
    ) as unknown as typeof fetch
    await expect(listLocalRaceIds({ fetchImpl, racesBridge: null })).resolves.toEqual([
      'demo-istanbul',
      'heat-2',
    ])
  })

  it('falls back to demo-istanbul when fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    await expect(
      listLocalRaceIds({ fetchImpl, racesBridge: null }),
    ).resolves.toEqual(['demo-istanbul'])
  })

  it('prepends demo-istanbul when omitted from manifest', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ids: ['heat-2'] }),
    ) as unknown as typeof fetch
    await expect(
      listLocalRaceIds({ fetchImpl, racesBridge: null }),
    ).resolves.toEqual(['demo-istanbul', 'heat-2'])
  })

  it('prefers API list when projectsApiBase is reachable', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/races') {
        return Response.json([
          { id: 'heat-api', name: 'Heat', revision: 1, updatedAt: '', labels: [] },
          { id: 'demo-istanbul', name: 'Demo', revision: 1, updatedAt: '', labels: [] },
        ])
      }
      throw new Error(`unexpected ${url}`)
    }) as unknown as typeof fetch
    await expect(
      listLocalRaceIds({
        projectsApiBase: '/api',
        fetchImpl,
        racesBridge: null,
      }),
    ).resolves.toEqual(['heat-api', 'demo-istanbul'])
  })

  it('falls back to static index when API is down', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/races') throw new Error('offline')
      if (url === '/races/index.json') {
        return Response.json({ ids: ['demo-istanbul', 'heat-2'] })
      }
      throw new Error(`unexpected ${url}`)
    }) as unknown as typeof fetch
    await expect(
      listLocalRaceIds({
        projectsApiBase: '/api',
        fetchImpl,
        racesBridge: null,
      }),
    ).resolves.toEqual(['demo-istanbul', 'heat-2'])
  })
})
