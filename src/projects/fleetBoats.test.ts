import { describe, expect, it } from 'vitest'
import { buildRaceProject, serializeRaceProject } from './buildRaceProject.ts'
import {
  parseProjectFleetIds,
  resolveBootPanelBoats,
  resolveLoadedFleetBoats,
  snapshotFleetBoats,
} from './fleetBoats.ts'
import { parseRaceProject } from './parseRaceProject.ts'

const origin = { lat: 41.0082, lon: 28.9784, altMsl: 0 }

describe('snapshotFleetBoats / resolveLoadedFleetBoats', () => {
  it('custom boats survive parse/build without a names URL', () => {
    const boats = snapshotFleetBoats(
      ['25', '26'],
      [
        {
          id: '25',
          name: 'Custom One',
          category: 'pembe',
          color: '#e53935',
          visibility: 'ghost',
          plannedLat: 41.01,
          plannedLon: 29.02,
        },
        { id: '26', name: 'Custom Two', category: 'mavi', mapVisible: false },
      ],
    )
    const project = buildRaceProject({
      id: 'custom-fleet',
      name: 'Custom fleet',
      origin,
      boatIds: ['25', '26'],
      boats,
      povIds: ['1'],
      updatedAt: '2026-08-18T12:00:00.000Z',
    })
    expect(project.fleet.boatNamesUrl).toBeUndefined()
    expect(project.fleet.boatIds).toEqual(['25', '26'])
    expect(project.fleet.boats).toEqual([
      {
        id: '25',
        name: 'Custom One',
        category: 'pembe',
        color: '#e53935',
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

    const again = parseRaceProject(JSON.parse(serializeRaceProject(project)))
    expect(again.fleet.boats).toEqual(project.fleet.boats)
    expect(again.fleet.boatIds).toEqual(['25', '26'])
  })

  it('Load with fleet.boats does not inject extra catalogue-only demo ids', () => {
    const catalogue = new Map([
      ['21', { name: 'Bora Aksu', category: 'pembe' }],
      ['22', { name: 'Demo 22', category: 'mavi' }],
      ['23', { name: 'Demo 23', category: 'sari' }],
      ['24', { name: 'Demo 24', category: 'yesil' }],
    ])
    const rows = resolveLoadedFleetBoats({
      boatIds: ['25'],
      boats: [{ id: '25', name: 'Operator Boat', category: 'turuncu' }],
      catalogue,
    })
    expect(rows.map((r) => r.id)).toEqual(['25'])
    expect(rows[0]?.name).toBe('Operator Boat')
    expect(rows.some((r) => r.name === 'Bora Aksu')).toBe(false)
  })

  it('old packs without fleet.boats fill names from the catalogue for boatIds only', () => {
    const catalogue = new Map([
      ['21', { name: 'Bora Aksu', category: 'pembe' }],
      ['22', { name: 'Demo 22', category: 'mavi' }],
    ])
    const rows = resolveLoadedFleetBoats({
      boatIds: ['21'],
      catalogue,
    })
    expect(rows).toEqual([{ id: '21', name: 'Bora Aksu', category: 'pembe' }])
  })

  it('when boats is present, boatIds / catalogue ids are not added', () => {
    const catalogue = new Map([
      ['21', { name: 'Bora Aksu', category: 'pembe' }],
    ])
    const rows = resolveLoadedFleetBoats({
      boatIds: ['21', '25'],
      boats: [{ id: '25', name: 'Extra', category: 'mavi' }],
      catalogue,
    })
    expect(rows).toEqual([{ id: '25', name: 'Extra', category: 'mavi' }])
    expect(rows.some((r) => r.id === '21')).toBe(false)
  })

  it('round-trips out-of-band ids ["1","2"] with no 21–24', () => {
    const boats = snapshotFleetBoats(
      ['1', '2'],
      [
        { id: '1', name: 'One', category: 'pembe' },
        { id: '2', name: 'Two', category: 'mavi' },
      ],
    )
    const project = buildRaceProject({
      id: 'oob-fleet',
      name: 'OOB fleet',
      origin,
      boatIds: ['1', '2'],
      boats,
      povIds: ['1'],
      updatedAt: '2026-08-29T12:00:00.000Z',
    })
    expect(project.fleet.boatIds).toEqual(['1', '2'])
    expect(project.fleet.boats?.map((b) => b.id)).toEqual(['1', '2'])
    expect(project.fleet.boatIds).toEqual(
      project.fleet.boats?.map((b) => b.id),
    )
    const again = parseRaceProject(JSON.parse(serializeRaceProject(project)))
    expect(again.fleet.boatIds).toEqual(['1', '2'])
    expect(again.fleet.boats?.map((b) => b.id)).toEqual(['1', '2'])
    expect(again.fleet.boats?.map((b) => b.name)).toEqual(['One', 'Two'])
    expect(again.fleet.boatIds.some((id) => ['21', '22', '23', '24'].includes(id))).toBe(
      false,
    )
  })

  it('round-trips an empty fleet with no defaults', () => {
    const boats = snapshotFleetBoats([], [])
    expect(boats).toEqual([])
    const project = buildRaceProject({
      id: 'empty-fleet',
      name: 'Empty fleet',
      origin,
      boatIds: [],
      boats,
      povIds: ['1'],
      updatedAt: '2026-08-29T12:00:00.000Z',
    })
    expect(project.fleet.boatIds).toEqual([])
    expect(project.fleet.boats).toEqual([])
    const again = parseRaceProject(JSON.parse(serializeRaceProject(project)))
    expect(again.fleet.boatIds).toEqual([])
    expect(again.fleet.boats).toEqual([])
  })

  it('mismatched boats[] vs boatIds follows boats[] (broken test pack shape)', () => {
    const catalogue = new Map([
      ['21', { name: 'Bora Aksu', category: 'pembe' }],
      ['22', { name: 'Demo 22', category: 'mavi' }],
      ['23', { name: 'Demo 23', category: 'sari' }],
      ['24', { name: 'Demo 24', category: 'yesil' }],
    ])
    const parsed = parseRaceProject({
      schemaVersion: 1,
      id: 'test',
      name: 'test',
      origin,
      fleet: {
        boatIds: ['21', '22', '23', '24'],
        boats: [
          { id: '1', name: '1', category: '' },
          { id: '2', name: '2', category: '' },
        ],
      },
      povIds: ['3'],
    })
    expect(parsed.fleet.boatIds).toEqual(['1', '2'])
    const rows = resolveLoadedFleetBoats({
      boatIds: parsed.fleet.boatIds,
      boats: parsed.fleet.boats,
      catalogue,
    })
    expect(rows.map((r) => r.id)).toEqual(['1', '2'])
    expect(rows.some((r) => ['21', '22', '23', '24'].includes(r.id))).toBe(false)
  })

  it('loading a 1-boat pack after a 4-boat pack leaves only the new fleet', () => {
    const catalogue = new Map([
      ['21', { name: 'Bora Aksu', category: 'pembe' }],
      ['22', { name: 'Demo 22', category: 'mavi' }],
      ['23', { name: 'Demo 23', category: 'sari' }],
      ['24', { name: 'Demo 24', category: 'yesil' }],
    ])
    const a = resolveLoadedFleetBoats({
      boatIds: ['21', '22', '23', '24'],
      boats: [
        { id: '21', name: 'Bora Aksu', category: 'pembe' },
        { id: '22', name: 'Demo 22', category: 'mavi' },
        { id: '23', name: 'Demo 23', category: 'sari' },
        { id: '24', name: 'Demo 24', category: 'yesil' },
      ],
      catalogue,
    })
    const b = resolveLoadedFleetBoats({
      boatIds: ['1'],
      boats: [{ id: '1', name: 'Solo', category: '' }],
      catalogue,
    })
    expect(a.map((r) => r.id)).toEqual(['21', '22', '23', '24'])
    expect(b.map((r) => r.id)).toEqual(['1'])
  })

  it('round-trips explicit color and omits it when absent', () => {
    const withColor = snapshotFleetBoats(
      ['25'],
      [{ id: '25', name: 'Red boat', category: 'Ops', color: '#e53935' }],
    )
    expect(withColor[0]?.color).toBe('#e53935')
    const again = parseRaceProject(
      JSON.parse(
        serializeRaceProject(
          buildRaceProject({
            id: 'color-fleet',
            name: 'Color fleet',
            origin,
            boatIds: ['25'],
            boats: withColor,
            povIds: ['1'],
            updatedAt: '2026-08-18T12:00:00.000Z',
          }),
        ),
      ),
    )
    expect(again.fleet.boats?.[0]?.color).toBe('#e53935')

    const without = snapshotFleetBoats(
      ['25'],
      [{ id: '25', name: 'Legacy', category: 'pembe' }],
    )
    expect(without[0]?.color).toBeUndefined()
    const loaded = resolveLoadedFleetBoats({
      boatIds: ['25'],
      boats: without,
      catalogue: new Map(),
    })
    expect(loaded[0]?.color).toBeUndefined()
  })
})

describe('parseProjectFleetIds', () => {
  it('accepts any non-empty string, preserves order, dedupes, allows empty', () => {
    expect(parseProjectFleetIds(['1', '2', '1', '', ' 3 '])).toEqual([
      '1',
      '2',
      '3',
    ])
    expect(parseProjectFleetIds([])).toEqual([])
    expect(parseProjectFleetIds(undefined)).toEqual([])
  })
})

describe('resolveBootPanelBoats', () => {
  const packBoats = [{ id: '1', name: 'Pack', category: '' }]
  const sessionBoats = [
    { id: '21', name: 'Bora Aksu', category: 'pembe' },
    { id: '22', name: 'Demo 22', category: 'mavi' },
  ]

  it('loaded pack wins over a stale session fleet', () => {
    const rows = resolveBootPanelBoats({
      packLoaded: true,
      packBoats,
      sessionBoats,
    })
    expect(rows.map((r) => r.id)).toEqual(['1'])
    expect(rows.some((r) => r.id === '21')).toBe(false)
  })

  it('session fleet is used only when no pack is loaded', () => {
    const rows = resolveBootPanelBoats({
      packLoaded: false,
      packBoats: [],
      sessionBoats,
    })
    expect(rows.map((r) => r.id)).toEqual(['21', '22'])
  })
})

