import { CINEMATIC_FPS } from './constants.ts'
import {
  createCinematicClock,
  quantizeCinematicTime,
  type CinematicClockHandle,
} from './clock.ts'
import {
  defaultCinematicGeo,
  evaluateCinematicAt,
  type CinematicGeo,
} from './evaluate.ts'
import type { CinematicSample, CinematicSequence } from './types.ts'

export type CinematicTransport = {
  active: boolean
  playing: boolean
  tSec: number
  sampleTSec: number
  durationSec: number
  fps: number
  sequenceId: string | null
}

export type CinematicPlayerHandle = {
  load: (sequence: CinematicSequence | null) => void
  getSequence: () => CinematicSequence | null
  play: (nowMs?: number) => void
  pause: () => void
  seek: (tSec: number) => void
  stop: () => void
  isPlaying: () => boolean
  isActive: () => boolean
  getTimeSec: () => number
  /**
   * Wall-clock sync → quantized sample. Null when no sequence / inactive.
   */
  sync: (nowMs?: number) => CinematicSample | null
  sampleAt: (tSec: number) => CinematicSample | null
  getTransport: () => CinematicTransport
}

export type CreateCinematicPlayerOptions = {
  geo?: CinematicGeo
  fps?: number
}

/**
 * Sequence transport. Does not own tiles or WebGL — createScene applies the sample.
 */
export function createCinematicPlayer(
  options: CreateCinematicPlayerOptions = {},
): CinematicPlayerHandle {
  const geo = options.geo ?? defaultCinematicGeo
  const fps = options.fps ?? CINEMATIC_FPS
  const clock: CinematicClockHandle = createCinematicClock(fps)
  let sequence: CinematicSequence | null = null
  let active = false

  function sampleAt(tSec: number): CinematicSample | null {
    if (!sequence) return null
    return evaluateCinematicAt(sequence, tSec, geo)
  }

  return {
    load(next: CinematicSequence | null): void {
      sequence = next
      clock.reset()
      if (next) {
        clock.setDuration(next.durationSec)
      } else {
        active = false
      }
    },
    getSequence: () => sequence,
    play(nowMs?: number): void {
      if (!sequence) return
      active = true
      clock.play(nowMs)
    },
    pause(): void {
      clock.pause()
    },
    seek(tSec: number): void {
      if (!sequence) return
      active = true
      clock.seek(tSec)
    },
    stop(): void {
      clock.pause()
      clock.seek(0)
      active = false
    },
    isPlaying: () => clock.isPlaying(),
    isActive: () => active,
    getTimeSec: () => clock.getTimeSec(),
    sync(nowMs?: number): CinematicSample | null {
      if (!sequence || !active) return null
      const t = clock.sync(nowMs)
      return evaluateCinematicAt(sequence, t, geo)
    },
    sampleAt,
    getTransport(): CinematicTransport {
      const durationSec = sequence?.durationSec ?? 0
      return {
        active,
        playing: clock.isPlaying(),
        tSec: clock.getTimeSec(),
        sampleTSec: quantizeCinematicTime(clock.getTimeSec(), durationSec, fps),
        durationSec,
        fps,
        sequenceId: sequence?.id ?? null,
      }
    },
  }
}
