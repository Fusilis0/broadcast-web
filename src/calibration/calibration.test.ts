import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_HFOV_DEG,
  clearAllOffsets,
  getOffsets,
  resetOffsets,
  setOffsets,
  zeroOffsets,
} from './index.ts'

afterEach(() => {
  clearAllOffsets()
})

describe('CalibrationOffsets defaults', () => {
  it('DEFAULT_HFOV_DEG is exactly 66.8832', () => {
    expect(DEFAULT_HFOV_DEG).toBe(66.8832)
  })

  it('zeroOffsets uses default FOV and zero knobs', () => {
    const z = zeroOffsets()
    expect(z).toEqual({
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      fovHDeg: 66.8832,
      altMeters: 0,
    })
  })

  it('missing device → zero angles/alt + default FOV (no map insert)', () => {
    const got = getOffsets('unknown-device')
    expect(got.yawDeg).toBe(0)
    expect(got.pitchDeg).toBe(0)
    expect(got.rollDeg).toBe(0)
    expect(got.altMeters).toBe(0)
    expect(got.fovHDeg).toBe(DEFAULT_HFOV_DEG)
    // still missing after get
    expect(getOffsets('unknown-device').fovHDeg).toBe(DEFAULT_HFOV_DEG)
  })

  it('set / reset round-trip', () => {
    setOffsets('cam-a', { yawDeg: 5, altMeters: 1.5 })
    expect(getOffsets('cam-a').yawDeg).toBe(5)
    expect(getOffsets('cam-a').altMeters).toBe(1.5)
    expect(getOffsets('cam-a').fovHDeg).toBe(DEFAULT_HFOV_DEG)

    const reset = resetOffsets('cam-a')
    expect(reset).toEqual(zeroOffsets())
    expect(getOffsets('cam-a')).toEqual(zeroOffsets())
  })

  it('getOffsets returns a copy (store not mutated by caller edits)', () => {
    setOffsets('cam-b', { pitchDeg: 3 })
    const a = getOffsets('cam-b')
    a.pitchDeg = 99
    expect(getOffsets('cam-b').pitchDeg).toBe(3)
  })
})
