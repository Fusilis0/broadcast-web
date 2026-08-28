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

/** Ops Output rail: live send fps, or em-dash when off / unavailable. */
export function formatNdiSendFps(
  fps: number | null | undefined,
  available: boolean,
): string {
  if (!available) return '—'
  if (fps == null || !Number.isFinite(fps) || fps <= 0) return '—'
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
