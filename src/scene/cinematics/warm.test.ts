import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseSequence } from './parseSequence.ts'
import {
  cinematicTileCacheFileName,
  stripCinematicTileAuthQuery,
} from '../../platform/cinematicTileCache.ts'
import { cinematicTileCacheFileNameAsync } from '../../platform/cinematicTileCacheKey.ts'
import {
  cinematicTileCacheHas,
  resetCinematicTileFetchCacheForTests,
} from './tileDiskCache.ts'
import {
  WARM_GLOBE_ERROR_TARGET_MIN,
  WARM_ISTANBUL_ERROR_TARGET,
  dumpSequenceTileWarmJson,
  formatWarmTilesStatus,
  isCoarseGlobeRegion,
  isIstanbulDetailRegion,
  mergeContentUrls,
  mergeWarmManifest,
  parseWarmManifest,
  prefetchManifestContentUrls,
  regionUsesOsm,
  regionsFromSequence,
  warmCinematicTiles,
  type WarmCinematicHost,
  type WarmManifest,
  type WarmRegion,
  type WarmTilesAdapter,
} from './warm.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = resolve(
  __dirname,
  '../../../public/cinematics/warm/intro-bosphorus.json',
)

function loadManifest(): WarmManifest {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as unknown
  const parsed = parseWarmManifest(raw)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.manifest
}

afterEach(() => {
  resetCinematicTileFetchCacheForTests()
})

describe('studio boot does not globe-tour tiles', () => {
  it('Play still warms; main.ts does not auto-warm on project load', () => {
    const main = readFileSync(
      resolve(__dirname, '../../main.ts'),
      'utf8',
    )
    expect(main).not.toMatch(/startCinematicTileWarm/)
    expect(main).not.toMatch(/warmCinematicTiles\(\)/)
    const scene = readFileSync(
      resolve(__dirname, '../createScene.ts'),
      'utf8',
    )
    expect(scene).toMatch(/playCinematicAfterWarm/)
    expect(scene).toMatch(/warmCinematicTiles\(/)
  })
})

describe('parseWarmManifest', () => {
  it('accepts the shipped intro-bosphorus warm file (regions, no binaries)', () => {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as unknown
    const rec = raw as Record<string, unknown>
    expect(JSON.stringify(raw)).not.toMatch(/data:application/)
    expect(JSON.stringify(raw).length).toBeLessThan(20_000)
    const parsed = parseWarmManifest(raw)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.manifest.id).toBe('intro-bosphorus')
    expect(parsed.manifest.ionAssets).toEqual({
      worldTerrain: 1,
      bingAerial: 2,
      osmBuildings: 96188,
    })
    expect(parsed.manifest.contentUrls).toEqual([])
    expect(Array.isArray(rec.contentUrls)).toBe(true)
    const globe = parsed.manifest.regions.filter((r) => r.domain === 'globe')
    const enu = parsed.manifest.regions.filter((r) => r.domain === 'enu')
    expect(globe.length).toBeGreaterThanOrEqual(4)
    expect(enu.length).toBeGreaterThanOrEqual(1)
  })

  it('rejects globe+osm and missing camera fields', () => {
    expect(
      parseWarmManifest({
        id: 'x',
        ionAssets: { worldTerrain: 1, bingAerial: 2, osmBuildings: 96188 },
        regions: [
          {
            id: 'bad',
            domain: 'globe',
            errorTarget: 48,
            osm: true,
            lat: 0,
            lon: 0,
            altMsl: 1,
            lookLat: 0,
            lookLon: 0,
            lookAltMsl: 0,
          },
        ],
      }).ok,
    ).toBe(false)
    expect(parseWarmManifest({ id: 'x' }).ok).toBe(false)
  })
})

