import { describe, expect, it } from 'vitest'
import type { LayoutFeature } from './features/types.ts'
import {
  boundsFromPoints,
  DEFAULT_BOAT_DOT_COLOR,
  DEFAULT_DRONE_DOT_COLOR,
  enuToMapPx,
  mapPxToEnu,
  resolveMapDotFill,
  type MapPoint,
} from './map2d.ts'
import {
  fitMapViewToBounds,
  panMapView,
  viewToMapBounds,
  wheelZoomFactor,
  zoomMapViewAt,
} from './map2dView.ts'
import {
  latLonToTile,
  osmTileUrl,
  pickOsmZoom,
  tilesForEnuBounds,
} from './map2dBasemap.ts'
import { samplePolylineAtSpacing } from './billboardChain.ts'

describe('map2d projection', () => {
  it('maps East→right and North→top (north-up)', () => {
    const bounds = { minE: 0, maxE: 100, minN: 0, maxN: 100 }
    const sw = enuToMapPx(0, 0, bounds, 200, 200, 0)
    const ne = enuToMapPx(100, 100, bounds, 200, 200, 0)
    expect(sw.x).toBeCloseTo(0)
    expect(sw.y).toBeCloseTo(200)
    expect(ne.x).toBeCloseTo(200)
    expect(ne.y).toBeCloseTo(0)
  })

  it('mapPxToEnu inverts enuToMapPx', () => {
    const bounds = { minE: -50, maxE: 50, minN: -40, maxN: 40 }
    const px = enuToMapPx(10, -5, bounds, 300, 300, 20)
    const enu = mapPxToEnu(px.x, px.y, bounds, 300, 300, 20)
    expect(enu.east).toBeCloseTo(10, 5)
    expect(enu.north).toBeCloseTo(-5, 5)
  })

  it('auto-fits bounds with padding around fleet points', () => {
    const points: MapPoint[] = [
      { id: '1', kind: 'drone', east: 10, north: 20, up: 5, yawDeg: 0 },
      { id: '21', kind: 'boat', east: 30, north: 40, up: 0, yawDeg: 90 },
    ]
    const b = boundsFromPoints(points)
    expect(b.minE).toBeLessThan(10)
    expect(b.maxE).toBeGreaterThan(30)
    expect(b.minN).toBeLessThan(20)
    expect(b.maxN).toBeGreaterThan(40)
  })

  it('includes shared layout features in auto-fit bounds', () => {
    const layout: LayoutFeature[] = [
      {
        id: 'sponsor:sp',
        name: 'sp',
        type: 'sponsor',
        points: [
          { x: -50, y: 0, z: -10 },
          { x: 50, y: 0, z: 10 },
        ],
        rawPoints: [
          { lat: 0, lon: 0, altMsl: 0 },
          { lat: 0, lon: 0, altMsl: 0 },
        ],
      },
    ]
    const b = boundsFromPoints([], [], layout)
    expect(b.minE).toBeLessThan(-50)
    expect(b.maxE).toBeGreaterThan(50)
    expect(b.minN).toBeLessThan(-10)
    expect(b.maxN).toBeGreaterThan(10)
  })
})

describe('map2d view transform (pan/zoom)', () => {
  it('viewToMapBounds scales East with canvas aspect', () => {
    const view = fitMapViewToBounds({
      minE: -100,
      maxE: 100,
      minN: -50,
      maxN: 50,
    })
    const square = viewToMapBounds(view, 200, 200)
    const wide = viewToMapBounds(view, 400, 200)
    expect(wide.maxE - wide.minE).toBeCloseTo(
      (square.maxE - square.minE) * 2,
      5,
    )
    expect(wide.maxN - wide.minN).toBeCloseTo(square.maxN - square.minN, 5)
  })

  it('panMapView shifts center and disables autoFit', () => {
    const view = fitMapViewToBounds({
      minE: 0,
      maxE: 100,
      minN: 0,
      maxN: 100,
    })
    const next = panMapView(view, 10, -5)
    expect(next.centerE).toBeCloseTo(view.centerE + 10)
    expect(next.centerN).toBeCloseTo(view.centerN - 5)
    expect(next.autoFit).toBe(false)
  })

  it('zoomMapViewAt keeps anchor ENU fixed in the viewport', () => {
    const view = {
      centerE: 0,
      centerN: 0,
      halfExtentN: 100,
      autoFit: false,
    }
    const anchorE = 40
    const anchorN = 20
    const before = viewToMapBounds(view, 200, 200)
    const pxBefore = enuToMapPx(anchorE, anchorN, before, 200, 200, 0)
    const zoomed = zoomMapViewAt(view, 0.5, anchorE, anchorN)
    const after = viewToMapBounds(zoomed, 200, 200)
    const pxAfter = enuToMapPx(anchorE, anchorN, after, 200, 200, 0)
    expect(pxAfter.x).toBeCloseTo(pxBefore.x, 5)
    expect(pxAfter.y).toBeCloseTo(pxBefore.y, 5)
    expect(zoomed.halfExtentN).toBeCloseTo(50)
  })

  it('wheelZoomFactor zooms out on positive deltaY', () => {
    expect(wheelZoomFactor(100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(-100)).toBeLessThan(1)
  })
})

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

  it('tilesForEnuBounds returns a capped tile list', () => {
    const geo = {
      enuToLatLon: (east: number, north: number) => ({
        lat: 41 + north / 111_320,
        lon: 29 + east / (111_320 * Math.cos((41 * Math.PI) / 180)),
      }),
      latLonToEnu: (lat: number, lon: number) => ({
        east: (lon - 29) * 111_320 * Math.cos((41 * Math.PI) / 180),
        north: (lat - 41) * 111_320,
      }),
    }
    const tiles = tilesForEnuBounds(
      { minE: -200, maxE: 200, minN: -200, maxN: 200 },
      geo,
      240,
    )
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.length).toBeLessThanOrEqual(24)
  })
})

describe('billboardChain sampling', () => {
  it('samples a straight 100m segment every 25m', () => {
    const samples = samplePolylineAtSpacing(
      [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
      ],
      25,
    )
    expect(samples[0]).toMatchObject({ x: 0, z: 0 })
    expect(samples.length).toBeGreaterThanOrEqual(4)
    expect(samples[1]!.x).toBeCloseTo(25)
  })
})

describe('resolveMapDotFill', () => {
  it('uses catalogue colour for boats and cyan for drones', () => {
    const colours = new Map([
      ['21', '#ff66b3'],
      ['23', '#0000ff'],
    ])
    expect(resolveMapDotFill('21', 'boat', colours)).toBe('#ff66b3')
    expect(resolveMapDotFill('23', 'boat', colours)).toBe('#0000ff')
    expect(resolveMapDotFill('99', 'boat', colours)).toBe(DEFAULT_BOAT_DOT_COLOR)
    expect(resolveMapDotFill('1', 'drone', colours)).toBe(DEFAULT_DRONE_DOT_COLOR)
  })
})
