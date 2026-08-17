import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  GERSTNER_OCEAN_DEFAULTS,
  GERSTNER_WAVE_COUNT,
  createClipmapGeometry,
  createGerstnerOcean,
  streakIntensityFromSpeedMs,
  streakScrollSpeedMs,
  streakTravelXZ,
  waveDirectionXZ,
  WIND_STREAK_DEFAULTS,
} from './gerstnerOcean.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('waveDirectionXZ', () => {
  it('default −π/2 travels toward −Z (geographic north)', () => {
    const d = waveDirectionXZ(GERSTNER_OCEAN_DEFAULTS.directionRad)
    expect(GERSTNER_OCEAN_DEFAULTS.directionRad).toBeCloseTo(-Math.PI / 2)
    expect(d.x).toBeCloseTo(0, 5)
    expect(d.z).toBeCloseTo(-1, 5)
  })

  it('rotating the direction uniform rotates travel in XZ', () => {
    expect(waveDirectionXZ(0).x).toBeCloseTo(1, 5)
    expect(waveDirectionXZ(0).z).toBeCloseTo(0, 5)

    const eastToNorth = waveDirectionXZ(-Math.PI / 2)
    expect(eastToNorth.x).toBeCloseTo(0, 5)
    expect(eastToNorth.z).toBeCloseTo(-1, 5)

    const towardPosX = waveDirectionXZ(-Math.PI / 2 + Math.PI / 2)
    expect(towardPosX.x).toBeCloseTo(1, 5)
    expect(towardPosX.z).toBeCloseTo(0, 5)

    const towardPosZ = waveDirectionXZ(Math.PI / 2)
    expect(towardPosZ.x).toBeCloseTo(0, 5)
    expect(towardPosZ.z).toBeCloseTo(1, 5)
  })
})

describe('createClipmapGeometry', () => {
  it('builds an inner grid plus concentric rings', () => {
    const geo = createClipmapGeometry(8, 4, 2, 4)
    const pos = geo.getAttribute('position')
    expect(pos).toBeTruthy()
    expect(pos!.count).toBeGreaterThan(5 * 5)
    geo.dispose()
  })
})

describe('createGerstnerOcean', () => {
  it('mounts a displaced-shader mesh and disposes cleanly', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 4,
      ringCount: 2,
      ringSegments: 4,
    })
    expect(ocean.mesh.name).toBe('gerstnerOcean')
    expect(ocean.mesh.material).toBeInstanceOf(THREE.ShaderMaterial)
    const mat = ocean.mesh.material as THREE.ShaderMaterial
    expect(mat.uniforms['uDirectionRad']!.value).toBeCloseTo(
      GERSTNER_OCEAN_DEFAULTS.directionRad,
    )
    expect(GERSTNER_WAVE_COUNT).toBe(5)
    expect(ocean.mesh.position.y).toBeCloseTo(GERSTNER_OCEAN_DEFAULTS.liftY)

    ocean.dispose()
    expect(mat.uniforms['uTime']).toBeTruthy()
  })

  it('setDirectionRad updates the XZ travel uniform', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    ocean.setDirectionRad(0)
    expect(ocean.getDirectionRad()).toBeCloseTo(0)
    const d = waveDirectionXZ(ocean.getDirectionRad())
    expect(d.x).toBeCloseTo(1, 5)
    expect(d.z).toBeCloseTo(0, 5)
    ocean.dispose()
  })

  it('advances wave time from a shared clock even when dt is 0', () => {
    let nowMs = 4_000
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
      now: () => nowMs,
    })
    ocean.tick(0)
    const t1 = ocean.getTime()
    expect(t1).toBeCloseTo(4)

    nowMs = 4_500
    ocean.tick(0)
    const t2 = ocean.getTime()
    expect(t2).toBeGreaterThan(t1)
    expect(t2 - t1).toBeCloseTo(0.5)
    ocean.dispose()
  })

  it('does not allocate a depth FBO until shore contact is set', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    expect(ocean.getShoreFoamEnabled()).toBe(false)
    expect(ocean.getShoreDepthTarget()).toBeNull()
    const mat = ocean.mesh.material as THREE.ShaderMaterial
    expect(mat.uniforms['uShoreFoamEnabled']!.value).toBe(0)
    expect(mat.fragmentShader).toContain('uTerrainDepth')
    ocean.dispose()
    expect(ocean.getShoreDepthTarget()).toBeNull()
  })

  it('arms a depth RT on shore contact and disposes it when cleared', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    const terrain = new THREE.Group()
    terrain.name = 'cesiumTerrain'
    ocean.setShoreContact(terrain)
    expect(ocean.getShoreFoamEnabled()).toBe(true)
    const rt = ocean.getShoreDepthTarget()
    expect(rt).toBeInstanceOf(THREE.WebGLRenderTarget)
    expect(rt?.depthTexture).toBeInstanceOf(THREE.DepthTexture)

    ocean.setShoreContact(null)
    expect(ocean.getShoreFoamEnabled()).toBe(false)
    expect(ocean.getShoreDepthTarget()).toBeNull()
    ocean.dispose()
  })

  it('dispose releases the shore depth RT', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    ocean.setShoreContact(new THREE.Group())
    expect(ocean.getShoreDepthTarget()).toBeTruthy()
    ocean.dispose()
    expect(ocean.getShoreDepthTarget()).toBeNull()
  })
})

