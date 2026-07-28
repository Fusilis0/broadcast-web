import type { MockPacket } from './mockSource.ts'
import type { ReplayFixtureV1 } from './replayFixture.ts'

/** Snapshot for HUD / ops (not wired to SCN in this slice). */
export type ReplayStatus = 'idle' | 'playing' | 'ended' | 'error'

export type ReplaySourceOptions = {
  fixture: ReplayFixtureV1
  onPacket?: (packet: MockPacket) => void
  /**
   * Override fixture.loop when set. Omit → use `fixture.loop`.
   * Committed sample fixtures use `loop: true`.
   */
  loop?: boolean
}

/**
 * Plays a v1 replay fixture onto the ingest path via timers.
 * `start` / `stop` clear pending timeouts; supports looping (fixture or override).
 * One-shot fixtures end in `ended`; call `start()` again (or stop→start) to restart.
 */
export class ReplayTelemetrySource {
  private readonly fixture: ReplayFixtureV1
  private readonly onPacket?: (packet: MockPacket) => void
  private readonly loopOverride: boolean | undefined

  private timers: ReturnType<typeof setTimeout>[] = []
  private running = false
  private status: ReplayStatus = 'idle'

  constructor(options: ReplaySourceOptions) {
    this.fixture = options.fixture
    this.onPacket = options.onPacket
    this.loopOverride = options.loop
  }

  get isRunning(): boolean {
    return this.running
  }

  /** Current playback state (`idle` | `playing` | `ended` | `error`). */
  getStatus(): ReplayStatus {
    return this.status
  }

  /** Effective loop flag (option override, else fixture.loop). */
  get loops(): boolean {
    return this.loopOverride !== undefined
      ? this.loopOverride
      : this.fixture.loop
  }

  start(): void {
    if (this.running) return
    this.clearTimers()
    this.running = true
    this.status = 'playing'
    this.schedulePass()
  }

  stop(): void {
    this.running = false
    this.clearTimers()
    this.status = 'idle'
  }

  private clearTimers(): void {
    for (const id of this.timers) {
      clearTimeout(id)
    }
    this.timers = []
  }

  private emitPacket(packet: ReplayFixtureV1['packets'][number]): void {
    this.onPacket?.({
      channel: packet.channel,
      jsonText: JSON.stringify(packet.payload),
    })
  }

  private finishOneShot(): void {
    if (!this.running) return
    this.running = false
    this.clearTimers()
    this.status = 'ended'
  }

  private schedulePass(): void {
    if (!this.running) return

    const { packets } = this.fixture
    const loop = this.loops
    const lastTMs = packets[packets.length - 1]?.t_ms ?? 0

    for (const packet of packets) {
      if (packet.t_ms === 0) {
        // Immediate (same as mock first sample) — works with fake timers without advance(0).
        this.emitPacket(packet)
        continue
      }
      const id = setTimeout(() => {
        if (!this.running) return
        this.emitPacket(packet)
      }, packet.t_ms)
      this.timers.push(id)
    }

    if (loop) {
      // Period is fixture duration; floor at 1ms so all-at-0 fixtures cannot spin sync.
      const periodMs = Math.max(lastTMs, 1)
      const loopId = setTimeout(() => {
        if (!this.running) return
        // Drop completed pass timers; schedule the next iteration.
        this.clearTimers()
        this.schedulePass()
      }, periodMs)
      this.timers.push(loopId)
    } else {
      // One-shot: after last packet time, mark ended so start() can restart cleanly.
      const endId = setTimeout(() => {
        this.finishOneShot()
      }, Math.max(lastTMs, 0))
      this.timers.push(endId)
    }
  }
}
