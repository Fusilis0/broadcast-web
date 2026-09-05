/**
 * SailGP-style sponsor board: opaque panel, framed border, logo/label in the
 * inner slot. Pure layout + draw-call plan — safe to unit-test without WebGL.
 *
 * Flat-on-water sponsors default **no plate** (`panelAlpha` 0) so the sea shows
 * through; logo/text still draw. Library PNGs often look black-backed; when the
 * plate is off, compose knocks out near-black to alpha 0 (luminance key).
 * Transparent PNG holes are `(255,255,255,0)` — knockout skips `a === 0`, so
 * compose **zeros RGB where alpha is 0** after blit (mip/fog-safe).
 * Upright chain ribbons keep opaque plate (`resolvePanelAlpha` omit → 1).
 * Inspector slider can restore a plate. Plate-off water-plane compose then
 * **crops canvas + mesh to the opaque glyph AABB** so the leftover transparent
 * board quad cannot read as a rectangle.
 */

export const DEFAULT_PANEL_COLOR = 0xf4f4f2
export const DEFAULT_FRAME_COLOR = 0x2c3338
/** Flat water-plane sponsors: omit `panelAlpha` → no plate (logo/text only). */
export const DEFAULT_WATER_PLANE_PANEL_ALPHA = 0
/** Treat as no plate — skip fill + frame, keep logo/label. */
export const PANEL_ALPHA_PLATE_EPS = 1e-3

/**
 * Rec. 601 luma below this (0–255) → alpha 0 when knocking out library PNG
 * backs. Small so Rolex green (~63), Vodafone red/white, Senexus cyan stay.
 */
export const LOGO_KNOCKOUT_LUMA_HARD = 18
/** Soft ramp above hard (no halo). Fully opaque at hard + soft. */
export const LOGO_KNOCKOUT_LUMA_SOFT = 16

export const SPONSOR_BOARD_WIDTH = 1024
export const SPONSOR_BOARD_HEIGHT = 512
export const SPONSOR_BOARD_MARGIN = 24
export const SPONSOR_BOARD_FRAME_LINE = 12
/** Gap from frame stroke to logo/label — keep tight so glyphs fill the plate. */
export const SPONSOR_BOARD_INNER_PAD = 8

export type SponsorBoardRect = {
  x: number
  y: number
  w: number
  h: number
}

export type ContainFitRect = {
  dx: number
  dy: number
  dw: number
  dh: number
}

/** Inclusive pixel AABB of opaque ink. */
export type PixelAabb = {
  x: number
  y: number
  w: number
  h: number
}

/** AABB plus the pre-crop canvas size (mesh scale = w/srcW, h/srcH). */
export type GlyphCrop = PixelAabb & {
  srcW: number
  srcH: number
}

/**
 * Match water-plane `alphaTest` 0.05 so fringe below the discard stays out of
 * the cropped quad.
 */
export const GLYPH_ALPHA_MIN = 13

export type ComposeSponsorBoardInput = {
  label: string
  panelColor?: number
  frameColor?: number
  /** Plate fill alpha 0–1. Omit handled by resolve* helpers (flat vs upright). */
  panelAlpha?: number
  /** When set, logo is contain-fit in the inner slot; else the label is drawn. */
  logo?: { width: number; height: number } | null
  /**
   * When true, never burn the name/label (logo URL chosen but image missing).
   * Label still used when no logo URL was set.
   */
  suppressLabel?: boolean
  canvasW?: number
  canvasH?: number
  /**
   * 0–1 scale of the glyph inside the A–B canvas (plate-off water plane).
   * 1 = contain-fit the inner slot. Clamped so it cannot enlarge the OBB.
   */
  glyphScale?: number
}

export type SponsorBoardPlan = {
  canvasW: number
  canvasH: number
  panelCss: string
  frameCss: string
  labelCss: string
  /** False when alpha ≈ 0 — skip plate fill + frame. */
  drawPlate: boolean
  margin: number
  frameLineWidth: number
  frameRect: SponsorBoardRect
  innerRect: SponsorBoardRect
  logoDest: ContainFitRect | null
  label: string | null
  /** 0–1; 1 = full inner-slot contain-fit. */
  glyphScale: number
}

