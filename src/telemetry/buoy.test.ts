import { afterEach, describe, expect, it, vi } from 'vitest'
import { TelemetryBus } from './bus.ts'
import { ingestPacket } from './ingest.ts'
import { MockTelemetrySource, MOCK_BUOY_ID } from './mockSource.ts'
import type { BoatTelemetry, BuoyTelemetry } from './types.ts'

describe('mock buoy channel', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits no buoy packets when buoyIds is empty/absent', () => {
    const buoyPackets: BuoyTelemetry[] = []
    const source = new MockTelemetrySource({
      boatIds: ['21'],
      onPacket: (packet) => {
        if (packet.channel === 'buoy') {
          buoyPackets.push(JSON.parse(packet.jsonText) as BuoyTelemetry)
        }
      },
    })
    source.start()
    source.stop()
    expect(buoyPackets).toHaveLength(0)
  })

  it('emits configured buoy ids on channel buoy (boat-shaped)', () => {
    vi.useFakeTimers()
    const seen = new Set<string>()
    const shapes: BuoyTelemetry[] = []
    const source = new MockTelemetrySource({
      hz: 10,
      boatIds: ['21'],
      buoyIds: [MOCK_BUOY_ID, '92'],
      onPacket: (packet) => {
        if (packet.channel !== 'buoy') return
        const payload = JSON.parse(packet.jsonText) as BuoyTelemetry
        seen.add(payload.id)
        shapes.push(payload)
      },
    })
    source.start()
    vi.advanceTimersByTime(100)
    source.stop()

    expect([...seen].sort()).toEqual(['91', '92'])
    expect(shapes[0]!.lat).toBeTypeOf('number')
    expect(shapes[0]!.lon).toBeTypeOf('number')
    expect(shapes[0]!.time).toBeTypeOf('number')
  })
})

describe('ingest buoy classification', () => {
  it('routes channel buoy to bus buoy', () => {
    const bus = new TelemetryBus()
    const buoyIds: string[] = []
    const boatIds: string[] = []
    bus.on('buoy', (b) => buoyIds.push(b.id))
    bus.on('boat', (b) => boatIds.push(b.id))

    const payload: BoatTelemetry = {
      lat: 41.007,
      lon: 28.979,
      alt: 0.3,
      acc: 1,
      spd: 0.5,
      brg: 10,
      time: 1_000,
      id: MOCK_BUOY_ID,
      t_sync: true,
      t_err: 0,
    }
    ingestPacket({ channel: 'buoy', jsonText: JSON.stringify(payload) }, bus)

    expect(buoyIds).toEqual([MOCK_BUOY_ID])
    expect(boatIds).toEqual([])
  })

  it('routes boat-channel packet to buoy when id is in buoyIds allow-list', () => {
    const bus = new TelemetryBus()
    const buoyIds: string[] = []
    const boatIds: string[] = []
    bus.on('buoy', (b) => buoyIds.push(b.id))
    bus.on('boat', (b) => boatIds.push(b.id))

    const buoyPayload: BoatTelemetry = {
      lat: 41.007,
      lon: 28.979,
      alt: 0.3,
      acc: 1,
      spd: 0.5,
      brg: 10,
      time: 1_000,
      id: '91',
      t_sync: true,
      t_err: 0,
    }
    const boatPayload: BoatTelemetry = {
      ...buoyPayload,
      id: '21',
    }

    ingestPacket(
      { channel: 'boat', jsonText: JSON.stringify(buoyPayload) },
      bus,
      { buoyIds: ['91'] },
    )
    ingestPacket(
      { channel: 'boat', jsonText: JSON.stringify(boatPayload) },
      bus,
      { buoyIds: ['91'] },
    )

    expect(buoyIds).toEqual(['91'])
    expect(boatIds).toEqual(['21'])
  })

  it('does not open buoy routing when buoyIds allow-list is empty', () => {
    const bus = new TelemetryBus()
    const buoyIds: string[] = []
    const boatIds: string[] = []
    bus.on('buoy', (b) => buoyIds.push(b.id))
    bus.on('boat', (b) => boatIds.push(b.id))

    const payload: BoatTelemetry = {
      lat: 41.007,
      lon: 28.979,
      alt: 0.3,
      acc: 1,
      spd: 0.5,
      brg: 10,
      time: 1_000,
      id: '91',
      t_sync: true,
      t_err: 0,
    }
    ingestPacket(
      { channel: 'boat', jsonText: JSON.stringify(payload) },
      bus,
      { buoyIds: [] },
    )

    expect(buoyIds).toEqual([])
    expect(boatIds).toEqual(['91'])
  })
})
