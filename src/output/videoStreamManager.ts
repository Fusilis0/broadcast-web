/**
 * Multi-POV warm decode manager (Phase 17.2, L5).
 *
 * Consumes `srt:data` (OUT-03) and drives OUT-04 via `setTexture`. Switching
 * swaps which stream's texture is bound — no reconnect, no black frame.
 * Cap 4; least-recently-used non-active POV is evicted and disposed.
 */

import * as THREE from 'three'
import { getPtsNtpMap } from '../telemetry/ptsNtpMap.ts'
import { telemetryBus } from '../telemetry/bus.ts'
import { timeNdiStage } from './ndiStageTiming.ts'
import { getSrtBridge, type SrtBridge } from './srtBridge.ts'
import {
  createVideoDecodePipeline,
  type DecodeCounters,
  type VideoDecoderFactory,
  type VideoDecodePipeline,
  type VideoFrameLike,
} from './videoDecodePipeline.ts'

export const WARM_STREAM_CAP = 4

export type VideoStreamCounters = DecodeCounters & {
  povId: string
  active: boolean
}

export type StreamTextureLike = {
  image: unknown
  needsUpdate: boolean
  colorSpace?: unknown
  dispose: () => void
}

export type VideoStreamManagerOptions = {
  setTexture: (tex: StreamTextureLike | null) => void
  getSrtBridge?: () => SrtBridge | null
  getActivePovId?: () => string | null
  /** LUT key. Default identity (TEL-08 / OUT-07 may map SRT id separately). */
  getLutStreamId?: (povId: string) => string
  toNtp?: (povId: string, pts90k: number) => number | null
  getNewestPoseNtp?: (povId: string) => number | null
  subscribeTick?: (cb: () => void) => () => void
  decoderFactory?: VideoDecoderFactory
  createTexture?: () => StreamTextureLike
  uploadFrame?: (tex: StreamTextureLike, frame: VideoFrameLike) => void
  warmCap?: number
  onOpsError?: (povId: string, message: string) => void
  nowMs?: () => number
}

export type VideoStreamManager = {
  pushBytes(povId: string, chunk: Uint8Array): void
  setActivePov(povId: string | null): void
  getActivePov(): string | null
  present(): void
  getCounters(povId: string): VideoStreamCounters | null
  getActiveCounters(): VideoStreamCounters | null
  listPovIds(): string[]
  ready(): Promise<void>
  resetForH264Fallback(povId: string): void
  /**
   * Explicit Disconnect: drop every decode slot so the last frame cannot
   * stay bound. Late `srt:data` is ignored until `resumeIngest()`.
   */
  dropPresented(): void
  /**
   * Close one POV's decoder. Returns true if a texture is still bound
   * (another warm POV). False → caller should restore the placeholder.
   */
  dropPov(povId: string): boolean
  /** Connect SRT — accept bytes again after `dropPresented()`. */
  resumeIngest(): void
  dispose(): void
}

type StreamSlot = {
  povId: string
  pipe: VideoDecodePipeline
  texture: StreamTextureLike
  lastUsedAt: number
  hasFrame: boolean
}

export function createVideoStreamTexture(): THREE.Texture {
  const tex = new THREE.Texture()
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return tex
}

export function uploadVideoFrameToTexture(
  tex: StreamTextureLike,
  frame: VideoFrameLike,
): void {
  if (tex.image === frame) return
  const w = frame.displayWidth ?? frame.codedWidth
  const h = frame.displayHeight ?? frame.codedHeight
  const img = frame as VideoFrameLike & {
    videoWidth?: number
    videoHeight?: number
    width?: number
    height?: number
  }
  try {
    img.videoWidth = w
    img.videoHeight = h
    img.width = w
    img.height = h
  } catch {
    /* VideoFrame host objects may reject expandos */
  }
  tex.image = img
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
}

function textureHasImage(tex: StreamTextureLike): boolean {
  const img = tex.image as
    | {
        width?: number
        height?: number
        videoWidth?: number
        videoHeight?: number
        codedWidth?: number
      }
    | null
    | undefined
  if (!img) return false
  const w = img.videoWidth ?? img.width ?? img.codedWidth
  return typeof w === 'number' && w > 0
}

