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
import {
  timeNdiStage,
  getNdiStageSnapshot,
  diagLastNdiStageP90Ms,
  NDI_STAGE_NAMES,
  type NdiSkipCounts,
} from './ndiStageTiming.ts'
import { diagPeekNdiSendFps } from './diagNdiPeek.ts'
import {
  diagNotePresentTick,
  takeDiagNdiContentWindow,
} from './diagNdiContent.ts'
import {
  diagNotePaceAdvance,
  diagNotePaceTick,
  diagNoteAuArrival,
  takeDiagPresentPaceWindow,
} from './diagPresentPace.ts'
import { getSrtBridge, type SrtBridge } from './srtBridge.ts'
import {
  createVideoDecodePipeline,
  parsePresentPace,
  type DecodeCounters,
  type VideoDecoderFactory,
  type VideoDecodePipeline,
  type VideoFrameLike,
} from './videoDecodePipeline.ts'

export const WARM_STREAM_CAP = 4
/**
 * GPU ring depth for hybrid consume → paced display.
 *
 * Justification (not DEFAULT_QUEUE_CAP=24):
 * - Display keeps 1 slot bound.
 * - Steady 30 fps decode / ~33 ms pace: unique advances are mostly
 *   ticksBetween gap-2 (~2 studio ticks).
 * - Live AU-per-tick burstiness is 0 / 2 / 3 (rarely 4+). Worst two ticks
 *   between swaps ≈ 3+3 = 6 arrivals while one slot stays displayed.
 * - +1 spare for phase jitter / 0 ms double-ticks → **8**.
 *
 * Was 24 (= queue cap) and exhausted WebGL (up to 96×1080p across warm
 * POVs). Overwriting the oldest non-display slot drops that PTS from the
 * ring; pick skips missing GPU copies via bindRing failure → hold.
 */
export const PRESENT_DISPLAY_RING_SLOTS = 8

export type VideoStreamCounters = DecodeCounters & {
  povId: string
  active: boolean
}

export type StreamTextureLike = {
  image: unknown
  needsUpdate: boolean
  colorSpace?: unknown
  isVideoTexture?: boolean
  update?: () => void
  internalFormat?: string | null
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
  /**
   * Force a real GPU upload for a texture that may not be in any drawn
   * material. Production: `renderer.initTexture(tex)` → Three.js
   * `WebGLTextures.setTexture2D` → `texImage2D(VideoFrame)` /
   * CopyTextureCHROMIUM. Required when presentPace is on.
   */
  forceUploadTexture?: (tex: StreamTextureLike) => void
  warmCap?: number
  onOpsError?: (povId: string, message: string) => void
  nowMs?: () => number
  /**
   * Default on. `?presentPace=off` disables the wall-clock gate + unstick.
   */
  presentPace?: boolean
  /** Latest SRT/IPC ingest proxies for decode-error events (item a). */
  getIngestDiag?: (povId: string) => {
    bitrateKbps: number | null
    ipcDropCount: number | null
    ipcDropPerSec: number | null
    ffmpegDropFrames: string | null
  } | null
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
  ring: Array<{
    tex: StreamTextureLike
    pts90k: number | null
    /** True after forceUploadTexture + seal; safe to bind after VideoFrame.close. */
    gpuReady: boolean
  }> | null
  displayIndex: number
  lastUsedAt: number
  hasFrame: boolean
}

type VideoFrameUploadTexture = THREE.Texture & {
  isVideoTexture: boolean
  update: () => void
}

/**
 * GL internal format Three.js will pass to `texImage2D` for this stream
 * texture. Video uploads use RGBA8 + shader `sRGBTransferEOTF`
 * (`DECODE_VIDEO_TEXTURE`), not `texStorage2D(SRGB8_ALPHA8)` — browsers do
 * not reliably support sRGB storage with video sources (three.js #26516).
 * Sampled colour matches the old SRGB8_ALPHA8 hardware-decode path; combining
 * SRGB8_ALPHA8 *and* DECODE_VIDEO_TEXTURE would double-apply the EOTF.
 */
export const VIDEO_FRAME_TEXIMAGE_GL_INTERNAL_FORMAT = 'RGBA8' as const

