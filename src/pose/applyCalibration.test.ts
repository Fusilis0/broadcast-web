import { Quaternion } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_HFOV_DEG,
  clearAllOffsets,
  setOffsets,
  zeroOffsets,
} from '../calibration/index.ts'
import {
  applyCalibration,
  applyCalibrationForDevice,
  unityEulerDeg,
} from './applyCalibration.ts'

afterEach(() => {
  clearAllOffsets()
})

function identityPose(x = 10, y = 20, z = 30) {
  return {
    position: { x, y, z },
    rotation: new Quaternion(),
  }
}

describe('applyCalibration', () => {
  it('zero offsets leave position/rotation unchanged; FOV is 66.8832', () => {
    const pose = identityPose()
    const { pose: out, fovHDeg } = applyCalibration(pose, zeroOffsets())

    expect(out.position.x).toBeCloseTo(10, 10)
    expect(out.position.y).toBeCloseTo(20, 10)
    expect(out.position.z).toBeCloseTo(30, 10)
    expect(out.rotation.x).toBeCloseTo(0, 10)
    expect(out.rotation.y).toBeCloseTo(0, 10)
    expect(out.rotation.z).toBeCloseTo(0, 10)
    expect(out.rotation.w).toBeCloseTo(1, 10)
    expect(fovHDeg).toBe(DEFAULT_HFOV_DEG)
  })

  it('altMeters adds to ENU Y only', () => {
    const { pose: out } = applyCalibration(identityPose(), {
      ...zeroOffsets(),
      altMeters: 2.5,
    })
    expect(out.position.x).toBeCloseTo(10, 10)
    expect(out.position.y).toBeCloseTo(22.5, 10)
    expect(out.position.z).toBeCloseTo(30, 10)
  })

  it('yawDeg rotates about world Y (smoke)', () => {
    const { pose: out } = applyCalibration(identityPose(), {
      ...zeroOffsets(),
      yawDeg: 90,
    })
    const expected = unityEulerDeg(0, 90, 0)
    expect(out.rotation.x).toBeCloseTo(expected.x, 6)
    expect(out.rotation.y).toBeCloseTo(expected.y, 6)
    expect(out.rotation.z).toBeCloseTo(expected.z, 6)
    expect(out.rotation.w).toBeCloseTo(expected.w, 6)
  })

  it('pitchDeg / rollDeg change local X / Z (smoke)', () => {
    const pitched = applyCalibration(identityPose(), {
      ...zeroOffsets(),
      pitchDeg: 10,
    }).pose.rotation
    expect(Math.abs(pitched.x)).toBeGreaterThan(0.01)

    const rolled = applyCalibration(identityPose(), {
      ...zeroOffsets(),
      rollDeg: 10,
    }).pose.rotation
    expect(Math.abs(rolled.z)).toBeGreaterThan(0.01)
  })

  it('fovHDeg comes from offsets, not input pose', () => {
    const { fovHDeg } = applyCalibration(identityPose(), {
      ...zeroOffsets(),
      fovHDeg: 50,
    })
    expect(fovHDeg).toBe(50)
  })

  it('applyCalibrationForDevice uses store (or default)', () => {
    const missing = applyCalibrationForDevice(identityPose(), 'dev-missing')
    expect(missing.fovHDeg).toBe(DEFAULT_HFOV_DEG)
    expect(missing.pose.position.y).toBeCloseTo(20, 10)

    setOffsets('dev-1', { altMeters: 4, yawDeg: 0 })
    const applied = applyCalibrationForDevice(identityPose(), 'dev-1')
    expect(applied.pose.position.y).toBeCloseTo(24, 10)
    expect(applied.fovHDeg).toBe(DEFAULT_HFOV_DEG)
  })
})