export type SponsorBoardDrawCall =
  | {
      op: 'fillRect'
      x: number
      y: number
      w: number
      h: number
      fill: string
    }
  | {
      op: 'strokeRect'
      x: number
      y: number
      w: number
      h: number
      stroke: string
      lineWidth: number
    }
  | { op: 'drawImage'; dx: number; dy: number; dw: number; dh: number }
  | { op: 'fillText'; text: string; x: number; y: number }

/** `#rrggbb` from 0xRRGGBB. Alpha below 1 → `rgba(r,g,b,a)` for canvas fills. */
export function hexToCss(color: number, alpha?: number): string {
  const hex = `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
  const a =
    alpha === undefined ? 1 : Math.max(0, Math.min(1, alpha))
  if (a >= 1) return hex
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * Optional additive hex: `#rrggbb`, `0xrrggbb`, or 0xRRGGBB number.
 * Invalid / omit → `undefined` (caller applies defaults).
 */
export function parseOptionalHexColor(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value) & 0xffffff
  }
  if (typeof value !== 'string') return undefined
  const s = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return Number.parseInt(s.slice(1), 16)
  if (/^0x[0-9a-fA-F]{6}$/i.test(s)) return Number.parseInt(s.slice(2), 16)
  if (/^[0-9a-fA-F]{6}$/.test(s)) return Number.parseInt(s, 16)
  return undefined
}

/**
 * Additive plate alpha 0–1. Invalid / omit → `undefined` (caller picks default).
 */
export function parseOptionalAlpha(value: unknown): number | undefined {
  let n: number
  if (typeof value === 'number') n = value
  else if (typeof value === 'string' && value.trim() !== '') {
    n = Number.parseFloat(value)
  } else return undefined
  if (!Number.isFinite(n)) return undefined
  return Math.max(0, Math.min(1, n))
}

export function resolveSponsorPanelColor(panelColor?: number): number {
  return panelColor !== undefined ? panelColor : DEFAULT_PANEL_COLOR
}

/** Upright / chain plates: omit → opaque (1). */
export function resolvePanelAlpha(panelAlpha?: number): number {
  if (panelAlpha === undefined || !Number.isFinite(panelAlpha)) return 1
  return Math.max(0, Math.min(1, panelAlpha))
}

/** Flat-on-water sponsors: omit → no plate (0). Slider can restore a plate. */
export function resolveWaterPlanePanelAlpha(panelAlpha?: number): number {
  if (panelAlpha === undefined || !Number.isFinite(panelAlpha)) {
    return DEFAULT_WATER_PLANE_PANEL_ALPHA
  }
  return Math.max(0, Math.min(1, panelAlpha))
}

export function shouldDrawPanelPlate(panelAlpha: number): boolean {
  return panelAlpha > PANEL_ALPHA_PLATE_EPS
}

/** Water-plane no-plate compose keys PNG black. Plate-on keeps the file as-is. */
export function shouldKnockOutLogo(drawPlate: boolean): boolean {
  return !drawPlate
}

/** Rec. 601 luminance 0–255. */
export function luma601(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Fog/mip-safe: transparent pixels must not keep white RGB. Library PNGs are
 * already alpha-0 with `(255,255,255,0)` — knockout skips those, so this pass
 * is required after any logo blit.
 */
export function zeroRgbWhereAlphaZero(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }
}

/** In-place canvas: zero RGB on a===0. No-op if getImageData is tainted. */
export function sanitizeCanvasZeroAlphaRgb(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  try {
    const img = ctx.getImageData(0, 0, Math.max(1, w), Math.max(1, h))
    zeroRgbWhereAlphaZero(img.data)
    ctx.putImageData(img, 0, 0)
  } catch {
    /* tainted canvas / missing 2d */
  }
}

/**
 * In-place luminance key: near-black → alpha 0, soft edge, never keys white.
 * Existing alpha is multiplied. Fully keyed pixels also zero RGB (fog-safe).
 * Always sanitizes a===0 (white-RGB transparent PNG holes).
 */
