import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WriteRaceProjectError,
  writeRaceProject,
} from './writeRaceProject.ts'
import type { RaceProject } from './types.ts'

const sample: RaceProject = {
  schemaVersion: 1,
  id: 'heat-2',
  name: 'Heat 2',
  revision: 1,
  origin: { lat: 41.0867, lon: 29.0618, altMsl: 0 },
  fleet: {
    boatIds: ['21', '22'],
    boatNamesUrl: '/fixtures/boats/demo-istanbul-names.json',
  },
  povIds: ['1', '2'],
  courseUrl: '/fixtures/course/demo-istanbul.json',
}

describe('writeRaceProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs create and returns stored project', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body)) as RaceProject
      expect(body.origin).toEqual(sample.origin)
      expect(body.fleet.boatIds).toEqual(['21', '22'])
      expect(body.povIds).toEqual(['1', '2'])
      return Response.json(
        { ...body, revision: 1, updatedAt: '2026-08-03T12:00:00.000Z' },
        { status: 201 },
      )
    }) as unknown as typeof fetch

    const stored = await writeRaceProject(sample, {
      projectsApiBase: '/api',
      mode: 'create',
      fetchImpl,
    })
    expect(stored.revision).toBe(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/races',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('sends Authorization bearer when token provided', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer editor-secret')
      return Response.json(
        { ...sample, revision: 1, updatedAt: '2026-08-04T12:00:00.000Z' },
        { status: 201 },
      )
    }) as unknown as typeof fetch

    await writeRaceProject(sample, {
      projectsApiBase: '/api',
      mode: 'create',
      bearerToken: 'editor-secret',
      fetchImpl,
    })
  })

  it('PUTs update with If-Match revision', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('/api/races/heat-2')
      expect(init?.method).toBe('PUT')
      const headers = init?.headers as Record<string, string>
      expect(headers['If-Match']).toBe('"1"')
      return Response.json({
        ...sample,
        revision: 2,
        updatedAt: '2026-08-03T12:01:00.000Z',
      })
    }) as unknown as typeof fetch

    const stored = await writeRaceProject(sample, {
      projectsApiBase: '/api',
      mode: 'update',
      expectedRevision: 1,
      fetchImpl,
    })
    expect(stored.revision).toBe(2)
  })

  it('throws WriteRaceProjectError on 409', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: 'already_exists' }, { status: 409 }),
    ) as unknown as typeof fetch

    await expect(
      writeRaceProject(sample, {
        projectsApiBase: '/api',
        mode: 'create',
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(WriteRaceProjectError)
  })
})
