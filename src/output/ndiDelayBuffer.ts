/**
 * Per-channel NDI delay ring (Phase 13.6).
 *
 * BW locks:
 * - Default delay = 0 (immediate send; **no** ring allocated)
 * - Max = 30000 ms (clamp)
 * - Allocate / push only when delayMs > 0
 * - UI warns above 3000 ms (soft); values up to 30000 still allowed
 *
 * Memory (RGBA8 @ 30 fps): `width * height * 4 * ceil(delayMs/1000 * fps)`.
 * Example: 1920×1080 × 30 s ≈ **~7.5 GB per channel**.
 */

export const NDI_DELAY_MS_MIN = 0
export const NDI_DELAY_MS_MAX = 30_000
/** Soft UI guidance threshold — not a hard refuse. */
export const NDI_DELAY_WARN_MS = 3_000
export const NDI_DELAY_MS_DEFAULT = 0

const DEFAULT_FPS_FOR_ESTIMATE = 30

export type NdiDelayedFrame = {
  capturedAtMs: number
  width: number
  height: number
  /** Owned RGBA pixel buffer (caller supplies a detached copy). */
  data: ArrayBuffer
  bottomUp: boolean
  /** DIAG:srt-fps — present() PTS/reason stamped at AR capture begin. */
  contentPts90k?: number | null
  contentReason?: string | null
}

export type OutputDelayMsConfig = {
  ar: number
  '3d': number
  '2d': number
}

export const DEFAULT_OUTPUT_DELAY_MS: Readonly<OutputDelayMsConfig> = {
  ar: NDI_DELAY_MS_DEFAULT,
  '3d': NDI_DELAY_MS_DEFAULT,
  '2d': NDI_DELAY_MS_DEFAULT,
}

/** Clamp to 0..30000 (integer ms). Non-finite → 0. */
export function clampNdiDelayMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return NDI_DELAY_MS_DEFAULT
  }
  return Math.min(
    NDI_DELAY_MS_MAX,
    Math.max(NDI_DELAY_MS_MIN, Math.round(raw)),
  )
}

export function isNdiDelayHighMemory(delayMs: number): boolean {
  return clampNdiDelayMs(delayMs) > NDI_DELAY_WARN_MS
}

/**
 * Expected RAM for a standing delay buffer (0 when delay is 0).
 * Does not allocate — estimate only.
 */
export function estimateNdiDelayBufferBytes(input: {
  width: number
  height: number
  delayMs: number
  fps?: number
}): number {
  const delayMs = clampNdiDelayMs(input.delayMs)
  if (delayMs <= 0) return 0
  const fps =
    typeof input.fps === 'number' && input.fps > 0
      ? input.fps
      : DEFAULT_FPS_FOR_ESTIMATE
  const frames = Math.max(1, Math.ceil((delayMs / 1000) * fps))
  const w = Math.max(0, Math.floor(input.width))
  const h = Math.max(0, Math.floor(input.height))
  return w * h * 4 * frames
}

/** Normalize optional `config.outputDelayMs` (missing keys → 0). */
export function normalizeOutputDelayMs(raw: unknown): OutputDelayMsConfig {
  if (raw === null || typeof raw !== 'object') {
    return { ...DEFAULT_OUTPUT_DELAY_MS }
  }
  const o = raw as Record<string, unknown>
  return {
    ar: clampNdiDelayMs(o.ar),
    '3d': clampNdiDelayMs(o['3d']),
    '2d': clampNdiDelayMs(o['2d']),
  }
}

/**
 * Timestamped frame ring between capture and `sendFrame`.
 * At delay 0 the ring stays empty — `push` returns the frame immediately.
 */
export class NdiDelayBuffer {
  #delayMs = NDI_DELAY_MS_DEFAULT
  #queue: NdiDelayedFrame[] = []

  getDelayMs(): number {
    return this.#delayMs
  }

  getBufferedCount(): number {
    return this.#queue.length
  }

  /**
   * Live delay change (no app restart). Setting 0 or **shrinking** drops
   * buffered frames so RAM falls immediately.
   */
  setDelayMs(raw: unknown): number {
    const next = clampNdiDelayMs(raw)
    if (next === this.#delayMs) return next
    if (next === 0 || next < this.#delayMs) {
      this.#queue = []
    }
    this.#delayMs = next
    return next
  }

  clear(): void {
    this.#queue = []
  }

  /**
   * Push a newly captured frame.
   * - delay 0: bypass — returns `[frame]` without storing (no ring growth).
   * - delay > 0: enqueues, then returns frames ready to send (`age >= delayMs`).
   */
  push(
    frame: NdiDelayedFrame,
    nowMs: number = frame.capturedAtMs,
  ): NdiDelayedFrame[] {
    if (this.#delayMs <= 0) {
      return [frame]
    }
    this.#queue.push(frame)
    this.#trimOverflow()
    return this.popReady(nowMs)
  }

  /** Pop frames whose capture time is at least `delayMs` ago (FIFO). */
  popReady(nowMs: number): NdiDelayedFrame[] {
    if (this.#delayMs <= 0 || this.#queue.length === 0) return []
    const ready: NdiDelayedFrame[] = []
    const threshold = nowMs - this.#delayMs
    while (
      this.#queue.length > 0 &&
      this.#queue[0]!.capturedAtMs <= threshold
    ) {
      ready.push(this.#queue.shift()!)
    }
    return ready
  }

  /** Soft cap so a stalled sender cannot grow unbounded. */
  #trimOverflow(): void {
    const maxFrames = Math.max(
      2,
      Math.ceil((this.#delayMs / 1000) * DEFAULT_FPS_FOR_ESTIMATE) + 2,
    )
    while (this.#queue.length > maxFrames) {
      this.#queue.shift()
    }
  }
}
