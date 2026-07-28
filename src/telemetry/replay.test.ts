import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadReplayFixture, parseReplayFixture } from './replayFixture.ts'
import { ReplayTelemetrySource } from './replaySource.ts'
import type { MockPacket } from './mockSource.ts'
import { TelemetryBus } from './bus.ts'
import { startTelemetryIngest } from './ingest.ts'

const validFixture = {
  version: 1 as const,
  name: 'unit',
  loop: false,
  packets: [
    {
      t_ms: 0,
      channel: 'drone' as const,
      payload: { id: '1', ts: 0 },
    },
    {
      t_ms: 100,
      channel: 'boat' as const,
      payload: { id: '21', lat: 1, lon: 2, time: 100 },
    },
    {
      t_ms: 250,
      channel: 'drone' as const,
      payload: { type: 'stream_anchor', stream_id: '1' },
    },
  ],
}

describe('parseReplayFixture', () => {
  it('accepts a valid v1 fixture', () => {
    const result = parseReplayFixture(validFixture)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fixture.version).toBe(1)
    expect(result.fixture.name).toBe('unit')
    expect(result.fixture.loop).toBe(false)
    expect(result.fixture.packets).toHaveLength(3)
    expect(result.fixture.packets[0]?.t_ms).toBe(0)
    expect(result.fixture.packets[2]?.channel).toBe('drone')
  })

  it('rejects bad version', () => {
    const result = parseReplayFixture({ ...validFixture, version: 2 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/version/i)
  })

  it('rejects missing packets', () => {
    const result = parseReplayFixture({
      version: 1,
      name: 'x',
      loop: true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/packets/i)
  })

  it('rejects empty packets', () => {
    const result = parseReplayFixture({
      version: 1,
      name: 'x',
      loop: true,
      packets: [],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/non-empty/i)
  })

  it('rejects non-monotonic t_ms', () => {
    const result = parseReplayFixture({
      version: 1,
      name: 'x',
      loop: false,
      packets: [
        { t_ms: 10, channel: 'drone', payload: {} },
        { t_ms: 5, channel: 'boat', payload: {} },
      ],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/monotonic/i)
  })

  it('rejects bad channel', () => {
    const result = parseReplayFixture({
      version: 1,
      name: 'x',
      loop: false,
      packets: [{ t_ms: 0, channel: 'cam', payload: {} }],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/channel/i)
  })
})

describe('loadReplayFixture errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports empty URL clearly', async () => {
    const result = await loadReplayFixture('')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/fixture missing/i)
    expect(result.error).toMatch(/replayUrl/i)
  })

  it('reports HTTP 404 as fixture missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    )
    const result = await loadReplayFixture('/fixtures/telemetry/nope.json')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/fixture missing \(HTTP 404\)/)
    expect(result.error).toContain('/fixtures/telemetry/nope.json')
  })

  it('prefixes parse errors with URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              version: 9,
              name: 'x',
              loop: true,
              packets: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
      ),
    )
    const result = await loadReplayFixture('/bad.json')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/fixture invalid at \/bad\.json/)
  })
})

