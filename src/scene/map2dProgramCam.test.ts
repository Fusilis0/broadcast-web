import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createMap2dProgramCam,
  DEFAULT_MAP2D_METRES_ACROSS,
  MAP2D_PROGRAM_STALE_MS,
  centroidEastNorth,
  isMap2dProgramView,
  layoutCentroidEastNorth,
  liveMap2dProgramBoats,
  metresAcrossToHalfExtentN,
  resolveMap2dProgramView,
  STREAM_MAP_ASPECT,
} from './map2dProgramCam.ts'
import { STATIC_HULL_LIVE_HOLD_MS } from './staticFleetHulls.ts'
import { viewToMapBounds } from './map2dView.ts'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

function boat(
  id: string,
  east: number,
  north: number,
  lastLiveAtMs: number,
) {
  return { id, east, north, lastLiveAtMs }
}

describe('2D program telemetry filter', () => {
  it('centroid ignores boats with no pose / planned-only / stale GPS', () => {
    expect(MAP2D_PROGRAM_STALE_MS).toBe(STATIC_HULL_LIVE_HOLD_MS)
    expect(MAP2D_PROGRAM_STALE_MS).toBe(2_000)

    const now = 10_000
    const live = liveMap2dProgramBoats(
      [
        boat('21', 10, 20, now),
        boat('22', 30, 40, now - MAP2D_PROGRAM_STALE_MS - 1),
        boat('40', 99, 99, Number.NaN),
      ],
      now,
    )
    expect(live.map((b) => b.id)).toEqual(['21'])
    expect(centroidEastNorth(live)).toEqual({ east: 10, north: 20 })
    expect(centroidEastNorth([])).toBeNull()
    expect(
      liveMap2dProgramBoats([boat('21', 10, 20, now)], now, new Set(['21'])),
    ).toEqual([])
  })
})

describe('resolveMap2dProgramView', () => {
  it('freezes last target when the live set is empty (no wander)', () => {
    const last = { east: 12, north: -8 }
    const empty = resolveMap2dProgramView({
      boats: [],
      nowMs: 10_000,
      follow: 'centroid',
      boatId: null,
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 250,
      lastTarget: last,
      fallbackTarget: { east: 500, north: 500 },
    })
    expect(empty.frozen).toBe(true)
    expect(empty.view.centerE).toBeCloseTo(12)
    expect(empty.view.centerN).toBeCloseTo(-8)
    expect(empty.view.autoFit).toBe(false)

    const first = resolveMap2dProgramView({
      boats: [],
      nowMs: 10_000,
      follow: 'centroid',
      boatId: null,
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 250,
      lastTarget: null,
      fallbackTarget: { east: 40, north: -10 },
    })
    expect(first.frozen).toBe(true)
    expect(first.view.centerE).toBeCloseTo(40)
    expect(first.view.centerN).toBeCloseTo(-10)
  })

  it('follows centroid of live boats and one selected boat', () => {
    const now = 5_000
    const boats = [
      boat('21', 0, 0, now),
      boat('22', 20, 10, now),
      boat('planned', 1000, 1000, 0),
    ]
    const mid = resolveMap2dProgramView({
      boats,
      nowMs: now,
      follow: 'centroid',
      boatId: null,
      offsetEastM: 5,
      offsetNorthM: -3,
      metresAcross: 250,
      lastTarget: null,
    })
    expect(mid.frozen).toBe(false)
    expect(mid.target).toEqual({ east: 10, north: 5 })
    expect(mid.view.centerE).toBeCloseTo(15)
    expect(mid.view.centerN).toBeCloseTo(2)

    const one = resolveMap2dProgramView({
      boats,
      nowMs: now,
      follow: 'boat',
      boatId: '22',
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 250,
      lastTarget: null,
    })
    expect(one.frozen).toBe(false)
    expect(one.view.centerE).toBeCloseTo(20)
    expect(one.view.centerN).toBeCloseTo(10)

    const missing = resolveMap2dProgramView({
      boats,
      nowMs: now,
      follow: 'boat',
      boatId: 'planned',
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 250,
      lastTarget: { east: 7, north: 8 },
    })
    expect(missing.frozen).toBe(true)
    expect(missing.view.centerE).toBeCloseTo(7)
    expect(missing.view.centerN).toBeCloseTo(8)
  })

  it('zoom (metres across) changes the ENU span of the view', () => {
    const tight = resolveMap2dProgramView({
      boats: [boat('21', 0, 0, 1)],
      nowMs: 1,
      follow: 'centroid',
      boatId: null,
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 80,
      lastTarget: null,
    })
    const wide = resolveMap2dProgramView({
      boats: [boat('21', 0, 0, 1)],
      nowMs: 1,
      follow: 'centroid',
      boatId: null,
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 400,
      lastTarget: null,
    })
    const tightBounds = viewToMapBounds(tight.view, 1920, 1080)
    const wideBounds = viewToMapBounds(wide.view, 1920, 1080)
    const tightAcross = tightBounds.maxE - tightBounds.minE
    const wideAcross = wideBounds.maxE - wideBounds.minE
    expect(tightAcross).toBeCloseTo(80, 5)
    expect(wideAcross).toBeCloseTo(400, 5)
    expect(wide.view.halfExtentN).toBeGreaterThan(tight.view.halfExtentN)
    expect(metresAcrossToHalfExtentN(250)).toBeCloseTo(
      250 / (2 * STREAM_MAP_ASPECT),
    )
  })

  it('createMap2dProgramCam notes live poses and freezes after stale', () => {
    const cam = createMap2dProgramCam()
    cam.noteBoatPose('21', 10, 4, 1_000)
    cam.noteBoatPose('22', 30, 8, 1_000)
    const live = cam.resolveView(1_000)
    expect(live.centerE).toBeCloseTo(20)
    expect(live.centerN).toBeCloseTo(6)
    expect(live.autoFit).toBe(false)

    const frozen = cam.resolveView(1_000 + MAP2D_PROGRAM_STALE_MS + 1)
    expect(frozen.centerE).toBeCloseTo(20)
    expect(frozen.centerN).toBeCloseTo(6)

    cam.setMetresAcross(80)
    cam.setOffsetEastM(12)
    const zoomed = cam.resolveView(1_000 + MAP2D_PROGRAM_STALE_MS + 1)
    expect(zoomed.centerE).toBeCloseTo(32)
    expect(zoomed.halfExtentN).toBeLessThan(live.halfExtentN)
  })
})

