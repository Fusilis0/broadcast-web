import {
  createDefaultWindFrame,
  normalizeDirectionFromDeg,
} from './windDirection.ts'
import type { WindFrame, WindSource } from './windTypes.ts'

const WIND_SOURCES: readonly WindSource[] = [
  'operator',
  'api',
  'sensor',
  'default',
]

function isWindSource(value: string): value is WindSource {
  return (WIND_SOURCES as readonly string[]).includes(value)
}

function optionalNonNeg(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function sanitizeWindFrame(frame: WindFrame): WindFrame {
  const speedMs =
    Number.isFinite(frame.speedMs) && frame.speedMs >= 0 ? frame.speedMs : 0
  const gustMs = optionalNonNeg(frame.gustMs)
  const waveHeightM = optionalNonNeg(frame.waveHeightM)
  const wavePeriodS = optionalNonNeg(frame.wavePeriodS)
  const waveDirOk =
    frame.waveDirectionFromDeg !== undefined &&
    Number.isFinite(frame.waveDirectionFromDeg)
  const source = isWindSource(frame.source) ? frame.source : 'default'
  return {
    directionFromDeg: normalizeDirectionFromDeg(frame.directionFromDeg),
    speedMs,
    ...(gustMs !== undefined ? { gustMs } : {}),
    ...(waveHeightM !== undefined ? { waveHeightM } : {}),
    ...(waveDirOk
      ? {
          waveDirectionFromDeg: normalizeDirectionFromDeg(
            frame.waveDirectionFromDeg!,
          ),
        }
      : {}),
    ...(wavePeriodS !== undefined ? { wavePeriodS } : {}),
    source,
    updatedAtMs: Number.isFinite(frame.updatedAtMs)
      ? frame.updatedAtMs
      : Date.now(),
  }
}

type WindHandler = (frame: WindFrame) => void

/**
 * Sticky wind pub-sub. SCN ocean (14.2b) should `subscribe` here — not fetch.
 * `subscribe` replays the last snapshot immediately so the sea is never blank.
 */
export class WindBus {
  private snapshot: WindFrame | null = null
  private readonly listeners = new Set<WindHandler>()

  publish(frame: WindFrame): void {
    const next = sanitizeWindFrame(frame)
    this.snapshot = next
    for (const handler of this.listeners) handler(next)
  }

  subscribe(handler: WindHandler): () => void {
    this.listeners.add(handler)
    if (this.snapshot) handler(this.snapshot)
    return () => {
      this.listeners.delete(handler)
    }
  }

  getSnapshot(): WindFrame | null {
    return this.snapshot
  }

  /** Test helper — drops listeners and snapshot. */
  clear(): void {
    this.listeners.clear()
    this.snapshot = null
  }
}

/** Shared default bus. Seeded with 6 kt from 000° so the sea never blanks. */
export const windBus = new WindBus()
windBus.publish(createDefaultWindFrame())

/** Restore the shared bus to the venue default (tests). */
export function resetWindBusForTests(nowMs = Date.now()): void {
  windBus.clear()
  windBus.publish(createDefaultWindFrame(nowMs))
}
