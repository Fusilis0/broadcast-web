/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { WindBus, resetWindBusForTests, windBus } from './windBus.ts'
import {
  createDefaultWindFrame,
  formatWindSourceAge,
  knotsToMs,
  msToKnots,
  parseOperatorWindInput,
  windTravelSceneXZ,
} from './windDirection.ts'
import { mountWindOpsRow } from './windOpsRow.ts'
import { resetWindHoldForTests } from './windOpenMeteo.ts'
import { DEFAULT_WIND_SPEED_KT, KT_TO_MS } from './windTypes.ts'

afterEach(() => {
  resetWindBusForTests()
  resetWindHoldForTests()
})

describe('windTravelSceneXZ', () => {
  it('0 from N → travel +Z (south)', () => {
    const v = windTravelSceneXZ(0)
    expect(v.x).toBeCloseTo(0, 10)
    expect(v.z).toBeCloseTo(1, 10)
  })

  it('90 from E → travel −X (west)', () => {
    const v = windTravelSceneXZ(90)
    expect(v.x).toBeCloseTo(-1, 10)
    expect(v.z).toBeCloseTo(0, 10)
  })

  it('180 from S → travel −Z (north)', () => {
    const v = windTravelSceneXZ(180)
    expect(v.x).toBeCloseTo(0, 10)
    expect(v.z).toBeCloseTo(-1, 10)
  })

  it('270 from W → travel +X (east)', () => {
    const v = windTravelSceneXZ(270)
    expect(v.x).toBeCloseTo(1, 10)
    expect(v.z).toBeCloseTo(0, 10)
  })

  it('wraps 360 / 450 onto the same cardinals and stays unit length', () => {
    const a = windTravelSceneXZ(360)
    const b = windTravelSceneXZ(0)
    expect(a.x).toBeCloseTo(b.x, 10)
    expect(a.z).toBeCloseTo(b.z, 10)
    const east = windTravelSceneXZ(450)
    expect(east.x).toBeCloseTo(-1, 10)
    expect(east.z).toBeCloseTo(0, 10)
    for (const deg of [0, 90, 180, 270, 33]) {
      const v = windTravelSceneXZ(deg)
      expect(Math.hypot(v.x, v.z)).toBeCloseTo(1, 10)
    }
  })
})

describe('knots ↔ m/s', () => {
  it('uses kt * 0.514444', () => {
    expect(knotsToMs(DEFAULT_WIND_SPEED_KT)).toBeCloseTo(
      DEFAULT_WIND_SPEED_KT * KT_TO_MS,
      10,
    )
    expect(msToKnots(knotsToMs(12))).toBeCloseTo(12, 10)
    expect(knotsToMs(-1)).toBe(0)
  })
})

describe('WindBus', () => {
  it('getSnapshot is null until publish; subscribe replays last frame', () => {
    const bus = new WindBus()
    expect(bus.getSnapshot()).toBeNull()
    const seen: number[] = []
    const unsub = bus.subscribe((f) => seen.push(f.directionFromDeg))
    expect(seen).toEqual([])
    bus.publish({
      directionFromDeg: 270,
      speedMs: 5,
      source: 'operator',
      updatedAtMs: 1,
    })
    expect(bus.getSnapshot()?.directionFromDeg).toBe(270)
    expect(seen).toEqual([270])
    const seen2: number[] = []
    bus.subscribe((f) => seen2.push(f.directionFromDeg))
    expect(seen2).toEqual([270])
    unsub()
  })

  it('shared bus is seeded with default 6 kt from 000°', () => {
    const snap = windBus.getSnapshot()
    expect(snap).not.toBeNull()
    expect(snap!.source).toBe('default')
    expect(snap!.directionFromDeg).toBe(0)
    expect(snap!.speedMs).toBeCloseTo(knotsToMs(6), 10)
  })

  it('preserves additive marine fields on publish', () => {
    const bus = new WindBus()
    bus.publish({
      directionFromDeg: 90,
      speedMs: 3,
      gustMs: 4,
      waveHeightM: 1.2,
      waveDirectionFromDeg: 270,
      wavePeriodS: 5,
      source: 'api',
      updatedAtMs: 7,
    })
    const snap = bus.getSnapshot()
    expect(snap?.gustMs).toBe(4)
    expect(snap?.waveHeightM).toBe(1.2)
    expect(snap?.waveDirectionFromDeg).toBe(270)
    expect(snap?.wavePeriodS).toBe(5)
  })
})

