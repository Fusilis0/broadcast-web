import { afterEach, describe, expect, it, vi } from 'vitest'
import { TelemetryBus } from './bus.ts'
import { ingestPacket, startTelemetryIngest } from './ingest.ts'
import { LiveTelemetrySource } from './liveSource.ts'
import type { MockPacket } from './mockSource.ts'

type Listener = ((ev?: unknown) => void) | null

/** Minimal injectable WebSocket for unit tests. */
class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  onopen: Listener = null
  onclose: Listener = null
  onmessage: Listener = null
  onerror: Listener = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
    queueMicrotask(() => {
      if (this.readyState !== FakeWebSocket.CONNECTING) return
      this.readyState = FakeWebSocket.OPEN
      this.onopen?.(new Event('open'))
    })
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }

  emitMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent)
  }
}

afterEach(() => {
  FakeWebSocket.instances = []
  vi.useRealTimers()
})

describe('LiveTelemetrySource', () => {
  it('text frame → onPacket with channel context', async () => {
    const packets: MockPacket[] = []
    const source = new LiveTelemetrySource({
      droneUrl: 'ws://example.invalid/drone',
      boatUrl: 'ws://example.invalid/boat',
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      onPacket: (p) => packets.push(p),
    })
    source.start()
    await Promise.resolve()

    const droneWs = FakeWebSocket.instances.find((w) =>
      w.url.includes('drone'),
    )
    const boatWs = FakeWebSocket.instances.find((w) => w.url.includes('boat'))
    expect(droneWs).toBeDefined()
    expect(boatWs).toBeDefined()

    droneWs!.emitMessage(
      JSON.stringify({
        id: '1',
        ts: 1,
        pos: { lat: 1, lon: 2, alt: 3 },
      }),
    )
    boatWs!.emitMessage(
      JSON.stringify({
        id: '21',
        lat: 4,
        lon: 5,
        time: 6,
      }),
    )

    expect(packets).toHaveLength(2)
    expect(packets[0]?.channel).toBe('drone')
    expect(packets[1]?.channel).toBe('boat')

    source.stop()
    expect(droneWs!.readyState).toBe(FakeWebSocket.CLOSED)
  })

  it('empty URLs soft-fail without throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const source = new LiveTelemetrySource({
      droneUrl: '',
      boatUrl: '',
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    })
    expect(() => source.start()).not.toThrow()
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    source.stop()
    warn.mockRestore()
  })

  it('stop cancels reconnect backoff', async () => {
    vi.useFakeTimers()
    const source = new LiveTelemetrySource({
      droneUrl: 'ws://example.invalid/drone',
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      initialBackoffMs: 100,
      maxBackoffMs: 400,
    })
    source.start()
    await vi.advanceTimersByTimeAsync(0)

    const first = FakeWebSocket.instances[0]
    expect(first).toBeDefined()
    first!.close()

    source.stop()
    const countAfterStop = FakeWebSocket.instances.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeWebSocket.instances.length).toBe(countAfterStop)
  })
})

