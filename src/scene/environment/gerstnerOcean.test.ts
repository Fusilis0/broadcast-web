import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  GERSTNER_OCEAN_DEFAULTS,
  GERSTNER_WAVE_COUNT,
  OCEAN_DETAIL_FADE,
  OCEAN_NOISE_SIZE,
  createClipmapGeometry,
  createGerstnerOcean,
  createOceanNoiseTexture,
  clipmapCellSizeM,
  clipmapPatchSpecs,
  clipmapRingOverlapM,
  quantizeClipmapCenter,
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

  it('coarser rings overlap the finer level by ≥ one finer cell', () => {
    const half = 8
    const innerSeg = 8
    const ringSeg = 8
    const cell = clipmapCellSizeM(half, innerSeg)
    expect(cell).toBeCloseTo(2)
    const overlap = clipmapRingOverlapM(half, innerSeg, ringSeg, 1)
    expect(overlap).toBeGreaterThanOrEqual(cell - 1e-9)

    const specs = clipmapPatchSpecs(half, innerSeg, 2, ringSeg)
    const inner = specs[0]!
    const south = specs[1]!
    expect(south.z1).toBeCloseTo(inner.z0 + overlap)
    expect(south.z1).toBeGreaterThan(inner.z0)

    const geo = createClipmapGeometry(half, innerSeg, 1, ringSeg)
    const pos = geo.getAttribute('position')!
    const innerEdge = half - overlap
    let hit = false
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - innerEdge) < 1e-4) {
        hit = true
        break
      }
    }
    expect(hit).toBe(true)
    geo.dispose()
  })
})

describe('quantizeClipmapCenter', () => {
  it('snaps camera XZ to the inner cell so dual-pass follow does not swim', () => {
    const cell = clipmapCellSizeM(48, 48)
    expect(cell).toBeCloseTo(2)
    const q = quantizeClipmapCenter(5.4, -7.6, cell)
    expect(q.x).toBeCloseTo(6)
    expect(q.z).toBeCloseTo(-8)
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
    expect(GERSTNER_OCEAN_DEFAULTS.liftY).toBeGreaterThan(0)
    expect(GERSTNER_OCEAN_DEFAULTS.liftY).toBeLessThanOrEqual(0.12)
    expect(ocean.mesh.position.x).toBe(0)
    expect(ocean.mesh.position.z).toBe(0)
    expect(mat.uniforms['uClipmapCenter']).toBeTruthy()
    expect(GERSTNER_OCEAN_DEFAULTS.innerSegments).toBe(32)
    expect(GERSTNER_OCEAN_DEFAULTS.ringCount).toBe(7)
    expect(GERSTNER_OCEAN_DEFAULTS.glitterIntensity).toBeGreaterThanOrEqual(0.12)
    expect(GERSTNER_OCEAN_DEFAULTS.glitterIntensity).toBeLessThanOrEqual(0.2)
    expect(GERSTNER_OCEAN_DEFAULTS.glitterSharpness).toBeGreaterThanOrEqual(60)
    expect(GERSTNER_OCEAN_DEFAULTS.glitterSharpness).toBeLessThanOrEqual(90)
    expect(mat.fragmentShader).not.toContain('glint * 0.45')
    expect(WIND_STREAK_DEFAULTS.contrast).toBeGreaterThan(0.75)

    ocean.dispose()
    expect(mat.uniforms['uTime']).toBeTruthy()
  })

  it('follows the render camera via uClipmapCenter, not mesh.position (NDI vs preview)', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 48,
      innerHalfExtentM: 48,
      ringCount: 1,
      ringSegments: 4,
    })
    const cam = new THREE.PerspectiveCamera()
    cam.position.set(41, 12, -27)
    cam.updateMatrixWorld()
    ocean.mesh.onBeforeRender(
      {} as THREE.WebGLRenderer,
      {} as THREE.Scene,
      cam,
      ocean.mesh.geometry,
      ocean.mesh.material,
      {} as THREE.Group,
    )
    expect(ocean.mesh.position.x).toBe(0)
    expect(ocean.mesh.position.z).toBe(0)
    const center = (ocean.mesh.material as THREE.ShaderMaterial).uniforms[
      'uClipmapCenter'
    ]!.value as THREE.Vector2
    expect(center.x).toBeCloseTo(42)
    expect(center.y).toBeCloseTo(-26)
    ocean.dispose()
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
    expect(mat.fragmentShader).toContain('windStreak(vWorldPos.xz)')
    expect(mat.fragmentShader).toContain('cross * 0.22')
    expect(mat.fragmentShader).toContain('uStreakContrast')
    expect(mat.fragmentShader).toContain('uTerrainDepth')
    expect(mat.fragmentShader).toContain('uShoreFoamEnabled')
    expect(mat.vertexShader).toContain('uClipmapCenter')
    expect(ocean.getShoreDepthTarget()).toBeNull()
    ocean.dispose()
  })
})

describe('ocean shimmer AA (16.1)', () => {
  it('wires a 256² repeating mipmapped noise texture and fade uniforms', () => {
    const tex = createOceanNoiseTexture()
    expect(tex.image.width).toBe(OCEAN_NOISE_SIZE)
    expect(tex.image.height).toBe(OCEAN_NOISE_SIZE)
    expect(tex.wrapS).toBe(THREE.RepeatWrapping)
    expect(tex.wrapT).toBe(THREE.RepeatWrapping)
    expect(tex.minFilter).toBe(THREE.LinearMipmapLinearFilter)
    expect(tex.generateMipmaps).toBe(true)
    tex.dispose()

    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    const mat = ocean.mesh.material as THREE.ShaderMaterial
    const noise = mat.uniforms['uNoise']!.value as THREE.DataTexture
    expect(noise).toBeInstanceOf(THREE.DataTexture)
    expect(noise.image.width).toBe(OCEAN_NOISE_SIZE)
    expect(noise.minFilter).toBe(THREE.LinearMipmapLinearFilter)
    expect(noise.wrapS).toBe(THREE.RepeatWrapping)
    expect(mat.uniforms['uDetailFadeNear']!.value).toBe(OCEAN_DETAIL_FADE.nearM)
    expect(mat.uniforms['uDetailFadeFar']!.value).toBe(OCEAN_DETAIL_FADE.farM)
    expect(OCEAN_DETAIL_FADE.farM).toBeLessThan(1536)
    ocean.dispose()
  })

  it('band-limits foam/streak/glitter in world XZ (no clipmap-local noise)', () => {
    const ocean = createGerstnerOcean({
      innerSegments: 2,
      ringCount: 1,
      ringSegments: 4,
    })
    const mat = ocean.mesh.material as THREE.ShaderMaterial
    expect(mat.fragmentShader).toContain('texture2D(uNoise')
    expect(mat.fragmentShader).toContain('fwidth')
    expect(mat.fragmentShader).toContain('uDetailFadeNear')
    expect(mat.fragmentShader).toContain('highFreqFade')
    expect(mat.fragmentShader).toContain('vWorldPos.xz')
    expect(mat.fragmentShader).not.toContain('streakHash21')
    expect(mat.fragmentShader).not.toMatch(/windStreak\(\s*position\.xz/)
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
