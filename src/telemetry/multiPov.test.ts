import { afterEach, describe, expect, it, vi } from 'vitest'
import { TelemetryBus } from './bus.ts'
import { ingestPacket } from './ingest.ts'
import { MockTelemetrySource } from './mockSource.ts'
import { parseReplayFixture } from './replayFixture.ts'
import { ReplayTelemetrySource } from './replaySource.ts'
import type { StreamAnchorMessage, TelemetryData } from './types.ts'

describe('mock multi-POV', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits all configured povIds within a tick window', () => {
    vi.useFakeTimers()
    const povIds = ['1', '2']
    const seen = new Set<string>()
    const source = new MockTelemetrySource({
      hz: 10,
      povIds,
      boatIds: ['21'],
      onPacket: (packet) => {
        if (packet.channel !== 'drone') return
        const payload = JSON.parse(packet.jsonText) as TelemetryData & {
          type?: string
        }
        if (payload.type === 'stream_anchor') return
        seen.add(payload.id)
      },
    })
    source.start()
    vi.advanceTimersByTime(100)
    source.stop()

    expect([...seen].sort()).toEqual([...povIds].sort())
  })

  it('phase-offsets POVs so lat/lon/yaw are not identical', () => {
    const packets: TelemetryData[] = []
    const source = new MockTelemetrySource({
      povIds: ['1', '2'],
      boatIds: ['21'],
      onPacket: (packet) => {
        if (packet.channel !== 'drone') return
        const payload = JSON.parse(packet.jsonText) as TelemetryData & {
          type?: string
        }
        if (payload.type === 'stream_anchor') return
        packets.push(payload)
      },
    })
    source.start()
    source.stop()

    expect(packets).toHaveLength(2)
    expect(packets[0]!.id).toBe('1')
    expect(packets[1]!.id).toBe('2')
    expect(packets[0]!.pos.lat).not.toBe(packets[1]!.pos.lat)
    expect(packets[0]!.pos.lon).not.toBe(packets[1]!.pos.lon)
    expect(packets[0]!.rot.yaw).not.toBe(packets[1]!.rot.yaw)
  })

  it('keeps multi-boat emit alongside multi-POV', () => {
    const boatSeen = new Set<string>()
    const povSeen = new Set<string>()
    const source = new MockTelemetrySource({
      povIds: ['1', '2'],
      boatIds: ['21', '22'],
      onPacket: (packet) => {
        const payload = JSON.parse(packet.jsonText) as {
          id?: string
          type?: string
        }
        if (payload.type === 'stream_anchor') return
        if (packet.channel === 'boat' && payload.id) boatSeen.add(payload.id)
        if (packet.channel === 'drone' && payload.id) povSeen.add(payload.id)
      },
    })
    source.start()
    source.stop()

    expect([...povSeen].sort()).toEqual(['1', '2'])
    expect([...boatSeen].sort()).toEqual(['21', '22'])
  })

  it('anchors stream_anchor to povIds[0]', () => {
    const anchors: StreamAnchorMessage[] = []
    const source = new MockTelemetrySource({
      povIds: ['2', '1'],
      boatIds: ['21'],
      onPacket: (packet) => {
        if (packet.channel !== 'drone') return
        const payload = JSON.parse(packet.jsonText) as StreamAnchorMessage
        if (payload.type === 'stream_anchor') anchors.push(payload)
      },
    })
    source.start()
    source.stop()

    expect(anchors.length).toBeGreaterThanOrEqual(1)
    expect(anchors[0]!.stream_id).toBe('2')
  })
})

describe('replay multi-POV → bus', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers ≥2 distinct POV ids onto the bus', async () => {
    vi.useFakeTimers()
    const parsed = parseReplayFixture({
      version: 1,
      name: 'multi-pov-unit',
      loop: false,
      packets: [
        {
          t_ms: 0,
          channel: 'drone',
          payload: {
            ts: 0,
            seq: 1,
            id: '1',
            ntp_synced: true,
            ntp_err_ms: 0,
            pos: { lat: 41.0082, lon: 28.9784, alt: 45 },
            rot: {
              x: 0,
              y: 0,
              z: 0,
              w: 1,
              yaw: 0,
              pitch: 0,
              roll: 0,
            },
            gimbal: {
              x: 0,
              y: 0,
              z: 0,
              w: 1,
              yaw: 5,
              pitch: -15,
              roll: 0,
            },
            vel: { x: 2, y: 0, z: 0 },
            cam: { fov: 72 },
            meta: { bat: 88, sat: 14, sig: 90 },
          },
        },
        {
          t_ms: 0,
          channel: 'drone',
          payload: {
            ts: 0,
            seq: 2,
            id: '2',
            ntp_synced: true,
            ntp_err_ms: 0,
            pos: { lat: 41.00865, lon: 28.9789, alt: 48 },
            rot: {
              x: 0,
              y: 0,
              z: 0,
              w: 1,
              yaw: 45,
              pitch: 1,
              roll: 0.5,
            },
            gimbal: {
              x: 0,
              y: 0,
              z: 0,
              w: 1,
              yaw: 50,
              pitch: -14,
              roll: 0,
            },
            vel: { x: 1.5, y: 0.5, z: 0 },
            cam: { fov: 72 },
            meta: { bat: 87, sat: 14, sig: 90 },
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
    const povIds = new Set<string>()
    bus.on('drone', (drone) => povIds.add(drone.id))

    const source = new ReplayTelemetrySource({
      fixture: parsed.fixture,
      onPacket: (packet) => ingestPacket(packet, bus),
    })
    source.start()
    await vi.advanceTimersByTimeAsync(50)
    source.stop()

    expect(povIds.has('1')).toBe(true)
    expect(povIds.has('2')).toBe(true)
    expect(povIds.size).toBeGreaterThanOrEqual(2)
  })
})
