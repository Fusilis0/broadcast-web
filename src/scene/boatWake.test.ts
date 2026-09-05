/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createBoatEntity } from './boatEntity.ts'
import {
  BOAT_WAKE_DEFAULTS,
  boatWakeLengthM,
  boatWakePeakRgb,
  boatWakeShouldDraw,
  boatWakeStrengthStep,
  boatWakeTailAlpha,
  createBoatWake,
  writeBoatWakeStrip,
} from './boatWake.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('boatWakeLengthM', () => {
  it('is idle at zero / sub-threshold speed', () => {
    expect(boatWakeLengthM(0)).toBe(0)
    expect(boatWakeLengthM(BOAT_WAKE_DEFAULTS.minSpeedMs - 0.01)).toBe(0)
  })

  it('clamps moving length to 8–12 m', () => {
    const fade = BOAT_WAKE_DEFAULTS.fadeSeconds
    expect(boatWakeLengthM(8 / fade)).toBeCloseTo(8)
    expect(boatWakeLengthM(10 / fade)).toBeCloseTo(10)
    expect(boatWakeLengthM(12 / fade)).toBeCloseTo(12)
    expect(boatWakeLengthM(20)).toBe(12)
    expect(boatWakeLengthM(1)).toBe(8)
  })
})

describe('boatWakeTailAlpha / strength / skip-hidden', () => {
  it('fades toward the tail', () => {
    expect(boatWakeTailAlpha(0)).toBeCloseTo(1)
    expect(boatWakeTailAlpha(0.5)).toBeCloseTo(0.25)
    expect(boatWakeTailAlpha(1)).toBeCloseTo(0)
    expect(boatWakeTailAlpha(0)).toBeGreaterThan(boatWakeTailAlpha(0.5))
    expect(boatWakeTailAlpha(0.5)).toBeGreaterThan(boatWakeTailAlpha(1))
  })

  it('skips hidden hulls even at full strength', () => {
    expect(boatWakeShouldDraw('hidden', 1)).toBe(false)
    expect(boatWakeShouldDraw('solid', 1)).toBe(true)
    expect(boatWakeShouldDraw('ghost', 0.5)).toBe(true)
    expect(boatWakeShouldDraw('solid', 0)).toBe(false)
  })

  it('ghost peak is weaker than solid', () => {
    expect(boatWakePeakRgb('ghost')).toBeLessThan(boatWakePeakRgb('solid'))
    expect(boatWakePeakRgb('hidden')).toBe(0)
  })

  it('decays to idle over ~2.5 s', () => {
    let s = boatWakeStrengthStep(0, 5, 0.016)
    expect(s).toBe(1)
    s = boatWakeStrengthStep(s, 0, BOAT_WAKE_DEFAULTS.fadeSeconds)
    expect(s).toBeCloseTo(0)
    expect(boatWakeStrengthStep(1, 0, 1)).toBeGreaterThan(0.5)
    expect(boatWakeStrengthStep(1, 0, 1)).toBeLessThan(0.7)
  })
})

describe('writeBoatWakeStrip', () => {
  it('is a flat water-y strip of the requested length', () => {
    const segs = BOAT_WAKE_DEFAULTS.segments
    const positions = new Float32Array((segs + 1) * 2 * 3)
    const colors = new Float32Array((segs + 1) * 2 * 3)
    writeBoatWakeStrip(positions, colors, {
      lengthM: 10,
      peakRgb: 1,
      segments: segs,
    })

    let minZ = Infinity
    let maxZ = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
      minZ = Math.min(minZ, positions[i + 2]!)
      maxZ = Math.max(maxZ, positions[i + 2]!)
      minY = Math.min(minY, positions[i + 1]!)
      maxY = Math.max(maxY, positions[i + 1]!)
    }
    expect(maxZ).toBeCloseTo(0)
    expect(minZ).toBeCloseTo(-10)
    expect(minY).toBeCloseTo(BOAT_WAKE_DEFAULTS.waterY)
    expect(maxY).toBeCloseTo(BOAT_WAKE_DEFAULTS.waterY)

    const head = colors[0]!
    const tail = colors[colors.length - 1]!
    expect(head).toBeGreaterThan(tail)
    expect(tail).toBeCloseTo(0)
  })
})

describe('createBoatWake', () => {
  it('hides when idle and when hidden; draws a short tail when moving', () => {
    const wake = createBoatWake()
    expect(wake.root.name).toBe('boatWake')
    expect(wake.root.position.y).toBeCloseTo(BOAT_WAKE_DEFAULTS.waterY)
    wake.sync({ speedMs: 0, mode: 'solid', dtSeconds: 0.1 })
    expect(wake.root.visible).toBe(false)
    expect(wake.getLengthM()).toBe(0)

    wake.sync({ speedMs: 5, mode: 'solid', dtSeconds: 0.1 })
    expect(wake.root.visible).toBe(true)
    expect(wake.getLengthM()).toBeGreaterThanOrEqual(8)
    expect(wake.getLengthM()).toBeLessThanOrEqual(12)

    wake.sync({ speedMs: 5, mode: 'hidden', dtSeconds: 0.1 })
    expect(wake.root.visible).toBe(false)
    expect(wake.getStrength()).toBe(0)

    wake.sync({ speedMs: 0, mode: 'solid', dtSeconds: 0.1 })
    expect(wake.root.visible).toBe(false)

    wake.sync({ speedMs: 5, mode: 'ghost', dtSeconds: 0.1 })
    expect(wake.root.visible).toBe(true)

    const mat = wake.root.material as THREE.MeshBasicMaterial
    expect(mat.transparent).toBe(true)
    expect(mat.depthWrite).toBe(false)
    expect(mat.blending).toBe(THREE.AdditiveBlending)
    wake.dispose()
  })
})

describe('createBoatEntity wake', () => {
  function pose(x: number, z: number) {
    return {
      id: '21',
      kind: 'boat' as const,
      position: { x, y: 0, z },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: 0,
    }
  }

  it('moving hull shows an 8–12 m foam tail; hidden has none', () => {
    const boat = createBoatEntity({ id: '21', tryGltf: false })
    const wake = boat.root.getObjectByName('boatWake') as THREE.Mesh
    expect(wake).toBeTruthy()

    boat.applyPose(pose(0, 0))
    boat.tickWake(0.1)
    expect(wake.visible).toBe(false)

    boat.applyPose(pose(0, -1))
    boat.tickWake(0.1)
    expect(wake.visible).toBe(true)
    expect(boat.getWakeLengthM()).toBeGreaterThanOrEqual(8)
    expect(boat.getWakeLengthM()).toBeLessThanOrEqual(12)
    expect(wake.position.y).toBeCloseTo(BOAT_WAKE_DEFAULTS.waterY)

    boat.setVisibilityMode('hidden')
    boat.applyPose(pose(0, -2))
    boat.tickWake(0.1)
    expect(wake.visible).toBe(false)
    expect(boat.root.getObjectByName('boatTag')?.visible).toBe(true)

    boat.dispose()
  })
})

describe('19.13 stays off Gerstner / NDI / tick cap', () => {
  it('boatWake does not import Gerstner or NDI pumps', () => {
    const src = readFileSync(resolve(__dirname, 'boatWake.ts'), 'utf8')
    const imports = [...src.matchAll(/^import .+$/gm)].map((m) => m[0]).join('\n')
    expect(imports).not.toMatch(/gerstner/i)
    expect(imports).not.toMatch(/ndi/i)
    expect(imports).not.toMatch(/environment\//i)
  })
})
