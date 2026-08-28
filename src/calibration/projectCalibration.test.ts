import { afterEach, describe, expect, it } from 'vitest'
import {
  applyRaceProjectCalibration,
  clearAllOffsets,
  getOffsets,
  parseCalibrationOffsets,
  parseRaceProjectCalibration,
  setOffsets,
  snapshotCalibrationByPovId,
  zeroOffsets,
} from './index.ts'

afterEach(() => {
  clearAllOffsets()
})

describe('parseCalibrationOffsets', () => {
  it('accepts store field names', () => {
    expect(
      parseCalibrationOffsets({
        yawDeg: 2,
        pitchDeg: -1,
        rollDeg: 0.5,
        fovHDeg: 50,
        altMeters: -3,
        junk: true,
      }),
    ).toEqual({
      yawDeg: 2,
      pitchDeg: -1,
      rollDeg: 0.5,
      fovHDeg: 50,
      altMeters: -3,
      syncTrimMs: 0,
    })
  })

  it('accepts short aliases and fills defaults for missing knobs', () => {
    expect(parseCalibrationOffsets({ yaw: 4, fov: 40 })).toEqual({
      ...zeroOffsets(),
      yawDeg: 4,
      fovHDeg: 40,
    })
  })

  it('accepts syncTrimMs and aliases; omitted field defaults to 0', () => {
    expect(parseCalibrationOffsets({ syncTrimMs: 40 })).toEqual({
      ...zeroOffsets(),
      syncTrimMs: 40,
    })
    expect(parseCalibrationOffsets({ syncTrim: -15 })).toEqual({
      ...zeroOffsets(),
      syncTrimMs: -15,
    })
    expect(parseCalibrationOffsets({ trimMs: 25 })).toEqual({
      ...zeroOffsets(),
      syncTrimMs: 25,
    })
    const oldPack = parseCalibrationOffsets({ yawDeg: 3 })
    expect(oldPack?.syncTrimMs).toBe(0)
    expect(oldPack).toEqual({ ...zeroOffsets(), yawDeg: 3 })
  })

  it('returns null for empty / non-objects', () => {
    expect(parseCalibrationOffsets(null)).toBeNull()
    expect(parseCalibrationOffsets({})).toBeNull()
    expect(parseCalibrationOffsets({ yawDeg: 'nope' })).toBeNull()
  })
})

describe('parseRaceProjectCalibration', () => {
  it('soft-ignores junk and omits empty', () => {
    expect(parseRaceProjectCalibration(undefined)).toBeUndefined()
    expect(parseRaceProjectCalibration({ byPovId: {} })).toBeUndefined()
    expect(
      parseRaceProjectCalibration({
        byPovId: { '1': { notANumber: 1 }, '': { yawDeg: 1 } },
      }),
    ).toBeUndefined()
  })

  it('keeps valid POV entries', () => {
    const cal = parseRaceProjectCalibration({
      byPovId: {
        '1': { yawDeg: 3, altMeters: 1 },
        '2': { fov: 55 },
      },
    })
    expect(cal?.byPovId['1']?.yawDeg).toBe(3)
    expect(cal?.byPovId['1']?.altMeters).toBe(1)
    expect(cal?.byPovId['1']?.syncTrimMs).toBe(0)
    expect(cal?.byPovId['2']?.fovHDeg).toBe(55)
  })
})

describe('snapshot + apply RaceProject calibration', () => {
  it('round-trips store via snapshot / apply', () => {
    setOffsets('1', { yawDeg: 12, fovHDeg: 40, altMeters: -2, syncTrimMs: 40 })
    setOffsets('2', { pitchDeg: 5 })
    const snap = snapshotCalibrationByPovId(['1', '2'])
    expect(snap?.byPovId['1']?.yawDeg).toBe(12)
    expect(snap?.byPovId['1']?.fovHDeg).toBe(40)
    expect(snap?.byPovId['1']?.syncTrimMs).toBe(40)
    expect(snap?.byPovId['2']?.pitchDeg).toBe(5)
    expect(snap?.byPovId['2']?.syncTrimMs).toBe(0)

    clearAllOffsets()
    applyRaceProjectCalibration({ calibration: snap })
    expect(getOffsets('1').yawDeg).toBe(12)
    expect(getOffsets('1').fovHDeg).toBe(40)
    expect(getOffsets('1').altMeters).toBe(-2)
    expect(getOffsets('1').syncTrimMs).toBe(40)
    expect(getOffsets('2').pitchDeg).toBe(5)
    expect(getOffsets('2').syncTrimMs).toBe(0)
  })

  it('hydrate of an old pack without syncTrimMs yields 0, not undefined', () => {
    const parsed = parseCalibrationOffsets({ yawDeg: 9 })
    expect(parsed?.syncTrimMs).toBe(0)
    applyRaceProjectCalibration({
      calibration: { byPovId: { '1': parsed! } },
    })
    expect(getOffsets('1').syncTrimMs).toBe(0)
    expect(getOffsets('1').yawDeg).toBe(9)
  })

  it('apply no-ops when calibration omitted (old packs)', () => {
    setOffsets('1', { yawDeg: 9 })
    applyRaceProjectCalibration({})
    expect(getOffsets('1').yawDeg).toBe(9)
  })
})
