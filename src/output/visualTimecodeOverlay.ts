import * as THREE from 'three'
import { telemetryBus, type TelemetryData } from '../telemetry/index.ts'
import {
  TIMECODE_BIT_COUNT,
  TIMECODE_COLS,
  TIMECODE_ROWS,
  writeVisualTimecodeRgba,
} from './visualTimecodeEncode.ts'

export type TimecodeCorner = 'bottom-right' | 'bottom-left'

export type VisualTimecodeOptions = {
  /** Scene WebGL renderer — overlay draws on the same canvas (capture-safe). */
  renderer: THREE.WebGLRenderer
  /** Active POV id from SCN (`scene.getActivePovId`). */
  getActivePovId: () => string
  /**
   * When false, no bus subscription / no overlay draw.
   * Default true (ops burn-in on).
   */
  enabled?: boolean
  /** Screen corner for the barcode. Default `bottom-right` (away from OUT mode control). */
  corner?: TimecodeCorner
  /**
   * Barcode size in **CSS reference pixels** (8×8 logical scaled up).
   * Applied in drawing-buffer space as `sizePx * devicePixelRatio` so the
   * burn-in stays fixed when the canvas is CSS-scaled (Electron studio).
   * Clamped to 32–256; default 96.
   */
  sizePx?: number
  /** Margin from edges in CSS reference pixels. Default 12. */
  marginPx?: number
}

export type VisualTimecodeHandle = {
  /** Last encoded telemetry timestamp (ms), or null before first encode. */
  getLastEncodedMs: () => number | null
  setEnabled: (enabled: boolean) => void
  stop: () => void
}

const DEFAULT_SIZE_PX = 96
const DEFAULT_MARGIN_PX = 12

function clampSizePx(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_SIZE_PX
  return Math.min(256, Math.max(32, Math.round(raw)))
}

function normalizeCorner(raw: unknown): TimecodeCorner {
  return raw === 'bottom-left' ? 'bottom-left' : 'bottom-right'
}

/**
 * Burn Unity-compatible 8×8 LSB visual timecode into the WebGL canvas.
 *
 * Implementation: orthographic overlay scene + `DataTexture` (NearestFilter),
 * drawn after the main scene via a thin `renderer.render` wrap so
 * canvas-only capture still includes the barcode. No sibling DOM canvas.
 *
 * Timestamp source: active POV drone `ts` from `telemetryBus`; fallback to
 * latest drone `ts` across ids (Unity `useGlobalLatest` analogue).
 */
export function startVisualTimecode(
  options: VisualTimecodeOptions,
): VisualTimecodeHandle {
  let enabled = options.enabled !== false
  const corner = normalizeCorner(options.corner)
  const sizePx = clampSizePx(options.sizePx)
  const marginPx =
    typeof options.marginPx === 'number' && Number.isFinite(options.marginPx)
      ? Math.max(0, options.marginPx)
      : DEFAULT_MARGIN_PX

  const { renderer, getActivePovId } = options

  const rgba = new Uint8Array(TIMECODE_BIT_COUNT * 4)
  writeVisualTimecodeRgba(0, rgba)

  const texture = new THREE.DataTexture(
    rgba,
    TIMECODE_COLS,
    TIMECODE_ROWS,
    THREE.RGBAFormat,
  )
  // Keep data[0] at bottom-left (Unity texture origin / decoder scan order).
  texture.flipY = false
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.needsUpdate = true

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    transparent: false,
  })

  const geometry = new THREE.PlaneGeometry(1, 1)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 999

  const overlayScene = new THREE.Scene()
  overlayScene.add(mesh)

  // Pixel space: y=0 bottom, y=height top (matches Unity bottom-left LSB).
  const overlayCam = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10)
  overlayCam.position.z = 1

  const lastTsById = new Map<string, number>()
  let globalLatestTs: number | null = null
  let lastEncoded: number | null = null
  let stopped = false

  function layout(): void {
    const el = renderer.domElement
    // Drawing buffer (not CSS client size) — keeps barcode static on NDI when
    // the Electron window is resized / letterboxed via object-fit.
    const width = el.width || 1
    const height = el.height || 1
    const dpr = Math.max(renderer.getPixelRatio(), 1)
    const sizeBuf = sizePx * dpr
    const marginBuf = marginPx * dpr

    overlayCam.left = 0
    overlayCam.right = width
    overlayCam.top = height
    overlayCam.bottom = 0
    overlayCam.updateProjectionMatrix()

    mesh.scale.set(sizeBuf, sizeBuf, 1)
    const half = sizeBuf / 2
    const x =
      corner === 'bottom-left'
        ? marginBuf + half
        : width - marginBuf - half
    const y = marginBuf + half
    mesh.position.set(x, y, 0)
  }

  function resolveMs(): number {
    const activeId = getActivePovId()
    const activeTs = lastTsById.get(activeId)
    if (activeTs !== undefined) return activeTs
    if (globalLatestTs !== null) return globalLatestTs
    return 0
  }

  function syncEncode(): void {
    const ms = resolveMs()
    if (lastEncoded !== null && ms === lastEncoded) return
    lastEncoded = ms
    writeVisualTimecodeRgba(ms, rgba)
    texture.needsUpdate = true
  }

  function onDrone(packet: TelemetryData): void {
    if (stopped) return
    const ts = packet.ts
    if (!Number.isFinite(ts)) return
    lastTsById.set(packet.id, ts)
    if (globalLatestTs === null || ts >= globalLatestTs) {
      globalLatestTs = ts
    }
  }

  const unsub = telemetryBus.on('drone', onDrone)

  layout()
  window.addEventListener('resize', layout)

  const originalRender = renderer.render.bind(renderer)
  renderer.render = ((scene: THREE.Scene, camera: THREE.Camera) => {
    originalRender(scene, camera)
    if (stopped || !enabled) return
    // Skip recursive overlay→overlay if somehow called with our scene.
    if (scene === overlayScene) return
    syncEncode()
    // Re-layout against drawing buffer each frame (stable under CSS resize).
    layout()
    const prevAutoClear = renderer.autoClear
    renderer.autoClear = false
    try {
      originalRender(overlayScene, overlayCam)
    } finally {
      renderer.autoClear = prevAutoClear
    }
  }) as typeof renderer.render

  return {
    getLastEncodedMs: () => lastEncoded,
    setEnabled(next): void {
      enabled = next
    },
    stop(): void {
      if (stopped) return
      stopped = true
      unsub()
      window.removeEventListener('resize', layout)
      renderer.render = originalRender as typeof renderer.render
      overlayScene.remove(mesh)
      geometry.dispose()
      material.dispose()
      texture.dispose()
      lastTsById.clear()
    },
  }
}
