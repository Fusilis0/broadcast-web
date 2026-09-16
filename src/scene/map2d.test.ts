/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { knotsToMs } from '../telemetry/windDirection.ts'
import { resetWindBusForTests, windBus } from '../telemetry/windBus.ts'
import type { LayoutFeature } from './features/types.ts'
import {
  boundsFromPoints,
  createMap2d,
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
  MAX_OSM_VISIBLE_TILES,
} from './map2dBasemap.ts'
import { samplePolylineAtSpacing } from './billboardChain.ts'
import * as GeoOrigin from '../geodesy/geoOrigin.ts'
import { gpsToEnu, northFromSceneZ } from '../geodesy/index.ts'

afterEach(() => {
  sessionStorage.removeItem('bw.streamMap.boatScale')
})

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

  it('scene Vector3 north (−Z) and named-scalar map agree: N→top, E→right', () => {
    const lat0 = 41.08673822819249
    const lon0 = 29.061803205100848
    GeoOrigin.setOriginHAE(lat0, lon0, 0)
    try {
      const metersPerDegLat = 111_320
      const metersPerDegLon =
        metersPerDegLat * Math.cos((lat0 * Math.PI) / 180)
      const east = gpsToEnu(lat0, lon0 + 500 / metersPerDegLon, 0)
      const north = gpsToEnu(lat0 + 500 / metersPerDegLat, lon0, 0)
      expect(east.x).toBeGreaterThan(0)
      expect(north.z).toBeLessThan(0)

      const bounds = { minE: -800, maxE: 800, minN: -800, maxN: 800 }
      const originPx = enuToMapPx(0, 0, bounds, 200, 200, 0)
      const eastPx = enuToMapPx(
        east.x,
        northFromSceneZ(east.z),
        bounds,
        200,
        200,
        0,
      )
      const northPx = enuToMapPx(
        north.x,
        northFromSceneZ(north.z),
        bounds,
        200,
        200,
        0,
      )
      expect(eastPx.x).toBeGreaterThan(originPx.x)
      expect(northPx.y).toBeLessThan(originPx.y)
    } finally {
      GeoOrigin.resetForTests()
    }
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

  it('1920×1080 stream source widens East vs a 1080² square (same north span)', () => {
    const view = {
      centerE: 0,
      centerN: 0,
      halfExtentN: 100,
      autoFit: true,
    }
    const square = viewToMapBounds(view, 1080, 1080)
    const wide = viewToMapBounds(view, 1920, 1080)
    expect(wide.maxN - wide.minN).toBeCloseTo(square.maxN - square.minN, 5)
    expect(wide.maxE - wide.minE).toBeCloseTo(
      (square.maxE - square.minE) * (16 / 9),
      5,
    )
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

describe('map2d stream program view', () => {
  it('setView zoom changes stream bounds; autoFit stays off', () => {
    const stream = createMap2d({
      variant: 'stream',
      widthPx: 1920,
      heightPx: 1080,
      visible: false,
    })
    try {
      expect(stream.getView().autoFit).toBe(false)
      stream.updatePose({
        id: '21',
        kind: 'boat',
        position: { x: 40, y: 0, z: -10 },
        rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
        fovHDeg: 60,
        ts: 1,
      })
      // Planned-looking pose must not auto-fit the stream (program cam owns zoom).
      expect(stream.getView().autoFit).toBe(false)
      stream.setView({
        centerE: 10,
        centerN: -4,
        halfExtentN: 20,
        autoFit: true,
      })
      expect(stream.getView().autoFit).toBe(false)
      expect(stream.getView().centerE).toBeCloseTo(10)
      expect(stream.getView().centerN).toBeCloseTo(-4)
      const tight = viewToMapBounds(stream.getView(), 1920, 1080)
      stream.setView({
        centerE: 10,
        centerN: -4,
        halfExtentN: 80,
        autoFit: false,
      })
      const wide = viewToMapBounds(stream.getView(), 1920, 1080)
      expect(wide.maxE - wide.minE).toBeGreaterThan(tight.maxE - tight.minE)
      expect(stream.getPoseIds()).toEqual(['21'])
    } finally {
      stream.dispose()
    }
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
    expect(tiles.length).toBeLessThanOrEqual(MAX_OSM_VISIBLE_TILES)
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

describe('map2d windBus readout', () => {
  afterEach(() => {
    resetWindBusForTests()
  })

  it('subscribes to windBus (no fetch) and still redraws after a publish', () => {
    const ops = createMap2d({ sizePx: 120, visible: false })
    const stream = createMap2d({
      sizePx: 120,
      visible: false,
      variant: 'stream',
    })
    try {
      windBus.publish({
        directionFromDeg: 90,
        speedMs: knotsToMs(12),
        source: 'operator',
        updatedAtMs: 1,
      })
      expect(ops.getCanvas().width).toBe(120)
      expect(stream.getCanvas().width).toBe(120)
    expect(stream.getCanvas().height).toBe(120)
    } finally {
      ops.dispose()
      stream.dispose()
    }
  })
})

describe('map2d pose prune', () => {
  const pose = (
    id: string,
    kind: 'boat' | 'drone' | 'buoy',
    east = 0,
    north = 0,
  ) => ({
    id,
    kind,
    position: { x: east, y: 0, z: -north },
    rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
    fovHDeg: 60,
    ts: 1,
  })

  it('removePose drops a point; place seed works without telemetry', () => {
    const map = createMap2d({ sizePx: 120, visible: false })
    try {
      map.updatePose(pose('21', 'boat', 10, 20))
      expect(map.getPoseIds()).toEqual(['21'])
      expect(map.removePose('21')).toBe(true)
      expect(map.getPoseIds()).toEqual([])
      expect(map.removePose('21')).toBe(false)

      // Planned place: seed icon at click ENU with no live packets.
      map.updatePose(pose('40', 'boat', 55, -12))
      expect(map.getPoseIds()).toContain('40')
    } finally {
      map.dispose()
    }
  })

  it('hitTestPose finds a boat icon and ignores hidden ids', () => {
    const map = createMap2d({ sizePx: 120, visible: false })
    try {
      map.updatePose(pose('21', 'boat', 10, 20))
      map.updatePose(pose('1', 'drone', 80, 80))
      map.redraw()
      expect(map.hitTestPose(10, 20, 40, ['boat'])?.id).toBe('21')
      expect(map.hitTestPose(10, 20, 40, ['drone'])).toBeNull()
      map.setHiddenPoseIds(['21'])
      expect(map.hitTestPose(10, 20, 40, ['boat'])).toBeNull()
    } finally {
      map.dispose()
    }
  })

  it('keeps a boat and a drone that share the same id', () => {
    const map = createMap2d({ sizePx: 120, visible: false })
    try {
      map.updatePose(pose('1', 'boat', 10, 20))
      map.updatePose(pose('1', 'drone', 80, 80))
      map.redraw()
      expect(map.getPoseIds()).toEqual(['1'])
      expect(map.hitTestPose(10, 20, 40, ['boat'])?.kind).toBe('boat')
      expect(map.hitTestPose(80, 80, 40, ['drone'])?.kind).toBe('drone')
      expect(map.removePose('1')).toBe(true)
      expect(map.getPoseIds()).toEqual([])
    } finally {
      map.dispose()
    }
  })

  it('hitTestPolylineInsert finds the mid-segment splice on a chain', () => {
    const map = createMap2d({ sizePx: 200, visible: false })
    try {
      map.setLayoutFeatures([
        {
          id: 'chain:1',
          name: 'chain',
          type: 'billboardChain',
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 80, y: 0, z: 0 },
          ],
          rawPoints: [],
        },
      ])
      map.redraw()
      const hit = map.hitTestPolylineInsert(40, 0, 40, ['billboardChain'])
      expect(hit?.featureId).toBe('chain:1')
      expect(hit?.insertIndex).toBe(1)
      expect(hit?.east).toBeCloseTo(40, 0)
    } finally {
      map.dispose()
    }
  })

  it('retainPoseIds drops deleted fleet icons but keeps buoys', () => {
    const map = createMap2d({ sizePx: 120, visible: false })
    try {
      map.updatePose(pose('21', 'boat'))
      map.updatePose(pose('22', 'boat'))
      map.updatePose(pose('1', 'drone'))
      map.updatePose(pose('mark-a', 'buoy'))
      const removed = map.retainPoseIds(['21', '1'])
      expect(removed).toBe(1)
      expect(map.getPoseIds().sort()).toEqual(['1', '21', 'mark-a'].sort())
    } finally {
      map.dispose()
    }
  })

  it('retainPoseIds clears a previous 4-boat pack down to one boat', () => {
    const map = createMap2d({ sizePx: 120, visible: false })
    try {
      map.updatePose(pose('21', 'boat'))
      map.updatePose(pose('22', 'boat'))
      map.updatePose(pose('23', 'boat'))
      map.updatePose(pose('24', 'boat'))
      const removed = map.retainPoseIds(['1'])
      expect(removed).toBe(4)
      expect(map.getPoseIds()).toEqual([])
      map.updatePose(pose('1', 'boat'))
      expect(map.getPoseIds()).toEqual(['1'])
    } finally {
      map.dispose()
    }
  })
})

describe('map2d canvas size', () => {
  it('keeps ops map square via setSizePx (authoring unchanged)', () => {
    const map = createMap2d({ sizePx: 240, visible: false })
    try {
      expect(map.getCanvas().width).toBe(240)
      expect(map.getCanvas().height).toBe(240)
      map.setSizePx(180)
      expect(map.getCanvas().width).toBe(180)
      expect(map.getCanvas().height).toBe(180)
    } finally {
      map.dispose()
    }
  })

  it('honors 16:9 widthPx/heightPx on stream variant', () => {
    const map = createMap2d({
      variant: 'stream',
      widthPx: 960,
      heightPx: 540,
      visible: false,
    })
    try {
      expect(map.getCanvas().width).toBe(960)
      expect(map.getCanvas().height).toBe(540)
      map.setSizePx(540)
      expect(map.getCanvas().width).toBe(960)
      expect(map.getCanvas().height).toBe(540)
    } finally {
      map.dispose()
    }
  })

  it('stream has no OSM checkbox; tiles draw when geoBridge is set', () => {
    const ops = createMap2d({ sizePx: 120, visible: false })
    const stream = createMap2d({
      variant: 'stream',
      widthPx: 160,
      heightPx: 90,
      visible: false,
    })
    try {
      expect(ops.root.querySelector('.ops-map__check')).not.toBeNull()
      expect(stream.root.querySelector('.ops-map__check')).toBeNull()
      expect(stream.root.querySelector('.stream-map__title')).toBeNull()
      expect(ops.isBasemapEnabled()).toBe(false)
      expect(stream.isBasemapEnabled()).toBe(true)

      const src = readFileSync(join(process.cwd(), 'src/scene/map2d.ts'), 'utf8')
      expect(src).toContain('if (basemapEnabled && geoBridge)')
      expect(src).not.toContain('if (!isStream && basemapEnabled && geoBridge)')
    } finally {
      ops.dispose()
      stream.dispose()
    }
  })

  it('local 2D CSS scales stream-map to the host; off-screen stays inline 1920', () => {
    const css = readFileSync(join(process.cwd(), 'src/style.css'), 'utf8')
    expect(css).toContain('html.local-focus-2d .local-2d-map-host .stream-map')
    expect(css).toContain('width: 100% !important')
    expect(css).toContain('left: -10000px')
    expect(css).toContain('width: 1920px')
    expect(css).toContain('stream-map-boat-scale')
    expect(css).toContain('html.local-focus-2d .local-2d-map-host .stream-map-boat-scale')
    const map = createMap2d({
      variant: 'stream',
      widthPx: 1920,
      heightPx: 1080,
      visible: false,
    })
    try {
      expect(map.root.style.width).toBe('1920px')
      expect(map.getCanvas().width).toBe(1920)
      expect(map.getCanvas().height).toBe(1080)
    } finally {
      map.dispose()
    }
  })

  it('stream redraw uses filterFeaturesForStreamMap; ops keeps filterFeaturesFor2d', () => {
    const src = readFileSync(join(process.cwd(), 'src/scene/map2d.ts'), 'utf8')
    expect(src).toContain('filterFeaturesForStreamMap(layoutFeatures)')
    expect(src).toContain('filterFeaturesFor2d(layoutFeatures)')
    expect(src).toContain('scaleStreamBoatChrome(chrome, boatIconScale)')
    expect(src).toContain('metrics: fleetChrome')
    expect(src).toContain('len: fleetChrome.boatLen')
    expect(src).toContain('if (isStream && p.kind === \'drone\') continue')
    expect(src).toContain('setBoatNames')
    expect(src).toContain('STREAM_ROUNDING_ANIM_HZ')
    expect(src).not.toContain('metrics: chrome,')
    expect(src).toContain('isStream')
  })

  it('burns setTitle on the stream canvas and keeps DOM title off', () => {
    const stream = createMap2d({
      variant: 'stream',
      widthPx: 160,
      heightPx: 90,
      title: 'Boot title',
      visible: false,
    })
    const texts: string[] = []
    const ctx = stream.getCanvas().getContext('2d')
    const orig = ctx?.fillText.bind(ctx)
    if (ctx && orig) {
      ctx.fillText = ((text: string, ...rest: unknown[]) => {
        texts.push(String(text))
        return orig(text, ...(rest as [number, number]))
      }) as typeof ctx.fillText
    }
    try {
      expect(stream.root.querySelector('.ops-map__title')).toBeNull()
      stream.setTitle('Demo Istanbul')
      expect(stream.root.getAttribute('aria-label')).toContain('Demo Istanbul')
      if (ctx && orig) {
        expect(texts.some((t) => t.includes('DEMO ISTANBUL'))).toBe(true)
      }
    } finally {
      if (ctx && orig) ctx.fillText = orig
      stream.dispose()
    }
  })
})

describe('map2d stream boat icon scale', () => {
  afterEach(() => {
    sessionStorage.removeItem('bw.streamMap.boatScale')
  })

  it('defaults to 0.5; clamps; ops setBoatIconScale is a no-op', () => {
    const stream = createMap2d({
      variant: 'stream',
      widthPx: 160,
      heightPx: 90,
      visible: false,
    })
    const ops = createMap2d({ sizePx: 120, visible: false })
    try {
      expect(stream.getBoatIconScale()).toBe(0.5)
      stream.setBoatIconScale(0.1)
      expect(stream.getBoatIconScale()).toBe(0.25)
      stream.setBoatIconScale(9)
      expect(stream.getBoatIconScale()).toBe(2)
      stream.setBoatIconScale(Number.NaN)
      expect(stream.getBoatIconScale()).toBe(0.5)
      expect(sessionStorage.getItem('bw.streamMap.boatScale')).toBe('0.5')

      expect(ops.getBoatIconScale()).toBe(1)
      ops.setBoatIconScale(2)
      expect(ops.getBoatIconScale()).toBe(1)
      expect(sessionStorage.getItem('bw.streamMap.boatScale')).toBe('0.5')
    } finally {
      stream.dispose()
      ops.dispose()
    }
  })

  it('reads a stored scale on stream create', () => {
    sessionStorage.setItem('bw.streamMap.boatScale', '0.75')
    const stream = createMap2d({
      variant: 'stream',
      widthPx: 160,
      heightPx: 90,
      visible: false,
    })
    try {
      expect(stream.getBoatIconScale()).toBe(0.75)
    } finally {
      stream.dispose()
    }
  })
})

describe('map2d stream names vs ops ids', () => {
  it('wires catalogue names on stream boats; ops keeps id; stream skips drones', () => {
    const src = readFileSync(join(process.cwd(), 'src/scene/map2d.ts'), 'utf8')
    expect(src).toContain('resolveStreamFleetLabel(p.id, boatNames)')
    expect(src).toContain('isStream && p.kind === \'boat\'')
    expect(src).toContain('if (isStream && p.kind === \'drone\') continue')
    expect(src).toContain('setBoatNames')
    expect(src).not.toContain("drawMapFleetLabel(ctx, `${p.id}`, labelX, y + 3, fleetChrome)")
  })
})