describe('ReplayTelemetrySource', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits packets in t_ms order with relative delays', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture(validFixture)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const emitted: MockPacket[] = []
    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (p) => emitted.push(p),
    })
    source.start()
    expect(source.getStatus()).toBe('playing')

    expect(emitted).toHaveLength(1)
    expect(emitted[0]?.channel).toBe('drone')
    expect(JSON.parse(emitted[0]!.jsonText)).toMatchObject({ id: '1' })

    await vi.advanceTimersByTimeAsync(99)
    expect(emitted).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(emitted).toHaveLength(2)
    expect(emitted[1]?.channel).toBe('boat')

    await vi.advanceTimersByTimeAsync(150)
    expect(emitted).toHaveLength(3)
    expect(JSON.parse(emitted[2]!.jsonText)).toMatchObject({
      type: 'stream_anchor',
    })

    source.stop()
    expect(source.getStatus()).toBe('idle')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(emitted).toHaveLength(3)
  })

  it('loops when loop is true', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture({
      version: 1,
      name: 'loop',
      loop: true,
      packets: [
        { t_ms: 0, channel: 'drone', payload: { seq: 1 } },
        { t_ms: 50, channel: 'boat', payload: { seq: 2 } },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const emitted: MockPacket[] = []
    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (p) => emitted.push(p),
    })
    source.start()

    expect(emitted).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(50)
    // At t=50: boat packet + loop restart (sync t=0 drone of next pass).
    expect(emitted).toHaveLength(3)
    expect(emitted[1]?.channel).toBe('boat')
    expect(emitted[2]?.channel).toBe('drone')

    source.stop()
  })

  it('loop override forces loop when fixture.loop is false', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture({
      version: 1,
      name: 'once',
      loop: false,
      packets: [
        { t_ms: 0, channel: 'drone', payload: { seq: 1 } },
        { t_ms: 40, channel: 'boat', payload: { seq: 2 } },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const emitted: MockPacket[] = []
    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      loop: true,
      onPacket: (p) => emitted.push(p),
    })
    expect(source.loops).toBe(true)
    source.start()
    await vi.advanceTimersByTimeAsync(40)
    expect(emitted).toHaveLength(3)
    source.stop()
  })

  it('one-shot ends in ended and restart works via start()', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture({
      version: 1,
      name: 'once',
      loop: false,
      packets: [
        { t_ms: 0, channel: 'drone', payload: { n: 1 } },
        { t_ms: 30, channel: 'boat', payload: { n: 2 } },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const emitted: MockPacket[] = []
    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (p) => emitted.push(p),
    })
    source.start()
    expect(source.getStatus()).toBe('playing')
    await vi.advanceTimersByTimeAsync(30)
    expect(emitted).toHaveLength(2)
    expect(source.getStatus()).toBe('ended')
    expect(source.isRunning).toBe(false)

    source.start()
    expect(source.getStatus()).toBe('playing')
    expect(emitted).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(30)
    expect(emitted).toHaveLength(4)
    expect(source.getStatus()).toBe('ended')
  })

  it('stop clears pending timers', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture(validFixture)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const emitted: MockPacket[] = []
    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (p) => emitted.push(p),
    })
    source.start()
    expect(emitted).toHaveLength(1)
    source.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(emitted).toHaveLength(1)
  })

  it('stop during loop cancels next pass', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture({
      version: 1,
      name: 'loop',
      loop: true,
      packets: [
        { t_ms: 0, channel: 'drone', payload: { seq: 1 } },
        { t_ms: 100, channel: 'boat', payload: { seq: 2 } },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const emitted: MockPacket[] = []
    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (p) => emitted.push(p),
    })
    source.start()
    expect(emitted).toHaveLength(1)
    source.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(emitted).toHaveLength(1)
    expect(source.getStatus()).toBe('idle')
  })
})

describe('replay ingest handle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('exposes getReplayStatus and soft-fails missing fixture', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('config.json')) {
          return new Response(JSON.stringify({}), { status: 200 })
        }
        return new Response(null, { status: 404 })
      }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const bus = new TelemetryBus()
    const handle = await startTelemetryIngest({
      mode: 'replay',
      replayUrl: '/fixtures/telemetry/missing.json',
      wsUrl: '',
      wsBoatUrl: '',
      bus,
    })
    expect(handle.mode).toBe('replay')
    expect(handle.getReplayStatus?.()).toBe('error')
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/cannot start/)
    handle.stop()
  })

  it('honours replayLoop override through ingest', async () => {
    vi.useFakeTimers()
    const fixture = {
      version: 1,
      name: 'ingest-loop',
      loop: false,
      packets: [
        {
          t_ms: 0,
          channel: 'drone',
          payload: { id: '1', ts: 0, pos: { lat: 0, lon: 0, alt: 0 } },
        },
        {
          t_ms: 20,
          channel: 'drone',
          payload: { id: '1', ts: 20, pos: { lat: 0, lon: 0, alt: 1 } },
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('config.json')) {
          return new Response(JSON.stringify({}), { status: 200 })
        }
        return new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
    const bus = new TelemetryBus()
    const drone: unknown[] = []
    bus.on('drone', (p) => drone.push(p))
    const handle = await startTelemetryIngest({
      mode: 'replay',
      replayUrl: '/fixtures/telemetry/unit.json',
      replayLoop: true,
      wsUrl: '',
      wsBoatUrl: '',
      bus,
    })
    expect(handle.getReplayStatus?.()).toBe('playing')
    await vi.advanceTimersByTimeAsync(20)
    // second packet + loop restart first packet
    expect(drone.length).toBeGreaterThanOrEqual(3)
    handle.stop()
    expect(handle.getReplayStatus?.()).toBe('idle')
  })
})
