/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { createBoatEntity } from './boatEntity.ts'
import {
  canApplyStaticHull,
  canAuthorStaticHull,
  resolveStaticHullPosition,
  STATIC_HULL_GRID_SPACING_M,
  STATIC_HULL_LIVE_HOLD_MS,
  staticBoatPose,
  staticHullGridPosition,
} from './staticFleetHulls.ts'

describe('staticHullGridPosition', () => {
  it('offsets by index so hulls do not stack', () => {
    expect(staticHullGridPosition(0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(staticHullGridPosition(1)).toEqual({
      x: STATIC_HULL_GRID_SPACING_M,
      y: 0,
      z: 0,
    })
    expect(staticHullGridPosition(4)).toEqual({
      x: 0,
      y: 0,
      z: -STATIC_HULL_GRID_SPACING_M,
    })
  })
})

describe('canApplyStaticHull', () => {
  it('allows planned pose when the id never had live telem', () => {
    expect(canApplyStaticHull(undefined)).toBe(true)
  })

  it('holds last live pose during and after the freshness window', () => {
    const liveAt = 1_000
    expect(canApplyStaticHull(liveAt)).toBe(false)
    expect(STATIC_HULL_LIVE_HOLD_MS).toBe(2000)
  })

  it('allows map-authoring after live packets go stale (not during live)', () => {
    expect(canAuthorStaticHull(undefined, 5_000)).toBe(true)
    expect(canAuthorStaticHull(4_000, 5_000)).toBe(false)
    expect(canAuthorStaticHull(2_000, 5_000)).toBe(true)
  })
})

describe('static fleet hull spawn (no poseBus)', () => {
  it('allow-listed id with no live packets still has a mesh at planned ENU', () => {
    const boat = createBoatEntity({ id: '25', tryGltf: false })
    const lastLive = new Map<string, number>()
    const seed = { id: '25', position: { x: 12, y: 0, z: -40 } }
    expect(canApplyStaticHull(lastLive.get('25'))).toBe(true)
    const pos = resolveStaticHullPosition(seed, 0)
    boat.applyPose(staticBoatPose('25', pos))
    expect(boat.root.visible).toBe(true)
    expect(boat.root.position.x).toBe(12)
    expect(boat.root.position.z).toBe(-40)
    boat.dispose()
  })

  it('planned ENU y moves the hull; live packet still blocks snap-back', () => {
    const boat = createBoatEntity({ id: '25', tryGltf: false })
    const seed = { id: '25', position: { x: 12, y: 4.5, z: -40 } }
    expect(canApplyStaticHull(undefined)).toBe(true)
    expect(resolveStaticHullPosition(seed, 0).y).toBe(4.5)
    boat.applyPose(staticBoatPose('25', resolveStaticHullPosition(seed, 0)))
    expect(boat.root.position.y).toBe(4.5)

    boat.applyPose(staticBoatPose('25', { x: 1, y: 9, z: -1 }, 1))
    const lastLive = new Map<string, number>([['25', Date.now()]])
    expect(canApplyStaticHull(lastLive.get('25'))).toBe(false)
    expect(boat.root.position.y).toBe(9)
    expect(resolveStaticHullPosition(seed, 0).y).toBe(4.5)
    boat.dispose()
  })

  it('does not snap back to planned after a live pose', () => {
    const boat = createBoatEntity({ id: '25', tryGltf: false })
    boat.applyPose(
      staticBoatPose('25', { x: 1, y: 0, z: -1 }, 1),
    )
    const lastLive = new Map<string, number>([['25', Date.now()]])
    expect(canApplyStaticHull(lastLive.get('25'))).toBe(false)
    expect(boat.root.position.x).toBe(1)
    boat.dispose()
  })

  it('ghost/hidden still apply on a static hull', () => {
    const boat = createBoatEntity({
      id: '26',
      tryGltf: false,
      visibilityMode: 'hidden',
    })
    boat.applyPose(staticBoatPose('26', staticHullGridPosition(2)))
    expect(boat.root.visible).toBe(true)
    expect(boat.getVisibilityMode()).toBe('hidden')
    boat.dispose()
  })
})
