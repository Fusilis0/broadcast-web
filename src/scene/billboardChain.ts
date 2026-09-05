import { layoutFeatures } from './features/layoutFeatures.ts'
import type {
  GpsToEnuAmslFn,
  LayoutFeature,
  WorldFeature,
} from './features/types.ts'
import { facingBasisFromSpan } from './sponsors/sponsorBillboard.ts'
import { DEFAULT_BILLBOARD_CHAIN_SPACING_M } from './features/editor/featureFactory.ts'
import { gpsToEnuAmsl } from '../geodesy/index.ts'
import * as THREE from 'three'
import {
  chainRibbonPeriodUrls,
  drawChainRibbon,
  planChainRibbon,
  resolveChainLogos,
  resolveChainPanelColor,
} from './billboardLogos.ts'
import { resolvePanelAlpha } from './sponsors/boardCompose.ts'

export {
  chainBoardCanvasSize,
  chainRibbonCanvasSize,
  chainRibbonPeriodUrls,
  cloneBillboardLogos,
  DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
  drawChainRibbon,
  parseBillboardLogos,
  pickChainTextureUrl,
  planChainRibbon,
  recordChainRibbonDraws,
  resolveChainLogos,
  resolveChainPanelColor,
  weightedFairInterleave,
  type BillboardLogo,
  type ChainRibbonPlan,
} from './billboardLogos.ts'

export type BillboardChainHandle = {
  root: THREE.Group
  dispose: () => void
  /** Mount diagnostics (segments vs textures — remount VRAM). */
  stats: BillboardChainMountPlan
}

export type EnuSample = { x: number; z: number; alongX: number; alongZ: number }

export type BillboardChainMountPlan = {
  chainCount: number
  /** Ribbon meshes (= polyline segments). */
  instanceCount: number
  /** Alias of `instanceCount` (DSP-02 mount tests). */
  segmentCount: number
  /** Composed period textures (0 = solid colour only). */
  uniqueBoardKeyCount: number
  /** Alias of `uniqueBoardKeyCount`. */
  textureCount: number
  totalLengthM: number
  /** Legacy discrete 6 m boards @ spacingM (OOM baseline). */
  legacyInstanceEstimate: number
  /** RGBA bytes for ribbon period texture(s). */
  approxBytesShared: number
  /** RGBA bytes if every legacy sample had its own 1k canvas. */
  approxBytesIfUnshared: number
}

/**
 * Sample points along a polyline at approximately `spacingM` intervals.
 * Kept for tests / diagnostics; ribbon mount uses full segments instead.
 */
export function samplePolylineAtSpacing(
  points: readonly { x: number; z: number }[],
  spacingM: number,
): EnuSample[] {
  if (points.length < 2) return []
  const spacing =
    Number.isFinite(spacingM) && spacingM > 0
      ? spacingM
      : DEFAULT_BILLBOARD_CHAIN_SPACING_M

  const samples: EnuSample[] = []
  let carry = 0

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const segLen = Math.hypot(dx, dz)
    if (segLen < 1e-6) continue
    const ux = dx / segLen
    const uz = dz / segLen

    let dist = carry === 0 && samples.length === 0 ? 0 : spacing - carry
    if (samples.length === 0) {
      samples.push({ x: a.x, z: a.z, alongX: ux, alongZ: uz })
      dist = spacing
    }

    while (dist <= segLen + 1e-9) {
      samples.push({
        x: a.x + ux * dist,
        z: a.z + uz * dist,
        alongX: ux,
        alongZ: uz,
      })
      dist += spacing
    }
    carry = segLen - (dist - spacing)
    if (carry < 0) carry = 0
  }

  return samples
}

/** Sum of horizontal segment lengths (metres). */
export function polylineLengthM(
  points: readonly { x: number; z: number }[],
): number {
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    len += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return len
}

/** @deprecated Discrete 6 m panels — ribbon no longer uses this for mesh width. */
export const CHAIN_INSTANCE_WIDTH_M = 6

function rgbaBytes(canvasW: number, canvasH: number): number {
  return Math.max(1, canvasW) * Math.max(1, canvasH) * 4
}

/**
 * Count ribbon segments / textures before allocating GPU canvases.
 * Pure ENU layout — no WebGL.
 */
