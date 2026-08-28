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

  const unsubs: Array<() => void> = []

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
    victim.pipe.dispose()
    try {
      victim.texture.dispose()
    } catch {
      /* fake textures */
    }
    streams.delete(victim.povId)
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
      if (disposed || !povId) return
      const slot = ensure(povId)
      if (!slot) return
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
      if (disposed) return
      const polled = options.getActivePovId?.() ?? null
      if (polled && polled !== activePov) handle.setActivePov(polled)
      for (const slot of streams.values()) {
        const shown = slot.pipe.present()
        if (!shown) continue
        uploadFrame(slot.texture, shown.frame)
        slot.hasFrame = true
      }
      bindActiveTexture()
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
