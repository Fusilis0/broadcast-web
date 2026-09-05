/**
 * Off-tick NDI `sendFrame` (DSP-OUT-20260829-04).
 *
 * `ipcRenderer.send` of an 8 MB RGBA frame is a synchronous structured clone.
 * Running it inside the `studio:tick` subscriber is why `totalTick` max was
 * 80 ms and the clock collapsed to ~50 Hz. Copy/steal pixels on the tick,
 * then `setTimeout(0)` the send so the tick returns after FBO + PBO begin/poll.
 *
 * Keep-newest-of-N: hold up to `maxPending` frames in arrival order. Overflow
 * drops the oldest. When the deferred timer fires, drain the whole short
 * queue in order (oldest first). Default N=1 (legacy latest-wins). AR/3D use
 * N=2. Recovered frames can be up to ~one capture interval (~31 ms) older
 * than the newest held slot. Killswitch: `?ndiQueueDepth=1`.
 */

import { diagNote2dGrabWallWindow } from './diagNdiContent.ts'
import { debugSessionLog, type NdiChannelId } from './studioBridge.ts'

export type NdiDeferredFrame = {
  width: number
  height: number
  data: ArrayBuffer
  bottomUp: boolean
  pixelFormat?: 'rgba' | 'uyvy' | 'uyva'
  /** DIAG:srt-fps — present() PTS/reason from the capture tick. */
  contentPts90k?: number | null
  contentReason?: string | null
}

export type NdiDeferredSend = {
  /** Queue a frame. Tick-safe: does not call `send`. */
  enqueue(frame: NdiDeferredFrame): void
  /** True while a macrotask send is scheduled (not while send is running). */
  isScheduled(): boolean
  dispose(): void
}

export type CreateNdiDeferredSendOptions = {
  send: (frame: NdiDeferredFrame) => void
  /** Recycle the buffer after send, or when a newer frame replaces it. */
  release?: (data: ArrayBuffer) => void
  /**
   * How to leave the studio-tick stack. Default `setTimeout(0)` (macrotask)
   * so queued `studio:tick` IPC can run; `queueMicrotask` still delays the
   * next tick.
   */
  defer?: (fn: () => void) => void
  /** DIAG:srt-fps — channel id for eviction / queue-wait accounting. */
  channel?: NdiChannelId
  /**
   * Pending frames before overflow drops the oldest. Clamped to 1 or 2.
   * Default 1. `?ndiQueueDepth=1` forces 1.
   */
  maxPending?: number
}

export type NdiDeferKind = 'timeout' | 'immediate' | 'microtask'

/** DIAG:srt-fps — `?ndiDefer=immediate|microtask` (default `timeout` = setTimeout(0)). */
export function parseNdiDefer(search: string | URLSearchParams): NdiDeferKind {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const raw = (params.get('ndiDefer') ?? '').trim().toLowerCase()
  if (raw === 'immediate' || raw === 'setimmediate' || raw === 'messagechannel') {
    return 'immediate'
  }
  if (raw === 'microtask' || raw === 'queuemicrotask' || raw === 'nexttick') {
    return 'microtask'
  }
  return 'timeout'
}

/**
 * DIAG:srt-fps — `?ndiQueueDepth=1` restores single-slot latest-wins.
 * Any other / omitted value leaves the caller’s `maxPending` (clamped 1–2).
 */
export function parseNdiQueueDepth(search: string | URLSearchParams): 1 | null {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const raw = (params.get('ndiQueueDepth') ?? '').trim()
  if (raw === '1') return 1
  return null
}

function resolveMaxPending(requested: number | undefined): 1 | 2 {
  const want = requested != null && requested >= 2 ? 2 : 1
  if (typeof window === 'undefined') return want
  return parseNdiQueueDepth(window.location.search) ?? want
}

/** Browser stand-in for Node `setImmediate` (MessageChannel macrotask). */
export function deferNdiSendImmediate(fn: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(fn)
    return
  }
  const ch = new MessageChannel()
  ch.port1.onmessage = () => {
    fn()
  }
  ch.port2.postMessage(null)
}

export function deferNdiSendOffTick(fn: () => void): void {
  setTimeout(fn, 0)
}

