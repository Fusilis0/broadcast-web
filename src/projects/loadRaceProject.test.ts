import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRaceProject, raceProjectApiUrl } from './loadRaceProject.ts'

const staticPack = {
  schemaVersion: 1,
  id: 'demo-istanbul',
  name: 'Demo Istanbul',
  origin: { lat: 41.0082, lon: 28.9784, altMsl: 0 },
  fleet: { boatIds: ['21', '22', '23', '24'] },
  povIds: ['1', '2'],
  courseUrl: '/fixtures/course/demo-istanbul.json',
}

const apiPack = {
  ...staticPack,
  name: 'Demo Istanbul (API)',
  revision: 3,
}

describe('loadRaceProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads static pack when projectsApiBase unset', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toBe('/races/demo-istanbul/project.json')
      return Response.json(staticPack)
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      fetchImpl,
      racesBridge: null,
      venuePackCache: false,
    })
    expect(project.name).toBe('Demo Istanbul')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('prefers API when projectsApiBase is set', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/races/demo-istanbul') {
        return Response.json(apiPack)
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      projectsApiBase: '/api',
      fetchImpl,
      racesBridge: null,
      venuePackCache: false,
    })
    expect(project.name).toBe('Demo Istanbul (API)')
    expect(project.revision).toBe(3)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to static on API 404', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/races/demo-istanbul') {
        return new Response('missing', { status: 404 })
      }
      if (url === '/races/demo-istanbul/project.json') {
        return Response.json(staticPack)
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      projectsApiBase: '/api',
      fetchImpl,
      racesBridge: null,
      venuePackCache: false,
    })
    expect(project.name).toBe('Demo Istanbul')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('falls back to static when API is unreachable', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'http://127.0.0.1:8787/api/races/demo-istanbul') {
        throw new Error('ECONNREFUSED')
      }
      if (url === '/races/demo-istanbul/project.json') {
        return Response.json(staticPack)
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      projectsApiBase: 'http://127.0.0.1:8787/api',
      fetchImpl,
      racesBridge: null,
      venuePackCache: false,
    })
    expect(project.id).toBe('demo-istanbul')
  })

  it('raceProjectApiUrl normalizes trailing slash', () => {
    expect(raceProjectApiUrl('/api/', 'demo-istanbul')).toBe(
      '/api/races/demo-istanbul',
    )
  })
})
