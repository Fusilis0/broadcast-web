import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { waveDirectionXZ } from './gerstnerOcean.ts'
import {
  WIND_STRINGS_DEFAULTS,
  createWindStrings,
  stringActiveCount,
  stringLengthM,
  stringOpacityFromSpeedMs,
  stringTravelXZ,
} from './windStrings.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('stringTravelXZ', () => {
  it('from-000° travel (directionRad π/2) is +Z; from-090° is −X', () => {
    expect(stringTravelXZ(Math.PI / 2).x).toBeCloseTo(0, 5)
    expect(stringTravelXZ(Math.PI / 2).z).toBeCloseTo(1, 5)
    const swell0 = waveDirectionXZ(Math.PI / 2)
    expect(stringTravelXZ(Math.PI / 2).x).toBeCloseTo(swell0.x, 10)
    expect(stringTravelXZ(Math.PI / 2).z).toBeCloseTo(swell0.z, 10)

    expect(stringTravelXZ(Math.PI).x).toBeCloseTo(-1, 5)
    expect(stringTravelXZ(Math.PI).z).toBeCloseTo(0, 5)
  })
})

describe('stringOpacityFromSpeedMs / length / count', () => {
  it('is fully faded at calm and scales up with typical race wind', () => {
    expect(stringOpacityFromSpeedMs(0)).toBe(0)
    expect(stringOpacityFromSpeedMs(WIND_STRINGS_DEFAULTS.fadeMsLo)).toBe(0)
    expect(stringOpacityFromSpeedMs(3)).toBeGreaterThan(0)
    expect(stringOpacityFromSpeedMs(3)).toBeLessThan(1)
    expect(stringOpacityFromSpeedMs(WIND_STRINGS_DEFAULTS.fadeMsHi)).toBeCloseTo(1)

    expect(stringLengthM(12)).toBeGreaterThan(stringLengthM(5))
    expect(stringActiveCount(0)).toBe(0)
    expect(stringActiveCount(5)).toBe(WIND_STRINGS_DEFAULTS.countAt5Ms)
    expect(stringActiveCount(12)).toBe(WIND_STRINGS_DEFAULTS.count)
    expect(stringActiveCount(12)).toBeGreaterThan(stringActiveCount(5))
  })
})

describe('createWindStrings', () => {
  it('is one Mesh draw, additive, depthWrite off', () => {
    const strings = createWindStrings({ count: 24, points: 5 })
    expect(strings.root.name).toBe('windStrings')
    expect(strings.root).toBeInstanceOf(THREE.Mesh)
    const mat = strings.root.material as THREE.ShaderMaterial
    expect(mat.depthWrite).toBe(false)
    expect(mat.blending).toBe(THREE.AdditiveBlending)
    expect(strings.root.frustumCulled).toBe(false)
    strings.dispose()
  })

  it('drifts along +Z for from-000° travel and fades at 0 m/s', () => {
    let nowMs = 0
    const strings = createWindStrings({
      count: 48,
      points: 5,
      radiusM: 2000,
      minLifeS: 30,
      extraLifeS: 0,
      now: () => nowMs,
    })
    strings.tick(0, Math.PI / 2, 8, 0, 40, 0)
    expect(strings.getOpacity()).toBeGreaterThan(0.8)
    expect(strings.getActiveCount()).toBeGreaterThan(20)
    const before = strings.sampleMeanXZ()

    nowMs = 1000
    strings.tick(0, Math.PI / 2, 8, 0, 40, 0)
    const after = strings.sampleMeanXZ()
    expect(after.z - before.z).toBeCloseTo(8, 0.6)
    expect(Math.abs(after.x - before.x)).toBeLessThan(1.5)

    strings.tick(0, Math.PI / 2, 0, 0, 40, 0)
    expect(strings.getOpacity()).toBe(0)
    expect(strings.getActiveCount()).toBe(0)

    nowMs = 2000
    strings.tick(0, Math.PI, 8, 0, 40, 0)
    const east0 = strings.sampleMeanXZ()
    nowMs = 3000
    strings.tick(0, Math.PI, 8, 0, 40, 0)
    const east1 = strings.sampleMeanXZ()
    expect(east0.x - east1.x).toBeGreaterThan(6)
    expect(Math.abs(east1.z - east0.z)).toBeLessThan(2)
    strings.dispose()
  })

  it('tick after dispose is a no-op', () => {
    const strings = createWindStrings({ count: 8, points: 4 })
    strings.dispose()
    expect(() => strings.tick(0.016, Math.PI / 2, 8, 0, 40, 0)).not.toThrow()
    expect(strings.root.parent).toBeNull()
  })
})

describe('no GPU readback', () => {
  it('windStrings.ts does not call readPixels / getImageData', () => {
    const src = readFileSync(resolve(__dirname, 'windStrings.ts'), 'utf8')
    expect(src).not.toMatch(/\breadPixels\s*\(/)
    expect(src).not.toMatch(/\bgetImageData\s*\(/)
    expect(src).not.toMatch(/\breadRenderTargetPixels\s*\(/)
  })
})