export function planBillboardChainMount(
  features: readonly WorldFeature[],
  gpsToEnu: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): BillboardChainMountPlan {
  const chains = features.filter((f) => f.type === 'billboardChain')
  const layout = layoutFeatures(chains, gpsToEnu)
  let instanceCount = 0
  let uniqueBoardKeyCount = 0
  let totalLengthM = 0
  let legacyInstanceEstimate = 0
  let approxBytesShared = 0
  let approxBytesIfUnshared = 0

  for (const f of layout) {
    if (f.points.length < 2) continue
    const spacing =
      f.spacingM !== undefined && f.spacingM > 0
        ? f.spacingM
        : DEFAULT_BILLBOARD_CHAIN_SPACING_M
    const heightM = f.heightM ?? 8
    const logos = resolveChainLogos(f)
    const periodUrls = chainRibbonPeriodUrls(logos)
    const pts = f.points.map((p) => ({ x: p.x, z: p.z }))
    const len = polylineLengthM(pts)
    totalLengthM += len
    const legacySamples = samplePolylineAtSpacing(pts, spacing)
    legacyInstanceEstimate += legacySamples.length

    let segs = 0
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!
      const b = pts[i + 1]!
      const seg = Math.hypot(b.x - a.x, b.z - a.z)
      if (seg < 1e-6) continue
      segs += 1
    }
    instanceCount += segs

    if (periodUrls.length > 0 && segs > 0) {
      // One shared period texture per chain (UV-repeated on each segment).
      uniqueBoardKeyCount += 1
      const plan = planChainRibbon({
        spacingM: spacing,
        heightM,
        slots: periodUrls.map(() => ({ width: 100, height: 100 })),
      })
      approxBytesShared += rgbaBytes(plan.canvasW, plan.canvasH)
    }

    // Legacy: one 1024×aspect canvas per discrete sample.
    const legacyCanvasH = Math.max(
      1,
      Math.round(1024 * (heightM / CHAIN_INSTANCE_WIDTH_M)),
    )
    approxBytesIfUnshared +=
      legacySamples.length * rgbaBytes(1024, legacyCanvasH)
  }

  return {
    chainCount: chains.length,
    instanceCount,
    segmentCount: instanceCount,
    uniqueBoardKeyCount,
    textureCount: uniqueBoardKeyCount,
    totalLengthM,
    legacyInstanceEstimate,
    approxBytesShared,
    approxBytesIfUnshared,
  }
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error(`[billboardChain] image load failed: ${url}`))
    img.src = url
  })
}

function sourceSize(src: CanvasImageSource): { width: number; height: number } {
  if (
    typeof HTMLImageElement !== 'undefined' &&
    src instanceof HTMLImageElement &&
    src.naturalWidth > 0
  ) {
    return { width: src.naturalWidth, height: src.naturalHeight }
  }
  if ('width' in src && 'height' in src) {
    const w = Number(src.width)
    const h = Number(src.height)
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h }
    }
  }
  return { width: 1, height: 1 }
}

async function createRibbonTexture(input: {
  panelColor: number
  panelAlpha?: number
  spacingM: number
  heightM: number
  periodUrls: readonly string[]
  logoCache: Map<string, HTMLImageElement | null>
}): Promise<THREE.CanvasTexture | null> {
  if (input.periodUrls.length === 0) return null

  const images: (HTMLImageElement | null)[] = []
  for (const url of input.periodUrls) {
    if (input.logoCache.has(url)) {
      images.push(input.logoCache.get(url) ?? null)
      continue
    }
    try {
      const img = await loadHtmlImage(url)
      input.logoCache.set(url, img)
      images.push(img)
    } catch (err) {
      console.warn(`[billboardChain] texture failed (${url}); empty slot`, err)
      input.logoCache.set(url, null)
      images.push(null)
    }
  }

  const slots = images.map((img) => (img ? sourceSize(img) : null))
  const plan = planChainRibbon({
    panelColor: input.panelColor,
    panelAlpha: input.panelAlpha,
    spacingM: input.spacingM,
    heightM: input.heightM,
    slots,
  })
  const canvas = document.createElement('canvas')
  canvas.width = plan.canvasW
  canvas.height = plan.canvasH
  const ctx = canvas.getContext('2d')
  if (ctx) drawChainRibbon(ctx, plan, images)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  const alpha = resolvePanelAlpha(input.panelAlpha)
  tex.premultiplyAlpha = alpha >= 1
  tex.needsUpdate = true
  return tex
}

/**
 * Mount a continuous upright ribbon per polyline segment.
 * `spacingM` = logo pitch on the strip (U repeat), not a gap between panels.
 */