describe('parseOperatorWindInput', () => {
  const fallback = createDefaultWindFrame(0)

  it('publishes operator frame from from-deg + knots', () => {
    const next = parseOperatorWindInput(
      { directionFromDegText: '270', speedKtText: '12' },
      fallback,
      42,
    )
    expect(next.source).toBe('operator')
    expect(next.directionFromDeg).toBe(270)
    expect(next.speedMs).toBeCloseTo(knotsToMs(12), 10)
    expect(next.updatedAtMs).toBe(42)
  })

  it('empty or invalid keeps last / default and does not throw', () => {
    expect(
      parseOperatorWindInput(
        { directionFromDegText: '', speedKtText: '6' },
        fallback,
      ),
    ).toBe(fallback)
    expect(
      parseOperatorWindInput(
        { directionFromDegText: '90', speedKtText: '' },
        fallback,
      ),
    ).toBe(fallback)
    expect(
      parseOperatorWindInput(
        { directionFromDegText: 'nope', speedKtText: '6' },
        fallback,
      ),
    ).toBe(fallback)
    expect(
      parseOperatorWindInput(
        { directionFromDegText: '90', speedKtText: '-1' },
        fallback,
      ),
    ).toBe(fallback)
  })
})

describe('formatWindSourceAge', () => {
  it('labels default vs operator age vs stale', () => {
    expect(
      formatWindSourceAge({
        directionFromDeg: 0,
        speedMs: 1,
        source: 'default',
        updatedAtMs: 0,
      }),
    ).toBe('default')
    expect(
      formatWindSourceAge(
        {
          directionFromDeg: 0,
          speedMs: 1,
          source: 'operator',
          updatedAtMs: 0,
        },
        3500,
      ),
    ).toBe('operator · 4s')
    expect(
      formatWindSourceAge(
        {
          directionFromDeg: 0,
          speedMs: 1,
          source: 'operator',
          updatedAtMs: 0,
        },
        11 * 60 * 1000,
      ),
    ).toBe('operator · stale')
  })
})

describe('mountWindOpsRow', () => {
  it('operator from-deg + speed updates the bus snapshot', () => {
    const bus = new WindBus()
    const root = document.createElement('div')
    const handle = mountWindOpsRow({ container: root, bus })
    expect(bus.getSnapshot()?.source).toBe('default')

    const from = root.querySelector(
      '#ops-wind-direction-from',
    ) as HTMLInputElement
    const speed = root.querySelector('#ops-wind-speed-kt') as HTMLInputElement
    from.value = '90'
    from.dispatchEvent(new Event('input'))
    speed.value = '8'
    speed.dispatchEvent(new Event('input'))

    const snap = bus.getSnapshot()
    expect(snap?.source).toBe('operator')
    expect(snap?.directionFromDeg).toBe(90)
    expect(snap?.speedMs).toBeCloseTo(knotsToMs(8), 10)
    expect(root.querySelector('[data-ops="wind-source"]')?.textContent).toMatch(
      /^operator · \d+ms$/,
    )

    from.value = ''
    from.dispatchEvent(new Event('input'))
    expect(bus.getSnapshot()?.directionFromDeg).toBe(90)

    handle.dispose()
    expect(root.querySelector('[data-ops="wind"]')).toBeNull()
  })
})