function resolveDefaultDefer(): (fn: () => void) => void {
  const kind =
    typeof window !== 'undefined'
      ? parseNdiDefer(window.location.search)
      : 'timeout'
  if (kind === 'immediate') return deferNdiSendImmediate
  if (kind === 'microtask') return (fn) => queueMicrotask(fn)
  return deferNdiSendOffTick
}

/**
 * Take the underlying ArrayBuffer without `ArrayBuffer.slice`.
 * Pixel-ring views are whole buffers; a non-full view is copied via `set`.
 */
export function takeNdiArrayBuffer(buf: Uint8Array): ArrayBuffer {
  const raw = buf.buffer
  if (
    buf.byteOffset === 0 &&
    raw instanceof ArrayBuffer &&
    buf.byteLength === raw.byteLength
  ) {
    return raw
  }
  const copy = new Uint8Array(buf.byteLength)
  copy.set(buf)
  return copy.buffer
}

type PendingSlot = {
  frame: NdiDeferredFrame
  enqueuedAt: number
  enqueuedTick: number
  enqueuedTask: string
}

export type DeferredEvictSample = {
  waitMs: number
  inFlightMs: number | null
  duringSend: boolean
  awaitingMacrotask: boolean
  duringGrabWall: boolean
  duringGrabBitmap: boolean
  afterGrabMs: number | null
  bytes: number
  preceding: string
  ticksDuringWait: number
}

export type DeferredChannelDiag = {
  enqueueN: number
  sendN: number
  evictN: number
  bytes: number
  bytesAfterSend: number
  sendMsSum: number
  sendMsMax: number
  queueWaitSum: number
  queueWaitMax: number
  queueWaitOver8: number
  queueWaitOver16: number
  queueWaitOver31: number
  evictWaitSum: number
  evictWaitMax: number
  evictDuringSend: number
  evictAwaitingMacrotask: number
  evictDuringGrabWall: number
  evictDuringGrabBitmap: number
  evictAfterGrab8ms: number
  inFlightAtEvictSum: number
  inFlightAtEvictMax: number
  inFlightAtEvictN: number
  evictWaitBuckets: Record<string, number>
  samples: DeferredEvictSample[]
  preceding: Record<string, number>
  precedingLate: Record<string, number>
  flushPreceding: Record<string, number>
  flushPrecedingLate: Record<string, number>
  ticksDuringWaitSum: number
  ticksDuringWaitMax: number
  flushInTickN: number
  enqueueInTickN: number
  msSinceTickEndSum: number
  lastTickGapSum: number
  probeTimeoutSum: number
  probeTimeoutN: number
  probeTimeoutMax: number
  probeImmediateSum: number
  probeImmediateN: number
  probeImmediateMax: number
  probeMicrotaskSum: number
  probeMicrotaskN: number
  probeMicrotaskMax: number
  immediateWhilePendingN: number
  microtaskWhilePendingN: number
}

export type DeferredSendDiagWindow = {
  windowMs: number
  deferKind: NdiDeferKind
  grab: {
    wallOccupiedMs: number
    bitmapOccupiedMs: number
    wallEnterN: number
    bitmapEnterN: number
    wallShare: number
  }
  channels: Record<NdiChannelId, DeferredChannelDiag>
}

const SAMPLE_CAP = 12

function emptyChannel(): DeferredChannelDiag {
  return {
    enqueueN: 0,
    sendN: 0,
    evictN: 0,
    bytes: 0,
    bytesAfterSend: 0,
    sendMsSum: 0,
    sendMsMax: 0,
    queueWaitSum: 0,
    queueWaitMax: 0,
    queueWaitOver8: 0,
    queueWaitOver16: 0,
    queueWaitOver31: 0,
    evictWaitSum: 0,
    evictWaitMax: 0,
    evictDuringSend: 0,
    evictAwaitingMacrotask: 0,
    evictDuringGrabWall: 0,
    evictDuringGrabBitmap: 0,
    evictAfterGrab8ms: 0,
    inFlightAtEvictSum: 0,
    inFlightAtEvictMax: 0,
    inFlightAtEvictN: 0,
    evictWaitBuckets: {},
    samples: [],
    preceding: {},
    precedingLate: {},
    flushPreceding: {},
    flushPrecedingLate: {},
    ticksDuringWaitSum: 0,
    ticksDuringWaitMax: 0,
    flushInTickN: 0,
    enqueueInTickN: 0,
    msSinceTickEndSum: 0,
    lastTickGapSum: 0,
    probeTimeoutSum: 0,
    probeTimeoutN: 0,
    probeTimeoutMax: 0,
    probeImmediateSum: 0,
    probeImmediateN: 0,
    probeImmediateMax: 0,
    probeMicrotaskSum: 0,
    probeMicrotaskN: 0,
    probeMicrotaskMax: 0,
    immediateWhilePendingN: 0,
    microtaskWhilePendingN: 0,
  }
}

