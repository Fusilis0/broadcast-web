import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseReplayFixture } from './replayFixture.ts'
import { ReplayTelemetrySource } from './replaySource.ts'
import type { MockPacket } from './mockSource.ts'

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
})
