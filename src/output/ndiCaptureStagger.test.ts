import { afterEach, describe, expect, it } from 'vitest'
import {
  NDI_HEAVY_STAGGER_MS,
  resetNdiHeavyCaptureStagger,
  tryClaimNdiHeavyCapture,
} from './ndiCaptureStagger.ts'

describe('ndiCaptureStagger', () => {
  afterEach(() => {
    resetNdiHeavyCaptureStagger()
  })

  it('allows the same channel to reclaim across ticks', () => {
    expect(tryClaimNdiHeavyCapture('ar', 1000)).toBe(true)
    expect(tryClaimNdiHeavyCapture('ar', 1000 + NDI_HEAVY_STAGGER_MS + 1)).toBe(
      true,
    )
  })

  it('blocks the other channel on the same tick and yields AR next', () => {
    expect(tryClaimNdiHeavyCapture('ar', 2000)).toBe(true)
    expect(tryClaimNdiHeavyCapture('3d', 2000 + 1)).toBe(false)
    // Next tick: AR yields so deferred 3D can capture.
    expect(tryClaimNdiHeavyCapture('ar', 2033)).toBe(false)
    expect(tryClaimNdiHeavyCapture('3d', 2034)).toBe(true)
    // Following tick: AR resumes.
    expect(tryClaimNdiHeavyCapture('ar', 2066)).toBe(true)
  })

  it('does not block 3d when far enough after AR', () => {
    expect(tryClaimNdiHeavyCapture('ar', 3000)).toBe(true)
    expect(
      tryClaimNdiHeavyCapture('3d', 3000 + NDI_HEAVY_STAGGER_MS + 1),
    ).toBe(true)
  })
})
