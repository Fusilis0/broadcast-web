import { afterEach, describe, expect, it } from 'vitest'
import {
  NDI_HEAVY_STAGGER_MS,
  releaseNdiHeavyCapture,
  resetNdiHeavyCaptureStagger,
  tryClaimNdiHeavyCapture,
} from './ndiCaptureStagger.ts'

describe('ndiCaptureStagger', () => {
  afterEach(() => {
    resetNdiHeavyCaptureStagger()
  })

  it('allows the same channel to reclaim across ticks', () => {
    expect(tryClaimNdiHeavyCapture('ar', 1000, { blocking: true })).toBe(true)
    expect(
      tryClaimNdiHeavyCapture('ar', 1000 + NDI_HEAVY_STAGGER_MS + 1, {
        blocking: true,
      }),
    ).toBe(true)
  })

  it('blocks a second FBO render on the same tick and yields AR next (sync)', () => {
    expect(tryClaimNdiHeavyCapture('ar', 2000, { blocking: true })).toBe(true)
    expect(tryClaimNdiHeavyCapture('3d', 2000 + 1, { blocking: true })).toBe(
      false,
    )
    // Next tick: AR yields so deferred 3D can capture.
    expect(tryClaimNdiHeavyCapture('ar', 2033, { blocking: true })).toBe(false)
    expect(tryClaimNdiHeavyCapture('3d', 2034, { blocking: true })).toBe(true)
    // Following tick: AR resumes.
    expect(tryClaimNdiHeavyCapture('ar', 2066, { blocking: true })).toBe(true)
  })

  it('does not block 3d when far enough after AR (sync)', () => {
    expect(tryClaimNdiHeavyCapture('ar', 3000, { blocking: true })).toBe(true)
    expect(
      tryClaimNdiHeavyCapture('3d', 3000 + NDI_HEAVY_STAGGER_MS + 1, {
        blocking: true,
      }),
    ).toBe(true)
  })

  it('lets AR and 3D both claim the same tick on the PBO path', () => {
    expect(tryClaimNdiHeavyCapture('ar', 4000, { blocking: false })).toBe(true)
    expect(tryClaimNdiHeavyCapture('3d', 4000 + 1, { blocking: false })).toBe(
      true,
    )
  })

  it('PBO claims are a no-op even if a sync FBO already claimed', () => {
    expect(tryClaimNdiHeavyCapture('ar', 6000, { blocking: true })).toBe(true)
    expect(tryClaimNdiHeavyCapture('3d', 6001, { blocking: false })).toBe(true)
  })

  it('lets 2D claim without occupying the FBO slot', () => {
    expect(tryClaimNdiHeavyCapture('ar', 7000, { blocking: true })).toBe(true)
    expect(tryClaimNdiHeavyCapture('2d', 7001, { blocking: true })).toBe(true)
    expect(tryClaimNdiHeavyCapture('3d', 7002, { blocking: true })).toBe(false)
  })

  it('releases a burned claim so the other FBO can capture this tick', () => {
    expect(tryClaimNdiHeavyCapture('ar', 8000, { blocking: true })).toBe(true)
    releaseNdiHeavyCapture('ar', 8000)
    expect(tryClaimNdiHeavyCapture('3d', 8001, { blocking: true })).toBe(true)
  })
})
