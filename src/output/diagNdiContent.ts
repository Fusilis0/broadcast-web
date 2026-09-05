/**
 * DIAG:srt-fps — unique video content on AR NDI vs send count.
 *
 * Send fps counts transmissions. This stamps each AR capture with the
 * `present()` PTS/reason from the same `studio:tick` (present runs first)
 * and counts how many sends carried a new PTS vs a repeat of the last send.
 *
 * Round-4 frame-identity: monotonic frameSeq on unique present bind,
 * duplicate-run detector on AR capture/send, 2dGrab wall overlap, optional
 * PNG dump (`?ndiFrameDump=1`).
 */

export type DiagPresentStamp = {
  pts90k: number | null
  reason: string | null
  povId: string | null
  /** Monotonic unique-present bind seq (null until first unique bind). */
  frameSeq?: number | null
  wallMs?: number | null
}

export type DiagDuplicateRunEvent = {
  kind: 'capture' | 'send'
  runLen: number
  spanMs: number
  startWall: number
  endWall: number
  pts90k: number
  overlap2dGrabMs: number
  overlap2dGrab: boolean
}

export type DiagNdiContentWindow = {
  presentN: number
  presentMinClamp: number
  presentRepeat: number
  presentOther: number
  uniquePresentN: number
  captureN: number
  captureMinClamp: number
  captureRepeat: number
  captureOther: number
  captureNullPts: number
  sendN: number
  sendNewPts: number
  sendSamePts: number
  sendNullPts: number
  distinctPts: number
  sentPts: number[]
  captureReasons: Record<string, number>
  sendReasons: Record<string, number>
  /** Closed duplicate-runs this window (capture + send). */
  duplicateRuns: DiagDuplicateRunEvent[]
  captureDupRunN: number
  sendDupRunN: number
  captureDupRunOverlap2dN: number
  sendDupRunOverlap2dN: number
  captureDupRunMaxLen: number
  sendDupRunMaxLen: number
  grab2dStartN: number
  grab2dEndN: number
}

const SENT_PTS_CAP = 40
const DUP_EVENT_CAP = 64
const GRAB_WINDOW_CAP = 64
/** PNG dump threshold: >2× 30fps period or 3+ identical captures/sends. */
export const DUP_DUMP_RUN_LEN = 3
export const DUP_DUMP_SPAN_MS = 80

let lastPresent: DiagPresentStamp = {
  pts90k: null,
  reason: null,
  povId: null,
  frameSeq: null,
  wallMs: null,
}
const captureFifo: DiagPresentStamp[] = []
let lastSentPts: number | null = null
const distinct = new Set<number>()
const sentPts: number[] = []

let presentN = 0
let presentMinClamp = 0
let presentRepeat = 0
let presentOther = 0
let uniquePresentN = 0
let captureN = 0
let captureMinClamp = 0
let captureRepeat = 0
let captureOther = 0
let captureNullPts = 0
let sendN = 0
let sendNewPts = 0
let sendSamePts = 0
let sendNullPts = 0
const captureReasons: Record<string, number> = {}
const sendReasons: Record<string, number> = {}

let frameSeq = 0
let lastUniquePts: number | null = null

type RunState = {
  pts90k: number | null
  runLen: number
  startWall: number
  endWall: number
}

let captureRun: RunState = {
  pts90k: null,
  runLen: 0,
  startWall: 0,
  endWall: 0,
}
let sendRun: RunState = {
  pts90k: null,
  runLen: 0,
  startWall: 0,
  endWall: 0,
}

const closedDupEvents: DiagDuplicateRunEvent[] = []
let windowDupEvents: DiagDuplicateRunEvent[] = []
let captureDupRunN = 0
let sendDupRunN = 0
let captureDupRunOverlap2dN = 0
let sendDupRunOverlap2dN = 0
let captureDupRunMaxLen = 0
let sendDupRunMaxLen = 0
let grab2dStartN = 0
let grab2dEndN = 0
let grab2dSeq = 0

type GrabInterval = { start: number; end: number }
const closedGrabWindows: GrabInterval[] = []
let openGrabStart: number | null = null

let frameDumpWanted = false
let frameIdVerbose = false
let dumpHook: ((ev: DiagDuplicateRunEvent) => void) | null = null

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

function classifyReason(reason: string | null): 'min-clamp' | 'repeat' | 'other' {
  if (reason === 'min-clamp') return 'min-clamp'
  if (reason === 'repeat' || reason === 'pace-hold') return 'repeat'
  return 'other'
}

