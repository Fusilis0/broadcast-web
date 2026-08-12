import { describe, expect, it, vi } from 'vitest'
import {
  boatIdsMissingFromCatalogue,
  confirmSaveWithOrphanBoatIds,
  duplicateRaceProject,
  formatOrphanBoatIdWarning,
  listRaceProjects,
  renameRaceProject,
} from './projectManager.ts'
import type { RaceProject } from './types.ts'

const sample: RaceProject = {
  schemaVersion: 1,
  id: 'heat-a',
  name: 'Heat A',
  origin: { lat: 41, lon: 29, altMsl: 0 },
  fleet: { boatIds: ['21', '99'] },
  povIds: ['1'],
  revision: 2,
}

describe('boatIdsMissingFromCatalogue', () => {
  it('lists fleet ids absent from catalogue', () => {
    expect(
      boatIdsMissingFromCatalogue(['21', '41', '57'], ['21', '22']),
    ).toEqual(['41', '57'])
  })

  it('returns empty when all ids are known', () => {
    expect(boatIdsMissingFromCatalogue(['21', '22'], ['21', '22', '23'])).toEqual(
      [],
    )
  })
})

describe('formatOrphanBoatIdWarning / confirmSaveWithOrphanBoatIds', () => {
  it('formats a non-blocking warning', () => {
    expect(formatOrphanBoatIdWarning(['41', '57'])).toBe(
      'boat ids not in catalogue: 41, 57 — Save anyway?',
    )
    expect(formatOrphanBoatIdWarning([])).toBeNull()
  })

  it('confirms only when orphans exist', () => {
    const confirm = vi.fn(() => true)
    expect(
      confirmSaveWithOrphanBoatIds(['21'], ['21'], confirm),
    ).toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    expect(
      confirmSaveWithOrphanBoatIds(['21', '99'], ['21'], confirm),
    ).toBe(true)
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0]![0]).toContain('99')
  })

  it('cancels save when operator declines', () => {
    expect(
      confirmSaveWithOrphanBoatIds(['99'], ['21'], () => false),
    ).toBe(false)
  })
})

describe('listRaceProjects', () => {
  it('requests default list without includeArchived', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('/api/races')
      return new Response(
        JSON.stringify([
          {
            id: 'demo-istanbul',
            name: 'Demo',
            revision: 1,
            updatedAt: '',
            labels: ['demo'],
          },
        ]),
        { status: 200 },
      )
    })
    const list = await listRaceProjects({
      projectsApiBase: '/api',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe('demo-istanbul')
  })

  it('passes includeArchived=1 when requested', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('/api/races?includeArchived=1')
      return new Response(JSON.stringify([]), { status: 200 })
    })
    await listRaceProjects({
      projectsApiBase: '/api',
      includeArchived: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
  })
})

describe('duplicateRaceProject / renameRaceProject', () => {
  it('duplicates via POST create under new id', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/races')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body)) as RaceProject
      expect(body.id).toBe('heat-b')
      expect(body.name).toBe('Heat B')
      return new Response(
        JSON.stringify({ ...body, revision: 1, updatedAt: '2026-08-11T00:00:00.000Z' }),
        { status: 201 },
      )
    })
    const created = await duplicateRaceProject(
      sample,
      { id: 'heat-b', name: 'Heat B' },
      {
        projectsApiBase: '/api',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    )
    expect(created.id).toBe('heat-b')
    expect(created.revision).toBe(1)
  })

  it('rename creates then deletes old (never deletes first)', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (method === 'GET' && url.endsWith('/races/heat-a')) {
        return new Response(JSON.stringify(sample), { status: 200 })
      }
      if (method === 'POST' && url.endsWith('/races')) {
        const body = JSON.parse(String(init?.body)) as RaceProject
        return new Response(
          JSON.stringify({
            ...body,
            revision: 1,
            updatedAt: '2026-08-11T00:00:00.000Z',
          }),
          { status: 201 },
        )
      }
      if (method === 'DELETE' && url.endsWith('/races/heat-a')) {
        return new Response(null, { status: 204 })
      }
      return new Response('unexpected', { status: 500 })
    })

    const created = await renameRaceProject(
      'heat-a',
      { id: 'heat-b', name: 'Heat B' },
      {
        projectsApiBase: '/api',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    )
    expect(created.id).toBe('heat-b')
    expect(calls[0]).toMatch(/^GET /)
    expect(calls.some((c) => c.startsWith('POST '))).toBe(true)
    expect(calls[calls.length - 1]).toBe('DELETE /api/races/heat-a')
    const deleteIdx = calls.findIndex((c) => c.startsWith('DELETE '))
    const postIdx = calls.findIndex((c) => c.startsWith('POST '))
    expect(postIdx).toBeGreaterThanOrEqual(0)
    expect(deleteIdx).toBeGreaterThan(postIdx)
  })

  it('rename does not delete when create fails', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') {
        return new Response(JSON.stringify(sample), { status: 200 })
      }
      if (method === 'POST') {
        return new Response(JSON.stringify({ error: 'already_exists' }), {
          status: 409,
        })
      }
      throw new Error(`unexpected ${method}`)
    })
    await expect(
      renameRaceProject(
        'heat-a',
        { id: 'heat-b', name: 'Heat B' },
        {
          projectsApiBase: '/api',
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      ),
    ).rejects.toThrow()
    expect(
      fetchImpl.mock.calls.every(
        ([, init]) => (init as RequestInit | undefined)?.method !== 'DELETE',
      ),
    ).toBe(true)
  })
})