export function knockOutNearBlackRgba(
  data: Uint8ClampedArray,
  lumaHard: number = LOGO_KNOCKOUT_LUMA_HARD,
  lumaSoft: number = LOGO_KNOCKOUT_LUMA_SOFT,
): void {
  const hard = Number.isFinite(lumaHard) ? Math.max(0, lumaHard) : LOGO_KNOCKOUT_LUMA_HARD
  const soft = Number.isFinite(lumaSoft) ? Math.max(0, lumaSoft) : LOGO_KNOCKOUT_LUMA_SOFT
  const opaqueAt = hard + soft
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!
    if (a === 0) continue
    const y = luma601(data[i]!, data[i + 1]!, data[i + 2]!)
    let k = 1
    if (y <= hard) k = 0
    else if (soft > 0 && y < opaqueAt) k = (y - hard) / soft
    const na = Math.round(a * k)
    data[i + 3] = na
    if (na === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
    }
  }
  zeroRgbWhereAlphaZero(data)
}

/**
 * Draw `src` with near-black keyed out. Falls back to a plain `drawImage` if
 * the scratch blit fails (tainted canvas, missing 2d).
 */
export function drawImageKnockOutNearBlack(
  dest: CanvasRenderingContext2D,
  src: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const tw = Math.max(1, Math.round(dw))
  const th = Math.max(1, Math.round(dh))
  try {
    const canvas = dest.canvas
    const doc =
      'ownerDocument' in canvas && canvas.ownerDocument
        ? canvas.ownerDocument
        : typeof document !== 'undefined'
          ? document
          : null
    if (!doc) {
      dest.drawImage(src, dx, dy, dw, dh)
      return
    }
    const scratch = doc.createElement('canvas')
    scratch.width = tw
    scratch.height = th
    const sctx = scratch.getContext('2d')
    if (!sctx) {
      dest.drawImage(src, dx, dy, dw, dh)
      return
    }
    sctx.drawImage(src, 0, 0, tw, th)
    const img = sctx.getImageData(0, 0, tw, th)
    knockOutNearBlackRgba(img.data)
    sctx.putImageData(img, 0, 0)
    dest.drawImage(scratch, dx, dy, dw, dh)
  } catch {
    dest.drawImage(src, dx, dy, dw, dh)
  }
}

/**
 * Opaque-ink AABB in row-major RGBA. Empty / fully transparent → `null`.
 * Pads 1 px so soft knockout edges are not clipped.
 */
export function opaqueGlyphAabb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMin: number = GLYPH_ALPHA_MIN,
): PixelAabb | null {
  const w = Math.max(0, width | 0)
  const h = Math.max(0, height | 0)
  const minA = Number.isFinite(alphaMin) ? Math.max(0, alphaMin) : GLYPH_ALPHA_MIN
  if (w < 1 || h < 1 || data.length < w * h * 4) return null
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (data[(row + x) * 4 + 3]! >= minA) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null
  const x = Math.max(0, minX - 1)
  const y = Math.max(0, minY - 1)
  const x1 = Math.min(w - 1, maxX + 1)
  const y1 = Math.min(h - 1, maxY + 1)
  return { x, y, w: x1 - x + 1, h: y1 - y + 1 }
}

/**
 * In-place crop of a canvas to the opaque glyph AABB. Returns the crop
 * (including original size) so the world mesh can shrink to match. No-op
 * (`null`) when there is no ink or getImageData fails.
 */
export function cropCanvasToOpaqueGlyph(
  canvas: HTMLCanvasElement,
  alphaMin: number = GLYPH_ALPHA_MIN,
): GlyphCrop | null {
  const srcW = canvas.width
  const srcH = canvas.height
  if (srcW < 1 || srcH < 1) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  let img: ImageData
  try {
    img = ctx.getImageData(0, 0, srcW, srcH)
  } catch {
    return null
  }
  const aabb = opaqueGlyphAabb(img.data, srcW, srcH, alphaMin)
  if (!aabb) return null
  if (aabb.w === srcW && aabb.h === srcH && aabb.x === 0 && aabb.y === 0) {
    return { ...aabb, srcW, srcH }
  }
  let cropped: ImageData
  try {
    cropped = ctx.getImageData(aabb.x, aabb.y, aabb.w, aabb.h)
  } catch {
    return null
  }
  canvas.width = aabb.w
  canvas.height = aabb.h
  ctx.putImageData(cropped, 0, 0)
  return { ...aabb, srcW, srcH }
}

