import * as THREE from 'three'
import { applyFlatOnWaterPlacement } from '../waterPlanePlacement.ts'
import {
  drawSponsorBoard,
  planSponsorBoard,
  cropCanvasToOpaqueGlyph,
  glyphCropFromPlan,
  glyphCropIsFullBoard,
  meshSizeFromGlyphCrop,
  DEFAULT_FRAME_COLOR,
  DEFAULT_PANEL_COLOR,
  resolvePanelAlpha,
  resolveWaterPlanePanelAlpha,
  shouldDrawPanelPlate,
  type GlyphCrop,
} from './boardCompose.ts'
import { DEFAULT_SPONSOR_BOARD_ASPECT } from './sponsorLayout.ts'
import type { SponsorEnuEndpoints } from './types.ts'

/** `flat` = sponsor on the sea; `upright` = billboardChain wall (must not leak). */
export type SponsorBillboardPlacement = 'flat' | 'upright'

/** Discard leftover fringe on water-plane boards (transparent PNG holes). */
export const WATER_PLANE_BOARD_ALPHA_TEST = 0.05

function applyWaterPlaneCanvasFilters(tex: THREE.CanvasTexture): void {
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
}

function applyGlyphUvCrop(tex: THREE.Texture, crop: GlyphCrop): void {
  const srcW = crop.srcW > 0 ? crop.srcW : 1
  const srcH = crop.srcH > 0 ? crop.srcH : 1
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.offset.set(crop.x / srcW, 1 - (crop.y + crop.h) / srcH)
  tex.repeat.set(crop.w / srcW, crop.h / srcH)
}

export type SponsorBillboardHandle = {
  root: THREE.Mesh
  dispose: () => void
}

/**
 * Facing: local +X along A→B (flattened), +Y up, +Z = along × up (left of A→B).
 * Matches Unity `BillboardBetweenTwoPoints` “perpendicular to span” intent.
 */
