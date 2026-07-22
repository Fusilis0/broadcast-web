import type {
  BoatTelemetry,
  StreamAnchorMessage,
  TelemetryData,
  TelemetryQuaternion,
} from './types.ts'

/** Mock channel bands from architecture / dispatch. */
export const MOCK_DRONE_ID = '1'
export const MOCK_BOAT_ID = '21'

export type MockChannel = 'drone' | 'boat'

export type MockPacket = {
  channel: MockChannel
  jsonText: string
}

export type MockSourceOptions = {
  /** Pose tick rate (Hz). Default 15. */
  hz?: number
  /** How often to emit a stream_anchor for the drone channel (ms). Default 1500. */
  streamAnchorIntervalMs?: number
  onPacket?: (packet: MockPacket) => void
}

const IDENTITY_QUAT: TelemetryQuaternion = {
  x: 0,
  y: 0,
  z: 0,
  w: 1,
  yaw: 0,
  pitch: 0,
  roll: 0,
}

function eulerQuat(
  yaw: number,
  pitch: number,
  roll: number,
): TelemetryQuaternion {
  return { ...IDENTITY_QUAT, yaw, pitch, roll }
}

/**
 * Interval mock: one drone (`1`) + one boat (`21`), plus periodic `stream_anchor`.
 * Emits JSON text so ingest can run packets through the router.
 */
export class MockTelemetrySource {
  private readonly hz: number
  private readonly streamAnchorIntervalMs: number
  private readonly onPacket?: (packet: MockPacket) => void

  private timer: ReturnType<typeof setInterval> | null = null
  private anchorTimer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0
  private droneSeq = 0
  private running = false

  constructor(options: MockSourceOptions = {}) {
    this.hz = options.hz ?? 15
    this.streamAnchorIntervalMs = options.streamAnchorIntervalMs ?? 1500
    this.onPacket = options.onPacket
  }

  get isRunning(): boolean {
    return this.running
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.startedAt = performance.now()
    this.droneSeq = 0

    const periodMs = Math.max(16, Math.round(1000 / this.hz))
    this.timer = setInterval(() => this.tickPose(), periodMs)
    this.anchorTimer = setInterval(
      () => this.tickStreamAnchor(),
      this.streamAnchorIntervalMs,
    )

    // Immediate first samples so subscribers see data without waiting a tick.
    this.tickPose()
    this.tickStreamAnchor()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.anchorTimer !== null) {
      clearInterval(this.anchorTimer)
      this.anchorTimer = null
    }
  }

  private elapsedSec(): number {
    return (performance.now() - this.startedAt) / 1000
  }

  private tickPose(): void {
    const t = this.elapsedSec()
    this.emit('drone', JSON.stringify(this.buildDrone(t)))
    this.emit('boat', JSON.stringify(this.buildBoat(t)))
  }

  private tickStreamAnchor(): void {
    this.emit('drone', JSON.stringify(this.buildStreamAnchor()))
  }

  private emit(channel: MockChannel, jsonText: string): void {
    this.onPacket?.({ channel, jsonText })
  }

  private buildDrone(t: number): TelemetryData {
    this.droneSeq += 1
    const yaw = (t * 8) % 360
    const pitch = Math.sin(t * 0.4) * 3
    const roll = Math.sin(t * 0.25) * 1.5
    const gimbalYaw = yaw + Math.sin(t * 0.2) * 5
    const gimbalPitch = -15 + Math.sin(t * 0.35) * 4

    return {
      ts: Date.now(),
      seq: this.droneSeq,
      id: MOCK_DRONE_ID,
      ntp_synced: true,
      ntp_err_ms: 2,
      pos: {
        lat: 41.0082 + Math.sin(t * 0.05) * 0.0008,
        lon: 28.9784 + Math.cos(t * 0.05) * 0.0008,
        alt: 45 + Math.sin(t * 0.15) * 2,
      },
      rot: eulerQuat(yaw, pitch, roll),
      gimbal: eulerQuat(gimbalYaw, gimbalPitch, 0),
      vel: {
        x: Math.cos(t * 0.05) * 2,
        y: Math.sin(t * 0.05) * 2,
        z: Math.cos(t * 0.15) * 0.2,
      },
      cam: { fov: 72 },
      meta: { bat: 88, sat: 14, sig: 90 },
    }
  }

  private buildBoat(t: number): BoatTelemetry {
    return {
      lat: 41.006 + Math.sin(t * 0.03) * 0.0012,
      lon: 28.98 + Math.cos(t * 0.03) * 0.0012,
      alt: 0.5 + Math.sin(t * 0.1) * 0.1,
      acc: 1.2,
      spd: 4 + Math.sin(t * 0.2) * 0.5,
      brg: (t * 12) % 360,
      time: Date.now(),
      id: MOCK_BOAT_ID,
      t_sync: true,
      t_err: 5,
    }
  }

  private buildStreamAnchor(): StreamAnchorMessage {
    return {
      type: 'stream_anchor',
      stream_id: MOCK_DRONE_ID,
      kind: 'periodic',
      fps: 30,
      pts_90khz: Math.floor(performance.now() * 90),
      ntp_capture_ms: Date.now(),
      ntp_synced: true,
      ntp_err_ms: 2,
    }
  }
}
