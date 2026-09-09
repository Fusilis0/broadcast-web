import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BOOT_RACE_ID, loadRaceProject, raceProjectApiUrl } from './loadRaceProject.ts'

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

  it('boots the empty pack when no ?race=', () => {
    expect(DEFAULT_BOOT_RACE_ID).toBe('empty')
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

  it('does not fetch featuresUrl when features is []', async () => {
    const pack = {
      ...staticPack,
      features: [] as unknown[],
      featuresUrl: '/fixtures/world/demo-istanbul-extras.json',
    }
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/races/demo-istanbul/project.json') {
        return Response.json(pack)
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      fetchImpl,
      racesBridge: null,
      venuePackCache: false,
    })
    expect(project.features).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fetches featuresUrl only when features is omitted', async () => {
    const pack = {
      ...staticPack,
      featuresUrl: '/world-features.json',
    }
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/races/demo-istanbul/project.json') {
        return Response.json(pack)
      }
      if (url === '/world-features.json') {
        return Response.json({
          features: [
            {
              id: 'course:Mark-NW',
              name: 'Mark-NW',
              type: 'mark',
              points: [{ lat: 41.0087, lon: 28.978, altMsl: 0 }],
            },
          ],
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      fetchImpl,
      racesBridge: null,
      venuePackCache: false,
    })
    expect(project.features).toHaveLength(1)
    expect(project.features?.[0]?.id).toBe('course:Mark-NW')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
