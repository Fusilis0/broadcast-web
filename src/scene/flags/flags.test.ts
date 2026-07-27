import { describe, expect, it } from 'vitest'
import { buildCountdownFlagsLayout } from './loadCountdownFlags.ts'
import {
  DEFAULT_BLUE_WHITE_EXTRA_OFFSET_M,
  DEFAULT_DEMO_TIME_SCALE,
  normalizeCountdownFlags,
} from './normalizeCountdownFlags.ts'
import type { GpsToEnuAmslFn } from './types.ts'

describe('normalizeCountdownFlags', () => {
  it('fills Unity-ish defaults and keeps GPS points', () => {
    const data = normalizeCountdownFlags({
      name: 'demo',
      point1: { lat: 41.0, lon: 28.97 },
      point2: { lat: 41.01, lon: 28.98, altMsl: 1 },
    })
    expect(data).not.toBeNull()
    expect(data!.name).toBe('demo')
    expect(data!.point1).toEqual({ lat: 41.0, lon: 28.97, altMsl: 0 })
    expect(data!.point2.altMsl).toBe(1)
    expect(data!.startMinutes).toBe(6)
    expect(data!.whiteRaiseMinutes).toBe(5)
    expect(data!.orangeRaiseMinutes).toBe(6)
    expect(data!.blueWhiteRaiseMinutes).toBe(4)
    expect(data!.blueWhiteLowerMinutes).toBe(1)
    expect(data!.blueWhiteExtraOffsetM).toBe(DEFAULT_BLUE_WHITE_EXTRA_OFFSET_M)
    expect(data!.demoTimeScale).toBe(DEFAULT_DEMO_TIME_SCALE)
    expect(data!.autoStart).toBe(true)
  })

  it('honours custom knobs', () => {
    const data = normalizeCountdownFlags({
      point1: { lat: 1, lon: 2 },
      point2: { lat: 3, lon: 4 },
      startMinutes: 1,
      demoTimeScale: 10,
      autoStart: false,
      blueWhiteExtraOffsetM: 8,
    })
    expect(data!.startMinutes).toBe(1)
    expect(data!.demoTimeScale).toBe(10)
    expect(data!.autoStart).toBe(false)
    expect(data!.blueWhiteExtraOffsetM).toBe(8)
  })

  it('returns null without both points', () => {
    expect(normalizeCountdownFlags(null)).toBeNull()
    expect(normalizeCountdownFlags({ point1: { lat: 1, lon: 2 } })).toBeNull()
    expect(
      normalizeCountdownFlags({
        point1: { lat: 'x', lon: 2 },
        point2: { lat: 3, lon: 4 },
      }),
    ).toBeNull()
  })
})

describe('buildCountdownFlagsLayout', () => {
  const mockEnu: GpsToEnuAmslFn = (lat, lon, alt) => ({
    x: lon * 1000,
    y: alt + 35,
    z: lat * 1000,
  })

  it('uses east/north from GEO and ignores AMSL y for placement', () => {
    const data = normalizeCountdownFlags({
      point1: { lat: 41.0, lon: 28.97, altMsl: 2 },
      point2: { lat: 41.01, lon: 28.98 },
    })!
    const layout = buildCountdownFlagsLayout(data, mockEnu)
    expect(layout.p1x).toBeCloseTo(28.97 * 1000)
    expect(layout.p1z).toBeCloseTo(41.0 * 1000)
    expect(layout.p2x).toBeCloseTo(28.98 * 1000)
    expect(layout.p2z).toBeCloseTo(41.01 * 1000)
  })
})