export function facingBasisFromSpan(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { along: THREE.Vector3; normal: THREE.Vector3 } | null {
  const along = new THREE.Vector3(bx - ax, 0, bz - az)
  if (along.lengthSq() < 1e-8) return null
  along.normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const normal = new THREE.Vector3().crossVectors(along, up)
  if (normal.lengthSq() < 1e-8) return null
  normal.normalize()
  return { along, normal }
}

/**
 * Procedural branded panel — SailGP-style board + label.
 * Used when `textureUrl` is missing (no logo chosen).
 */
export function createProceduralSponsorTexture(
  label: string,
  options?: { panelColor?: number; frameColor?: number; panelAlpha?: number },
): THREE.CanvasTexture {
  return createSponsorBoardTexture({
    label,
    panelColor: options?.panelColor,
    frameColor: options?.frameColor,
    panelAlpha: options?.panelAlpha,
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

/** Canvas texture: board + optional contain-fit logo (else label, unless suppressed). */
export function createSponsorBoardTexture(input: {
  label: string
  panelColor?: number
  frameColor?: number
  panelAlpha?: number
  suppressLabel?: boolean
  logo?: CanvasImageSource | null
  canvasW?: number
  canvasH?: number
  glyphScale?: number
  /** Water-plane boards: off — mips average white-RGB holes into a grey slab. */
  disableMipmaps?: boolean
}): THREE.CanvasTexture {
  const logoSize = input.logo ? sourceSize(input.logo) : null
  const plan = planSponsorBoard({
    label: input.label,
    panelColor: input.panelColor,
    frameColor: input.frameColor,
    panelAlpha: input.panelAlpha,
    suppressLabel: input.suppressLabel,
    logo: logoSize,
    canvasW: input.canvasW,
    canvasH: input.canvasH,
    glyphScale: input.glyphScale,
  })
  const canvas = document.createElement('canvas')
  canvas.width = plan.canvasW
  canvas.height = plan.canvasH
  const ctx = canvas.getContext('2d')
  if (ctx) drawSponsorBoard(ctx, plan, input.logo)
  let crop: GlyphCrop | null = null
  if (input.disableMipmaps && !plan.drawPlate) {
    const pixel = cropCanvasToOpaqueGlyph(canvas)
    const planned = glyphCropFromPlan(plan)
    if (pixel && !glyphCropIsFullBoard(pixel)) {
      crop = pixel
    } else {
      crop = planned
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const alpha = resolvePanelAlpha(input.panelAlpha)
  tex.premultiplyAlpha = alpha >= 1
  if (input.disableMipmaps) applyWaterPlaneCanvasFilters(tex)
  if (crop && canvas.width === crop.srcW && canvas.height === crop.srcH) {
    applyGlyphUvCrop(tex, crop)
  }
  if (crop) tex.userData.glyphCrop = crop
  tex.needsUpdate = true
  return tex
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:\/\//i.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`[sponsors] image load failed: ${url}`))
    img.src = url
  })
}

export type CreateSponsorBillboardOptions = {
  placement?: SponsorBillboardPlacement
  /**
   * Shared composed board (chain remount). Caller owns `dispose()` of the
   * texture — mesh dispose only drops geo/mat so one canvas serves many panels.
   */
  sharedMap?: THREE.Texture
}

/**
 * Branded board between A–B. Default `flat` lies on the water (sponsor features).
 * Pass `upright` for billboardChain walls — do not change that default.
 * Texture is always a composed board (background + frame + logo or label)
 * unless `sharedMap` is provided. A chosen `textureUrl` never burns the name
 * onto the plate (failed loads → coloured plate only).
 */
export async function createSponsorBillboard(
  endpoints: SponsorEnuEndpoints,
  options?: CreateSponsorBillboardOptions,
): Promise<SponsorBillboardHandle> {
  const placement = options?.placement ?? 'flat'
  const sharedMap = options?.sharedMap
  const basis = facingBasisFromSpan(
    endpoints.ax,
    endpoints.az,
    endpoints.bx,
    endpoints.bz,
  )
  if (!basis) {
    throw new Error(`[sponsors] degenerate span for ${endpoints.id}`)
  }

  const panelColor = endpoints.panelColor ?? DEFAULT_PANEL_COLOR
  const frameColor = endpoints.frameColor ?? DEFAULT_FRAME_COLOR
  // Flat water-plane: omit alpha → 0 (logo/text only). Upright chain: omit → 1.
  const panelAlpha =
    placement === 'flat'
      ? resolveWaterPlanePanelAlpha(endpoints.panelAlpha)
      : resolvePanelAlpha(endpoints.panelAlpha)
  const translucent = panelAlpha < 1

  let map: THREE.Texture
  if (sharedMap) {
    map = sharedMap
  } else {
    let logo: HTMLImageElement | undefined
    const textureUrl = endpoints.textureUrl?.trim() || ''
    if (textureUrl) {
      try {
        logo = await loadHtmlImage(textureUrl)
      } catch (err) {
        console.warn(
          `[sponsors] texture failed for ${endpoints.id} (${textureUrl}); plate only (no label)`,
          err,
        )
      }
    }

    map = createSponsorBoardTexture({
      label: endpoints.label,
      panelColor,
      frameColor,
      panelAlpha,
      suppressLabel: textureUrl !== '',
      logo,
      canvasW: endpoints.canvasW,
      canvasH: endpoints.canvasH,
      glyphScale: placement === 'flat' ? endpoints.glyphScale : 1,
      disableMipmaps: placement === 'flat',
    })
  }

  let meshW = endpoints.widthM
  let meshH = endpoints.heightM
  let offsetAlongM = 0
  let offsetAcrossM = 0
  if (placement === 'flat') {
    const maxAcross = meshW / DEFAULT_SPONSOR_BOARD_ASPECT
    if (meshH > maxAcross + 1e-6) meshH = maxAcross
    if (!sharedMap && !shouldDrawPanelPlate(panelAlpha)) {
      const crop = map.userData.glyphCrop as GlyphCrop | undefined
      if (crop) {
        const sized = meshSizeFromGlyphCrop(meshW, meshH, crop)
        meshW = sized.widthM
        meshH = sized.heightM
        offsetAlongM = sized.offsetAlongM
        offsetAcrossM = sized.offsetAcrossM
      }
    }
  }

  const geo = new THREE.PlaneGeometry(meshW, meshH)
  const mat =
    placement === 'flat'
      ? new THREE.MeshBasicMaterial({
          map,
          side: THREE.DoubleSide,
          toneMapped: false,
          transparent: true,
          depthWrite: false,
          alphaTest: WATER_PLANE_BOARD_ALPHA_TEST,
          premultipliedAlpha: !translucent,
          // Scene fog tints the whole transparent quad (04-06 Fail). Glyph only.
          fog: false,
          // Stronger than Gerstner ocean (−2) so a filled board wins when coplanar.
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        })
      : new THREE.MeshBasicMaterial({
          map,
          side: THREE.DoubleSide,
          toneMapped: false,
          transparent: translucent,
          depthWrite: !translucent,
          premultipliedAlpha: !translucent,
        })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = `sponsor:${endpoints.id}`

  if (placement === 'flat') {
    if (!applyFlatOnWaterPlacement(mesh, endpoints)) {
      geo.dispose()
      mat.dispose()
      if (!sharedMap) map.dispose()
      throw new Error(`[sponsors] degenerate span for ${endpoints.id}`)
    }
    if (offsetAlongM !== 0 || offsetAcrossM !== 0) {
      mesh.translateX(offsetAlongM)
      mesh.translateY(offsetAcrossM)
    }
  } else {
    const up = new THREE.Vector3(0, 1, 0)
    const m = new THREE.Matrix4().makeBasis(basis.along, up, basis.normal)
    mesh.quaternion.setFromRotationMatrix(m)
    mesh.position.set(
      endpoints.midX,
      endpoints.midY + endpoints.heightM / 2,
      endpoints.midZ,
    )
  }

  return {
    root: mesh,
    dispose(): void {
      geo.dispose()
      mat.dispose()
      if (!sharedMap) map.dispose()
    },
  }
}

/** Billboard-chain instances: keep the pre-18.7 upright wall. */
export async function createUprightSponsorBillboard(
  endpoints: SponsorEnuEndpoints,
  options?: Omit<CreateSponsorBillboardOptions, 'placement'>,
): Promise<SponsorBillboardHandle> {
  return createSponsorBillboard(endpoints, {
    placement: 'upright',
    sharedMap: options?.sharedMap,
  })
}
