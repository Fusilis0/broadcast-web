import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildRaceProject,
  defaultEditedRaceId,
  serializeRaceProject,
} from './buildRaceProject.ts'
import { listLocalRaceIds } from './listLocalRaces.ts'
import { parseRaceProject } from './parseRaceProject.ts'

describe('buildRaceProject', () => {
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
})

describe('listLocalRaceIds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads ids from manifest JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ids: ['demo-istanbul', 'heat-2'] }),
    ) as unknown as typeof fetch
    await expect(listLocalRaceIds(fetchImpl)).resolves.toEqual([
      'demo-istanbul',
      'heat-2',
    ])
  })

  it('falls back to demo-istanbul when fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    await expect(listLocalRaceIds(fetchImpl)).resolves.toEqual([
      'demo-istanbul',
    ])
  })

  it('prepends demo-istanbul when omitted from manifest', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ids: ['heat-2'] }),
    ) as unknown as typeof fetch
    await expect(listLocalRaceIds(fetchImpl)).resolves.toEqual([
      'demo-istanbul',
      'heat-2',
    ])
  })
})
