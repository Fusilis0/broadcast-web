import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { knotsToMs } from '../../telemetry/windDirection.ts'
import { waveDirectionXZ } from './gerstnerOcean.ts'
import {
  WIND_VANE_DEFAULTS,
  createWindVane,
  vaneLengthM,
  vaneYawY,
} from './windVane.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('vaneYawY', () => {
  it('from-000° travel (+Z) has yaw 0; from-090° (−X) yaws −π/2', () => {
    expect(vaneYawY(Math.PI / 2)).toBeCloseTo(0, 5)
    const d0 = waveDirectionXZ(Math.PI / 2)
    expect(d0.x).toBeCloseTo(0, 5)
    expect(d0.z).toBeCloseTo(1, 5)

    expect(vaneYawY(Math.PI)).toBeCloseTo(-Math.PI / 2, 5)
    const d90 = waveDirectionXZ(Math.PI)
    expect(d90.x).toBeCloseTo(-1, 5)
    expect(d90.z).toBeCloseTo(0, 5)
  })
})

describe('vaneLengthM', () => {
  it('never drops below min length at 0 m/s', () => {
    expect(vaneLengthM(0)).toBeCloseTo(WIND_VANE_DEFAULTS.minLengthM)
    expect(vaneLengthM(knotsToMs(6))).toBeGreaterThan(vaneLengthM(0))
    expect(vaneLengthM(knotsToMs(12))).toBeGreaterThan(vaneLengthM(knotsToMs(6)))
  })
})

describe('createWindVane', () => {
  it('builds a pole + two-sided arrow at a fixed origin offset', () => {
    const vane = createWindVane()
    expect(vane.root.name).toBe('windVane')
    expect(vane.root.position.x).toBeCloseTo(WIND_VANE_DEFAULTS.offsetX)
    expect(vane.root.position.z).toBeCloseTo(WIND_VANE_DEFAULTS.offsetZ)
    expect(vane.root.getObjectByName('windVanePole')).toBeTruthy()
    expect(vane.root.getObjectByName('windVaneShaft')).toBeTruthy()
    expect(vane.root.getObjectByName('windVaneHead')).toBeTruthy()
    const mat = (vane.root.getObjectByName('windVanePole') as THREE.Mesh)
      .material as THREE.MeshBasicMaterial
    expect(mat.side).toBe(THREE.DoubleSide)
    vane.dispose()
  })

  it('yaws to travel and keeps a minimum length at 0 m/s', () => {
    const vane = createWindVane()
    vane.setTravel(Math.PI / 2, 0)
    expect(vane.root.rotation.y).toBeCloseTo(0, 5)
    expect(vane.getLengthM()).toBeCloseTo(WIND_VANE_DEFAULTS.minLengthM)

    vane.setTravel(Math.PI, knotsToMs(12))
    expect(vane.root.rotation.y).toBeCloseTo(-Math.PI / 2, 5)
    expect(vane.getLengthM()).toBeGreaterThan(WIND_VANE_DEFAULTS.minLengthM)
    vane.dispose()
  })
})

describe('no GPU readback', () => {
  it('windVane.ts does not call readPixels / getImageData', () => {
    const src = readFileSync(resolve(__dirname, 'windVane.ts'), 'utf8')
    expect(src).not.toMatch(/\breadPixels\s*\(/)
    expect(src).not.toMatch(/\bgetImageData\s*\(/)
    expect(src).not.toMatch(/\breadRenderTargetPixels\s*\(/)
  })
})
