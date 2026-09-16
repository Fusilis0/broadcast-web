import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AR_FOLLOW_STALE_MS,
  AR_PLATE_WORLD_LAYERS,
  hasActiveArFollowTelemetry,
  noteArFollowGps,
  shouldApplyArFollowPose,
} from './arProgramFollow.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('AR plate world layers', () => {
  it('keeps terrain, sea, buildings, and heroes off', () => {
    expect(AR_PLATE_WORLD_LAYERS).toEqual({
      environmentMode: 'simple',
      terrainEnabled: false,
      buildingsEnabled: false,
      heroesEnabled: false,
    })
  })
})

describe('hasActiveArFollowTelemetry', () => {
  it('freezes when the follow POV has no GPS pose', () => {
    expect(hasActiveArFollowTelemetry(undefined, 10_000)).toBe(false)
    expect(shouldApplyArFollowPose({ followRequiresActiveGps: true, gpsLive: false })).toBe(
      false,
    )
  })

  it('unlocks Follow when that POV has recent usable GPS', () => {
    const last = new Map<string, number>()
    noteArFollowGps(last, {
      povId: '1',
      lat: 41.0,
      lon: 29.0,
      receivedAtMs: 8_500,
    })
    expect(hasActiveArFollowTelemetry(last.get('1'), 10_000)).toBe(true)
    expect(shouldApplyArFollowPose({ followRequiresActiveGps: true, gpsLive: true })).toBe(
      true,
    )
  })

  it('ignores lat/lon 0 (no GPS) and planned-only boats', () => {
    const last = new Map<string, number>()
    noteArFollowGps(last, {
      povId: '1',
      lat: 0,
      lon: 0,
      receivedAtMs: 10_000,
    })
    noteArFollowGps(last, {
      povId: '  ',
      lat: 41.0,
      lon: 29.0,
      receivedAtMs: 10_000,
    })
    expect(last.size).toBe(0)
    expect(hasActiveArFollowTelemetry(undefined, 10_000)).toBe(false)
  })

  it('freezes again after the GPS sample goes stale', () => {
    expect(hasActiveArFollowTelemetry(1_000, 1_000 + AR_FOLLOW_STALE_MS + 1)).toBe(
      false,
    )
    expect(hasActiveArFollowTelemetry(1_000, 1_000 + AR_FOLLOW_STALE_MS)).toBe(true)
  })

  it('ops / 3D still apply poses when the AR GPS gate is off', () => {
    expect(
      shouldApplyArFollowPose({ followRequiresActiveGps: false, gpsLive: false }),
    ).toBe(true)
  })
})

describe('AR plate wiring (source)', () => {
  it('does not enable terrain on the AR plate path', () => {
    const main = readFileSync(join(here, '../main.ts'), 'utf8')
    expect(main).toMatch(/AR_PLATE_WORLD_LAYERS/)
    expect(main).toMatch(/followRequiresActiveGps:\s*srtPlateChannel === 'ar'/)
    expect(main).toMatch(/srtPlateAcceptsWorldLook/)
    const applyLook = main.slice(
      main.indexOf('function applySrtWorldLook'),
      main.indexOf('function clearLiveStatusSub'),
    )
    expect(applyLook).toMatch(/srtPlateAcceptsWorldLook\(srtPlateChannel\)/)
    expect(applyLook).not.toMatch(/srtPlateChannel === '2d'/)
    expect(applyLook).toMatch(/setTerrainTilesLocked\(false\)/)
    expect(applyLook).not.toMatch(/look\.terrainTilesLocked/)
    const off = main.slice(
      main.indexOf('function applyArPlateWorldLayersOff'),
      main.indexOf('function applySrtPlatePresentation'),
    )
    expect(off).toMatch(/AR_PLATE_WORLD_LAYERS/)
    expect(off).toMatch(/setTerrainEnabled\(AR_PLATE_WORLD_LAYERS\.terrainEnabled\)/)
    const presentation = main.slice(
      main.indexOf('function applySrtPlatePresentation'),
      main.indexOf('function readSrtWorldLook'),
    )
    expect(presentation).toMatch(/applyArPlateWorldLayersOff\(\)/)
    expect(presentation).toMatch(/srtPlateChannel === 'ar'/)
    expect(presentation).toMatch(/arBackgroundMode = 'video'/)
    expect(presentation).toMatch(/resolveOpaqueClearSafeForVideo/)
    expect(presentation).toMatch(/setTerrainEnabled\(true\)/)
    expect(presentation).toMatch(/setTerrainTilesLocked\(false\)/)
    const arReturnAt = presentation.indexOf('applyArPlateWorldLayersOff()')
    const terrainOnAt = presentation.indexOf('setTerrainEnabled(true)')
    expect(arReturnAt).toBeGreaterThan(-1)
    expect(terrainOnAt).toBeGreaterThan(arReturnAt)
  })

  it('createScene freezes follow until GPS and skips cinematic leftover', () => {
    const scene = readFileSync(join(here, 'createScene.ts'), 'utf8')
    expect(scene).toMatch(/followRequiresActiveGps/)
    expect(scene).toMatch(/shouldApplyArFollowPose/)
    expect(scene).toMatch(/hasActiveArFollowTelemetry/)
    expect(scene).toMatch(/noteArFollowGps/)
    expect(scene).toMatch(/!followRequiresActiveGps && cinematicPlayer\.isActive\(\)/)
  })
})
