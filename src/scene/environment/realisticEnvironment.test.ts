import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { WindBus, resetWindBusForTests, windBus } from '../../telemetry/windBus.ts'
import { knotsToMs } from '../../telemetry/windDirection.ts'
import { createRealisticEnvironment } from './realisticEnvironment.ts'
import { waveDirectionXZ } from './gerstnerOcean.ts'
import { WIND_OCEAN_RAMP_SECONDS } from './windOceanCoupling.ts'
import { shouldShowRealisticEnvironment } from './environmentMode.ts'

describe('createRealisticEnvironment', () => {
  const scenes: THREE.Scene[] = []
  const handles: ReturnType<typeof createRealisticEnvironment>[] = []

  afterEach(() => {
    for (const handle of handles) handle.dispose()
    handles.length = 0
    for (const scene of scenes) {
      scene.clear()
    }
    scenes.length = 0
    resetWindBusForTests()
  })

  it('mounts Gerstner ocean+sky (no Water example) and disposes cleanly', () => {
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 4, ringCount: 2, ringSegments: 4 },
    })
    handles.push(handle)
    const scene = new THREE.Scene()
    scenes.push(scene)
    scene.add(handle.root)
    scene.fog = handle.fog

    expect(handle.root.name).toBe('realisticEnvironment')
    expect(handle.root.getObjectByName('gerstnerOcean')).toBeTruthy()
    expect(handle.root.getObjectByName('realisticWater')).toBeFalsy()
    expect(handle.root.getObjectByName('realisticSky')).toBeTruthy()
    expect(handle.ocean.material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(scene.fog).toBe(handle.fog)

    handle.tick(0)
    scene.remove(handle.root)
    scene.fog = null
    handle.dispose()
    expect(handle.root.children.length).toBe(0)
  })

  it('snaps default wind from 000° to travel +Z (not the old −Z swell)', () => {
    const snap = windBus.getSnapshot()
    expect(snap?.directionFromDeg).toBe(0)
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 2, ringCount: 1, ringSegments: 4 },
    })
    handles.push(handle)
    const d = waveDirectionXZ(handle.getDirectionRad())
    expect(d.x).toBeCloseTo(0, 5)
    expect(d.z).toBeCloseTo(1, 5)
    expect(handle.getWindSpeed()).toBeCloseTo(knotsToMs(6), 5)
  })

  it('ramps 90° from-east to −X without jumping in one update; speed reaches foam', () => {
    let nowMs = 0
    const bus = new WindBus()
    bus.publish({
      directionFromDeg: 0,
      speedMs: knotsToMs(6),
      source: 'operator',
      updatedAtMs: 0,
    })
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 2, ringCount: 1, ringSegments: 4 },
      now: () => nowMs,
      wind: bus,
      windRampSeconds: WIND_OCEAN_RAMP_SECONDS,
    })
    handles.push(handle)

    const start = waveDirectionXZ(handle.getDirectionRad())
    expect(start.z).toBeCloseTo(1, 5)

    bus.publish({
      directionFromDeg: 90,
      speedMs: 8,
      source: 'operator',
      updatedAtMs: 1,
    })
    handle.tick(0.016)
    const mid = waveDirectionXZ(handle.getDirectionRad())
    expect(mid.x).toBeGreaterThan(-0.5)
    expect(mid.z).toBeGreaterThan(0.5)
    expect(handle.getWindSpeed()).not.toBeCloseTo(8, 1)

    nowMs = WIND_OCEAN_RAMP_SECONDS * 1000
    handle.tick(0)
    const done = waveDirectionXZ(handle.getDirectionRad())
    expect(done.x).toBeCloseTo(-1, 5)
    expect(done.z).toBeCloseTo(0, 5)
    expect(handle.getWindSpeed()).toBeCloseTo(8, 5)
  })

  it('does not change the simple / opaqueClearSafe gate', () => {
    expect(shouldShowRealisticEnvironment('realistic', true)).toBe(true)
    expect(shouldShowRealisticEnvironment('realistic', false)).toBe(false)
    expect(shouldShowRealisticEnvironment('simple', true)).toBe(false)
  })

  it('forwards shore contact to the ocean and drops the FBO when cleared', () => {
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 2, ringCount: 1, ringSegments: 4 },
      coupleWind: false,
    })
    handles.push(handle)
    expect(handle.getShoreFoamEnabled()).toBe(false)
    expect(handle.getShoreDepthTarget()).toBeNull()

    handle.setShoreContact(new THREE.Group())
    expect(handle.getShoreFoamEnabled()).toBe(true)
    expect(handle.getShoreDepthTarget()).toBeInstanceOf(THREE.WebGLRenderTarget)

    handle.setShoreContact(null)
    expect(handle.getShoreFoamEnabled()).toBe(false)
    expect(handle.getShoreDepthTarget()).toBeNull()
  })
})
