import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRaceProject } from '../loadRaceProject.ts'
import {
  buildVenuePack,
  collectNestedAssetUrls,
  collectProjectAssetUrls,
  createMemoryVenuePackCache,
  materializeVenuePack,
  parseVenuePack,
  seedVenuePackUrls,
  setDefaultVenuePackCacheForTests,
  VENUE_PACK_KIND,
} from './index.ts'

const demoProject = {
  schemaVersion: 1,
  id: 'demo-istanbul',
  name: 'Demo Istanbul',
  origin: { lat: 41.0082, lon: 28.9784, altMsl: 0 },
  fleet: {
    boatIds: ['21', '22'],
    boatNamesUrl: '/fixtures/boats/demo-istanbul-names.json',
  },
  povIds: ['1', '2'],
  courseUrl: '/fixtures/course/demo-istanbul.json',
  sponsorsUrl: '/fixtures/sponsors/demo-istanbul.json',
  flagsUrl: '/fixtures/flags/demo-istanbul-countdown.json',
  replayUrl: '/fixtures/telemetry/spine-demo.json',
}

describe('venuePack collect', () => {
  it('collects project URL fields', () => {
    const urls = collectProjectAssetUrls(demoProject)
    expect(urls).toContain('/fixtures/course/demo-istanbul.json')
    expect(urls).toContain('/fixtures/boats/demo-istanbul-names.json')
    expect(urls).toContain('/fixtures/sponsors/demo-istanbul.json')
  })

  it('seeds extras + project urls', () => {
    const seeded = seedVenuePackUrls(demoProject, ['/models/boat.glb'])
    expect(seeded).toContain('/models/boat.glb')
    expect(seeded).toContain('/fixtures/course/demo-istanbul.json')
  })

  it('walks nested texture paths in JSON', () => {
    const into = new Set<string>()
    collectNestedAssetUrls(
      {
        sponsors: [
          { textureUrl: '/textures/sponsors/rolex.png' },
          { textureUrl: 'https://example.com/x.png' },
        ],
      },
      into,
    )
    expect(into.has('/textures/sponsors/rolex.png')).toBe(true)
    expect([...into].some((u) => u.includes('example.com'))).toBe(false)
  })

  it('recognizes /assets/library/ paths', () => {
    const into = new Set<string>()
    collectNestedAssetUrls(
      { textureUrl: '/assets/library/image/logo-a1b2c3d4.png' },
      into,
    )
    expect(into.has('/assets/library/image/logo-a1b2c3d4.png')).toBe(true)
  })
})

describe('parseVenuePack', () => {
  it('accepts a minimal valid pack', () => {
    const pack = parseVenuePack({
      schemaVersion: 1,
      kind: VENUE_PACK_KIND,
      id: 'demo-istanbul',
      name: 'Demo Istanbul',
      createdAt: '2026-08-04T00:00:00.000Z',
      project: demoProject,
      files: {
        '/fixtures/course/demo-istanbul.json': {
          contentType: 'application/json',
          encoding: 'utf-8',
          body: '{"marks":[]}',
        },
      },
    })
    expect(pack.id).toBe('demo-istanbul')
    expect(pack.files['/fixtures/course/demo-istanbul.json']?.encoding).toBe(
      'utf-8',
    )
  })

  it('rejects wrong kind', () => {
    expect(() =>
      parseVenuePack({
        schemaVersion: 1,
        kind: 'nope',
        id: 'demo-istanbul',
        name: 'x',
        project: demoProject,
        files: {},
      }),
    ).toThrow(/kind/)
  })
})

describe('buildVenuePack + materialize', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('embeds fixtures and rewrites nested texture urls to blob:', async () => {
    const fixtures: Record<string, string> = {
      '/fixtures/course/demo-istanbul.json': JSON.stringify({ marks: [] }),
      '/fixtures/sponsors/demo-istanbul.json': JSON.stringify({
        sponsors: [{ textureUrl: '/textures/sponsors/rolex.png' }],
      }),
      '/fixtures/flags/demo-istanbul-countdown.json': '{}',
      '/fixtures/boats/demo-istanbul-names.json': '{"boats":[]}',
      '/fixtures/telemetry/spine-demo.json': '[]',
    }
    const pngBytes = new Uint8Array([137, 80, 78, 71])

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url in fixtures) {
        return new Response(fixtures[url], {
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url === '/textures/sponsors/rolex.png') {
        return new Response(pngBytes, {
          headers: { 'content-type': 'image/png' },
        })
      }
      return new Response('missing', { status: 404 })
    }) as unknown as typeof fetch

    const pack = await buildVenuePack(demoProject, {
      fetchImpl,
      extraUrls: [],
      createdAt: '2026-08-04T12:00:00.000Z',
    })

    expect(pack.kind).toBe(VENUE_PACK_KIND)
    expect(pack.files['/fixtures/sponsors/demo-istanbul.json']).toBeTruthy()
    expect(pack.files['/textures/sponsors/rolex.png']?.encoding).toBe('base64')

    const mat = materializeVenuePack(pack)
    expect(mat.project.sponsorsUrl?.startsWith('blob:')).toBe(true)
    expect(mat.project.courseUrl?.startsWith('blob:')).toBe(true)

    const sponsorsRes = await fetch(mat.project.sponsorsUrl!)
    const sponsorsJson = (await sponsorsRes.json()) as {
      sponsors: { textureUrl: string }[]
    }
    expect(sponsorsJson.sponsors[0]?.textureUrl.startsWith('blob:')).toBe(true)
    mat.revoke()
  })
})

describe('loadRaceProject venue cache fallback', () => {
  afterEach(() => {
    setDefaultVenuePackCacheForTests(null)
    vi.restoreAllMocks()
  })

  it('loads from venue pack cache when static misses', async () => {
    const pack = parseVenuePack({
      schemaVersion: 1,
      kind: VENUE_PACK_KIND,
      id: 'demo-istanbul',
      name: 'Demo Istanbul',
      createdAt: '2026-08-04T00:00:00.000Z',
      project: demoProject,
      files: {
        '/fixtures/course/demo-istanbul.json': {
          contentType: 'application/json',
          encoding: 'utf-8',
          body: '{"marks":[]}',
        },
      },
    })
    const cache = createMemoryVenuePackCache([pack])
    setDefaultVenuePackCacheForTests(cache)

    const fetchImpl = vi.fn(async () => {
      return new Response('missing', { status: 404 })
    }) as unknown as typeof fetch

    const project = await loadRaceProject('demo-istanbul', {
      fetchImpl,
      venuePackCache: cache,
    })
    expect(project.id).toBe('demo-istanbul')
    expect(project.courseUrl?.startsWith('blob:')).toBe(true)
  })
})
