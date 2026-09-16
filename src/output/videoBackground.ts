import * as THREE from 'three'
import { normalizeArBackground } from './applyOutputMode.ts'
import { isOpaque3dPassActive } from './ndiOpaquePass.ts'

export type VideoBackgroundFit = 'cover' | 'contain'

export type VideoBackgroundDrawInput = {
  arBackground: unknown
  hasTexture: boolean
  /** 3D NDI opaque pass — never draw (drone feed behind a 3D look is wrong). */
  opaque3dPass: boolean
  /**
   * `true` when presenting to the canvas (`getRenderTarget() === null`).
   * `false` for FBO / AR NDI readback.
   */
  isScreenPass: boolean
  /** Local window focus (`2d` / `3d` / `ar`). Screen-only; NDI ignores this. */
  localFocus: unknown
  /** Unused for the screen gate (kept so callers do not churn). */
  previewIsAirCamera: boolean
}

export type VideoBackgroundOptions = {
  renderer: THREE.WebGLRenderer
  /**
   * Policy gate from `main.ts` / pumps. Return false to pass through
   * (alpha plate stays byte-identical). Texture-null is handled here too.
   */
  shouldDraw: () => boolean
  /** Optional per-frame texture source. Overrides `setTexture` when set. */
  getTexture?: () => THREE.Texture | null
  /** Aspect fit vs drawing-buffer. Default `cover`. */
  fit?: VideoBackgroundFit
}

export type VideoBackgroundHandle = {
  setTexture: (tex: THREE.Texture | null) => void
  getTexture: () => THREE.Texture | null
  stop: () => void
}

export type TextureFitRect = {
  width: number
  height: number
  x: number
  y: number
}

const TEST_PATTERN_BARS: readonly [number, number, number][] = [
  [220, 40, 40],
  [220, 200, 40],
  [40, 180, 70],
  [40, 180, 200],
  [50, 70, 210],
  [180, 50, 180],
  [230, 230, 230],
  [20, 20, 24],
]

export function normalizeTextureFit(raw: unknown): VideoBackgroundFit {
  return raw === 'contain' ? 'contain' : 'cover'
}

/**
 * Fit a source rectangle into a drawing-buffer destination.
 * Origin is the quad centre in the same pixel space as `visualTimecodeOverlay.layout`.
 */
export function resolveTextureFit(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  fit: VideoBackgroundFit,
): TextureFitRect {
  const srcW = srcWidth > 0 && Number.isFinite(srcWidth) ? srcWidth : 1
  const srcH = srcHeight > 0 && Number.isFinite(srcHeight) ? srcHeight : 1
  const dstW = dstWidth > 0 && Number.isFinite(dstWidth) ? dstWidth : 1
  const dstH = dstHeight > 0 && Number.isFinite(dstHeight) ? dstHeight : 1
  const srcAspect = srcW / srcH
  const dstAspect = dstW / dstH
  let width: number
  let height: number
  if (fit === 'contain') {
    if (srcAspect > dstAspect) {
      width = dstW
      height = dstW / srcAspect
    } else {
      height = dstH
      width = dstH * srcAspect
    }
  } else if (srcAspect > dstAspect) {
    height = dstH
    width = dstH * srcAspect
  } else {
    width = dstW
    height = dstW / srcAspect
  }
  return { width, height, x: dstW / 2, y: dstH / 2 }
}

/**
 * Source pixel size for fit. Prefers `videoWidth`/`videoHeight` (HTMLVideoElement /
 * VideoFrame-backed textures) over `width`/`height`.
 */
export function resolveTextureSourceSize(
  tex: THREE.Texture | null | undefined,
): { width: number; height: number } | null {
  if (!tex) return null
  const img = tex.image as
    | {
        width?: number
        height?: number
        videoWidth?: number
        videoHeight?: number
      }
    | undefined
  if (!img) return null
  const videoW = img.videoWidth
  const videoH = img.videoHeight
  if (
    typeof videoW === 'number' &&
    videoW > 0 &&
    typeof videoH === 'number' &&
    videoH > 0
  ) {
    return { width: videoW, height: videoH }
  }
  const w = img.width
  const h = img.height
  if (typeof w === 'number' && w > 0 && typeof h === 'number' && h > 0) {
    return { width: w, height: h }
  }
  return null
}

/**
 * Pure draw gate. `main.ts` supplies live state; this module does not read
 * pumps or scene cameras itself.
 */