describe('coarse vs İstanbul region flags', () => {
  it('globe countries skip OSM; ENU Istanbul uses OSM at a finer errorTarget', () => {
    const manifest = loadManifest()
    const usa = manifest.regions.find((r) => r.id === 'usa')
    const istanbul = manifest.regions.find((r) => r.id === 'istanbul-maidens')
    expect(usa).toBeTruthy()
    expect(istanbul).toBeTruthy()
    expect(isCoarseGlobeRegion(usa as WarmRegion)).toBe(true)
    expect(regionUsesOsm(usa as WarmRegion)).toBe(false)
    expect((usa as WarmRegion).errorTarget).toBe(WARM_GLOBE_ERROR_TARGET_MIN)
    expect(isIstanbulDetailRegion(istanbul as WarmRegion)).toBe(true)
    expect(regionUsesOsm(istanbul as WarmRegion)).toBe(true)
    expect((istanbul as WarmRegion).errorTarget).toBe(WARM_ISTANBUL_ERROR_TARGET)
    expect((istanbul as WarmRegion).errorTarget).toBeLessThan(
      (usa as WarmRegion).errorTarget,
    )
  })
})

describe('cache key', () => {
  it('Web Crypto hash matches Node cinematicTileCacheFileName (token stripped)', async () => {
    const url =
      'https://assets.ion.cesium.com/1/tile.terrain?v=1&access_token=secret-a'
    const node = cinematicTileCacheFileName(url)
    const web = await cinematicTileCacheFileNameAsync(url)
    expect(web).toBe(node)
    expect(web).toMatch(/^[0-9a-f]{64}$/)
    expect(stripCinematicTileAuthQuery(url)).not.toContain('access_token')
  })
})

describe('skip-if-present', () => {
  it('HEAD/GET 200 counts as a hit and does not POST', async () => {
    const posts: string[] = []
    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'POST') {
        posts.push(url)
        return new Response(null, { status: 201 })
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    }) as typeof fetch

    const url = 'https://assets.ion.cesium.com/1/layer.json?v=1'
    expect(await cinematicTileCacheHas(url, { fetchImpl, ipc: null })).toBe(true)
    const skip = await prefetchManifestContentUrls([url], { fetchImpl, ipc: null })
    expect(skip).toEqual({ hit: 1, miss: 0 })
    expect(posts).toEqual([])
  })

  it('404 is a miss', async () => {
    const fetchImpl: typeof fetch = (async () =>
      new Response(null, { status: 404 })) as typeof fetch
    const skip = await prefetchManifestContentUrls(
      ['https://assets.ion.cesium.com/1/missing'],
      { fetchImpl, ipc: null },
    )
    expect(skip).toEqual({ hit: 0, miss: 1 })
  })
})

describe('warmCinematicTiles', () => {
  it('skips when AR opaque-clear is false (terrain gated off)', async () => {
    const host = stubHost({ opaque: false })
    const result = await warmCinematicTiles(host, loadManifest())
    expect(result.skipped).toBe(true)
    expect(result.status.phase).toBe('skipped')
    expect(result.status.label).toMatch(/AR gate/)
    expect(host.applyCount).toBe(0)
  })

  it('skips when there is no ion token', async () => {
    const host = stubHost({ token: '' })
    const result = await warmCinematicTiles(host, loadManifest())
    expect(result.skipped).toBe(true)
    expect(result.status.label).toMatch(/no ion token/)
  })

  it('poses each region, sets errorTarget, and does not throw on timeout', async () => {
    const host = stubHost({})
    const mini: WarmManifest = {
      id: 'intro-bosphorus',
      ionAssets: { worldTerrain: 1, bingAerial: 2, osmBuildings: 96188 },
      regions: loadManifest().regions.slice(0, 2),
      contentUrls: [],
    }
    const statuses: string[] = []
    const result = await warmCinematicTiles(host, mini, (s) => {
      statuses.push(formatWarmTilesStatus(s))
    })
    expect(result.skipped).toBe(false)
    expect(host.applyCount).toBe(2)
    expect(host.restoreCount).toBe(1)
    expect(host.targets).toEqual([8, 8])
    expect(result.regionLogs[0]).toMatch(/errorTarget=8/)
    expect(statuses.some((s) => s.startsWith('tiles: warming'))).toBe(true)
    expect(result.status.phase).toBe('ready')
  })
})

function stubAdapter(): WarmTilesAdapter & { targets: number[] } {
  const targets: number[] = []
  let errorTarget = 16
  return {
    targets,
    setErrorTarget(value) {
      errorTarget = value
      targets.push(value)
    },
    getErrorTarget: () => errorTarget,
    isDownloadIdle: () => true,
    getVisibleTileCount: () => 4,
    tick: () => undefined,
  }
}

