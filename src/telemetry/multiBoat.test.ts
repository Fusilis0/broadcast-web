import { afterEach, describe, expect, it, vi } from 'vitest'
import { TelemetryBus } from './bus.ts'
import { ingestPacket } from './ingest.ts'
import { MockTelemetrySource } from './mockSource.ts'
import { parseReplayFixture } from './replayFixture.ts'
import { ReplayTelemetrySource } from './replaySource.ts'
import type { BoatTelemetry } from './types.ts'

describe('mock multi-boat', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits all configured boat ids within a tick window', () => {
    vi.useFakeTimers()
    const boatIds = ['21', '22', '23', '24']
    const seen = new Set<string>()
    const source = new MockTelemetrySource({
      hz: 10,
      boatIds,
      onPacket: (packet) => {
        if (packet.channel !== 'boat') return
        const payload = JSON.parse(packet.jsonText) as BoatTelemetry
        seen.add(payload.id)
      },
    })
    source.start()
    // Immediate tickPose on start already fired; advance one more period.
    vi.advanceTimersByTime(100)
    source.stop()

    expect([...seen].sort()).toEqual([...boatIds].sort())
  })

  it('phase-offsets boats so lat/lon are not identical', () => {
    const packets: BoatTelemetry[] = []
    const source = new MockTelemetrySource({
      boatIds: ['21', '22'],
      onPacket: (packet) => {
        if (packet.channel !== 'boat') return
        packets.push(JSON.parse(packet.jsonText) as BoatTelemetry)
      },
    })
    source.start()
    source.stop()

    expect(packets).toHaveLength(2)
    expect(packets[0]!.id).toBe('21')
    expect(packets[1]!.id).toBe('22')
    expect(packets[0]!.lat).not.toBe(packets[1]!.lat)
    expect(packets[0]!.lon).not.toBe(packets[1]!.lon)
  })
})

describe('replay multi-boat → bus', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers ≥2 distinct boat ids onto the bus', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture({
      version: 1,
      name: 'multi-boat-unit',
      loop: false,
      packets: [
        {
          t_ms: 0,
          channel: 'boat',
          payload: {
            id: '21',
            lat: 41.006,
            lon: 28.98,
            time: 0,
          },
        },
        {
          t_ms: 0,
          channel: 'boat',
          payload: {
            id: '22',
            lat: 41.0065,
            lon: 28.9805,
            time: 0,
          },
        },
        {
          t_ms: 50,
          channel: 'drone',
          payload: {
            type: 'stream_anchor',
            stream_id: '1',
            kind: 'periodic',
            fps: 30,
            pts_90khz: 0,
            ntp_capture_ms: 50,
            ntp_synced: true,
            ntp_err_ms: 0,
          },
        },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const bus = new TelemetryBus()
    const boatIds = new Set<string>()
    bus.on('boat', (boat) => boatIds.add(boat.id))

    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (packet) => ingestPacket(packet, bus),
    })
    source.start()
    await vi.advanceTimersByTimeAsync(50)
    source.stop()

    expect(boatIds.has('21')).toBe(true)
    expect(boatIds.has('22')).toBe(true)
    expect(boatIds.size).toBeGreaterThanOrEqual(2)
  })
})