describe('wind streaks (14.3e)', () => {
  it('travel matches uDirectionRad: π/2 → +Z (from-000° swell)', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    ocean.setDirectionRad(Math.PI / 2)
    expect(ocean.getDirectionRad()).toBeCloseTo(Math.PI / 2)
    const d = streakTravelXZ(ocean.getDirectionRad())
    expect(d.x).toBeCloseTo(0, 5)
    expect(d.z).toBeCloseTo(1, 5)
    expect(d).toEqual(waveDirectionXZ(ocean.getDirectionRad()))
    ocean.dispose()
  })

  it('streak intensity is 0 at ~0 m/s and ramps with speed', () => {
    expect(streakIntensityFromSpeedMs(0)).toBe(0)
    expect(streakIntensityFromSpeedMs(-1)).toBe(0)
    expect(streakIntensityFromSpeedMs(WIND_STREAK_DEFAULTS.fadeMsLo)).toBe(0)
    expect(streakScrollSpeedMs(0)).toBe(0)
    expect(streakIntensityFromSpeedMs(WIND_STREAK_DEFAULTS.fadeMsHi)).toBeCloseTo(1)
    expect(streakIntensityFromSpeedMs(2.5)).toBeGreaterThan(0)
    expect(streakIntensityFromSpeedMs(2.5)).toBeLessThan(1)

    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
      windSpeed: 0,
    })
    const mat = ocean.mesh.material as THREE.ShaderMaterial
    expect(mat.uniforms['uStreakIntensity']!.value).toBe(0)
    expect(mat.uniforms['uStreakScroll']!.value).toBe(0)

    ocean.setWindSpeed(0)
    expect(mat.uniforms['uWindSpeed']!.value).toBe(0)
    expect(mat.uniforms['uStreakIntensity']!.value).toBe(0)
    expect(mat.uniforms['uStreakScroll']!.value).toBe(0)

    ocean.setWindSpeed(GERSTNER_OCEAN_DEFAULTS.windSpeed)
    expect(mat.uniforms['uStreakIntensity']!.value).toBeGreaterThan(0)
    expect(mat.uniforms['uStreakScroll']!.value).toBeCloseTo(
      streakScrollSpeedMs(GERSTNER_OCEAN_DEFAULTS.windSpeed),
    )
    ocean.dispose()
  })

  it('fragment shader scrolls a gust mask along uDirectionRad without an extra FBO', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    const mat = ocean.mesh.material as THREE.ShaderMaterial
    expect(mat.fragmentShader).toContain('uDirectionRad')
    expect(mat.fragmentShader).toContain('uStreakIntensity')
    expect(mat.fragmentShader).toContain('uStreakScroll')
    expect(mat.fragmentShader).toContain('streakNoise')
    expect(mat.fragmentShader).toContain('windStreak')
    expect(mat.fragmentShader).toContain('uTerrainDepth')
    expect(mat.fragmentShader).toContain('uShoreFoamEnabled')
    expect(ocean.getShoreDepthTarget()).toBeNull()
    ocean.dispose()
  })
})

describe('no GPU readback', () => {
  it('gerstnerOcean.ts does not call readPixels / getImageData', () => {
    const src = readFileSync(resolve(__dirname, 'gerstnerOcean.ts'), 'utf8')
    expect(src).not.toMatch(/\breadPixels\s*\(/)
    expect(src).not.toMatch(/\bgetImageData\s*\(/)
    expect(src).not.toMatch(/\breadRenderTargetPixels\s*\(/)
  })
})