function stubHost(opts: { opaque?: boolean; token?: string }): WarmCinematicHost & {
  applyCount: number
  restoreCount: number
  targets: number[]
} {
  const terrain = stubAdapter()
  const buildings = stubAdapter()
  const camera = {
    near: 1,
    far: 100,
    up: { set: () => undefined },
    position: { set: () => undefined },
    lookAt: () => undefined,
    updateProjectionMatrix: () => undefined,
  } as unknown as WarmCinematicHost['camera']
  let applyCount = 0
  let restoreCount = 0
  return {
    camera,
    renderer: {} as WarmCinematicHost['renderer'],
    opaqueClearSafe: () => opts.opaque !== false,
    token: () => (opts.token !== undefined ? opts.token : 'ion-token'),
    applyRegionLook: () => {
      applyCount += 1
    },
    restoreLook: () => {
      restoreCount += 1
    },
    terrain: () => terrain,
    buildings: () => buildings,
    nowMs: () => 0,
    waitFrame: async () => undefined,
    get applyCount() {
      return applyCount
    },
    get restoreCount() {
      return restoreCount
    },
    get targets() {
      return terrain.targets
    },
  }
}

describe('sequence tileWarm dump', () => {
  it('writes contentUrls onto the sequence JSON, not a sidecar-only list', () => {
    const json = dumpSequenceTileWarmJson(
      { id: 'intro-bosphorus', durationSec: 60 },
      ['https://assets.ion.cesium.com/1/a', 'https://assets.ion.cesium.com/1/b'],
    )
    const raw = JSON.parse(json) as Record<string, unknown>
    expect(raw.id).toBe('intro-bosphorus')
    expect(raw.durationSec).toBe(60)
    const warm = raw.tileWarm as { contentUrls: string[] }
    expect(warm.contentUrls).toEqual([
      'https://assets.ion.cesium.com/1/a',
      'https://assets.ion.cesium.com/1/b',
    ])
  })

  it('merges sequence keyframes into the sidecar regions and URL lists', () => {
    const sequencePath = resolve(
      __dirname,
      '../../../public/cinematics/intro-bosphorus.json',
    )
    const parsed = parseSequence(JSON.parse(readFileSync(sequencePath, 'utf8')))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const extra = regionsFromSequence(parsed.sequence)
    expect(extra.length).toBeGreaterThan(loadManifest().regions.length)
    expect(extra.some((r) => r.domain === 'enu' && r.osm)).toBe(true)
    expect(extra.some((r) => r.domain === 'globe' && !r.osm)).toBe(true)
    const merged = mergeWarmManifest(loadManifest(), parsed.sequence)
    expect(merged.regions.length).toBeGreaterThan(loadManifest().regions.length)
    expect(mergeContentUrls(['b'], ['a'], ['b'])).toEqual(['a', 'b'])
  })
})

describe('formatWarmTilesStatus', () => {
  it('shows tiles: warming N/M', () => {
    expect(
      formatWarmTilesStatus({
        phase: 'warming',
        label: '',
        done: 2,
        total: 8,
      }),
    ).toBe('tiles: warming 2/8')
  })
})

describe('SPA must not import getCinematicTileCacheDir', () => {
  it('createScene and tileDiskCache stay off the Node fs helper', () => {
    const sceneSrc = readFileSync(
      resolve(__dirname, '../createScene.ts'),
      'utf8',
    )
    const diskSrc = readFileSync(
      resolve(__dirname, './tileDiskCache.ts'),
      'utf8',
    )
    expect(sceneSrc).not.toMatch(/getCinematicTileCacheDir/)
    expect(diskSrc).not.toMatch(/cinematicTileCache\.ts/)
    expect(diskSrc).toMatch(/cinematicTileCacheKey/)
  })
})

describe('isIonContentUrl', () => {
  it('accepts ion CDN and skips the token endpoint', async () => {
    const { isIonContentUrl } = await import('./tileDiskCache.ts')
    expect(
      isIonContentUrl('https://assets.ion.cesium.com/1/layer.json?v=1'),
    ).toBe(true)
    expect(
      isIonContentUrl('https://api.cesium.com/v1/assets/1/endpoint?access_token=x'),
    ).toBe(false)
    expect(isIonContentUrl('/cinematic-tiles/abc')).toBe(false)
  })
})
