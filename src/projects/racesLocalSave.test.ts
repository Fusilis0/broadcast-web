import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  mergeLocalRaceIds,
  resolveRacesKind,
  upsertRaceIndexIds,
} from './racesIndex.ts'
import type { StudioRacesBridge } from './racesBridge.ts'
import { listLocalRaceIds } from './listLocalRaces.ts'
import { loadRaceProject } from './loadRaceProject.ts'

const require = createRequire(import.meta.url)
const racesFs = require('../../desktop/racesFs.cjs') as {
  isSafeRaceId: (id: unknown) => boolean
  resolveRacesDir: (
    loadKind: 'url' | 'file',
    paths: { desktopDir: string; userDataPath: string },
  ) => string
  resolveRacesKind: (loadKind: 'url' | 'file') => 'public' | 'userData'
  upsertRaceIndexIds: (existing: unknown[], id?: string) => string[]
  saveRaceProject: (
    racesDir: string,
    project: unknown,
  ) => Promise<{ ok: boolean; id?: string; error?: string }>
  listRaceIds: (
    racesDir: string,
  ) => Promise<{ ok: boolean; ids: string[] }>
  readRaceProject: (
    racesDir: string,
    id: unknown,
  ) => Promise<{ ok: boolean; project?: unknown; error?: string }>
}

describe('upsertRaceIndexIds / mergeLocalRaceIds', () => {
  it('appends id without dropping others', () => {
    expect(upsertRaceIndexIds(['demo-istanbul', 'heat-a'], 'heat-b')).toEqual([
      'demo-istanbul',
      'heat-a',
      'heat-b',
    ])
  })

  it('is idempotent for existing id', () => {
    expect(upsertRaceIndexIds(['heat-a'], 'heat-a')).toEqual(['heat-a'])
  })

  it('rejects unsafe ids', () => {
    expect(upsertRaceIndexIds(['ok'], '../x')).toEqual(['ok'])
    expect(upsertRaceIndexIds(['a/b', 'ok'], '')).toEqual(['ok'])
  })

  it('mergeLocalRaceIds concatenates and dedupes', () => {
    expect(
      mergeLocalRaceIds(['demo-istanbul'], ['heat-2', 'demo-istanbul']),
    ).toEqual(['demo-istanbul', 'heat-2'])
  })

  it('resolveRacesKind mirrors desktop', () => {
    expect(resolveRacesKind('url')).toBe('public')
    expect(resolveRacesKind('file')).toBe('userData')
    expect(racesFs.resolveRacesKind('url')).toBe('public')
    expect(racesFs.resolveRacesKind('file')).toBe('userData')
  })
})

describe('desktop/racesFs.cjs', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('resolveRacesDir picks public vs userData', () => {
    expect(
      racesFs.resolveRacesDir('url', {
        desktopDir: '/repo/desktop',
        userDataPath: '/user/data',
      }),
    ).toMatch(/[/\\]public[/\\]races$/)
    expect(
      racesFs.resolveRacesDir('file', {
        desktopDir: '/repo/desktop',
        userDataPath: '/user/data',
      }),
    ).toMatch(/[/\\]user[/\\]data[/\\]races$/)
  })

  it('save upserts index and overwrites project.json', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'bw-races-'))
    await mkdir(path.join(dir, 'keep-me'), { recursive: true })
    await writeFile(
      path.join(dir, 'index.json'),
      `${JSON.stringify({ ids: ['keep-me', 'demo-istanbul'] }, null, 2)}\n`,
      'utf8',
    )

    const project = {
      schemaVersion: 1,
      id: 'heat-local',
      name: 'Heat',
      origin: { lat: 0, lon: 0, altMsl: 0 },
      fleet: { boatIds: ['1'] },
      povIds: ['1'],
    }
    const saved = await racesFs.saveRaceProject(dir, project)
    expect(saved.ok).toBe(true)

    const index = JSON.parse(await readFile(path.join(dir, 'index.json'), 'utf8'))
    expect(index.ids).toEqual(['keep-me', 'demo-istanbul', 'heat-local'])

    const again = await racesFs.saveRaceProject(dir, {
      ...project,
      name: 'Heat v2',
    })
    expect(again.ok).toBe(true)
    const index2 = JSON.parse(
      await readFile(path.join(dir, 'index.json'), 'utf8'),
    )
    expect(index2.ids).toEqual(['keep-me', 'demo-istanbul', 'heat-local'])

    const read = await racesFs.readRaceProject(dir, 'heat-local')
    expect(read.ok).toBe(true)
    expect((read.project as { name: string }).name).toBe('Heat v2')
  })

  it('rejects unsafe ids', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'bw-races-'))
    const bad = await racesFs.saveRaceProject(dir, { id: '../etc' })
    expect(bad.ok).toBe(false)
  })
})

describe('listLocalRaceIds + races bridge', () => {
  it('merges Electron list ids', async () => {
    const fetchImpl = viFetch(async () =>
      Response.json({ ids: ['demo-istanbul'] }),
    )
    const racesBridge: StudioRacesBridge = {
      save: async () => ({ ok: false, error: 'unused' }),
      list: async () => ({ ok: true, ids: ['studio-heat'] }),
      read: async () => ({ ok: false, error: 'unused' }),
    }
    await expect(
      listLocalRaceIds({ fetchImpl, racesBridge }),
    ).resolves.toEqual(['demo-istanbul', 'studio-heat'])
  })
})

describe('loadRaceProject + races bridge', () => {
  it('prefers Electron read over static when bridge returns project', async () => {
    const fetchImpl = viFetch(async () => {
      throw new Error('should not fetch static')
    })
    const racesBridge: StudioRacesBridge = {
      save: async () => ({ ok: false, error: 'unused' }),
      list: async () => ({ ok: true, ids: [] }),
      read: async () => ({
        ok: true,
        project: {
          schemaVersion: 1,
          id: 'demo-istanbul',
          name: 'From Electron',
          origin: { lat: 1, lon: 2, altMsl: 0 },
          fleet: { boatIds: ['1'] },
          povIds: ['1'],
        },
      }),
    }
    const project = await loadRaceProject('demo-istanbul', {
      fetchImpl,
      racesBridge,
      venuePackCache: false,
    })
    expect(project.name).toBe('From Electron')
  })

  it('falls through to static when bridge misses', async () => {
    const fetchImpl = viFetch(async (input) => {
      expect(String(input)).toBe('/races/demo-istanbul/project.json')
      return Response.json({
        schemaVersion: 1,
        id: 'demo-istanbul',
        name: 'Static',
        origin: { lat: 1, lon: 2, altMsl: 0 },
        fleet: { boatIds: ['1'] },
        povIds: ['1'],
      })
    })
    const racesBridge: StudioRacesBridge = {
      save: async () => ({ ok: false, error: 'unused' }),
      list: async () => ({ ok: true, ids: [] }),
      read: async () => ({ ok: false, error: 'not found' }),
    }
    const project = await loadRaceProject('demo-istanbul', {
      fetchImpl,
      racesBridge,
      venuePackCache: false,
    })
    expect(project.name).toBe('Static')
  })
})

function viFetch(
  impl: (input: RequestInfo | URL) => Promise<Response>,
): typeof fetch {
  return impl as unknown as typeof fetch
}