function copyStamp(s: DiagPresentStamp): DiagPresentStamp {
  return {
    pts90k: s.pts90k,
    reason: s.reason,
    povId: s.povId,
    frameSeq: s.frameSeq ?? null,
    wallMs: s.wallMs ?? null,
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function pushClosedGrab(iv: GrabInterval): void {
  closedGrabWindows.push(iv)
  while (closedGrabWindows.length > GRAB_WINDOW_CAP) closedGrabWindows.shift()
}

/** Interval intersection length (ms). Open grab extends to `until`. */
export function diag2dGrabOverlapMs(
  startWall: number,
  endWall: number,
  until: number = endWall,
): number {
  if (!(endWall >= startWall)) return 0
  let total = 0
  for (const iv of closedGrabWindows) {
    const a = Math.max(startWall, iv.start)
    const b = Math.min(endWall, iv.end)
    if (b > a) total += b - a
  }
  if (openGrabStart != null) {
    const a = Math.max(startWall, openGrabStart)
    const b = Math.min(endWall, until)
    if (b > a) total += b - a
  }
  return total
}

function emitDupEvent(ev: DiagDuplicateRunEvent): void {
  closedDupEvents.push(ev)
  while (closedDupEvents.length > DUP_EVENT_CAP) closedDupEvents.shift()
  windowDupEvents.push(ev)
  if (ev.kind === 'capture') {
    captureDupRunN += 1
    if (ev.overlap2dGrab) captureDupRunOverlap2dN += 1
    if (ev.runLen > captureDupRunMaxLen) captureDupRunMaxLen = ev.runLen
  } else {
    sendDupRunN += 1
    if (ev.overlap2dGrab) sendDupRunOverlap2dN += 1
    if (ev.runLen > sendDupRunMaxLen) sendDupRunMaxLen = ev.runLen
  }
  console.info(`[diag:frame-id] ${JSON.stringify({ stage: 'duplicate-run', ...ev })}`)
  if (
    frameDumpWanted &&
    (ev.runLen >= DUP_DUMP_RUN_LEN || ev.spanMs >= DUP_DUMP_SPAN_MS)
  ) {
    try {
      dumpHook?.(ev)
    } catch {
      /* ignore dump failures */
    }
  }
}

function closeRun(kind: 'capture' | 'send', run: RunState): void {
  if (run.pts90k == null || run.runLen < 2) return
  const overlapMs = diag2dGrabOverlapMs(run.startWall, run.endWall)
  emitDupEvent({
    kind,
    runLen: run.runLen,
    spanMs: Math.max(0, run.endWall - run.startWall),
    startWall: run.startWall,
    endWall: run.endWall,
    pts90k: run.pts90k,
    overlap2dGrabMs: overlapMs,
    overlap2dGrab: overlapMs > 0,
  })
}

function noteSample(
  kind: 'capture' | 'send',
  run: RunState,
  pts: number | null,
  wall: number,
): RunState {
  if (pts == null) {
    closeRun(kind, run)
    return { pts90k: null, runLen: 0, startWall: 0, endWall: 0 }
  }
  if (run.pts90k === pts && run.runLen > 0) {
    return {
      pts90k: pts,
      runLen: run.runLen + 1,
      startWall: run.startWall,
      endWall: wall,
    }
  }
  closeRun(kind, run)
  return { pts90k: pts, runLen: 1, startWall: wall, endWall: wall }
}

function parseFrameIdFlags(search?: string | URLSearchParams): void {
  if (typeof window === 'undefined' && search == null) return
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(
          (search ?? (typeof window !== 'undefined' ? window.location.search : '')).replace(
            /^\?/,
            '',
          ),
        )
  const dump = (params.get('ndiFrameDump') ?? '').trim().toLowerCase()
  frameDumpWanted = dump === '1' || dump === 'true' || dump === 'yes'
  const verbose = (params.get('ndiFrameId') ?? '').trim().toLowerCase()
  frameIdVerbose = verbose === 'verbose' || verbose === '1'
}

export function configureDiagNdiFrameId(
  opts: {
    search?: string | URLSearchParams
    onDump?: ((ev: DiagDuplicateRunEvent) => void) | null
  } = {},
): void {
  parseFrameIdFlags(opts.search)
  if (opts.onDump !== undefined) dumpHook = opts.onDump
}

export function isNdiFrameDumpEnabled(): boolean {
  if (typeof window !== 'undefined' && !frameDumpWanted) parseFrameIdFlags()
  return frameDumpWanted
}

export function resetDiagNdiContent(): void {
  lastPresent = {
    pts90k: null,
    reason: null,
    povId: null,
    frameSeq: null,
    wallMs: null,
  }
  captureFifo.length = 0
  lastSentPts = null
  distinct.clear()
  sentPts.length = 0
  presentN = 0
  presentMinClamp = 0
  presentRepeat = 0
  presentOther = 0
  uniquePresentN = 0
  captureN = 0
  captureMinClamp = 0
  captureRepeat = 0
  captureOther = 0
  captureNullPts = 0
  sendN = 0
  sendNewPts = 0
  sendSamePts = 0
  sendNullPts = 0
  for (const k of Object.keys(captureReasons)) delete captureReasons[k]
  for (const k of Object.keys(sendReasons)) delete sendReasons[k]
  frameSeq = 0
  lastUniquePts = null
  captureRun = { pts90k: null, runLen: 0, startWall: 0, endWall: 0 }
  sendRun = { pts90k: null, runLen: 0, startWall: 0, endWall: 0 }
  closedDupEvents.length = 0
  windowDupEvents = []
  captureDupRunN = 0
  sendDupRunN = 0
  captureDupRunOverlap2dN = 0
  sendDupRunOverlap2dN = 0
  captureDupRunMaxLen = 0
  sendDupRunMaxLen = 0
  grab2dStartN = 0
  grab2dEndN = 0
  grab2dSeq = 0
  closedGrabWindows.length = 0
  openGrabStart = null
  frameDumpWanted = false
  frameIdVerbose = false
  dumpHook = null
}

/**
 * Call from `present()` after the active POV’s pick for this tick.
 * Pass `unique: true` when shown PTS advanced (texture rebind).
 */
export function diagNotePresentTick(
  stamp: DiagPresentStamp,
  opts?: { unique?: boolean },
): void {
  const wall = stamp.wallMs ?? nowMs()
  let seq = lastPresent.frameSeq ?? null
  const unique =
    opts?.unique !== undefined
      ? opts.unique
      : stamp.pts90k != null && stamp.pts90k !== lastUniquePts
  if (unique && stamp.pts90k != null) {
    frameSeq += 1
    seq = frameSeq
    lastUniquePts = stamp.pts90k
    uniquePresentN += 1
    if (frameIdVerbose) {
      console.info(
        `[diag:frame-id] ${JSON.stringify({
          stage: 'present-bind',
          frameSeq: seq,
          pts90k: stamp.pts90k,
          wallMs: wall,
          reason: stamp.reason,
          povId: stamp.povId,
        })}`,
      )
    }
  }
  lastPresent = {
    pts90k: stamp.pts90k,
    reason: stamp.reason,
    povId: stamp.povId,
    frameSeq: seq,
    wallMs: wall,
  }
  presentN += 1
  const kind = classifyReason(stamp.reason)
  if (kind === 'min-clamp') presentMinClamp += 1
  else if (kind === 'repeat') presentRepeat += 1
  else presentOther += 1
}

/**
 * Call when AR readback `begin` succeeds (FBO just rendered this tick’s
 * presented texture). FIFO matches PBO drain order.
 */
export function diagNoteArCaptureBegin(wallMs?: number): DiagPresentStamp {
  const wall = wallMs ?? nowMs()
  const stamp = copyStamp(lastPresent)
  stamp.wallMs = wall
  captureFifo.push(stamp)
  captureN += 1
  if (stamp.pts90k == null) captureNullPts += 1
  const kind = classifyReason(stamp.reason)
  if (kind === 'min-clamp') captureMinClamp += 1
  else if (kind === 'repeat') captureRepeat += 1
  else captureOther += 1
  bump(captureReasons, stamp.reason ?? 'null')
  captureRun = noteSample('capture', captureRun, stamp.pts90k, wall)
  if (frameIdVerbose) {
    console.info(
      `[diag:frame-id] ${JSON.stringify({
        stage: 'ar-capture',
        frameSeq: stamp.frameSeq ?? null,
        pts90k: stamp.pts90k,
        wallMs: wall,
        reason: stamp.reason,
      })}`,
    )
  }
  return stamp
}

/** Consume the oldest capture stamp when that PBO’s pixels are packed. */
export function diagTakeArCaptureStamp(): DiagPresentStamp {
  return captureFifo.shift() ?? copyStamp(lastPresent)
}

/** Call when `sendStudioNdiFrame` actually runs for AR. */
export function diagNoteArSend(
  stamp: DiagPresentStamp | null | undefined,
  wallMs?: number,
): void {
  sendN += 1
  const pts = stamp?.pts90k ?? null
  const reason = stamp?.reason ?? null
  const wall = wallMs ?? nowMs()
  bump(sendReasons, reason ?? 'null')
  sendRun = noteSample('send', sendRun, pts, wall)
  if (frameIdVerbose) {
    console.info(
      `[diag:frame-id] ${JSON.stringify({
        stage: 'ar-send',
        frameSeq: stamp?.frameSeq ?? null,
        pts90k: pts,
        wallMs: wall,
        reason,
      })}`,
    )
  }
  if (pts == null) {
    sendNullPts += 1
    return
  }
  if (sentPts.length >= SENT_PTS_CAP) sentPts.shift()
  sentPts.push(pts)
  distinct.add(pts)
  if (lastSentPts === pts) sendSamePts += 1
  else sendNewPts += 1
  lastSentPts = pts
}

/**
 * Reuse path from `diagMark2dGrabWall` — records open/closed intervals for
 * duplicate-run overlap (timestamp intersection).
 */
export function diagNote2dGrabWallWindow(active: boolean, wallMs?: number): void {
  const wall = wallMs ?? nowMs()
  if (active) {
    if (openGrabStart == null) openGrabStart = wall
    return
  }
  if (openGrabStart != null) {
    pushClosedGrab({ start: openGrabStart, end: wall })
    openGrabStart = null
  }
}

/** 2D channel grab start/end seq (map≠SRT PTS) for correlation timeline. */
export function diagNote2dGrabSeq(phase: 'start' | 'end', wallMs?: number): void {
  const wall = wallMs ?? nowMs()
  if (phase === 'start') {
    grab2dSeq += 1
    grab2dStartN += 1
    if (frameIdVerbose) {
      console.info(
        `[diag:frame-id] ${JSON.stringify({
          stage: '2d-grab',
          phase: 'start',
          grabSeq: grab2dSeq,
          wallMs: wall,
        })}`,
      )
    }
    return
  }
  grab2dEndN += 1
  if (frameIdVerbose) {
    console.info(
      `[diag:frame-id] ${JSON.stringify({
        stage: '2d-grab',
        phase: 'end',
        grabSeq: grab2dSeq,
        wallMs: wall,
      })}`,
    )
  }
}

export function peekLastPresentPts(): number | null {
  return lastPresent.pts90k
}

export function peekArCaptureRunLen(): number {
  return captureRun.runLen
}

export function peekDiagDuplicateRuns(): readonly DiagDuplicateRunEvent[] {
  return closedDupEvents
}

export function takeDiagNdiContentWindow(): DiagNdiContentWindow {
  // Open runs stay open across 1 Hz windows; only PTS change closes them.
  const snap: DiagNdiContentWindow = {
    presentN,
    presentMinClamp,
    presentRepeat,
    presentOther,
    uniquePresentN,
    captureN,
    captureMinClamp,
    captureRepeat,
    captureOther,
    captureNullPts,
    sendN,
    sendNewPts,
    sendSamePts,
    sendNullPts,
    distinctPts: distinct.size,
    sentPts: [...sentPts],
    captureReasons: { ...captureReasons },
    sendReasons: { ...sendReasons },
    duplicateRuns: [...windowDupEvents],
    captureDupRunN,
    sendDupRunN,
    captureDupRunOverlap2dN,
    sendDupRunOverlap2dN,
    captureDupRunMaxLen,
    sendDupRunMaxLen,
    grab2dStartN,
    grab2dEndN,
  }
  presentN = 0
  presentMinClamp = 0
  presentRepeat = 0
  presentOther = 0
  uniquePresentN = 0
  captureN = 0
  captureMinClamp = 0
  captureRepeat = 0
  captureOther = 0
  captureNullPts = 0
  sendN = 0
  sendNewPts = 0
  sendSamePts = 0
  sendNullPts = 0
  distinct.clear()
  sentPts.length = 0
  for (const k of Object.keys(captureReasons)) delete captureReasons[k]
  for (const k of Object.keys(sendReasons)) delete sendReasons[k]
  windowDupEvents = []
  captureDupRunN = 0
  sendDupRunN = 0
  captureDupRunOverlap2dN = 0
  sendDupRunOverlap2dN = 0
  captureDupRunMaxLen = 0
  sendDupRunMaxLen = 0
  grab2dStartN = 0
  grab2dEndN = 0
  return snap
}
