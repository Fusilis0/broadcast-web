import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  CINEMATIC_RECORD_COVER_BUDGET_MS,
  CINEMATIC_RECORD_FPS,
  CINEMATIC_RECORD_HEIGHT,
  CINEMATIC_RECORD_MIME_CANDIDATES,
  CINEMATIC_RECORD_WIDTH,
  cinematicRecordDefaultName,
  cinematicRecordNeedsRemux,
  cinematicRecordShouldStop,
  isCinematicRecordMp4Mime,
  pickCinematicRecordMime,
  refuseCinematicRecord,
  startCinematicRecord,
  type CinematicRecordTransport,
  type StartCinematicRecordInput,
} from './cinematicRecorder.ts'

function idleTransport(
  overrides: Partial<CinematicRecordTransport> = {},
): CinematicRecordTransport {
  return {
    active: false,
    playing: false,
    tSec: 0,
    durationSec: 2,
    sequenceId: 'intro-bosphorus',
    fps: 30,
    ...overrides,
  }
}

function stubInput(
  overrides: Partial<StartCinematicRecordInput> = {},
): StartCinematicRecordInput {
  return {
    isStudio: true,
    isCinematicActive: () => true,
    getTransport: () => idleTransport({ active: true }),
    canvas: {
      width: 1920,
      height: 1080,
      captureStream: () => {
        throw new Error('captureStream should not run')
      },
    },
    choosePath: async () => ({ ok: false, error: 'choose should not run' }),
    writeFile: async () => ({ ok: false, error: 'write should not run' }),
    onStatus: () => {},
    playCinematic: () => {
      throw new Error('play should not run')
    },
    ...overrides,
  }
}

describe('cinematicRecorder constants', () => {
  it('locks 1920×1080 at 30 fps', () => {
    expect(CINEMATIC_RECORD_FPS).toBe(30)
    expect(CINEMATIC_RECORD_WIDTH).toBe(1920)
    expect(CINEMATIC_RECORD_HEIGHT).toBe(1080)
  })

  it('prefers mp4/avc before webm in the mime list', () => {
    expect(CINEMATIC_RECORD_MIME_CANDIDATES[0]).toMatch(/^video\/mp4/)
    expect(
      CINEMATIC_RECORD_MIME_CANDIDATES.some((m) => m.startsWith('video/webm')),
    ).toBe(true)
    const mp4Index = CINEMATIC_RECORD_MIME_CANDIDATES.findIndex((m) =>
      m.startsWith('video/mp4'),
    )
    const webmIndex = CINEMATIC_RECORD_MIME_CANDIDATES.findIndex((m) =>
      m.startsWith('video/webm'),
    )
    expect(mp4Index).toBeGreaterThanOrEqual(0)
    expect(webmIndex).toBeGreaterThan(mp4Index)
  })
})

describe('pickCinematicRecordMime', () => {
  it('returns the first supported candidate', () => {
    const mime = pickCinematicRecordMime(
      (m) => m === 'video/mp4' || m.startsWith('video/webm'),
    )
    expect(mime).toBe('video/mp4')
  })

  it('returns null when nothing is supported', () => {
    expect(pickCinematicRecordMime(() => false)).toBeNull()
  })
})

describe('cinematicRecordDefaultName / remux', () => {
  it('defaults to intro-bosphorus.mp4', () => {
    expect(cinematicRecordDefaultName(null)).toBe('intro-bosphorus.mp4')
    expect(cinematicRecordDefaultName('')).toBe('intro-bosphorus.mp4')
    expect(cinematicRecordDefaultName('intro-bosphorus')).toBe(
      'intro-bosphorus.mp4',
    )
    expect(cinematicRecordDefaultName('_empty')).toBe('_empty.mp4')
  })

  it('flags webm for remux and mp4 as container-ready', () => {
    expect(isCinematicRecordMp4Mime('video/mp4;codecs=avc1.42E01E')).toBe(true)
    expect(cinematicRecordNeedsRemux('video/webm;codecs=vp9')).toBe(true)
    expect(cinematicRecordNeedsRemux('video/mp4')).toBe(false)
  })
})