export function startVideoStreamManager(
  options: VideoStreamManagerOptions,
): VideoStreamManager {
  const cap = Math.max(1, options.warmCap ?? WARM_STREAM_CAP)
  const nowMs = options.nowMs ?? (() => performance.now())
  const createTexture = options.createTexture ?? createVideoStreamTexture
  const uploadFrame = options.uploadFrame ?? uploadVideoFrameToTexture
  const getLutStreamId = options.getLutStreamId ?? ((povId: string) => povId)

  const streams = new Map<string, StreamSlot>()
  const newestPose = new Map<string, number>()
  let activePov: string | null = null
  let disposed = false
  let boundTexture: StreamTextureLike | null = null
  /** False after explicit Disconnect until Connect SRT (`resumeIngest`). */
  let acceptingBytes = true

  const unsubs: Array<() => void> = []

  /* DIAG:srt-fps — temporary decode/present rates; revert after diagnosis. */
  type DiagSnap = {
    framesDecoded: number
    framesDropped: number
    accessUnits: number
    bytesPushed: number
  }
  const diag = {
    t0: performance.now(),
    windowT0: performance.now(),
    presentCalls: 0,
    uniquePts: new Map<string, number>(),
    repeatPts: new Map<string, number>(),
    kfTrue: new Map<string, number>(),
    kfRise: new Map<string, number>(),
    lastKf: new Map<string, boolean>(),
    lastPts: new Map<string, number | null>(),
    lastReason: new Map<string, string | null>(),
    reasonCounts: new Map<string, Map<string, number>>(),
    auDeltaHist: new Map<string, number>(),
    lastAu: new Map<string, number>(),
    sameFrameUpload: 0,
    bytesIn: 0,
    snap: new Map<string, DiagSnap>(),
    traces: [] as Array<Record<string, unknown>>,
    window: {
      presentCalls: 0,
      unique: 0,
      repeat: 0,
      reasonCounts: new Map<string, number>(),
    },
  }

  function diagBump(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  function diagBumpReason(povId: string, reason: string): void {
    let per = diag.reasonCounts.get(povId)
    if (!per) {
      per = new Map()
      diag.reasonCounts.set(povId, per)
    }
    diagBump(per, reason)
    diagBump(diag.window.reasonCounts, `${povId}:${reason}`)
  }

  function diagFlushIfDue(): void {
    const now = performance.now()
    const dt = (now - diag.t0) / 1000
    if (dt < 1) return
    const rows: Record<string, unknown>[] = []
    for (const slot of streams.values()) {
      const c = slot.pipe.getCounters()
      const prev = diag.snap.get(slot.povId)
      const rate = (cur: number, old: number | undefined) =>
        old == null ? null : (cur - old) / dt
      const reasons: Record<string, number> = {}
      for (const [k, v] of diag.reasonCounts.get(slot.povId) ?? []) {
        reasons[k] = v
      }
      rows.push({
        povId: slot.povId,
        active: slot.povId === activePov,
        codec: c.codec,
        decodedFps: rate(c.framesDecoded, prev?.framesDecoded),
        droppedFps: rate(c.framesDropped, prev?.framesDropped),
        auFps: rate(c.accessUnits, prev?.accessUnits),
        bytesPushedPerSec: rate(c.bytesPushed, prev?.bytesPushed),
        uniquePresentFps: (diag.uniquePts.get(slot.povId) ?? 0) / dt,
        repeatPresentPerSec: (diag.repeatPts.get(slot.povId) ?? 0) / dt,
        kfWaitTicks: diag.kfTrue.get(slot.povId) ?? 0,
        kfRise: diag.kfRise.get(slot.povId) ?? 0,
        waitingForKeyframe: c.waitingForKeyframe,
        reason: diag.lastReason.get(slot.povId) ?? c.reason,
        reasonCounts: reasons,
        degraded: c.degraded,
        latencyMs: c.latencyMs,
        queueDepth: c.queueDepth,
        outstandingFrames: c.outstandingFrames,
        decodeError: c.decodeError,
        framesDecoded: c.framesDecoded,
        framesDropped: c.framesDropped,
        accessUnits: c.accessUnits,
      })
      diag.snap.set(slot.povId, {
        framesDecoded: c.framesDecoded,
        framesDropped: c.framesDropped,
        accessUnits: c.accessUnits,
        bytesPushed: c.bytesPushed,
      })
    }
    const auHist: Record<string, number> = {}
    for (const [k, v] of diag.auDeltaHist) auHist[k] = v
    console.info(
      `[diag:srt-fps] ${JSON.stringify({
        stage: 'decode-present',
        dtSec: Math.round(dt * 1000) / 1000,
        presentHz: diag.presentCalls / dt,
        ipcBytesPerSec: diag.bytesIn / dt,
        sameFrameUpload: diag.sameFrameUpload,
        auDeltaPerPresent: auHist,
        traces: diag.traces.slice(-8),
        streams: rows,
      })}`,
    )
    const winDt = (now - diag.windowT0) / 1000
    if (winDt >= 20) {
      const winReasons: Record<string, number> = {}
      for (const [k, v] of diag.window.reasonCounts) winReasons[k] = v
      console.info(
        `[diag:srt-fps] ${JSON.stringify({
          stage: 'decode-present-20s',
          dtSec: Math.round(winDt * 1000) / 1000,
          presentHz: diag.window.presentCalls / winDt,
          uniquePresentFps: diag.window.unique / winDt,
          repeatPresentPerSec: diag.window.repeat / winDt,
          reasonCounts: winReasons,
        })}`,
      )
      diag.windowT0 = now
      diag.window.presentCalls = 0
      diag.window.unique = 0
      diag.window.repeat = 0
      diag.window.reasonCounts.clear()
    }
    diag.t0 = now
    diag.presentCalls = 0
    diag.bytesIn = 0
    diag.sameFrameUpload = 0
    diag.uniquePts.clear()
    diag.repeatPts.clear()
    diag.kfTrue.clear()
    diag.kfRise.clear()
    diag.reasonCounts.clear()
    diag.auDeltaHist.clear()
    diag.traces.length = 0
  }

  if (!options.getNewestPoseNtp) {
    unsubs.push(
      telemetryBus.on('drone', (packet) => {
        if (typeof packet.ts === 'number' && Number.isFinite(packet.ts)) {
          newestPose.set(packet.id, packet.ts)
        }
      }),
    )
  }

  function toNtp(povId: string, pts90k: number): number | null {
    if (options.toNtp) return options.toNtp(povId, pts90k)
    const mapped = getPtsNtpMap(getLutStreamId(povId)).toNtp(pts90k)
    return mapped.ntpMs
  }

  function newestPoseNtp(povId: string): number | null {
    if (options.getNewestPoseNtp) return options.getNewestPoseNtp(povId)
    return newestPose.get(povId) ?? null
  }

  function touch(slot: StreamSlot): void {
    slot.lastUsedAt = nowMs()
  }

  function evictLru(): void {
    let victim: StreamSlot | null = null
    for (const slot of streams.values()) {
      if (slot.povId === activePov) continue
      if (!victim || slot.lastUsedAt < victim.lastUsedAt) victim = slot
    }
    if (!victim) return
    disposeSlot(victim)
    streams.delete(victim.povId)
  }

  function disposeSlot(slot: StreamSlot): void {
    slot.pipe.dispose()
    try {
      slot.texture.dispose()
    } catch {
      /* fake textures */
    }
    if (boundTexture === slot.texture) boundTexture = null
  }

  function ensure(povId: string): StreamSlot | null {
    if (disposed) return null
    const existing = streams.get(povId)
    if (existing) {
      touch(existing)
      return existing
    }
    while (streams.size >= cap) evictLru()
    if (streams.size >= cap) return null
    const slot: StreamSlot = {
      povId,
      texture: createTexture(),
      lastUsedAt: nowMs(),
      hasFrame: false,
      pipe: createVideoDecodePipeline({
        decoderFactory: options.decoderFactory,
        toNtp: (pts) => toNtp(povId, pts),
        getNewestPoseNtp: () => newestPoseNtp(povId),
        onOpsError: (message) => options.onOpsError?.(povId, message),
      }),
    }
    streams.set(povId, slot)
    return slot
  }

  function bindActiveTexture(): void {
    if (!activePov) return
    const slot = streams.get(activePov)
    if (!slot || !slot.hasFrame || !textureHasImage(slot.texture)) return
    if (boundTexture === slot.texture) return
    options.setTexture(slot.texture)
    boundTexture = slot.texture
  }

  const handle: VideoStreamManager = {
    pushBytes(povId: string, chunk: Uint8Array): void {
      if (disposed || !acceptingBytes || !povId) return
      const slot = ensure(povId)
      if (!slot) return
      /* DIAG:srt-fps */
      diag.bytesIn += chunk.byteLength
      slot.pipe.pushBytes(Uint8Array.from(chunk))
    },
    setActivePov(povId: string | null): void {
      if (disposed) return
      if (povId === activePov) {
        bindActiveTexture()
        return
      }
      activePov = povId
      if (povId) {
        const slot = streams.get(povId)
        if (slot) touch(slot)
      }
      bindActiveTexture()
    },
    getActivePov: () => activePov,
    present(): void {
      timeNdiStage('present', () => {
        if (disposed) return
        const polled = options.getActivePovId?.() ?? null
        if (polled && polled !== activePov) handle.setActivePov(polled)
        /* DIAG:srt-fps */
        diag.presentCalls += 1
        diag.window.presentCalls += 1
        for (const slot of streams.values()) {
          const shown = slot.pipe.present()
          const c = slot.pipe.getCounters()
          const prevKf = diag.lastKf.get(slot.povId)
          if (prevKf === false && c.waitingForKeyframe) {
            diagBump(diag.kfRise, slot.povId)
          }
          diag.lastKf.set(slot.povId, c.waitingForKeyframe)
          if (c.waitingForKeyframe) diagBump(diag.kfTrue, slot.povId)
          const prevAu = diag.lastAu.get(slot.povId) ?? c.accessUnits
          const auDelta = Math.max(0, c.accessUnits - prevAu)
          diag.lastAu.set(slot.povId, c.accessUnits)
          const auKey = auDelta >= 4 ? '4+' : String(auDelta)
          diagBump(diag.auDeltaHist, `${slot.povId}:${auKey}`)
          if (shown) {
            diag.lastReason.set(slot.povId, shown.pick.reason)
            diagBumpReason(slot.povId, shown.pick.reason)
            const prevPts = diag.lastPts.get(slot.povId)
            if (prevPts !== shown.pts90k) {
              diagBump(diag.uniquePts, slot.povId)
              diag.window.unique += 1
              diag.lastPts.set(slot.povId, shown.pts90k)
              if (diag.traces.length < 8) {
                diag.traces.push({
                  povId: slot.povId,
                  presentedPts90k: prevPts ?? null,
                  pickPts90k: shown.pts90k,
                  reason: shown.pick.reason,
                  latencyMs: shown.pick.latencyMs,
                  degraded: shown.pick.degraded,
                  queueDepth: c.queueDepth,
                  auDelta,
                })
              }
            } else {
              diagBump(diag.repeatPts, slot.povId)
              diag.window.repeat += 1
            }
            if (slot.texture.image === shown.frame) diag.sameFrameUpload += 1
          }
          if (!shown) continue
          uploadFrame(slot.texture, shown.frame)
          slot.hasFrame = true
        }
        bindActiveTexture()
        diagFlushIfDue()
      })
    },
    getCounters(povId: string): VideoStreamCounters | null {
      const slot = streams.get(povId)
      if (!slot) return null
      return {
        povId,
        active: povId === activePov,
        ...slot.pipe.getCounters(),
      }
    },
    getActiveCounters(): VideoStreamCounters | null {
      return activePov ? handle.getCounters(activePov) : null
    },
    listPovIds: () => [...streams.keys()],
    async ready(): Promise<void> {
      await Promise.all([...streams.values()].map((s) => s.pipe.ready()))
    },
    resetForH264Fallback(povId: string): void {
      if (disposed || !povId) return
      const slot = streams.get(povId)
      if (!slot) return
      slot.pipe.resetForH264Fallback()
      slot.hasFrame = false
    },
    dropPresented(): void {
      if (disposed) return
      acceptingBytes = false
      for (const slot of streams.values()) disposeSlot(slot)
      streams.clear()
      boundTexture = null
      options.setTexture(null)
    },
    dropPov(povId: string): boolean {
      if (disposed || !povId) return boundTexture != null
      const slot = streams.get(povId)
      if (slot) {
        disposeSlot(slot)
        streams.delete(povId)
      }
      bindActiveTexture()
      return boundTexture != null
    },
    resumeIngest(): void {
      if (disposed) return
      acceptingBytes = true
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      for (const u of unsubs) u()
      unsubs.length = 0
      for (const slot of streams.values()) {
        slot.pipe.dispose()
        try {
          slot.texture.dispose()
        } catch {
          /* ignore */
        }
      }
      streams.clear()
      boundTexture = null
      activePov = null
    },
  }

  const bridge = options.getSrtBridge ? options.getSrtBridge() : getSrtBridge()
  if (bridge) {
    unsubs.push(
      bridge.onSrtData((payload) => {
        handle.pushBytes(payload.povId, payload.chunk)
      }),
    )
  }
  if (options.subscribeTick) {
    unsubs.push(options.subscribeTick(() => handle.present()))
  }

  return handle
}
