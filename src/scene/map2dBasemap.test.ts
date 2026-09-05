/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import {
  cachedParentOsmTiles,
  createTileCache,
  isOsmTileImage,
  latLonToTile,
  MAX_OSM_VISIBLE_TILES,
  nextOsmDrawHistory,
  OSM_TILE_PAD,
  osmTileRangeForBounds,
  osmTilesDrawList,
  osmTileUrl,
  pickOsmZoom,
  tileCacheKey,
  tilesForEnuBounds,
  type BasemapGeoBridge,
  type MapBoundsLike,
  type OsmTileRef,
} from './map2dBasemap.ts'

const ISTANBUL_LAT = 41
const ISTANBUL_LON = 29
const M_PER_DEG = 111_320

function istanbulGeo(): BasemapGeoBridge {
  const cos = Math.cos((ISTANBUL_LAT * Math.PI) / 180)
  return {
    enuToLatLon: (east, north) => ({
      lat: ISTANBUL_LAT + north / M_PER_DEG,
      lon: ISTANBUL_LON + east / (M_PER_DEG * cos),
    }),
    latLonToEnu: (lat, lon) => ({
      east: (lon - ISTANBUL_LON) * M_PER_DEG * cos,
      north: (lat - ISTANBUL_LAT) * M_PER_DEG,
    }),
  }
}

function boundsFromHalf(halfM: number): MapBoundsLike {
  return { minE: -halfM, maxE: halfM, minN: -halfM, maxN: halfM }
}

function cornerLatLons(bounds: MapBoundsLike, geo: BasemapGeoBridge) {
  return [
    geo.enuToLatLon(bounds.minE, bounds.minN),
    geo.enuToLatLon(bounds.maxE, bounds.minN),
    geo.enuToLatLon(bounds.minE, bounds.maxN),
    geo.enuToLatLon(bounds.maxE, bounds.maxN),
  ]
}

function hasTile(tiles: readonly OsmTileRef[], want: OsmTileRef): boolean {
  return tiles.some((t) => t.z === want.z && t.x === want.x && t.y === want.y)
}

function expectFilledRectangle(tiles: readonly OsmTileRef[]): void {
  expect(tiles.length).toBeGreaterThan(0)
  const z = tiles[0]!.z
  expect(tiles.every((t) => t.z === z)).toBe(true)
  const xs = tiles.map((t) => t.x)
  const ys = tiles.map((t) => t.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  expect(tiles.length).toBe((maxX - minX + 1) * (maxY - minY + 1))
}

describe('map2dBasemap tile math', () => {
  it('builds OSM tile URLs', () => {
    expect(osmTileUrl({ z: 12, x: 2345, y: 1500 })).toBe(
      'https://tile.openstreetmap.org/12/2345/1500.png',
    )
  })

  it('latLonToTile is finite for Istanbul', () => {
    const t = latLonToTile(41.01, 28.98, 14)
    expect(t.z).toBe(14)
    expect(t.x).toBeGreaterThan(0)
    expect(t.y).toBeGreaterThan(0)
  })

  it('pickOsmZoom returns a sane integer', () => {
    const z = pickOsmZoom(41, 200, 240)
    expect(z).toBeGreaterThanOrEqual(0)
    expect(z).toBeLessThanOrEqual(18)
  })
})

describe('tilesForEnuBounds coverage', () => {
  const geo = istanbulGeo()

  it('includes every viewport corner (authoring-sized canvas)', () => {
    const bounds = boundsFromHalf(400)
    const tiles = tilesForEnuBounds(bounds, geo, 900)
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThanOrEqual(MAX_OSM_VISIBLE_TILES)
    expectFilledRectangle(tiles)
    const z = tiles[0]!.z
    for (const c of cornerLatLons(bounds, geo)) {
      const t = latLonToTile(c.lat, c.lon, z)
      expect(hasTile(tiles, t)).toBe(true)
    }
  })

  it('pads the tile range by one around unpadded corners', () => {
    const bounds = boundsFromHalf(80)
    const z = pickOsmZoom(ISTANBUL_LAT, 80, 560)
    const unpadded = osmTileRangeForBounds(bounds, geo, z, 0)
    const padded = osmTileRangeForBounds(bounds, geo, z, OSM_TILE_PAD)
    expect(padded.minTx).toBeLessThanOrEqual(unpadded.minTx)
    expect(padded.maxTx).toBeGreaterThanOrEqual(unpadded.maxTx)
    expect(padded.minTy).toBeLessThanOrEqual(unpadded.minTy)
    expect(padded.maxTy).toBeGreaterThanOrEqual(unpadded.maxTy)
    expect(padded.maxTx - padded.minTx).toBeGreaterThanOrEqual(
      unpadded.maxTx - unpadded.minTx,
    )
  })

  it('never returns an empty set across zoom extents', () => {
    const canvasH = 560
    for (const half of [5, 25, 80, 200, 1000, 8000, 50_000]) {
      const tiles = tilesForEnuBounds(boundsFromHalf(half), geo, canvasH)
      expect(tiles.length).toBeGreaterThan(0)
      expect(tiles.length).toBeLessThanOrEqual(MAX_OSM_VISIBLE_TILES)
      expectFilledRectangle(tiles)
    }
  })

  it('keeps a filled rectangle when the preferred zoom would overflow the cap', () => {
    const tiles = tilesForEnuBounds(boundsFromHalf(400), geo, 900)
    expectFilledRectangle(tiles)
    const xs = new Set(tiles.map((t) => t.x))
    const ys = new Set(tiles.map((t) => t.y))
    expect(xs.size * ys.size).toBe(tiles.length)
  })
})

describe('OSM zoom draw fallback', () => {
  it('osmTilesDrawList keeps previous z in front of the new request', () => {
    const prev: OsmTileRef[] = [{ z: 14, x: 1, y: 2 }]
    const current: OsmTileRef[] = [
      { z: 15, x: 2, y: 4 },
      { z: 15, x: 3, y: 4 },
    ]
    const list = osmTilesDrawList(current, prev)
    expect(list[0]).toEqual(prev[0])
    expect(list.slice(1)).toEqual(current)
  })

  it('nextOsmDrawHistory keeps previous tiles while the new z is loading', () => {
    const cache = createTileCache()
    const prev: OsmTileRef[] = [{ z: 14, x: 10, y: 20 }]
    const img = document.createElement('img')
    cache.set(tileCacheKey(prev[0]!), img)
    const current: OsmTileRef[] = [{ z: 15, x: 20, y: 40 }]
    cache.set(tileCacheKey(current[0]!), 'loading')
    const next = nextOsmDrawHistory(current, prev, cache)
    expect(next).toEqual(prev)
    expect(isOsmTileImage(cache.get(tileCacheKey(prev[0]!)))).toBe(true)
  })

  it('cachedParentOsmTiles uses a coarser cache hit under a loading child', () => {
    const cache = createTileCache()
    const child: OsmTileRef = { z: 15, x: 20, y: 40 }
    const parent: OsmTileRef = { z: 14, x: 10, y: 20 }
    cache.set(tileCacheKey(child), 'loading')
    cache.set(tileCacheKey(parent), document.createElement('img'))
    const parents = cachedParentOsmTiles([child], cache)
    expect(parents).toEqual([parent])
  })
})
