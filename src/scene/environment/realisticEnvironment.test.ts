import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { WindBus, resetWindBusForTests, windBus } from '../../telemetry/windBus.ts'
import { knotsToMs } from '../../telemetry/windDirection.ts'
import { createRealisticEnvironment, REALISTIC_ENVIRONMENT_DEFAULTS } from './realisticEnvironment.ts'
import { GERSTNER_OCEAN_DEFAULTS, waveDirectionXZ } from './gerstnerOcean.ts'
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
    expect(handle.root.getObjectByName('windVane')).toBeTruthy()
    expect(handle.root.getObjectByName('windStrings')).toBeTruthy()
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

  it('uses a sky radius that still covers the 3rd bridge from the race origin', () => {
    expect(REALISTIC_ENVIRONMENT_DEFAULTS.skyScale).toBe(80_000)
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
    const vane = handle.root.getObjectByName('windVane')
    expect(vane).toBeTruthy()
    expect(vane!.rotation.y).toBeCloseTo(0, 5)
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

  it('applies seaQuality low (5 rings, quarter-res foam scale)', () => {
    const handle = createRealisticEnvironment({
      skyScale: 100,
      seaQuality: 'low',
      coupleWind: false,
    })
    handles.push(handle)
    expect(handle.getSeaQuality()).toBe('low')
    const high = createRealisticEnvironment({
      skyScale: 100,
      seaQuality: 'high',
      coupleWind: false,
    })
    handles.push(high)
    const lowCount = handle.ocean.geometry.getAttribute('position')!.count
    const highCount = high.ocean.geometry.getAttribute('position')!.count
    expect(lowCount).toBeLessThan(highCount)
  })

  it('mounts wind strings (additive, depthWrite off) on the same ramped travel', () => {
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 2, ringCount: 1, ringSegments: 4 },
    })
    handles.push(handle)
    const mesh = handle.root.getObjectByName('windStrings') as THREE.Mesh
    expect(mesh).toBeTruthy()
    const mat = mesh.material as THREE.ShaderMaterial
    expect(mat.depthWrite).toBe(false)
    expect(mat.blending).toBe(THREE.AdditiveBlending)
    handle.tick(0)
    const d = waveDirectionXZ(handle.getDirectionRad())
    expect(d.z).toBeCloseTo(1, 5)
  })

  it('dispose unsubscribes the wind bus', () => {
    const bus = new WindBus()
    bus.publish({
      directionFromDeg: 0,
      speedMs: knotsToMs(6),
      source: 'operator',
      updatedAtMs: 0,
    })
    let subCalls = 0
    let unsubCalls = 0
    const real = bus.subscribe.bind(bus)
    bus.subscribe = (handler) => {
      subCalls += 1
      const off = real(handler)
      return () => {
        unsubCalls += 1
        off()
      }
    }
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 2, ringCount: 1, ringSegments: 4 },
      wind: bus,
    })
    handles.push(handle)
    expect(subCalls).toBe(1)
    handle.dispose()
    expect(unsubCalls).toBe(1)
  })
})

describe('realistic fog (04-07)', () => {
  it('matches dark ocean horizon, not 04-06 mid-teal or 0x8a9aaa', () => {
    expect(REALISTIC_ENVIRONMENT_DEFAULTS.fogColor).toBe(
      GERSTNER_OCEAN_DEFAULTS.horizonColor,
    )
    expect(REALISTIC_ENVIRONMENT_DEFAULTS.fogColor).toBe(0x2a4a52)
    expect(REALISTIC_ENVIRONMENT_DEFAULTS.fogColor).not.toBe(0x5a8a8c)
    expect(REALISTIC_ENVIRONMENT_DEFAULTS.fogColor).not.toBe(0x8a9aaa)
    const handle = createRealisticEnvironment({
      skyScale: 100,
      ocean: { innerSegments: 2, ringCount: 1, ringSegments: 4 },
    })
    try {
      expect(handle.fog.color.getHex()).toBe(0x2a4a52)
    } finally {
      handle.dispose()
    }
  })
})