export async function mountBillboardChains(
  scene: THREE.Scene,
  features: readonly WorldFeature[],
  gpsToEnu: GpsToEnuAmslFn = (lat, lon, alt) => {
    const v = gpsToEnuAmsl(lat, lon, alt)
    return { x: v.x, y: v.y, z: v.z }
  },
): Promise<BillboardChainHandle | null> {
  const chains = features.filter((f) => f.type === 'billboardChain')
  if (chains.length === 0) return null

  const stats = planBillboardChainMount(features, gpsToEnu)
  console.info('[billboardChain] mount plan', {
    chains: stats.chainCount,
    segments: stats.instanceCount,
    textures: stats.uniqueBoardKeyCount,
    lengthM: Math.round(stats.totalLengthM),
    legacyInstances: stats.legacyInstanceEstimate,
    approxMbShared: Math.round(stats.approxBytesShared / 1e6),
    approxMbIfLegacyUnshared: Math.round(stats.approxBytesIfUnshared / 1e6),
  })

  const root = new THREE.Group()
  root.name = 'billboardChains'
  const disposers: Array<() => void> = []
  const logoCache = new Map<string, HTMLImageElement | null>()

  const layout = layoutFeatures(chains, gpsToEnu)
  for (const f of layout) {
    await mountOneRibbonChain(root, f, disposers, logoCache)
  }

  scene.add(root)
  return {
    root,
    stats,
    dispose(): void {
      // Detach before GPU dispose so a concurrent preview tick cannot render
      // disposed geometries (which used to set stopped=true → permanent white).
      root.removeFromParent()
      for (const d of disposers) d()
      disposers.length = 0
      root.clear()
    },
  }
}

async function mountOneRibbonChain(
  parent: THREE.Group,
  f: LayoutFeature,
  disposers: Array<() => void>,
  logoCache: Map<string, HTMLImageElement | null>,
): Promise<void> {
  if (f.points.length < 2) {
    console.info('[billboardChain] skip chain', {
      id: f.id,
      reason: 'points < 2',
    })
    return
  }

  const spacing =
    f.spacingM !== undefined && f.spacingM > 0
      ? f.spacingM
      : DEFAULT_BILLBOARD_CHAIN_SPACING_M
  const heightM = f.heightM ?? 8
  const panelColor = resolveChainPanelColor(f.panelColor)
  const panelAlpha = resolvePanelAlpha(f.panelAlpha)
  const translucent = panelAlpha < 1
  const logos = resolveChainLogos(f)
  const periodUrls = chainRibbonPeriodUrls(logos)

  let sharedMap: THREE.CanvasTexture | null = null
  try {
    sharedMap = await createRibbonTexture({
      panelColor,
      panelAlpha,
      spacingM: spacing,
      heightM,
      periodUrls,
      logoCache,
    })
  } catch (err) {
    console.warn(`[billboardChain] ribbon texture failed for ${f.id}`, err)
    sharedMap = null
  }

  if (sharedMap) {
    disposers.push(() => sharedMap!.dispose())
  }

  const periodMeters =
    periodUrls.length > 0
      ? Math.max(spacing, periodUrls.length * spacing)
      : spacing

  const pts = f.points.map((p) => ({ x: p.x, y: p.y, z: p.z }))
  let along = 0
  let mounted = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const segLen = Math.hypot(b.x - a.x, b.z - a.z)
    if (segLen < 1e-6) continue

    const basis = facingBasisFromSpan(a.x, a.z, b.x, b.z)
    if (!basis) continue

    const geo = new THREE.PlaneGeometry(segLen, heightM)
    if (sharedMap && periodMeters > 0) {
      const u0 = along / periodMeters
      const u1 = (along + segLen) / periodMeters
      const uv = geo.attributes.uv
      if (uv) {
        for (let vi = 0; vi < uv.count; vi++) {
          const u = uv.getX(vi)
          uv.setX(vi, u < 0.5 ? u0 : u1)
        }
        uv.needsUpdate = true
      }
    }

    const mat = new THREE.MeshBasicMaterial({
      color: sharedMap ? 0xffffff : panelColor,
      map: sharedMap,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: translucent,
      opacity: sharedMap ? 1 : panelAlpha,
      depthWrite: !translucent,
      premultipliedAlpha: !translucent,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = `billboardChain:${f.id}:seg${i}`
    const up = new THREE.Vector3(0, 1, 0)
    const m = new THREE.Matrix4().makeBasis(basis.along, up, basis.normal)
    mesh.quaternion.setFromRotationMatrix(m)
    mesh.position.set(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2 + heightM / 2,
      (a.z + b.z) / 2,
    )
    parent.add(mesh)
    disposers.push(() => {
      geo.dispose()
      mat.dispose()
    })
    along += segLen
    mounted += 1
  }

  if (mounted === 0) {
    console.info('[billboardChain] skip chain', {
      id: f.id,
      reason: 'no segments',
    })
  }
}
