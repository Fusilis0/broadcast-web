import type { MockPacket } from './mockSource.ts'
import type { ReplayFixtureV1 } from './replayFixture.ts'

export type ReplaySourceOptions = {
  fixture: ReplayFixtureV1
  onPacket?: (packet: MockPacket) => void
}

/**
 * Plays a v1 replay fixture onto the ingest path via timers.
 * `start` / `stop` clear pending timeouts; supports `fixture.loop`.
 */
export class ReplayTelemetrySource {
  private readonly fixture: ReplayFixtureV1
  private readonly onPacket?: (packet: MockPacket) => void

  private timers: ReturnType<typeof setTimeout>[] = []
  private running = false

  constructor(options: ReplaySourceOptions) {
    this.fixture = options.fixture
    this.onPacket = options.onPacket
  }

  get isRunning(): boolean {
    return this.running
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.schedulePass()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.clearTimers()
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

  private schedulePass(): void {
    if (!this.running) return

    const { packets, loop } = this.fixture
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
    }
  }
}
