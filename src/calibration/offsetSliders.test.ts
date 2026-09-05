/**
 * @vitest-environment happy-dom
 */
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
  SYNC_TRIM_MS_TITLE,
  clampOffsetField,
  startOffsetSliders,
  writeOffsetField,
} from './offsetSliders.ts'

afterEach(() => {
  clearAllOffsets()
  document.body.replaceChildren()
})

describe('offset slider specs', () => {
  it('covers all six CalibrationOffsets fields', () => {
    const fields = OFFSET_SLIDER_SPECS.map((s) => s.field).sort()
    expect(fields).toEqual(
      [
        'altMeters',
        'fovHDeg',
        'pitchDeg',
        'rollDeg',
        'syncTrimMs',
        'yawDeg',
      ].sort(),
    )
  })

  it('FOV range includes DEFAULT_HFOV_DEG', () => {
    const fov = OFFSET_SLIDER_SPECS.find((s) => s.field === 'fovHDeg')
    expect(fov).toBeDefined()
    expect(DEFAULT_HFOV_DEG).toBeGreaterThanOrEqual(fov!.min)
    expect(DEFAULT_HFOV_DEG).toBeLessThanOrEqual(fov!.max)
  })

  it('yaw / pitch / roll are ±200° step 0.1', () => {
    for (const field of ['yawDeg', 'pitchDeg', 'rollDeg'] as const) {
      const angle = OFFSET_SLIDER_SPECS.find((s) => s.field === field)
      expect(angle).toMatchObject({ min: -200, max: 200, step: 0.1 })
    }
  })

  it('FOV / alt / syncTrimMs ranges stay at prior product limits', () => {
    expect(OFFSET_SLIDER_SPECS.find((s) => s.field === 'fovHDeg')).toMatchObject({
      min: 20,
      max: 120,
      step: 0.1,
    })
    expect(
      OFFSET_SLIDER_SPECS.find((s) => s.field === 'altMeters'),
    ).toMatchObject({ min: -50, max: 50, step: 0.1 })
    expect(
      OFFSET_SLIDER_SPECS.find((s) => s.field === 'syncTrimMs'),
    ).toMatchObject({ min: -500, max: 500, step: 5 })
  })

  it('syncTrimMs is ±500 ms step 5 with a written sign convention', () => {
    const sync = OFFSET_SLIDER_SPECS.find((s) => s.field === 'syncTrimMs')
    expect(sync).toEqual({
      field: 'syncTrimMs',
      label: 'sync ms',
      min: -500,
      max: 500,
      step: 5,
      title: SYNC_TRIM_MS_TITLE,
    })
    expect(SYNC_TRIM_MS_TITLE).toMatch(/Positive = AR leads video/)
    expect(SYNC_TRIM_MS_TITLE).toMatch(/Overlay lags the picture → raise/)
  })
})

describe('clampOffsetField', () => {
  it('clamps yaw / pitch / roll to ±200', () => {
    for (const field of ['yawDeg', 'pitchDeg', 'rollDeg'] as const) {
      expect(clampOffsetField(field, -300)).toBe(-200)
      expect(clampOffsetField(field, 300)).toBe(200)
      expect(clampOffsetField(field, 12.3)).toBe(12.3)
      expect(clampOffsetField(field, -100)).toBe(-100)
      expect(clampOffsetField(field, 100)).toBe(100)
    }
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

  it('clamps syncTrimMs to ±500', () => {
    expect(clampOffsetField('syncTrimMs', -800)).toBe(-500)
    expect(clampOffsetField('syncTrimMs', 800)).toBe(500)
    expect(clampOffsetField('syncTrimMs', -40)).toBe(-40)
  })

  it('non-finite → field default', () => {
    expect(clampOffsetField('yawDeg', Number.NaN)).toBe(0)
    expect(clampOffsetField('syncTrimMs', Number.NaN)).toBe(0)
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
    expect(getOffsets(id).yawDeg).toBe(200)

    writeOffsetField(id, 'pitchDeg', -999)
    expect(getOffsets(id).pitchDeg).toBe(-200)
    writeOffsetField(id, 'rollDeg', 999)
    expect(getOffsets(id).rollDeg).toBe(200)

    writeOffsetField(id, 'fovHDeg', 90)
    expect(getOffsets(id).fovHDeg).toBe(90)
    expect(getOffsets(id).yawDeg).toBe(200)

    writeOffsetField(id, 'syncTrimMs', 999)
    expect(getOffsets(id).syncTrimMs).toBe(500)
  })

  it('keeps per-device stores isolated', () => {
    writeOffsetField('1', 'yawDeg', 10)
    writeOffsetField('2', 'yawDeg', -20)
    expect(getOffsets('1').yawDeg).toBe(10)
    expect(getOffsets('2').yawDeg).toBe(-20)
    expect(getOffsets('1').fovHDeg).toBe(DEFAULT_HFOV_DEG)
    expect(getOffsets('2').fovHDeg).toBe(DEFAULT_HFOV_DEG)
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
      syncTrimMs: 0,
    })
  })
})

describe('startOffsetSliders sync trim', () => {
  it('writes syncTrimMs through setOffsets for the selected POV only', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const handle = startOffsetSliders({
      container,
      povIds: ['1', '2'],
      deviceId: '1',
    })

    const range = container.querySelector(
      '#calib-syncTrimMs',
    ) as HTMLInputElement
    expect(range).toBeTruthy()
    expect(range.title).toBe(SYNC_TRIM_MS_TITLE)
    expect(range.min).toBe('-500')
    expect(range.max).toBe('500')
    expect(range.step).toBe('5')

    range.value = '40'
    range.dispatchEvent(new Event('input'))
    expect(getOffsets('1').syncTrimMs).toBe(40)
    expect(getOffsets('2').syncTrimMs).toBe(0)

    handle.setDeviceId('2')
    const rangeAfter = container.querySelector(
      '#calib-syncTrimMs',
    ) as HTMLInputElement
    expect(rangeAfter.valueAsNumber).toBe(0)
    writeOffsetField('2', 'syncTrimMs', -15)
    handle.setDeviceId('2')
    expect(
      (container.querySelector('#calib-syncTrimMs') as HTMLInputElement)
        .valueAsNumber,
    ).toBe(-15)
    expect(getOffsets('1').syncTrimMs).toBe(40)

    handle.stop()
  })
})
