/**
 * Measurement helpers (DSP-PRF-20260826-01).
 *
 * Live counters only — does not change preview rAF, NDI caps, or
 * `STUDIO_TICK_FPS`. Workers must not assert GPU fps in unit tests.
 */

export const PERF_WINDOW_MS = 1000
export const HITCH_DT_MS_33 = 33
export const HITCH_DT_MS_50 = 50

export type SendFpsCounter = {
  /** Record one successful send (not a staggered-away claim). */
  record: (nowMs: number) => void
  /** Successful sends in the trailing window (0 when empty). */
  getFps: (nowMs: number) => number
}

/**
 * Count successful events in a trailing window. `getFps` is the count in the
 * last `windowMs` (sends/s when window is 1 s) — not (n−1)/dt.
 */
export function createSendFpsCounter(
  windowMs: number = PERF_WINDOW_MS,
): SendFpsCounter {
  const span =
    typeof windowMs === 'number' && windowMs > 0 ? windowMs : PERF_WINDOW_MS
  const stamps: number[] = []

  function prune(nowMs: number): void {
    const cut = nowMs - span
    while (stamps.length > 0 && stamps[0]! < cut) {
      stamps.shift()
    }
  }

  return {
    record(nowMs: number): void {
      stamps.push(nowMs)
      prune(nowMs)
    },
    getFps(nowMs: number): number {
      prune(nowMs)
      return stamps.length
    },
  }
}

/**
 * Ops Output rail: live send fps. Em-dash when the channel is off /
 * unavailable. **0 fps** (not em-dash) when the sender is available but
 * counted no successful `sendFrame` this window — live + silent must not
 * look like a healthy dash.
 */
export function formatNdiSendFps(
  fps: number | null | undefined,
  available: boolean,
): string {
  if (!available) return '—'
  if (fps == null || !Number.isFinite(fps) || fps <= 0) return '0 fps'
  return `${Math.round(fps)} fps`
}

/**
 * Short GPU string for the Race ops HUD (`GPU · NVIDIA …` / `GPU · unknown`).
 * Never include Cesium ion tokens — this is adapter text only.
 */
export function formatGpuHudLabel(
  unmaskedRenderer: string | null | undefined,
): string {
  if (unmaskedRenderer == null) return 'GPU · unknown'
  const trimmed = unmaskedRenderer.trim()
  if (trimmed === '') return 'GPU · unknown'
  return `GPU · ${shortenUnmaskedRenderer(trimmed)}`
}

/** Compact ANGLE / raw WebGL renderer strings for a one-line HUD. */
export function shortenUnmaskedRenderer(raw: string): string {
  const angle = raw.match(/ANGLE\s*\(\s*([^,]+)\s*,\s*([^,]+)/i)
  if (angle) {
    let renderer = angle[2]!.trim()
    renderer = renderer.replace(/\s+Direct3D[\d.]+.*$/i, '')
    renderer = renderer.replace(/\s+\(0x[0-9a-f]+\)/i, '')
    renderer = truncateHud(renderer)
    return renderer || angle[1]!.trim()
  }
  return truncateHud(raw.replace(/\s+OpenGL Engine$/i, '').trim())
}

export type WebGlGpuInfo = {
  /** HUD text, always `GPU · …`. */
  display: string
  /** Unmasked renderer (log once at boot). Null when the extension is missing. */
  raw: string | null
}

type GlDebugExt = {
  UNMASKED_RENDERER_WEBGL: number
  UNMASKED_VENDOR_WEBGL: number
}

type GlLike = {
  getExtension: (name: string) => GlDebugExt | null
  getParameter: (pname: number) => unknown
}

/**
 * Read `WEBGL_debug_renderer_info` after `WebGLRenderer` create.
 * Missing extension → `GPU · unknown` (no throw).
 */
export function readWebGlGpuInfo(
  gl: GlLike | null | undefined,
): WebGlGpuInfo {
  if (!gl) return { display: 'GPU · unknown', raw: null }
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return { display: 'GPU · unknown', raw: null }
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    const raw = typeof renderer === 'string' ? renderer : null
    return { display: formatGpuHudLabel(raw), raw }
  } catch {
    return { display: 'GPU · unknown', raw: null }
  }
}

function truncateHud(s: string, max = 36): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1).trimEnd()}…`
}

export type StageStats = {
  count: number
  sumMs: number
  maxMs: number
  meanMs: number
}

/**
 * Cheap per-stage accumulator (DSP-PRF-20260829-01).
 * Call `add` with an elapsed ms; snapshot mean/max without allocating per sample.
 */
export function createStageAccumulator(): {
  add: (elapsedMs: number) => void
  snapshot: () => StageStats
  reset: () => void
} {
  let count = 0
  let sumMs = 0
  let maxMs = 0
  return {
    add(elapsedMs: number): void {
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return
      count += 1
      sumMs += elapsedMs
      if (elapsedMs > maxMs) maxMs = elapsedMs
    },
    snapshot(): StageStats {
      return {
        count,
        sumMs,
        maxMs,
        meanMs: count > 0 ? sumMs / count : 0,
      }
    },
    reset(): void {
      count = 0
      sumMs = 0
      maxMs = 0
    },
  }
}

export type IntHistogram = {
  record: (value: number) => void
  snapshot: () => Record<string, number>
  reset: () => void
}

/**
 * Integer histogram that keeps exact counts for `1 .. maxExact-1` and
 * buckets the rest as `${maxExact}+`. A mean would hide a 2-vs-3 split.
 */
export function createIntHistogram(maxExact: number = 6): IntHistogram {
  const cap = maxExact > 1 ? maxExact : 6
  const counts = new Map<number, number>()
  let overflow = 0
  return {
    record(value: number): void {
      const v = value | 0
      if (v < 1) return
      if (v >= cap) {
        overflow += 1
        return
      }
      counts.set(v, (counts.get(v) ?? 0) + 1)
    },
    snapshot(): Record<string, number> {
      const out: Record<string, number> = {}
      for (let i = 1; i < cap; i++) {
        const n = counts.get(i)
        if (n) out[String(i)] = n
      }
      if (overflow > 0) out[`${cap}+`] = overflow
      return out
    },
    reset(): void {
      counts.clear()
      overflow = 0
    },
  }
}

/** Compact `2:180 3:120` — never a single mean. */
export function formatIntHistogram(hist: Record<string, number>): string {
  const keys = Object.keys(hist)
  if (keys.length === 0) return '—'
  return keys.map((k) => `${k}:${hist[k]}`).join(' ')
}

/**
 * Tick-interval bucket (ms, floored). 16.7 ms ticks land in `16`.
 * Distribution, not a mean — jitter of ±0.5 ms is the phase-lock defect.
 */
export function tickIntervalBucketMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'other'
  const floored = Math.floor(ms)
  if (floored < 14) return '≤13'
  if (floored <= 20) return String(floored)
  if (floored < 25) return '21-24'
  if (floored < 34) return '25-33'
  return '≥34'
}
