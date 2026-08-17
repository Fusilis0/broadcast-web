/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WindBus, resetWindBusForTests } from './windBus.ts'
import { knotsToMs, windTravelSceneXZ } from './windDirection.ts'
import { mountWindOpsRow } from './windOpsRow.ts'
import {
  OPERATOR_HOLD_MS,
  buildOpenMeteoForecastUrl,
  createOpenMeteoWindProvider,
  mapOpenMeteoForecastToWindFrame,
  resetWindHoldForTests,
  setWindHoldMode,
} from './windOpenMeteo.ts'

const ISTANBUL = { lat: 41.0082, lon: 28.9784 }
/** Fits a 32-bit timer; tests call `pollNow` and must not auto-tick. */
const NO_AUTO_POLL_MS = 60 * 60 * 1000

afterEach(() => {
  resetWindBusForTests()
  resetWindHoldForTests()
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function forecastBody(
  directionFromDeg: number,
  speedMs: number,
  gustMs = speedMs + 1,
): unknown {
  return {
    current: {
      wind_speed_10m: speedMs,
      wind_direction_10m: directionFromDeg,
      wind_gusts_10m: gustMs,
    },
  }
}

function marineBody(
  heightM: number,
  directionFromDeg: number,
  periodS: number,
): unknown {
  return {
    current: {
      wave_height: heightM,
      wave_direction: directionFromDeg,
      wave_period: periodS,
    },
  }
}

function mockFetch(options: {
  forecast?: unknown | 'fail' | 'throw'
  marine?: unknown | 'fail' | 'throw'
}): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const marine = url.includes('marine-api')
    const spec = marine ? options.marine : options.forecast
    if (spec === 'throw') throw new Error('network down')
    if (spec === 'fail') return new Response(null, { status: 502 })
    if (spec === undefined) {
      return jsonResponse(marine ? { current: {} } : forecastBody(270, 5.2))
    }
    return jsonResponse(spec)
  }) as unknown as typeof fetch
}

describe('mapOpenMeteoForecastToWindFrame', () => {
  it('maps cardinal from-degrees and m/s onto source api', () => {
    const cardinals: Array<{ from: number; travel: { x: number; z: number } }> =
      [
        { from: 0, travel: { x: 0, z: 1 } },
        { from: 90, travel: { x: -1, z: 0 } },
        { from: 180, travel: { x: 0, z: -1 } },
        { from: 270, travel: { x: 1, z: 0 } },
      ]
    for (const { from, travel } of cardinals) {
      const frame = mapOpenMeteoForecastToWindFrame(forecastBody(from, 4), 99)
      expect(frame).not.toBeNull()
      expect(frame!.source).toBe('api')
      expect(frame!.directionFromDeg).toBe(from)
      expect(frame!.speedMs).toBe(4)
      expect(frame!.gustMs).toBe(5)
      expect(frame!.updatedAtMs).toBe(99)
      const v = windTravelSceneXZ(frame!.directionFromDeg)
      expect(v.x).toBeCloseTo(travel.x, 10)
      expect(v.z).toBeCloseTo(travel.z, 10)
    }
  })

  it('attaches marine fields additively when present', () => {
    const frame = mapOpenMeteoForecastToWindFrame(
      forecastBody(90, 3),
      1,
      marineBody(1.4, 270, 6),
    )
    expect(frame?.waveHeightM).toBe(1.4)
    expect(frame?.waveDirectionFromDeg).toBe(270)
    expect(frame?.wavePeriodS).toBe(6)
  })

  it('returns null when speed or direction is missing (keep last)', () => {
    expect(mapOpenMeteoForecastToWindFrame({ current: {} }, 1)).toBeNull()
    expect(
      mapOpenMeteoForecastToWindFrame(
        { current: { wind_speed_10m: 1 } },
        1,
      ),
    ).toBeNull()
    expect(
      mapOpenMeteoForecastToWindFrame(
        { current: { wind_direction_10m: 90 } },
        1,
      ),
    ).toBeNull()
  })
})