export function shouldDrawVideoBackground(
  input: VideoBackgroundDrawInput,
): boolean {
  if (normalizeArBackground(input.arBackground) !== 'video') return false
  if (!input.hasTexture) return false
  if (input.opaque3dPass) return false
  if (input.isScreenPass) {
    // Local AR window must show the ingest even in free cam. Default ops
    // view is free; hiding the underlay there made Connect SRT look dead.
    return input.localFocus === 'ar'
  }
  return true
}

/** Convenience: read 3D-pass flag from `ndiOpaquePass`. */
export function opaque3dPassBlocksBackground(): boolean {
  return isOpaque3dPassActive()
}

/**
 * Colour-bar DataTexture for compositor development. OUT-06 replaces this
 * via `setTexture` with a decoded `VideoTexture`.
 */
export function createVideoBackgroundTestPattern(
  width = 320,
  height = 180,
): THREE.DataTexture {
  const w = Math.max(8, Math.floor(width))
  const h = Math.max(8, Math.floor(height))
  const data = new Uint8Array(w * h * 4)
  const barCount = TEST_PATTERN_BARS.length
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bar = Math.min(barCount - 1, Math.floor((x / w) * barCount))
      const [r, g, b] = TEST_PATTERN_BARS[bar]!
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function applySampledColorSpace(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace
}

/**
 * Fullscreen background quad drawn **before** the scene via a `renderer.render`
 * wrap (mirror of `visualTimecodeOverlay`, which draws after).
 *
 * Install **before** optional `startVisualTimecode`. NDI pumps bind
 * `renderer.render` last (the video-background wrap when the barcode is off).
 */
export function startVideoBackground(
  options: VideoBackgroundOptions,
): VideoBackgroundHandle {
  const { renderer, shouldDraw } = options
  const fit = normalizeTextureFit(options.fit)

  let currentTexture: THREE.Texture | null = null
  let stopped = false

  const material = new THREE.MeshBasicMaterial({
    map: null,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    transparent: false,
  })
  const geometry = new THREE.PlaneGeometry(1, 1)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1000

  const bgScene = new THREE.Scene()
  bgScene.add(mesh)

  const bgCam = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10)
  bgCam.position.z = 1

  function resolveTexture(): THREE.Texture | null {
    if (options.getTexture) return options.getTexture()
    return currentTexture
  }

  function bindTexture(tex: THREE.Texture | null): void {
    if (tex) applySampledColorSpace(tex)
    material.map = tex
    material.needsUpdate = true
  }

  function layout(tex: THREE.Texture): boolean {
    const size = resolveTextureSourceSize(tex)
    if (!size) return false
    const el = renderer.domElement
    const width = el.width || 1
    const height = el.height || 1
    const rect = resolveTextureFit(
      size.width,
      size.height,
      width,
      height,
      fit,
    )
    bgCam.left = 0
    bgCam.right = width
    bgCam.top = height
    bgCam.bottom = 0
    bgCam.updateProjectionMatrix()
    mesh.scale.set(rect.width, rect.height, 1)
    mesh.position.set(rect.x, rect.y, 0)
    return true
  }

  const originalRender = renderer.render.bind(renderer)
  renderer.render = ((scene: THREE.Scene, camera: THREE.Camera) => {
    if (stopped || scene === bgScene) {
      originalRender(scene, camera)
      return
    }
    // Timecode overlay (and any other ortho post-pass) must not retrigger
    // a clear + background draw.
    if (camera instanceof THREE.OrthographicCamera) {
      originalRender(scene, camera)
      return
    }
    const tex = resolveTexture()
    if (!tex || !shouldDraw()) {
      originalRender(scene, camera)
      return
    }
    bindTexture(tex)
    if (!layout(tex)) {
      originalRender(scene, camera)
      return
    }
    const prevAutoClear = renderer.autoClear
    renderer.autoClear = true
    originalRender(bgScene, bgCam)
    renderer.autoClear = false
    try {
      originalRender(scene, camera)
    } finally {
      renderer.autoClear = prevAutoClear
    }
  }) as typeof renderer.render

  return {
    setTexture(tex): void {
      currentTexture = tex
      bindTexture(tex)
    },
    getTexture: () => resolveTexture(),
    stop(): void {
      if (stopped) return
      stopped = true
      renderer.render = originalRender as typeof renderer.render
      bgScene.remove(mesh)
      geometry.dispose()
      material.dispose()
      currentTexture = null
    },
  }
}