/** World plane size + centering offset so a cropped quad stays on the glyph. */
export function meshSizeFromGlyphCrop(
  planeW: number,
  planeH: number,
  crop: GlyphCrop,
): {
  widthM: number
  heightM: number
  offsetAlongM: number
  offsetAcrossM: number
} {
  const srcW = crop.srcW > 0 ? crop.srcW : 1
  const srcH = crop.srcH > 0 ? crop.srcH : 1
  return {
    widthM: planeW * (crop.w / srcW),
    heightM: planeH * (crop.h / srcH),
    offsetAlongM: ((crop.x + crop.w / 2) / srcW - 0.5) * planeW,
    offsetAcrossM: (0.5 - (crop.y + crop.h / 2) / srcH) * planeH,
  }
}

export function clampGlyphScale(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, value))
}

/** Plate-off fallback AABB from the compose dest (no getImageData). */
export function glyphCropFromPlan(plan: SponsorBoardPlan): GlyphCrop | null {
  if (plan.drawPlate) return null
  const srcW = plan.canvasW
  const srcH = plan.canvasH
  if (srcW < 1 || srcH < 1) return null
  if (plan.logoDest) {
    const x = Math.max(0, Math.floor(plan.logoDest.dx))
    const y = Math.max(0, Math.floor(plan.logoDest.dy))
    const w = Math.max(1, Math.min(srcW - x, Math.ceil(plan.logoDest.dw)))
    const h = Math.max(1, Math.min(srcH - y, Math.ceil(plan.logoDest.dh)))
    if (w >= srcW - 1 && h >= srcH - 1) return null
    return { x, y, w, h, srcW, srcH }
  }
  if (plan.label !== null) {
    const s = clampGlyphScale(plan.glyphScale)
    const w = Math.max(1, Math.round(srcW * 0.55 * s))
    const h = Math.max(1, Math.round(srcH * 0.35 * s))
    const x = Math.max(0, Math.round((srcW - w) / 2))
    const y = Math.max(0, Math.round((srcH - h) / 2))
    return { x, y, w, h, srcW, srcH }
  }
  return null
}

/** True when a pixel AABB is still the full board (crop did not hug ink). */
export function glyphCropIsFullBoard(crop: GlyphCrop): boolean {
  return crop.w >= crop.srcW - 1 && crop.h >= crop.srcH - 1
}

export function containFitRect(
  srcW: number,
  srcH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): ContainFitRect {
  if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) {
    return { dx: boxX, dy: boxY, dw: boxW, dh: boxH }
  }
  const scale = Math.min(boxW / srcW, boxH / srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  return {
    dx: boxX + (boxW - dw) / 2,
    dy: boxY + (boxH - dh) / 2,
    dw,
    dh,
  }
}

export function planSponsorBoard(
  input: ComposeSponsorBoardInput,
): SponsorBoardPlan {
  const canvasW = input.canvasW ?? SPONSOR_BOARD_WIDTH
  const canvasH = input.canvasH ?? SPONSOR_BOARD_HEIGHT
  const panelColor = input.panelColor ?? DEFAULT_PANEL_COLOR
  const frameColor = input.frameColor ?? DEFAULT_FRAME_COLOR
  // Callers pass an already-resolved alpha (flat→0 omit, upright→1 omit).
  const panelAlpha =
    input.panelAlpha === undefined || !Number.isFinite(input.panelAlpha)
      ? 1
      : Math.max(0, Math.min(1, input.panelAlpha))
  const drawPlate = shouldDrawPanelPlate(panelAlpha)
  const margin = SPONSOR_BOARD_MARGIN
  const frameLineWidth = SPONSOR_BOARD_FRAME_LINE
  const innerPad = SPONSOR_BOARD_INNER_PAD

  const frameRect: SponsorBoardRect = {
    x: margin,
    y: margin,
    w: canvasW - 2 * margin,
    h: canvasH - 2 * margin,
  }
  const inset = margin + frameLineWidth / 2 + innerPad
  const innerRect: SponsorBoardRect = {
    x: inset,
    y: inset,
    w: canvasW - 2 * inset,
    h: canvasH - 2 * inset,
  }

  const glyphScale = clampGlyphScale(input.glyphScale)
  const logo = input.logo
  const hasLogo =
    logo !== null &&
    logo !== undefined &&
    logo.width > 0 &&
    logo.height > 0
  const trimmedLabel = input.label.trim()
  const label =
    hasLogo || input.suppressLabel
      ? null
      : trimmedLabel === ''
        ? null
        : input.label

  let logoDest: ContainFitRect | null = hasLogo
    ? containFitRect(
        logo.width,
        logo.height,
        innerRect.x,
        innerRect.y,
        innerRect.w,
        innerRect.h,
      )
    : null
  if (logoDest && glyphScale < 1) {
    const cx = innerRect.x + innerRect.w / 2
    const cy = innerRect.y + innerRect.h / 2
    const ocx = logoDest.dx + logoDest.dw / 2
    const ocy = logoDest.dy + logoDest.dh / 2
    const dw = logoDest.dw * glyphScale
    const dh = logoDest.dh * glyphScale
    logoDest = {
      dw,
      dh,
      dx: cx + (ocx - cx) * glyphScale - dw / 2,
      dy: cy + (ocy - cy) * glyphScale - dh / 2,
    }
  }

  return {
    canvasW,
    canvasH,
    panelCss: hexToCss(panelColor, panelAlpha),
    frameCss: hexToCss(frameColor, panelAlpha),
    labelCss: '#1a1a1a',
    drawPlate,
    margin,
    frameLineWidth,
    frameRect,
    innerRect,
    logoDest,
    label,
    glyphScale,
  }
}

