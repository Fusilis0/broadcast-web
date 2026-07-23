import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_HFOV_DEG,
  clearAllOffsets,
  getOffsets,
  resetOffsets,
} from './index.ts'
import {
  DEFAULT_CALIB_DEVICE_ID,
  OFFSET_SLIDER_SPECS,
  clampOffsetField,
  writeOffsetField,
} from './offsetSliders.ts'

afterEach(() => {
  clearAllOffsets()
})

describe('offset slider specs', () => {
  it('covers all five CalibrationOffsets fields', () => {
    const fields = OFFSET_SLIDER_SPECS.map((s) => s.field).sort()
    expect(fields).toEqual(
      ['altMeters', 'fovHDeg', 'pitchDeg', 'rollDeg', 'yawDeg'].sort(),
    )
  })

  it('FOV range includes DEFAULT_HFOV_DEG', () => {
    const fov = OFFSET_SLIDER_SPECS.find((s) => s.field === 'fovHDeg')
    expect(fov).toBeDefined()
    expect(DEFAULT_HFOV_DEG).toBeGreaterThanOrEqual(fov!.min)
    expect(DEFAULT_HFOV_DEG).toBeLessThanOrEqual(fov!.max)
  })
})

describe('clampOffsetField', () => {
  it('clamps yaw to ±45', () => {
    expect(clampOffsetField('yawDeg', -100)).toBe(-45)
    expect(clampOffsetField('yawDeg', 100)).toBe(45)
    expect(clampOffsetField('yawDeg', 12.3)).toBe(12.3)
  })

  it('clamps FOV to 20–120', () => {
    expect(clampOffsetField('fovHDeg', 5)).toBe(20)
    expect(clampOffsetField('fovHDeg', 200)).toBe(120)
    expect(clampOffsetField('fovHDeg', DEFAULT_HFOV_DEG)).toBe(DEFAULT_HFOV_DEG)
  })

  it('clamps alt to ±50', () => {
    expect(clampOffsetField('altMeters', -80)).toBe(-50)
    expect(clampOffsetField('altMeters', 80)).toBe(50)
  })

  it('non-finite → field default', () => {
    expect(clampOffsetField('yawDeg', Number.NaN)).toBe(0)
    expect(clampOffsetField('fovHDeg', Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_HFOV_DEG,
    )
  })
})

describe('writeOffsetField', () => {
  it('calls setOffsets for default device with clamped value', () => {
    const id = DEFAULT_CALIB_DEVICE_ID
    writeOffsetField(id, 'yawDeg', 10)
    expect(getOffsets(id).yawDeg).toBe(10)

    writeOffsetField(id, 'yawDeg', 999)
    expect(getOffsets(id).yawDeg).toBe(45)

    writeOffsetField(id, 'fovHDeg', 90)
    expect(getOffsets(id).fovHDeg).toBe(90)
    expect(getOffsets(id).yawDeg).toBe(45)
  })

  it('reset restores zeros + default FOV', () => {
    const id = DEFAULT_CALIB_DEVICE_ID
    writeOffsetField(id, 'pitchDeg', 20)
    writeOffsetField(id, 'altMeters', -5)
    writeOffsetField(id, 'fovHDeg', 40)
    const reset = resetOffsets(id)
    expect(reset).toEqual({
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      fovHDeg: DEFAULT_HFOV_DEG,
      altMeters: 0,
    })
  })
})
