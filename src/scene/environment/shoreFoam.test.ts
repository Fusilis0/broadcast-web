import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  SHORE_FOAM_DEFAULTS,
  createShoreDepthTarget,
  disposeShoreDepthTarget,
  resizeShoreDepthTarget,
  shoreDepthSize,
  shouldEnableShoreFoam,
} from './shoreFoam.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('shouldEnableShoreFoam', () => {
  it('is on only when realistic ocean, terrain, and opaque-clear are all on', () => {
    expect(
      shouldEnableShoreFoam({
        realisticMounted: true,
        terrainEnabled: true,
        opaqueClearSafe: true,
      }),
    ).toBe(true)
  })

  it('stays off when terrain is disabled', () => {
    expect(
      shouldEnableShoreFoam({
        realisticMounted: true,
        terrainEnabled: false,
        opaqueClearSafe: true,
      }),
    ).toBe(false)
  })

  it('stays off for transparent/chroma (opaqueClearSafe false)', () => {
    expect(
      shouldEnableShoreFoam({
        realisticMounted: true,
        terrainEnabled: true,
        opaqueClearSafe: false,
      }),
    ).toBe(false)
  })

  it('stays off when the realistic env is unmounted', () => {
    expect(
      shouldEnableShoreFoam({
        realisticMounted: false,
        terrainEnabled: true,
        opaqueClearSafe: true,
      }),
    ).toBe(false)
  })
})

describe('shore depth target', () => {
  it('half-res is one extra FBO worth of pixels, not full-res', () => {
    expect(SHORE_FOAM_DEFAULTS.depthScale).toBe(0.5)
    const size = shoreDepthSize(1920, 1080)
    expect(size.width).toBe(960)
    expect(size.height).toBe(540)
  })

  it('creates a depth texture and disposes it', () => {
    const rt = createShoreDepthTarget(8, 4)
    expect(rt.width).toBe(8)
    expect(rt.height).toBe(4)
    expect(rt.depthTexture).toBeInstanceOf(THREE.DepthTexture)
    resizeShoreDepthTarget(rt, 16, 8)
    expect(rt.width).toBe(16)
    expect(rt.height).toBe(8)
    expect(rt.depthTexture?.image.width).toBe(16)
    disposeShoreDepthTarget(rt)
  })
})

describe('no GPU readback', () => {
  it('shoreFoam.ts does not call readPixels / getImageData', () => {
    const src = readFileSync(resolve(__dirname, 'shoreFoam.ts'), 'utf8')
    expect(src).not.toMatch(/\breadPixels\s*\(/)
    expect(src).not.toMatch(/\bgetImageData\s*\(/)
    expect(src).not.toMatch(/\breadRenderTargetPixels\s*\(/)
  })
})
