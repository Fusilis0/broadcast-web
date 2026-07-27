import type {
  BoatTelemetry,
  StreamAnchorMessage,
  TelemetryData,
  TelemetryQuaternion,
} from './types.ts'

/**
 * Legacy single-drone constant (`"1"`). Prefer configured `povIds` /
 * `povIds[0]` for multi-POV mock; kept for callers that still import it.
 */
export const MOCK_DRONE_ID = '1'
/**
 * Legacy single-boat constant (`"21"`). Prefer configured `boatIds` /
 * `boatIds[0]` for multi-boat mock; kept for callers that still import it.
 */
export const MOCK_BOAT_ID = '21'

/** Default mock POV ids when `povIds` is omitted (matches committed config). */
export const DEFAULT_MOCK_POV_IDS: readonly string[] = ['1', '2']

/** Default mock fleet when `boatIds` is omitted (matches committed config). */
export const DEFAULT_MOCK_BOAT_IDS: readonly string[] = [
  '21',
  '22',
  '23',
  '24',
]

export type MockChannel = 'drone' | 'boat'

export type MockPacket = {
  channel: MockChannel
  jsonText: string
}

export type MockSourceOptions = {
  /** Pose tick rate (Hz). Default 15. */
  hz?: number
  /** How often to emit a stream_anchor for the primary POV (ms). Default 1500. */
  streamAnchorIntervalMs?: number
  /**
   * POV / drone+cam ids to emit each pose tick (`channel: 'drone'`). Default
   * `["1","2"]`. One packet per id; phase-offset so they are not stacked.
   * Periodic `stream_anchor` uses `povIds[0]` (primary POV).
   */
  povIds?: readonly string[]
  /**
   * Boat ids to emit each pose tick (`channel: 'boat'`). Default
   * `["21","22","23","24"]`. One packet per id; phase-offset so they are not stacked.
   */
  boatIds?: readonly string[]
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
 * Interval mock: one drone packet per `povIds` entry + one boat packet per
 * `boatIds` entry, plus periodic `stream_anchor` for `povIds[0]`. Emits JSON
 * text so ingest can run packets through the router.
 */
export class MockTelemetrySource {
  private readonly hz: number
  private readonly streamAnchorIntervalMs: number
  private readonly povIds: readonly string[]
  private readonly boatIds: readonly string[]
  private readonly onPacket?: (packet: MockPacket) => void

  private timer: ReturnType<typeof setInterval> | null = null
  private anchorTimer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0
  private droneSeq = 0
  private running = false

  constructor(options: MockSourceOptions = {}) {
    this.hz = options.hz ?? 15
    this.streamAnchorIntervalMs = options.streamAnchorIntervalMs ?? 1500
    this.povIds =
      options.povIds !== undefined && options.povIds.length > 0
        ? [...options.povIds]
        : [...DEFAULT_MOCK_POV_IDS]
    this.boatIds =
      options.boatIds !== undefined && options.boatIds.length > 0
        ? [...options.boatIds]
        : [...DEFAULT_MOCK_BOAT_IDS]
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
    for (let i = 0; i < this.povIds.length; i++) {
      const id = this.povIds[i]!
      this.emit('drone', JSON.stringify(this.buildDrone(t, id, i)))
    }
    for (let i = 0; i < this.boatIds.length; i++) {
      const id = this.boatIds[i]!
      this.emit('boat', JSON.stringify(this.buildBoat(t, id, i)))
    }
  }

  private tickStreamAnchor(): void {
    // Anchor for primary POV (`povIds[0]`) — not rotated across ids.
    this.emit('drone', JSON.stringify(this.buildStreamAnchor()))
  }

  private emit(channel: MockChannel, jsonText: string): void {
    this.onPacket?.({ channel, jsonText })
  }

  private buildDrone(t: number, id: string, index: number): TelemetryData {
    this.droneSeq += 1
    const phase = index * 0.7
    const latOff = index * 0.00045
    const lonOff = index * 0.0005
    const yaw = (t * 8 + index * 45) % 360
    const pitch = Math.sin(t * 0.4 + phase) * 3
    const roll = Math.sin(t * 0.25 + phase) * 1.5
    const gimbalYaw = yaw + Math.sin(t * 0.2 + phase) * 5
    const gimbalPitch = -15 + Math.sin(t * 0.35 + phase) * 4

    return {
      ts: Date.now(),
      seq: this.droneSeq,
      id,
      ntp_synced: true,
      ntp_err_ms: 2,
      pos: {
        lat: 41.0082 + latOff + Math.sin(t * 0.05 + phase) * 0.0008,
        lon: 28.9784 + lonOff + Math.cos(t * 0.05 + phase) * 0.0008,
        alt: 45 + index * 3 + Math.sin(t * 0.15 + phase) * 2,
      },
      rot: eulerQuat(yaw, pitch, roll),
      gimbal: eulerQuat(gimbalYaw, gimbalPitch, 0),
      vel: {
        x: Math.cos(t * 0.05 + phase) * 2,
        y: Math.sin(t * 0.05 + phase) * 2,
        z: Math.cos(t * 0.15 + phase) * 0.2,
      },
      cam: { fov: 72 },
      meta: { bat: 88 - index, sat: 14, sig: 90 },
    }
  }

  private buildBoat(t: number, id: string, index: number): BoatTelemetry {
    const phase = index * 0.55
    const latOff = index * 0.00035
    const lonOff = index * 0.0004
    return {
      lat: 41.006 + latOff + Math.sin(t * 0.03 + phase) * 0.0012,
      lon: 28.98 + lonOff + Math.cos(t * 0.03 + phase) * 0.0012,
      alt: 0.5 + Math.sin(t * 0.1 + phase) * 0.1,
      acc: 1.2,
      spd: 4 + Math.sin(t * 0.2 + phase) * 0.5,
      brg: (t * 12 + index * 40) % 360,
      time: Date.now(),
      id,
      t_sync: true,
      t_err: 5,
    }
  }

  private buildStreamAnchor(): StreamAnchorMessage {
    const primaryId = this.povIds[0] ?? MOCK_DRONE_ID
    return {
      type: 'stream_anchor',
      stream_id: primaryId,
      kind: 'periodic',
      fps: 30,
      pts_90khz: Math.floor(performance.now() * 90),
      ntp_capture_ms: Date.now(),
      ntp_synced: true,
      ntp_err_ms: 2,
    }
  }
}
