import { describe, expect, it } from 'vitest'
import { buildRaceProject, serializeRaceProject } from './buildRaceProject.ts'
import {
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

  it('names URL / catalogue fills boatIds missing from boats[]', () => {
    const catalogue = new Map([
      ['21', { name: 'Bora Aksu', category: 'pembe' }],
    ])
    const rows = resolveLoadedFleetBoats({
      boatIds: ['21', '25'],
      boats: [{ id: '25', name: 'Extra', category: 'mavi' }],
      catalogue,
    })
    expect(rows).toEqual([
      { id: '21', name: 'Bora Aksu', category: 'pembe' },
      { id: '25', name: 'Extra', category: 'mavi' },
    ])
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