/** Draw-call list for tests (board fill, frame, then logo or label). */
export function recordSponsorBoardDraws(
  input: ComposeSponsorBoardInput,
): SponsorBoardDrawCall[] {
  const plan = planSponsorBoard(input)
  const calls: SponsorBoardDrawCall[] = []
  if (plan.drawPlate) {
    calls.push(
      {
        op: 'fillRect',
        x: 0,
        y: 0,
        w: plan.canvasW,
        h: plan.canvasH,
        fill: plan.panelCss,
      },
      {
        op: 'strokeRect',
        x: plan.frameRect.x,
        y: plan.frameRect.y,
        w: plan.frameRect.w,
        h: plan.frameRect.h,
        stroke: plan.frameCss,
        lineWidth: plan.frameLineWidth,
      },
    )
  }
  if (plan.logoDest) {
    calls.push({
      op: 'drawImage',
      dx: plan.logoDest.dx,
      dy: plan.logoDest.dy,
      dw: plan.logoDest.dw,
      dh: plan.logoDest.dh,
    })
  } else if (plan.label !== null) {
    calls.push({
      op: 'fillText',
      text: plan.label,
      x: plan.canvasW / 2,
      y: plan.canvasH / 2,
    })
  }
  return calls
}

export function drawSponsorBoard(
  ctx: CanvasRenderingContext2D,
  plan: SponsorBoardPlan,
  logo?: CanvasImageSource | null,
): void {
  ctx.clearRect(0, 0, plan.canvasW, plan.canvasH)
  if (plan.drawPlate) {
    ctx.fillStyle = plan.panelCss
    ctx.fillRect(0, 0, plan.canvasW, plan.canvasH)

    ctx.strokeStyle = plan.frameCss
    ctx.lineWidth = plan.frameLineWidth
    ctx.strokeRect(
      plan.frameRect.x,
      plan.frameRect.y,
      plan.frameRect.w,
      plan.frameRect.h,
    )
  }

  if (plan.logoDest && logo) {
    const { dx, dy, dw, dh } = plan.logoDest
    if (shouldKnockOutLogo(plan.drawPlate)) {
      drawImageKnockOutNearBlack(ctx, logo, dx, dy, dw, dh)
    } else {
      ctx.drawImage(logo, dx, dy, dw, dh)
    }
    sanitizeCanvasZeroAlphaRgb(ctx, plan.canvasW, plan.canvasH)
    return
  }

  if (plan.label === null) {
    sanitizeCanvasZeroAlphaRgb(ctx, plan.canvasW, plan.canvasH)
    return
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = plan.labelCss
  const fontSize = Math.max(
    1,
    Math.round(
      Math.min(
        88,
        Math.floor(plan.canvasW / Math.max(plan.label.length * 0.55, 6)),
      ) * plan.glyphScale,
    ),
  )
  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  ctx.fillText(plan.label, plan.canvasW / 2, plan.canvasH / 2)
  sanitizeCanvasZeroAlphaRgb(ctx, plan.canvasW, plan.canvasH)
}