describe('createOpenMeteoWindProvider', () => {
  it('successful mock fetch publishes source api with from-deg + speedMs', async () => {
    const bus = new WindBus()
    const fetchImpl = mockFetch({ forecast: forecastBody(270, 5.2) })
    const provider = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl,
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
    })
    await provider.pollNow()
    const snap = bus.getSnapshot()
    expect(snap?.source).toBe('api')
    expect(snap?.directionFromDeg).toBe(270)
    expect(snap?.speedMs).toBe(5.2)
    expect(snap?.gustMs).toBe(6.2)
    const urls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    )
    expect(urls.some((u) => u.includes('wind_speed_unit=ms'))).toBe(true)
    expect(buildOpenMeteoForecastUrl(ISTANBUL)).toContain('wind_speed_unit=ms')
    provider.stop()
  })

  it('failed fetch does not publish a blank/zero frame over a good last snapshot', async () => {
    const bus = new WindBus()
    const fetchImpl = mockFetch({ forecast: forecastBody(90, 4) })
    const provider = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl,
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
    })
    await provider.pollNow()
    expect(bus.getSnapshot()?.directionFromDeg).toBe(90)
    expect(bus.getSnapshot()?.speedMs).toBe(4)

    const failFetch = mockFetch({ forecast: 'fail' })
    const provider2 = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl: failFetch,
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await provider2.pollNow()
    expect(bus.getSnapshot()?.source).toBe('api')
    expect(bus.getSnapshot()?.directionFromDeg).toBe(90)
    expect(bus.getSnapshot()?.speedMs).toBe(4)
    expect(warn).toHaveBeenCalled()
    provider.stop()
    provider2.stop()
  })

  it('network throw keeps last; calm 0 m/s from a good fetch is allowed', async () => {
    const bus = new WindBus()
    bus.publish({
      directionFromDeg: 180,
      speedMs: 8,
      source: 'api',
      updatedAtMs: 1,
    })
    const provider = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl: mockFetch({ forecast: 'throw' }),
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await provider.pollNow()
    expect(bus.getSnapshot()?.speedMs).toBe(8)
    expect(bus.getSnapshot()?.directionFromDeg).toBe(180)
    expect(warn).toHaveBeenCalled()
    provider.stop()

    const calm = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl: mockFetch({ forecast: forecastBody(0, 0, 0) }),
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
    })
    await calm.pollNow()
    expect(bus.getSnapshot()?.source).toBe('api')
    expect(bus.getSnapshot()?.speedMs).toBe(0)
    expect(bus.getSnapshot()?.directionFromDeg).toBe(0)
    calm.stop()
  })

  it('operator publish is not overwritten by a poll while hold is recent', async () => {
    const bus = new WindBus()
    bus.publish({
      directionFromDeg: 45,
      speedMs: knotsToMs(12),
      source: 'operator',
      updatedAtMs: 1000,
    })
    setWindHoldMode('operator')
    const provider = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl: mockFetch({ forecast: forecastBody(270, 9) }),
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
      now: () => 1000,
    })
    await provider.pollNow()
    const snap = bus.getSnapshot()
    expect(snap?.source).toBe('operator')
    expect(snap?.directionFromDeg).toBe(45)
    expect(snap?.speedMs).toBeCloseTo(knotsToMs(12), 10)
    provider.stop()
  })

  it('follow API / expired hold lets the next poll publish', async () => {
    let nowMs = 0
    const bus = new WindBus()
    bus.publish({
      directionFromDeg: 45,
      speedMs: 2,
      source: 'operator',
      updatedAtMs: 0,
    })
    setWindHoldMode('operator')
    const fetchImpl = mockFetch({ forecast: forecastBody(180, 7) })
    const provider = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl,
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
      now: () => nowMs,
      operatorHoldMs: OPERATOR_HOLD_MS,
    })
    await provider.pollNow()
    expect(bus.getSnapshot()?.source).toBe('operator')

    setWindHoldMode('api')
    await provider.pollNow()
    expect(bus.getSnapshot()?.source).toBe('api')
    expect(bus.getSnapshot()?.directionFromDeg).toBe(180)

    bus.publish({
      directionFromDeg: 10,
      speedMs: 1,
      source: 'operator',
      updatedAtMs: 0,
    })
    setWindHoldMode('operator')
    nowMs = OPERATOR_HOLD_MS
    await provider.pollNow()
    expect(bus.getSnapshot()?.source).toBe('api')
    provider.stop()
  })

  it('marine fetch failure still publishes wind', async () => {
    const bus = new WindBus()
    const provider = createOpenMeteoWindProvider({
      origin: ISTANBUL,
      bus,
      fetchImpl: mockFetch({
        forecast: forecastBody(90, 3),
        marine: 'fail',
      }),
      pollIntervalMs: NO_AUTO_POLL_MS,
      pollOnStart: false,
    })
    await provider.pollNow()
    expect(bus.getSnapshot()?.source).toBe('api')
    expect(bus.getSnapshot()?.directionFromDeg).toBe(90)
    expect(bus.getSnapshot()?.waveHeightM).toBeUndefined()
    provider.stop()
  })
})

describe('mountWindOpsRow hold control', () => {
  it('operator input holds; API button follows and polls', async () => {
    const bus = new WindBus()
    const root = document.createElement('div')
    const poll = vi.fn()
    const handle = mountWindOpsRow({
      container: root,
      bus,
      onFollowApi: poll,
    })

    const from = root.querySelector(
      '#ops-wind-direction-from',
    ) as HTMLInputElement
    const speed = root.querySelector('#ops-wind-speed-kt') as HTMLInputElement
    from.value = '90'
    from.dispatchEvent(new Event('input'))
    speed.value = '8'
    speed.dispatchEvent(new Event('input'))
    expect(bus.getSnapshot()?.source).toBe('operator')

    const btn = root.querySelector('[data-ops="wind-hold"]') as HTMLButtonElement
    expect(btn.textContent).toBe('API')
    expect(btn.getAttribute('aria-pressed')).toBe('true')

    btn.click()
    expect(poll).toHaveBeenCalledTimes(1)
    expect(btn.textContent).toBe('hold')

    handle.dispose()
  })
})