describe('cinematicRecordShouldStop', () => {
  it('does not treat a mid-take remount pause as the end', () => {
    const pausedAtIstanbul = idleTransport({
      active: true,
      playing: false,
      tSec: 22,
      durationSec: 60,
    })
    expect(cinematicRecordShouldStop(pausedAtIstanbul, true)).toBe(false)
    expect(CINEMATIC_RECORD_COVER_BUDGET_MS).toBeGreaterThanOrEqual(20_000)
  })

  it('stops when the playhead reaches duration or the operator stops', () => {
    expect(
      cinematicRecordShouldStop(
        idleTransport({
          active: true,
          playing: false,
          tSec: 60,
          durationSec: 60,
        }),
        true,
      ),
    ).toBe(true)
    expect(
      cinematicRecordShouldStop(
        idleTransport({
          active: false,
          playing: false,
          tSec: 22,
          durationSec: 60,
        }),
        true,
      ),
    ).toBe(true)
    expect(
      cinematicRecordShouldStop(
        idleTransport({
          active: true,
          playing: true,
          tSec: 10,
          durationSec: 60,
        }),
        true,
      ),
    ).toBe(false)
  })
})

describe('refuseCinematicRecord', () => {
  it('refuses when cinematic is inactive', () => {
    expect(
      refuseCinematicRecord({ cinematicActive: false, isStudio: true }),
    ).toEqual({
      ok: false,
      reason: 'inactive',
      status: 'record: cinematic inactive',
    })
  })

  it('refuses web-only (no Electron) with desktop only', () => {
    expect(
      refuseCinematicRecord({ cinematicActive: true, isStudio: false }),
    ).toEqual({
      ok: false,
      reason: 'desktop-only',
      status: 'desktop only',
    })
  })

  it('allows an active studio take', () => {
    expect(
      refuseCinematicRecord({ cinematicActive: true, isStudio: true }),
    ).toEqual({ ok: true })
  })
})

describe('startCinematicRecord playhead', () => {
  it('keeps recording across a remount pause and stops at duration', async () => {
    class FakeRecorder {
      state = 'inactive'
      mimeType = 'video/webm'
      ondataavailable: ((ev: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      start(): void {
        this.state = 'recording'
        this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) })
      }
      stop(): void {
        this.state = 'inactive'
        this.onstop?.()
      }
    }
    let step = 0
    const result = await startCinematicRecord(
      stubInput({
        isCinematicActive: () => true,
        getTransport: () => {
          step += 1
          if (step < 3) {
            return idleTransport({
              active: true,
              playing: true,
              tSec: 10,
              durationSec: 60,
            })
          }
          if (step < 8) {
            return idleTransport({
              active: true,
              playing: false,
              tSec: 22,
              durationSec: 60,
            })
          }
          if (step < 12) {
            return idleTransport({
              active: true,
              playing: true,
              tSec: 40,
              durationSec: 60,
            })
          }
          return idleTransport({
            active: true,
            playing: false,
            tSec: 60,
            durationSec: 60,
          })
        },
        canvas: {
          width: 1920,
          height: 1080,
          captureStream: () =>
            ({
              getTracks: () => [],
              getAudioTracks: () => [],
              removeTrack: () => {},
            }) as unknown as MediaStream,
        },
        choosePath: async () => ({ ok: true, path: 'C:/tmp/intro-bosphorus.mp4' }),
        writeFile: async () => ({ ok: true, path: 'C:/tmp/intro-bosphorus.mp4' }),
        playCinematic: () => {},
        MediaRecorderCtor: FakeRecorder as unknown as typeof MediaRecorder,
        isTypeSupported: () => true,
        wait: async () => {},
        nowMs: () => {
          const n = step * 200
          return n
        },
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.path).toContain('intro-bosphorus.mp4')
  })
})

describe('startCinematicRecord', () => {
  it('refuses when cinematic inactive and does not capture', async () => {
    const choosePath = vi.fn()
    const playCinematic = vi.fn()
    const result = await startCinematicRecord(
      stubInput({
        isCinematicActive: () => false,
        choosePath,
        playCinematic,
      }),
    )
    expect(result).toMatchObject({
      ok: false,
      reason: 'inactive',
    })
    expect(choosePath).not.toHaveBeenCalled()
    expect(playCinematic).not.toHaveBeenCalled()
  })

  it('refuses when not studio', async () => {
    const result = await startCinematicRecord(
      stubInput({
        isStudio: false,
        isCinematicActive: () => true,
      }),
    )
    expect(result).toMatchObject({
      ok: false,
      reason: 'desktop-only',
      status: 'desktop only',
    })
  })
})

describe('cinematicRecorder module isolation', () => {
  it('does not import NDI', () => {
    const src = readFileSync(
      fileURLToPath(new URL('./cinematicRecorder.ts', import.meta.url)),
      'utf8',
    )
    const imports = [...src.matchAll(/^import .+$/gm)].map((m) => m[0])
    expect(imports.join('\n').toLowerCase()).not.toContain('ndi')
    expect(src).not.toMatch(/from ['"][^'"]*ndi/i)
  })
})