describe('layoutCentroidEastNorth', () => {
  it('averages layout ENU (scene z = −north)', () => {
    expect(
      layoutCentroidEastNorth([
        {
          points: [
            { x: 0, z: 0 },
            { x: 20, z: -10 },
          ],
        },
      ]),
    ).toEqual({ east: 10, north: 5 })
    expect(layoutCentroidEastNorth([])).toBeNull()
  })
})

describe('isMap2dProgramView', () => {
  it('accepts a frozen autoFit-off view', () => {
    expect(
      isMap2dProgramView({
        centerE: 1,
        centerN: 2,
        halfExtentN: 40,
        autoFit: false,
      }),
    ).toBe(true)
    expect(
      isMap2dProgramView({
        centerE: 1,
        centerN: 2,
        halfExtentN: 40,
        autoFit: true,
      }),
    ).toBe(false)
    expect(DEFAULT_MAP2D_METRES_ACROSS).toBe(250)
  })
})

describe('2D program wiring (source)', () => {
  it('does not touch STUDIO_TICK_FPS; studio 2D view is sent to the 2D plate', () => {
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    expect(main).toMatch(/createMap2dProgramCam/)
    expect(main).toMatch(/sendMap2dView/)
    expect(main).toMatch(/onMap2dView/)
    expect(main).toMatch(/applyMap2dProgramView/)
    expect(main).not.toMatch(/STUDIO_TICK_FPS\s*=/)

    const desktop = readFileSync(join(repoRoot, 'desktop/main.cjs'), 'utf8')
    expect(desktop).toMatch(/srtOut:map2dView/)
    expect(desktop).toMatch(/STUDIO_TICK_FPS\s*=\s*60/)
    expect(desktop).not.toMatch(/STUDIO_TICK_FPS\s*=\s*30/)

    const preload = readFileSync(join(repoRoot, 'desktop/preload.cjs'), 'utf8')
    expect(preload).toMatch(/sendMap2dView/)
    expect(preload).toMatch(/onMap2dView/)

    const map = readFileSync(join(here, 'map2d.ts'), 'utf8')
    expect(map).toMatch(/setView/)
    expect(map).toMatch(/autoFit:\s*false/)
    expect(map).toMatch(/if \(isStream\) return/)
    expect(map).toMatch(/drawMapBoatIcon/)
  })
})