export function resolveVideoFrameTexImageInternalFormat(tex: {
  isVideoTexture?: boolean
  internalFormat?: string | null
  colorSpace?: unknown
}): 'RGBA8' | 'SRGB8_ALPHA8' {
  if (tex.internalFormat === 'SRGB8_ALPHA8' || tex.internalFormat === 'RGBA8') {
    return tex.internalFormat
  }
  if (tex.isVideoTexture === true) return VIDEO_FRAME_TEXIMAGE_GL_INTERNAL_FORMAT
  return tex.colorSpace === THREE.SRGBColorSpace ? 'SRGB8_ALPHA8' : 'RGBA8'
}

/**
 * Mark a stream texture so WebGL2 uses `texImage2D(VideoFrame)` (Chromium
 * CopyTextureCHROMIUM fast path) instead of `texStorage` + `texSubImage2D`
 * (webcodecs#421 / three.js #28980). `update()` is a no-op: `present()`
 * already sets `needsUpdate` on unique frames.
 */
export function applyVideoFrameTexImage2DUpload(tex: THREE.Texture): THREE.Texture {
  const video = tex as VideoFrameUploadTexture
  video.colorSpace = THREE.SRGBColorSpace
  video.internalFormat = null
  video.isVideoTexture = true
  video.update = () => {
    /* present() owns needsUpdate */
  }
  return video
}

export function createVideoStreamTexture(): THREE.Texture {
  const tex = new THREE.Texture()
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return applyVideoFrameTexImage2DUpload(tex)
}

/** Killswitch: old texStorage + texSubImage2D + SRGB8_ALPHA8 path. */
export function createLegacyTexSubImageVideoStreamTexture(): THREE.Texture {
  const tex = new THREE.Texture()
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return tex
}

function videoFramePixelFormat(frame: VideoFrameLike): string | null {
  const fmt = (frame as { format?: unknown }).format
  return typeof fmt === 'string' ? fmt : null
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
  // GPU-GPU: Three.js `isVideoTexture` → `texImage2D(VideoFrame)` →
  // Chromium CopyTextureCHROMIUM. Not `VideoFrame.copyTo()` / CPU readback.
  // For off-screen ring slots, caller must also `forceUploadTexture`
  // (`renderer.initTexture`) before `VideoFrame.close()`.
  tex.image = img
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
}

/**
 * After a successful force GPU upload, drop the VideoFrame reference so
 * `close()` cannot leave a closed source on a later bind. Keep dimensions
 * for `textureHasImage` / layout. Does not bump `needsUpdate`.
 */
