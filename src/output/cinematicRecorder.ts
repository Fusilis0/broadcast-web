/**
 * Silent 1920×1080 30 fps MP4 from the opaque 3D canvas (Phase 21).
 * Capture is canvas MediaRecorder — not NDI, not SRT, no audio track.
 * Spline time comes from SCN’s cinematic transport; this module does not
 * advance the playhead from rAF.
 */

export const CINEMATIC_RECORD_FPS = 30
export const CINEMATIC_RECORD_WIDTH = 1920
export const CINEMATIC_RECORD_HEIGHT = 1080
/** Target video bitrate for 1080p30 (silent). */
export const CINEMATIC_RECORD_BITRATE = 12_000_000

export const CINEMATIC_RECORD_DEFAULT_ID = 'intro-bosphorus'

/**
 * Prefer H.264 MP4 (vMix). WebM is a fallback that Electron remuxes.
 * Order is load-bearing for `pickCinematicRecordMime`.
 */
export const CINEMATIC_RECORD_MIME_CANDIDATES: readonly string[] = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1.4D401F',
  'video/mp4;codecs=avc1.640028',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

export type CinematicRecordRefuseReason =
  | 'inactive'
  | 'desktop-only'
  | 'busy'
  | 'cancelled'
  | 'no-mime'
  | 'disk'
  | 'capture'

export type CinematicRecordRefuse = {
  ok: false
  reason: CinematicRecordRefuseReason
  status: string
}

export type CinematicRecordOk = {
  ok: true
  path: string
  mime: string
}

export type CinematicRecordResult = CinematicRecordOk | CinematicRecordRefuse

export type CinematicRecordTransport = {
  active: boolean
  playing: boolean
  tSec: number
  durationSec: number
  sequenceId: string | null
  fps: number
}

export type CinematicRecordCanvas = {
  captureStream: (frameRate?: number) => MediaStream
  width: number
  height: number
}

export type CinematicRecordPathResult =
  | { ok: true; path: string }
  | { ok: false; cancelled?: boolean; error?: string }

export type CinematicRecordWriteResult =
  | { ok: true; path: string }
  | { ok: false; error: string }

export type StartCinematicRecordInput = {
  isStudio: boolean
  isCinematicActive: () => boolean
  getTransport: () => CinematicRecordTransport
  canvas: CinematicRecordCanvas
  choosePath: (defaultName: string) => Promise<CinematicRecordPathResult>
  writeFile: (opts: {
    path: string
    mime: string
    bytes: ArrayBuffer
  }) => Promise<CinematicRecordWriteResult>
  onStatus: (msg: string) => void
  playCinematic: () => void
  MediaRecorderCtor?: typeof MediaRecorder
  isTypeSupported?: (mime: string) => boolean
  nowMs?: () => number
  wait?: (ms: number) => Promise<void>
}

let recording = false

export function isCinematicRecordBusy(): boolean {
  return recording
}

export function cinematicRecordDefaultName(sequenceId: string | null | undefined): string {
  const raw = typeof sequenceId === 'string' ? sequenceId.trim() : ''
  const safe = raw.replace(/[^a-zA-Z0-9._-]+/g, '')
  const id = safe !== '' ? safe : CINEMATIC_RECORD_DEFAULT_ID
  return id.toLowerCase().endsWith('.mp4') ? id : `${id}.mp4`
}

export function cinematicRecordNeedsRemux(mime: string): boolean {
  return !isCinematicRecordMp4Mime(mime)
}

export function isCinematicRecordMp4Mime(mime: string): boolean {
  const lower = mime.trim().toLowerCase()
  return lower.startsWith('video/mp4') || lower.includes('mp4;')
}

export function pickCinematicRecordMime(
  isTypeSupported: (mime: string) => boolean = defaultIsTypeSupported,
): string | null {
  for (const mime of CINEMATIC_RECORD_MIME_CANDIDATES) {
    if (isTypeSupported(mime)) return mime
  }
  return null
}

function defaultIsTypeSupported(mime: string): boolean {
  try {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof MediaRecorder.isTypeSupported === 'function' &&
      MediaRecorder.isTypeSupported(mime)
    )
  } catch {
    return false
  }
}

export function refuseCinematicRecord(input: {
  cinematicActive: boolean
  isStudio: boolean
  recording?: boolean
}): CinematicRecordRefuse | { ok: true } {
  if (input.recording === true) {
    return {
      ok: false,
      reason: 'busy',
      status: 'record: busy',
    }
  }
  if (!input.isStudio) {
    return {
      ok: false,
      reason: 'desktop-only',
      status: 'desktop only',
    }
  }
  if (!input.cinematicActive) {
    return {
      ok: false,
      reason: 'inactive',
      status: 'record: cinematic inactive',
    }
  }
  return { ok: true }
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function defaultNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function stopStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
  }
}

