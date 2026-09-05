import { describe, expect, it } from 'vitest'
import type { WorldFeature } from '../features/types.ts'
import { LINE_SIGN_BAND_DEPTH_M } from '../lineSigns/lineSignLayout.ts'
import { WATER_PLANE_Y_OFFSET } from '../waterPlanePlacement.ts'
import {
  GERSTNER_OCEAN_DEFAULTS,
  gerstnerPeakAmplitudeM,
} from './gerstnerOcean.ts'
import {
  OCEAN_SUPPRESS_CAP,
  collectOceanSuppressFootprints,
  footprintFromWaterSpan,
  oceanIsFlattenedAt,
  oceanIsSuppressedAt,
} from './oceanSuppress.ts'

const mockEnu = (lat: number, lon: number, alt: number) => ({
  x: lon * 100,
  y: alt,
  z: lat * 100,
})

function sponsorFeature(
  id: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  heightM = 8,
): WorldFeature {
  return {
    id: `sponsor:${id}`,
    name: id,
    type: 'sponsor',
    label: id,
    heightM,
    points: [
      { lat: az / 100, lon: ax / 100, altMsl: 0 },
      { lat: bz / 100, lon: bx / 100, altMsl: 0 },
    ],
  }
}

function lineFeature(
  type: 'start' | 'finish',
  ax: number,
  az: number,
  bx: number,
  bz: number,
): WorldFeature {
  return {
    id: `${type}:1`,
    name: type,
    type,
    points: [
      { lat: az / 100, lon: ax / 100, altMsl: 0 },
      { lat: bz / 100, lon: bx / 100, altMsl: 0 },
    ],
  }
}

describe('19.15 ocean suppress footprints', () => {
  it('keeps authored peak amplitude for diagnosis; product displacementScale is 0', () => {
    expect(GERSTNER_OCEAN_DEFAULTS.liftY).toBeCloseTo(WATER_PLANE_Y_OFFSET)
    expect(gerstnerPeakAmplitudeM()).toBeGreaterThan(WATER_PLANE_Y_OFFSET * 4)
    expect(GERSTNER_OCEAN_DEFAULTS.displacementScale).toBe(0)
  })

  it('fragment discard is retired; flatten still detects board footprints', () => {
    const features: WorldFeature[] = [
      sponsorFeature('sp', 0, 0, 40, 0, 8),
      lineFeature('start', 0, 80, 100, 80),
    ]
    const fps = collectOceanSuppressFootprints(features, mockEnu)
    expect(fps.length).toBe(2)

    expect(oceanIsSuppressedAt(20, 0, fps)).toBe(false)
    expect(oceanIsFlattenedAt(20, 0, fps)).toBe(true)
    expect(oceanIsSuppressedAt(50, 80, fps)).toBe(false)
    expect(oceanIsFlattenedAt(50, 80, fps)).toBe(true)

    expect(oceanIsFlattenedAt(20, 400, fps)).toBe(false)
  })

  it('oriented span is not an axis-aligned box (corner off the board is open water)', () => {
    const fp = footprintFromWaterSpan(0, 0, 40, 0, 8)
    expect(fp).not.toBeNull()
    const fps = [fp!]
    expect(oceanIsFlattenedAt(20, 0, fps)).toBe(true)
    expect(oceanIsFlattenedAt(20, 3.9, fps)).toBe(true)
    expect(oceanIsFlattenedAt(20, 12, fps)).toBe(false)
  })

  it('caps at OCEAN_SUPPRESS_CAP and prefers start/finish over later sponsors', () => {
    const features: WorldFeature[] = [
      lineFeature('finish', 0, 0, 20, 0),
      ...Array.from({ length: OCEAN_SUPPRESS_CAP }, (_, i) =>
        sponsorFeature(`s${i}`, i * 30, 200, i * 30 + 10, 200),
      ),
    ]
    const fps = collectOceanSuppressFootprints(features, mockEnu)
    expect(fps).toHaveLength(OCEAN_SUPPRESS_CAP)
    expect(oceanIsFlattenedAt(10, 0, fps)).toBe(true)
    const lastSponsorMidX = (OCEAN_SUPPRESS_CAP - 1) * 30 + 5
    expect(oceanIsFlattenedAt(lastSponsorMidX, 200, fps)).toBe(false)
  })

  it('empty layout leaves the ocean drawing everywhere', () => {
    expect(collectOceanSuppressFootprints([], mockEnu)).toEqual([])
    expect(oceanIsSuppressedAt(0, 0, [])).toBe(false)
    expect(LINE_SIGN_BAND_DEPTH_M).toBe(24)
  })
})
