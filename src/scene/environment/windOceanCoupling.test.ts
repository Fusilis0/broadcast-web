import { describe, expect, it } from 'vitest'
import { knotsToMs, windTravelSceneXZ } from '../../telemetry/windDirection.ts'
import type { WindFrame } from '../../telemetry/windTypes.ts'
import { waveDirectionXZ } from './gerstnerOcean.ts'
import {
  WIND_OCEAN_RAMP_SECONDS,
  amplitudeScaleFromSpeedMs,
  createWindOceanDriver,
  directionRadFromWindFrame,
  directionRadFromWindTravel,
  shortestAngleDelta,
} from './windOceanCoupling.ts'

function frame(directionFromDeg: number, speedMs: number): WindFrame {
  return {
    directionFromDeg,
    speedMs,
    source: 'operator',
    updatedAtMs: 1,
  }
}

describe('directionRadFromWindTravel', () => {
  it('uses windTravelSceneXZ: 0° from N → +Z, 90° from E → −X', () => {
    const north = windTravelSceneXZ(0)
    expect(north.x).toBeCloseTo(0, 10)
    expect(north.z).toBeCloseTo(1, 10)
    const rad0 = directionRadFromWindTravel(north)
    const d0 = waveDirectionXZ(rad0)
    expect(d0.x).toBeCloseTo(0, 5)
    expect(d0.z).toBeCloseTo(1, 5)

    const east = windTravelSceneXZ(90)
    expect(east.x).toBeCloseTo(-1, 10)
    expect(east.z).toBeCloseTo(0, 10)
    const rad90 = directionRadFromWindFrame(frame(90, 1))
    const d90 = waveDirectionXZ(rad90)
    expect(d90.x).toBeCloseTo(-1, 5)
    expect(d90.z).toBeCloseTo(0, 5)
  })
})

describe('createWindOceanDriver', () => {
  it('snaps the first frame and ramps a later 90° step (does not jump in one call)', () => {
    let nowMs = 0
    let dir = 0
    let speed = 0
    const driver = createWindOceanDriver({
      apply: {
        setDirectionRad: (rad) => {
          dir = rad
        },
        setWindSpeed: (ms) => {
          speed = ms
        },
      },
      now: () => nowMs,
      rampSeconds: WIND_OCEAN_RAMP_SECONDS,
    })

    const sixKt = knotsToMs(6)
    driver.setTarget(frame(0, sixKt), true)
    const travel0 = waveDirectionXZ(dir)
    expect(travel0.x).toBeCloseTo(0, 5)
    expect(travel0.z).toBeCloseTo(1, 5)
    expect(speed).toBeCloseTo(sixKt, 5)

    driver.setTarget(frame(90, 8), false)
    driver.step(0)
    const afterPublish = waveDirectionXZ(dir)
    expect(afterPublish.z).toBeCloseTo(1, 4)
    expect(afterPublish.x).toBeCloseTo(0, 4)
    expect(speed).toBeCloseTo(sixKt, 4)

    driver.step(0.05)
    const mid = waveDirectionXZ(dir)
    expect(mid.x).toBeGreaterThan(-0.5)
    expect(mid.z).toBeGreaterThan(0.5)
    expect(Math.abs(shortestAngleDelta(dir, directionRadFromWindFrame(frame(90, 8))))).toBeGreaterThan(
      0.5,
    )

    nowMs = WIND_OCEAN_RAMP_SECONDS * 1000
    driver.step(0)
    const done = waveDirectionXZ(dir)
    expect(done.x).toBeCloseTo(-1, 5)
    expect(done.z).toBeCloseTo(0, 5)
    expect(speed).toBeCloseTo(8, 5)
  })

  it('scales amplitude mildly with speed (1.0 at 6 kt, clamped)', () => {
    expect(amplitudeScaleFromSpeedMs(knotsToMs(6))).toBeCloseTo(1, 5)
    expect(amplitudeScaleFromSpeedMs(0)).toBeCloseTo(0.65, 5)
    expect(amplitudeScaleFromSpeedMs(40)).toBeCloseTo(1.25, 5)
  })
})