function stripAudioTracks(stream: MediaStream): void {
  for (const track of stream.getAudioTracks()) {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
    try {
      stream.removeTrack(track)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Record the studio canvas until SCN’s 30 Hz clock reaches `durationSec`.
 * Caller must `seekCinematic(0)` first so hide-race is on (`isCinematicActive`).
 */
export async function startCinematicRecord(
  input: StartCinematicRecordInput,
): Promise<CinematicRecordResult> {
  const refuse = refuseCinematicRecord({
    cinematicActive: input.isCinematicActive(),
    isStudio: input.isStudio,
    recording,
  })
  if (!refuse.ok) {
    input.onStatus(refuse.status)
    return refuse
  }

  const isTypeSupported = input.isTypeSupported ?? defaultIsTypeSupported
  const mime = pickCinematicRecordMime(isTypeSupported)
  if (mime == null) {
    const failed: CinematicRecordRefuse = {
      ok: false,
      reason: 'no-mime',
      status: 'record: no MediaRecorder mime',
    }
    input.onStatus(failed.status)
    return failed
  }

  recording = true
  let stream: MediaStream | null = null
  try {
    const transport = input.getTransport()
    const defaultName = cinematicRecordDefaultName(transport.sequenceId)
    let dest: CinematicRecordPathResult
    try {
      dest = await input.choosePath(defaultName)
    } catch (err) {
      const failed: CinematicRecordRefuse = {
        ok: false,
        reason: 'disk',
        status: diskStatus(err),
      }
      input.onStatus(failed.status)
      return failed
    }
    if (!dest.ok) {
      const failed: CinematicRecordRefuse = dest.cancelled
        ? { ok: false, reason: 'cancelled', status: 'cancelled' }
        : {
            ok: false,
            reason: 'disk',
            status: dest.error ? `disk: ${dest.error}` : 'disk: save cancelled',
          }
      input.onStatus(failed.status)
      return failed
    }

    const Recorder = input.MediaRecorderCtor ?? globalThis.MediaRecorder
    if (typeof Recorder !== 'function') {
      const failed: CinematicRecordRefuse = {
        ok: false,
        reason: 'capture',
        status: 'record: MediaRecorder missing',
      }
      input.onStatus(failed.status)
      return failed
    }

    const wait = input.wait ?? defaultWait
    const nowMs = input.nowMs ?? defaultNowMs
    let recorder: MediaRecorder | null = null

    try {
      stream = input.canvas.captureStream(CINEMATIC_RECORD_FPS)
    } catch (err) {
      const failed: CinematicRecordRefuse = {
        ok: false,
        reason: 'capture',
        status: captureStatus(err),
      }
      input.onStatus(failed.status)
      return failed
    }
    stripAudioTracks(stream)

    const chunks: Blob[] = []
    try {
      recorder = new Recorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: CINEMATIC_RECORD_BITRATE,
      })
    } catch {
      recorder = new Recorder(stream)
    }
    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data)
    }

    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve()
      recorder!.onerror = () => resolve()
    })

    input.onStatus('recording…')
    recorder.start(1000)
    input.playCinematic()

    const ended = await waitForSequenceEnd({
      getTransport: input.getTransport,
      wait,
      nowMs,
    })
    if (ended === 'timeout') {
      input.onStatus('record: timed out — stopping')
    } else {
      await wait(Math.round(2000 / CINEMATIC_RECORD_FPS))
    }

    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    await stopped

    const blob = new Blob(chunks, { type: recorder.mimeType || mime })
    if (blob.size <= 0) {
      const failed: CinematicRecordRefuse = {
        ok: false,
        reason: 'capture',
        status: 'record: empty capture',
      }
      input.onStatus(failed.status)
      return failed
    }

    input.onStatus('saving…')
    const bytes = await blob.arrayBuffer()
    let written: CinematicRecordWriteResult
    try {
      written = await input.writeFile({
        path: dest.path,
        mime: recorder.mimeType || mime,
        bytes,
      })
    } catch (err) {
      const failed: CinematicRecordRefuse = {
        ok: false,
        reason: 'disk',
        status: diskStatus(err),
      }
      input.onStatus(failed.status)
      return failed
    }
    if (!written.ok) {
      const failed: CinematicRecordRefuse = {
        ok: false,
        reason: 'disk',
        status: `disk: ${written.error}`,
      }
      input.onStatus(failed.status)
      return failed
    }

    const ok: CinematicRecordOk = {
      ok: true,
      path: written.path,
      mime: recorder.mimeType || mime,
    }
    input.onStatus(`saved ${ok.path}`)
    return ok
  } finally {
    stopStream(stream)
    recording = false
  }
}

const PLAY_WAIT_MS = 120_000
const END_GRACE_MS = 5_000
/** Globe→ENU cover can pause the 30 Hz clock for up to 20 s. Do not cut the MP4. */
export const CINEMATIC_RECORD_COVER_BUDGET_MS = 25_000

/**
 * Pause while the sequence is still active is the Istanbul remount, not the end.
 * Stop only when the playhead hits duration or the operator stops (inactive).
 */
export function cinematicRecordShouldStop(
  t: CinematicRecordTransport,
  seenPlaying: boolean,
): boolean {
  if (!seenPlaying) return false
  if (!t.active) return true
  return t.durationSec > 0 && t.tSec + 1e-4 >= t.durationSec
}

async function waitForSequenceEnd(opts: {
  getTransport: () => CinematicRecordTransport
  wait: (ms: number) => Promise<void>
  nowMs: () => number
}): Promise<'ended' | 'timeout'> {
  const pollMs = Math.round(1000 / CINEMATIC_RECORD_FPS)
  const playDeadline = opts.nowMs() + PLAY_WAIT_MS
  while (opts.nowMs() < playDeadline) {
    if (opts.getTransport().playing) break
    await opts.wait(pollMs)
  }
  const t0 = opts.getTransport()
  if (!t0.playing) {
    if (t0.durationSec > 0 && t0.tSec + 1e-4 >= t0.durationSec) return 'ended'
    return 'timeout'
  }

  const durationMs = Math.max(0, t0.durationSec) * 1000
  const endDeadline =
    opts.nowMs() + durationMs + CINEMATIC_RECORD_COVER_BUDGET_MS + END_GRACE_MS
  let seenPlaying = t0.playing
  while (opts.nowMs() < endDeadline) {
    const t = opts.getTransport()
    if (t.playing) seenPlaying = true
    if (cinematicRecordShouldStop(t, seenPlaying)) {
      return 'ended'
    }
    await opts.wait(pollMs)
  }
  return 'timeout'
}

function diskStatus(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return `disk: ${msg}`
}

function captureStatus(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return `record: ${msg}`
}