export function sealUploadedVideoTexture(
  tex: StreamTextureLike,
  frame: VideoFrameLike,
): void {
  const w = frame.displayWidth ?? frame.codedWidth
  const h = frame.displayHeight ?? frame.codedHeight
  tex.image = {
    width: w,
    height: h,
    videoWidth: w,
    videoHeight: h,
  }
  tex.needsUpdate = false
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
  const forceUploadTexture = options.forceUploadTexture
  const getLutStreamId = options.getLutStreamId ?? ((povId: string) => povId)
  let presentPace = options.presentPace !== false
  if (options.presentPace == null) {
    try {
      if (typeof window !== 'undefined' && window.location?.search != null) {
        presentPace = parsePresentPace(window.location.search)
      }
    } catch {
      presentPace = true
    }
  }

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
    loggedFrameFormat: false,
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
        retainedDepth: c.retainedDepth,
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
    /* Skip empty managers (HMR orphans) — they steal pace window samples. */
    if (rows.length === 0) {
      diag.t0 = now
      diag.presentCalls = 0
      diag.bytesIn = 0
      diag.sameFrameUpload = 0
      diag.uniquePts.clear()
      diag.repeatPts.clear()
      diag.kfTrue.clear()
      diag.kfRise.clear()
      diag.auDeltaHist.clear()
      diag.reasonCounts.clear()
      diag.traces.length = 0
      return
    }
    const auHist: Record<string, number> = {}
    for (const [k, v] of diag.auDeltaHist) auHist[k] = v
    /* DIAG:srt-fps — NDI from the same counters/snapshot the AR Send HUD reads. */
    const ndiSnap = getNdiStageSnapshot()
    const ndiP90 = diagLastNdiStageP90Ms()
    const round2 = (n: number) => Math.round(n * 100) / 100
    const ndiStages: Record<
      string,
      { n: number; meanMs: number; p90Ms: number | null; maxMs: number }
    > = {}
    for (const name of NDI_STAGE_NAMES) {
      const st = ndiSnap.stages[name]
      const p90 = ndiP90?.[name]
      ndiStages[name] = {
        n: st.count,
        meanMs: round2(st.meanMs),
        p90Ms: p90 == null ? null : round2(p90),
        maxMs: round2(st.maxMs),
      }
    }
    const skipShares = (s: NdiSkipCounts) => {
      const total = s.rateCap + s.stagger + s.busy + s.freshness
      const share = (n: number) =>
        total === 0 ? 0 : Math.round((n / total) * 1000) / 10
      return {
        rateCap: s.rateCap,
        stagger: s.stagger,
        busy: s.busy,
        freshness: s.freshness,
        total,
        rateCapShare: share(s.rateCap),
        staggerShare: share(s.stagger),
        busyShare: share(s.busy),
        freshnessShare: share(s.freshness),
      }
    }
    const content = takeDiagNdiContentWindow()
    const grab2d = ndiStages['2dGrab'] as
      | { n?: number; meanMs?: number }
      | undefined
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
        /* Top-level copy for jitter correlation (also nested under ndi.pace). */
        pace: takeDiagPresentPaceWindow(),
        ndi: {
          sendFps: diagPeekNdiSendFps(),
          windowMs: round2(ndiSnap.windowMs),
          skips: ndiSnap.skips,
          skipShares: {
            ar: skipShares(ndiSnap.skips.ar),
            '3d': skipShares(ndiSnap.skips['3d']),
            '2d': skipShares(ndiSnap.skips['2d']),
          },
          stages: ndiStages,
          tickInterval: ndiSnap.tickInterval,
          captureTicks: ndiSnap.captureTicks,
          deferredSend: ndiSnap.deferredSend ?? null,
          content,
        },
      })}`,
    )
    /* Rolling AR unique-PTS Send fps (SRT round 5 acceptance metric). */
    console.info(
      `[diag:ar-send-fps] ${JSON.stringify({
        stage: 'ar-unique-send',
        sendNewPts: content.sendNewPts,
        sendSamePts: content.sendSamePts,
        uniquePresentN: content.uniquePresentN,
        captureN: content.captureN,
        freshness: ndiSnap.skips.ar.freshness,
        busy: ndiSnap.skips.ar.busy,
        rateCap: ndiSnap.skips.ar.rateCap,
        grab2dN: grab2d?.n ?? 0,
        grab2dMeanMs: grab2d?.meanMs ?? null,
        grab2dStartN: content.grab2dStartN,
        overlapHint:
          content.captureDupRunOverlap2dN > 0 || content.grab2dStartN > 0,
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
    const textures = slot.ring ? slot.ring.map((e) => e.tex) : [slot.texture]
    for (const tex of textures) {
      try {
        tex.dispose()
      } catch {
        /* fake textures */
      }
      if (boundTexture === tex) boundTexture = null
    }
  }

  function consumeToRing(
    slot: StreamSlot,
    frame: VideoFrameLike,
    pts90k: number | null,
  ): void {
    const ring = slot.ring
    if (!ring) {
      uploadFrame(slot.texture, frame)
      if (!forceUploadTexture) {
        throw new Error(
          'presentPace requires forceUploadTexture (WebGLRenderer.initTexture)',
        )
      }
      forceUploadTexture(slot.texture)
      sealUploadedVideoTexture(slot.texture, frame)
      return
    }
    let write = -1
    for (let i = 0; i < ring.length; i++) {
      if (slot.hasFrame && i === slot.displayIndex) continue
      if (ring[i]!.pts90k == null) {
        write = i
        break
      }
    }
    if (write < 0) {
      write = (slot.displayIndex + 1) % ring.length
      let oldestPts = ring[write]!.pts90k
      for (let i = 0; i < ring.length; i++) {
        if (slot.hasFrame && i === slot.displayIndex) continue
        const p = ring[i]!.pts90k
        if (p == null) {
          write = i
          break
        }
        if (oldestPts == null || p < oldestPts) {
          oldestPts = p
          write = i
        }
      }
    }
    const entry = ring[write]!
    entry.gpuReady = false
    uploadFrame(entry.tex, frame)
    // Must run before VideoFrame.close() in the pipeline. Three.js only
    // uploads drawn materials unless initTexture forces setTexture2D.
    if (!forceUploadTexture) {
      throw new Error(
        'presentPace requires forceUploadTexture (WebGLRenderer.initTexture)',
      )
    }
    forceUploadTexture(entry.tex)
    sealUploadedVideoTexture(entry.tex, frame)
    entry.pts90k = pts90k
    entry.gpuReady = true
  }

  function bindRing(slot: StreamSlot, pts90k: number): boolean {
    const ring = slot.ring
    if (!ring) return false
    const i = ring.findIndex(
      (e) => e.pts90k === pts90k && e.gpuReady && textureHasImage(e.tex),
    )
    if (i < 0) return false
    slot.displayIndex = i
    slot.texture = ring[i]!.tex
    slot.hasFrame = true
    return true
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
    const ring = presentPace
      ? Array.from({ length: PRESENT_DISPLAY_RING_SLOTS }, () => ({
          tex: createTexture(),
          pts90k: null as number | null,
          gpuReady: false,
        }))
      : null
    const slot: StreamSlot = {
      povId,
      texture: ring ? ring[0]!.tex : createTexture(),
      ring,
      displayIndex: 0,
      lastUsedAt: nowMs(),
      hasFrame: false,
      pipe: createVideoDecodePipeline({
        decoderFactory: options.decoderFactory,
        toNtp: (pts) => toNtp(povId, pts),
        getNewestPoseNtp: () => newestPoseNtp(povId),
        onOpsError: (message) => options.onOpsError?.(povId, message),
        getIngestDiag: () => options.getIngestDiag?.(povId) ?? null,
        presentPace,
        nowMs,
        onConsumeFrame: presentPace
          ? (frame, pts) => {
              const current = streams.get(povId)
              if (current) consumeToRing(current, frame, pts)
            }
          : undefined,
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
      const beforeAu = slot.pipe.getCounters().accessUnits
      slot.pipe.pushBytes(Uint8Array.from(chunk))
      if (povId === activePov) {
        const afterAu = slot.pipe.getCounters().accessUnits
        const now = performance.now()
        for (let i = beforeAu; i < afterAu; i++) diagNoteAuArrival(now)
      }
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
        diagNotePaceTick(performance.now())
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
            const uniqueAdvance = prevPts !== shown.pts90k
            if (slot.povId === activePov) {
              diagNotePresentTick(
                {
                  pts90k: shown.pts90k,
                  reason: shown.pick.reason,
                  povId: slot.povId,
                  wallMs: performance.now(),
                },
                { unique: uniqueAdvance },
              )
            }
            if (uniqueAdvance) {
              diagBump(diag.uniquePts, slot.povId)
              diag.window.unique += 1
              diag.lastPts.set(slot.povId, shown.pts90k)
              if (slot.povId === activePov) {
                diagNotePaceAdvance(performance.now(), shown.pick.reason)
              }
              const frameFormat = videoFramePixelFormat(shown.frame)
              if (!diag.loggedFrameFormat) {
                diag.loggedFrameFormat = true
                console.info(
                  `[diag:srt-fps] ${JSON.stringify({
                    stage: 'video-frame-format',
                    format: frameFormat,
                    codedWidth: shown.frame.codedWidth,
                    codedHeight: shown.frame.codedHeight,
                    displayWidth: shown.frame.displayWidth ?? null,
                    displayHeight: shown.frame.displayHeight ?? null,
                  })}`,
                )
              }
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
                  format: frameFormat,
                })
              }
            } else {
              diagBump(diag.repeatPts, slot.povId)
              diag.window.repeat += 1
            }
            if (slot.texture.image === shown.frame) diag.sameFrameUpload += 1
            if (presentPace) {
              if (prevPts !== shown.pts90k || !slot.hasFrame) {
                bindRing(slot, shown.pts90k)
              }
            } else {
              uploadFrame(slot.texture, shown.frame)
              slot.hasFrame = true
            }
          }
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