describe('live ingest → bus', () => {
  it('drone / boat / stream_anchor emit on bus', async () => {
    const bus = new TelemetryBus()
    const drone: unknown[] = []
    const boat: unknown[] = []
    const anchors: unknown[] = []
    bus.on('drone', (p) => drone.push(p))
    bus.on('boat', (p) => boat.push(p))
    bus.on('stream_anchor', (p) => anchors.push(p))

    const handle = await startTelemetryIngest({
      mode: 'live',
      wsUrl: 'ws://example.invalid/drone',
      wsBoatUrl: 'ws://example.invalid/boat',
      bus,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    })
    await Promise.resolve()

    const droneWs = FakeWebSocket.instances.find((w) =>
      w.url.includes('drone'),
    )!
    const boatWs = FakeWebSocket.instances.find((w) =>
      w.url.includes('boat'),
    )!

    droneWs.emitMessage(
      JSON.stringify({
        id: '1',
        ts: 10,
        seq: 0,
        ntp_synced: false,
        ntp_err_ms: 0,
        pos: { lat: 41, lon: 29, alt: 10 },
        rot: { x: 0, y: 0, z: 0, w: 1, yaw: 0, pitch: 0, roll: 0 },
        gimbal: { x: 0, y: 0, z: 0, w: 1, yaw: 0, pitch: 0, roll: 0 },
        vel: { x: 0, y: 0, z: 0 },
        cam: { fov: 70 },
        meta: { bat: 1, sat: 1, sig: 1 },
      }),
    )
    boatWs.emitMessage(
      JSON.stringify({
        id: '21',
        lat: 41.01,
        lon: 29.01,
        alt: 0,
        acc: 1,
        spd: 0,
        brg: 0,
        time: 20,
        t_sync: false,
        t_err: 0,
      }),
    )
    droneWs.emitMessage(
      JSON.stringify({
        type: 'stream_anchor',
        stream_id: '1',
        kind: 'video',
        fps: 30,
        ntp_capture_ms: 1,
        ntp_synced: true,
        ntp_err_ms: 0,
      }),
    )

    expect(drone).toHaveLength(1)
    expect(boat).toHaveLength(1)
    expect(anchors).toHaveLength(1)

    handle.stop()
  })

  it('live + empty URL does not throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const bus = new TelemetryBus()
    const handle = await startTelemetryIngest({
      mode: 'live',
      wsUrl: '',
      wsBoatUrl: '',
      bus,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    })
    expect(handle.mode).toBe('live')
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(handle.getLiveStatus).toBeDefined()
    expect(handle.getLiveStatus?.()).toEqual({ drone: 'idle', boat: 'idle' })
    handle.stop()
    warn.mockRestore()
  })

  it('exposes getLiveStatus / onLiveStatus for live sockets', async () => {
    const bus = new TelemetryBus()
    const seen: { channel: string; status: string }[] = []
    const handle = await startTelemetryIngest({
      mode: 'live',
      wsUrl: 'ws://example.invalid/drone',
      wsBoatUrl: 'ws://example.invalid/boat',
      bus,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    })

    expect(handle.getLiveStatus).toBeDefined()
    expect(handle.onLiveStatus).toBeDefined()
    const unsub = handle.onLiveStatus!((channel, status) => {
      seen.push({ channel, status })
    })

    // FakeWebSocket opens on a microtask; flush then assert snapshot + listener.
    await Promise.resolve()
    expect(handle.getLiveStatus?.()).toEqual({ drone: 'open', boat: 'open' })

    const droneWs = FakeWebSocket.instances.find((w) =>
      w.url.includes('drone'),
    )!
    droneWs.close()
    expect(handle.getLiveStatus?.().drone).toBe('closed')
    expect(seen.some((e) => e.channel === 'drone' && e.status === 'closed')).toBe(
      true,
    )

    unsub()
    handle.stop()
    expect(handle.getLiveStatus?.()).toEqual({ drone: 'idle', boat: 'idle' })
  })

  it('mock/replay omit live status helpers', async () => {
    const bus = new TelemetryBus()
    const mock = await startTelemetryIngest({ mode: 'mock', bus })
    expect(mock.getLiveStatus).toBeUndefined()
    expect(mock.onLiveStatus).toBeUndefined()
    mock.stop()
  })

  it('ingestPacket still routes channel context', () => {
    const bus = new TelemetryBus()
    const drone: unknown[] = []
    bus.on('drone', (p) => drone.push(p))
    ingestPacket(
      {
        channel: 'drone',
        jsonText: JSON.stringify({
          id: '1',
          ts: 1,
          pos: { lat: 0, lon: 0, alt: 0 },
        }),
      },
      bus,
    )
    expect(drone).toHaveLength(1)
  })
})