const acc: Record<NdiChannelId, DeferredChannelDiag> = {
  ar: emptyChannel(),
  '3d': emptyChannel(),
  '2d': emptyChannel(),
}

let windowT0 = 0
let grabWallOpen = false
let grabBitmapOpen = false
let grabWallOpenAt = 0
let grabBitmapOpenAt = 0
let grabWallMs = 0
let grabBitmapMs = 0
let grabWallEnterN = 0
let grabBitmapEnterN = 0
let lastGrabWallEnd = 0
let lastGrabWallEndSet = false

function ensureWindow(now: number): void {
  if (windowT0 === 0) windowT0 = now
}

function occupiedMs(open: boolean, openAt: number, closedMs: number, now: number): number {
  return closedMs + (open ? Math.max(0, now - openAt) : 0)
}

function waitBucket(ms: number): string {
  if (ms < 1) return '0-1'
  if (ms < 2) return '1-2'
  if (ms < 4) return '2-4'
  if (ms < 8) return '4-8'
  if (ms < 16) return '8-16'
  if (ms < 32) return '16-32'
  if (ms < 48) return '32-48'
  if (ms < 64) return '48-64'
  return '64+'
}

let lastTask = 'none'
let tickSeqLocal = 0
let tickOpenLocal = false
let tickStartLocal = 0
let tickEndLocal = 0
let lastTickGap = 0
let activeDeferKind: NdiDeferKind = 'timeout'

function bumpMap(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

function meanProbe(sum: number, n: number): number {
  return n > 0 ? sum / n : 0
}

/** DIAG:srt-fps — name the macrotask that is currently running. */
export function diagMarkMacrotask(name: string): void {
  const now = performance.now()
  lastTask = name
  if (name === 'studio:tick') {
    if (tickStartLocal > 0) lastTickGap = now - tickStartLocal
    tickSeqLocal += 1
    tickOpenLocal = true
    tickStartLocal = now
  } else if (name === 'studio:tick:end') {
    tickOpenLocal = false
    tickEndLocal = now
  }
}

function recordProbe(
  ch: DeferredChannelDiag,
  kind: 'timeout' | 'immediate' | 'microtask',
  delayMs: number,
  pendingStill: boolean,
): void {
  if (kind === 'timeout') {
    ch.probeTimeoutSum += delayMs
    ch.probeTimeoutN += 1
    if (delayMs > ch.probeTimeoutMax) ch.probeTimeoutMax = delayMs
  } else if (kind === 'immediate') {
    ch.probeImmediateSum += delayMs
    ch.probeImmediateN += 1
    if (delayMs > ch.probeImmediateMax) ch.probeImmediateMax = delayMs
    if (pendingStill) ch.immediateWhilePendingN += 1
  } else {
    ch.probeMicrotaskSum += delayMs
    ch.probeMicrotaskN += 1
    if (delayMs > ch.probeMicrotaskMax) ch.probeMicrotaskMax = delayMs
    if (pendingStill) ch.microtaskWhilePendingN += 1
  }
}

function scheduleDeferProbes(
  channel: NdiChannelId,
  scheduledAt: number,
  stillPending: () => boolean,
): void {
  const ch = acc[channel]
  try {
    setTimeout(() => {
      recordProbe(ch, 'timeout', performance.now() - scheduledAt, stillPending())
    }, 0)
  } catch {
    /* ignore */
  }
  try {
    deferNdiSendImmediate(() => {
      recordProbe(
        ch,
        'immediate',
        performance.now() - scheduledAt,
        stillPending(),
      )
    })
  } catch {
    /* ignore */
  }
  try {
    queueMicrotask(() => {
      recordProbe(
        ch,
        'microtask',
        performance.now() - scheduledAt,
        stillPending(),
      )
    })
  } catch {
    /* ignore */
  }
}

export function diagMark2dGrabWall(active: boolean): void {
  const now = performance.now()
  ensureWindow(now)
  if (active) {
    if (!grabWallOpen) {
      grabWallOpen = true
      grabWallOpenAt = now
      grabWallEnterN += 1
      diagNote2dGrabWallWindow(true, now)
    }
    return
  }
  if (grabWallOpen) {
    grabWallMs += Math.max(0, now - grabWallOpenAt)
    grabWallOpen = false
    lastGrabWallEnd = now
    lastGrabWallEndSet = true
    diagNote2dGrabWallWindow(false, now)
  }
}

export function diagMark2dGrabBitmap(active: boolean): void {
  const now = performance.now()
  ensureWindow(now)
  if (active) {
    if (!grabBitmapOpen) {
      grabBitmapOpen = true
      grabBitmapOpenAt = now
      grabBitmapEnterN += 1
    }
    return
  }
  if (grabBitmapOpen) {
    grabBitmapMs += Math.max(0, now - grabBitmapOpenAt)
    grabBitmapOpen = false
  }
}

function summarizeChannel(ch: DeferredChannelDiag): Record<string, unknown> {
  const sendN = ch.sendN
  const evictN = ch.evictN
  const mean = (sum: number, n: number) => (n > 0 ? sum / n : 0)
  return {
    enqueueN: ch.enqueueN,
    sendN,
    evictN,
    bytes: sendN > 0 ? Math.round(ch.bytes / sendN) : 0,
    bytesAfterSend: sendN > 0 ? Math.round(ch.bytesAfterSend / sendN) : 0,
    sendMsMean: mean(ch.sendMsSum, sendN),
    sendMsMax: ch.sendMsMax,
    mbPerSec:
      ch.sendMsSum > 0 ? ch.bytes / 1e6 / (ch.sendMsSum / 1000) : 0,
    queueWaitMean: mean(ch.queueWaitSum, sendN),
    queueWaitMax: ch.queueWaitMax,
    queueWaitOver8: ch.queueWaitOver8,
    queueWaitOver16: ch.queueWaitOver16,
    queueWaitOver31: ch.queueWaitOver31,
    evictWaitMean: mean(ch.evictWaitSum, evictN),
    evictWaitMax: ch.evictWaitMax,
    evictDuringSend: ch.evictDuringSend,
    evictAwaitingMacrotask: ch.evictAwaitingMacrotask,
    evictDuringGrabWall: ch.evictDuringGrabWall,
    evictDuringGrabBitmap: ch.evictDuringGrabBitmap,
    evictAfterGrab8ms: ch.evictAfterGrab8ms,
    inFlightAtEvictMean: mean(ch.inFlightAtEvictSum, ch.inFlightAtEvictN),
    inFlightAtEvictMax: ch.inFlightAtEvictMax,
    evictWaitBuckets: ch.evictWaitBuckets,
    samples: ch.samples,
    preceding: ch.preceding,
    precedingLate: ch.precedingLate,
    flushPreceding: ch.flushPreceding,
    flushPrecedingLate: ch.flushPrecedingLate,
    ticksDuringWaitMean: mean(ch.ticksDuringWaitSum, sendN),
    ticksDuringWaitMax: ch.ticksDuringWaitMax,
    flushInTickN: ch.flushInTickN,
    enqueueInTickN: ch.enqueueInTickN,
    msSinceTickEndMean: mean(ch.msSinceTickEndSum, sendN),
    lastTickGapMean: mean(ch.lastTickGapSum, sendN),
    probeTimeoutMs: meanProbe(ch.probeTimeoutSum, ch.probeTimeoutN),
    probeTimeoutMax: ch.probeTimeoutMax,
    probeImmediateMs: meanProbe(ch.probeImmediateSum, ch.probeImmediateN),
    probeImmediateMax: ch.probeImmediateMax,
    probeMicrotaskMs: meanProbe(ch.probeMicrotaskSum, ch.probeMicrotaskN),
    probeMicrotaskMax: ch.probeMicrotaskMax,
    immediateWhilePendingN: ch.immediateWhilePendingN,
    microtaskWhilePendingN: ch.microtaskWhilePendingN,
  }
}

export function takeDeferredSendDiagWindow(
  nowMs?: number,
): DeferredSendDiagWindow {
  const now =
    typeof nowMs === 'number' && Number.isFinite(nowMs)
      ? nowMs
      : performance.now()
  ensureWindow(now)
  const windowMs = Math.max(0, now - windowT0)
  const wallOccupiedMs = occupiedMs(grabWallOpen, grabWallOpenAt, grabWallMs, now)
  const bitmapOccupiedMs = occupiedMs(
    grabBitmapOpen,
    grabBitmapOpenAt,
    grabBitmapMs,
    now,
  )
  const snap: DeferredSendDiagWindow = {
    windowMs,
    deferKind: activeDeferKind,
    grab: {
      wallOccupiedMs,
      bitmapOccupiedMs,
      wallEnterN: grabWallEnterN,
      bitmapEnterN: grabBitmapEnterN,
      wallShare: windowMs > 0 ? wallOccupiedMs / windowMs : 0,
    },
    channels: {
      ar: acc.ar,
      '3d': acc['3d'],
      '2d': acc['2d'],
    },
  }
  acc.ar = emptyChannel()
  acc['3d'] = emptyChannel()
  acc['2d'] = emptyChannel()
  windowT0 = now
  grabWallMs = 0
  grabBitmapMs = 0
  grabWallEnterN = 0
  grabBitmapEnterN = 0
  if (grabWallOpen) grabWallOpenAt = now
  if (grabBitmapOpen) grabBitmapOpenAt = now
  return snap
}

export function formatDeferredSendDiag(
  snap: DeferredSendDiagWindow,
): Record<string, unknown> {
  const grabMs = snap.grab.wallOccupiedMs
  const freeMs = Math.max(0, snap.windowMs - grabMs)
  const rate = (n: number, ms: number) => (ms > 1 ? n / (ms / 1000) : 0)
  const withRates = (ch: NdiChannelId) => {
    const raw = snap.channels[ch]
    const during = raw.evictDuringGrabWall
    const outside = raw.evictN - during
    return {
      ...summarizeChannel(raw),
      evictPerSecDuringGrab: rate(during, grabMs),
      evictPerSecOutsideGrab: rate(outside, freeMs),
    }
  }
  return {
    windowMs: snap.windowMs,
    deferKind: snap.deferKind,
    grab: snap.grab,
    ar: withRates('ar'),
    '3d': withRates('3d'),
    '2d': withRates('2d'),
  }
}

export function resetDeferredSendDiag(): void {
  acc.ar = emptyChannel()
  acc['3d'] = emptyChannel()
  acc['2d'] = emptyChannel()
  windowT0 = 0
  grabWallOpen = false
  grabBitmapOpen = false
  grabWallOpenAt = 0
  grabBitmapOpenAt = 0
  grabWallMs = 0
  grabBitmapMs = 0
  grabWallEnterN = 0
  grabBitmapEnterN = 0
  lastGrabWallEnd = 0
  lastGrabWallEndSet = false
  lastTask = 'none'
  tickSeqLocal = 0
  tickOpenLocal = false
  tickStartLocal = 0
  tickEndLocal = 0
  lastTickGap = 0
}

function noteEvict(
  channel: NdiChannelId,
  waitMs: number,
  sending: boolean,
  awaitingMacrotask: boolean,
  sendStartedAt: number,
  bytes: number,
  now: number,
  preceding: string,
  ticksDuringWait: number,
): void {
  const ch = acc[channel]
  ch.evictN += 1
  ch.evictWaitSum += waitMs
  if (waitMs > ch.evictWaitMax) ch.evictWaitMax = waitMs
  const bucket = waitBucket(waitMs)
  ch.evictWaitBuckets[bucket] = (ch.evictWaitBuckets[bucket] ?? 0) + 1
  if (sending) ch.evictDuringSend += 1
  if (awaitingMacrotask) ch.evictAwaitingMacrotask += 1
  bumpMap(ch.preceding, preceding)
  if (waitMs > 8) bumpMap(ch.precedingLate, preceding)
  const duringGrabWall = grabWallOpen && now >= grabWallOpenAt
  const duringGrabBitmap = grabBitmapOpen && now >= grabBitmapOpenAt
  if (duringGrabWall) ch.evictDuringGrabWall += 1
  if (duringGrabBitmap) ch.evictDuringGrabBitmap += 1
  let afterGrabMs: number | null = null
  if (!duringGrabWall && lastGrabWallEndSet) {
    afterGrabMs = now - lastGrabWallEnd
    if (afterGrabMs >= 0 && afterGrabMs <= 8) ch.evictAfterGrab8ms += 1
  }
  let inFlightMs: number | null = null
  if (sending) {
    inFlightMs = now - sendStartedAt
    ch.inFlightAtEvictN += 1
    ch.inFlightAtEvictSum += inFlightMs
    if (inFlightMs > ch.inFlightAtEvictMax) ch.inFlightAtEvictMax = inFlightMs
  }
  if (ch.samples.length < SAMPLE_CAP) {
    ch.samples.push({
      waitMs,
      inFlightMs,
      duringSend: sending,
      awaitingMacrotask,
      duringGrabWall,
      duringGrabBitmap,
      afterGrabMs,
      bytes,
      preceding,
      ticksDuringWait,
    })
  }
}

export function createNdiDeferredSend(
  options: CreateNdiDeferredSendOptions,
): NdiDeferredSend {
  const defer = options.defer ?? resolveDefaultDefer()
  activeDeferKind =
    typeof window !== 'undefined'
      ? parseNdiDefer(window.location.search)
      : 'timeout'
  const g = globalThis as { __ndiDeferLogged?: boolean }
  if (!g.__ndiDeferLogged) {
    g.__ndiDeferLogged = true
    console.info(
      `[diag:srt-fps] ${JSON.stringify({
        stage: 'ndi-defer',
        kind: activeDeferKind,
      })}`,
    )
  }
  const channel: NdiChannelId = options.channel ?? 'ar'
  const maxPending = resolveMaxPending(options.maxPending)
  console.info(
    `[diag:srt-fps] ${JSON.stringify({
      stage: 'ndi-queue',
      maxPending,
      channel,
    })}`,
  )
  let pending: PendingSlot[] = []
  let scheduled = false
  let disposed = false
  let sending = false
  let sendStartedAt = 0

  function recycle(data: ArrayBuffer): void {
    try {
      options.release?.(data)
    } catch {
      /* ignore */
    }
  }

  function flush(): void {
    scheduled = false
    if (disposed) {
      for (const slot of pending) recycle(slot.frame.data)
      pending = []
      return
    }
    const batch = pending
    pending = []
    if (batch.length === 0) return
    const now = performance.now()
    const preceding = lastTask
    diagMarkMacrotask(`flush:${channel}`)
    ensureWindow(now)
    const ch = acc[channel]
    for (const slot of batch) {
      const queueWait = now - slot.enqueuedAt
      const ticksDuringWait = Math.max(0, tickSeqLocal - slot.enqueuedTick)
      ch.queueWaitSum += queueWait
      if (queueWait > ch.queueWaitMax) ch.queueWaitMax = queueWait
      if (queueWait > 8) ch.queueWaitOver8 += 1
      if (queueWait > 16) ch.queueWaitOver16 += 1
      if (queueWait > 31) ch.queueWaitOver31 += 1
      bumpMap(ch.flushPreceding, preceding)
      if (queueWait > 8) bumpMap(ch.flushPrecedingLate, preceding)
      ch.ticksDuringWaitSum += ticksDuringWait
      if (ticksDuringWait > ch.ticksDuringWaitMax) {
        ch.ticksDuringWaitMax = ticksDuringWait
      }
      if (tickOpenLocal) ch.flushInTickN += 1
      if (tickEndLocal > 0) {
        ch.msSinceTickEndSum += Math.max(0, now - tickEndLocal)
      }
      ch.lastTickGapSum += lastTickGap
      const bytesBefore = slot.frame.data.byteLength
      sending = true
      sendStartedAt = performance.now()
      try {
        // #region agent log
        const __sendT0 = performance.now()
        // #endregion
        options.send(slot.frame)
        // #region agent log
        const __sendMs = performance.now() - __sendT0
        ch.sendN += 1
        ch.sendMsSum += __sendMs
        if (__sendMs > ch.sendMsMax) ch.sendMsMax = __sendMs
        ch.bytes += bytesBefore
        ch.bytesAfterSend += slot.frame.data.byteLength
        if (
          !(globalThis as { __ndiIpcLogAt?: number }).__ndiIpcLogAt ||
          performance.now() -
            ((globalThis as { __ndiIpcLogAt?: number }).__ndiIpcLogAt ?? 0) >
            1000
        ) {
          ;(globalThis as { __ndiIpcLogAt?: number }).__ndiIpcLogAt =
            performance.now()
          fetch(
            'http://127.0.0.1:7438/ingest/7196fb84-148e-4d0c-af68-4fcb53313232',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Debug-Session-Id': '173fbb',
              },
              body: JSON.stringify({
                sessionId: '173fbb',
                runId: 'post-fix',
                hypothesisId: 'H4',
                location: 'ndiDeferredSend.ts:flush',
                message: 'deferred sendFrame',
                data: {
                  channel,
                  sendMs: __sendMs,
                  bytes: bytesBefore,
                  bytesAfter: slot.frame.data.byteLength,
                  queueWaitMs: queueWait,
                  batch: batch.length,
                  maxPending,
                  preceding,
                  ticksDuringWait,
                  deferKind: activeDeferKind,
                  w: slot.frame.width,
                  h: slot.frame.height,
                  bottomUp: slot.frame.bottomUp,
                  pixelFormat: slot.frame.pixelFormat ?? null,
                },
                timestamp: Date.now(),
              }),
            },
          ).catch(() => {})
          debugSessionLog({
            hypothesisId: 'H4',
            location: 'ndiDeferredSend.ts:flush',
            message: 'deferred sendFrame',
            data: {
              channel,
              sendMs: __sendMs,
              bytes: bytesBefore,
              bytesAfter: slot.frame.data.byteLength,
              queueWaitMs: queueWait,
              batch: batch.length,
              maxPending,
              preceding,
              ticksDuringWait,
              deferKind: activeDeferKind,
              w: slot.frame.width,
              h: slot.frame.height,
              bottomUp: slot.frame.bottomUp,
              pixelFormat: slot.frame.pixelFormat ?? null,
            },
          })
        }
        // #endregion
      } finally {
        sending = false
        sendStartedAt = 0
        recycle(slot.frame.data)
      }
    }
  }

  return {
    enqueue(frame: NdiDeferredFrame): void {
      if (disposed) {
        recycle(frame.data)
        return
      }
      const now = performance.now()
      ensureWindow(now)
      acc[channel].enqueueN += 1
      if (tickOpenLocal) acc[channel].enqueueInTickN += 1
      while (pending.length >= maxPending) {
        const dropped = pending.shift()
        if (!dropped) break
        noteEvict(
          channel,
          now - dropped.enqueuedAt,
          sending,
          scheduled && !sending,
          sendStartedAt,
          dropped.frame.data.byteLength,
          now,
          lastTask,
          Math.max(0, tickSeqLocal - dropped.enqueuedTick),
        )
        recycle(dropped.frame.data)
      }
      pending.push({
        frame,
        enqueuedAt: now,
        enqueuedTick: tickSeqLocal,
        enqueuedTask: lastTask,
      })
      if (scheduled) return
      scheduled = true
      scheduleDeferProbes(channel, now, () => pending.length > 0 && !sending)
      defer(flush)
    },
    isScheduled(): boolean {
      return scheduled
    },
    dispose(): void {
      disposed = true
      for (const slot of pending) recycle(slot.frame.data)
      pending = []
    },
  }
}
