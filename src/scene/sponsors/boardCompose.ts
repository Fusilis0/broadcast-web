/**
 * SailGP-style sponsor board: opaque panel, framed border, logo/label in the
 * inner slot. Pure layout + draw-call plan — safe to unit-test without WebGL.
 */

export const DEFAULT_PANEL_COLOR = 0xf4f4f2
export const DEFAULT_FRAME_COLOR = 0x2c3338

export const SPONSOR_BOARD_WIDTH = 1024
export const SPONSOR_BOARD_HEIGHT = 512
export const SPONSOR_BOARD_MARGIN = 24
export const SPONSOR_BOARD_FRAME_LINE = 12
export const SPONSOR_BOARD_INNER_PAD = 36

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

export type ComposeSponsorBoardInput = {
  label: string
  panelColor?: number
  frameColor?: number
  /** When set, logo is contain-fit in the inner slot; else the label is drawn. */
  logo?: { width: number; height: number } | null
  canvasW?: number
  canvasH?: number
}

export type SponsorBoardPlan = {
  canvasW: number
  canvasH: number
  panelCss: string
  frameCss: string
  labelCss: string
  margin: number
  frameLineWidth: number
  frameRect: SponsorBoardRect
  innerRect: SponsorBoardRect
  logoDest: ContainFitRect | null
  label: string | null
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

/** `#rrggbb` from 0xRRGGBB. */
export function hexToCss(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
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
 * Scale `src` to fit inside `box` (contain), centered. Never stretches.
 * Degenerate sizes yield the box itself.
 */
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

  const logo = input.logo
  const hasLogo =
    logo !== null &&
    logo !== undefined &&
    logo.width > 0 &&
    logo.height > 0

  return {
    canvasW,
    canvasH,
    panelCss: hexToCss(panelColor),
    frameCss: hexToCss(frameColor),
    labelCss: '#1a1a1a',
    margin,
    frameLineWidth,
    frameRect,
    innerRect,
    logoDest: hasLogo
      ? containFitRect(
          logo.width,
          logo.height,
          innerRect.x,
          innerRect.y,
          innerRect.w,
          innerRect.h,
        )
      : null,
    label: hasLogo ? null : input.label,
  }
}

/** Draw-call list for tests (board fill, frame, then logo or label). */
export function recordSponsorBoardDraws(
  input: ComposeSponsorBoardInput,
): SponsorBoardDrawCall[] {
  const plan = planSponsorBoard(input)
  const calls: SponsorBoardDrawCall[] = [
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
  ]
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

  if (plan.logoDest && logo) {
    ctx.drawImage(
      logo,
      plan.logoDest.dx,
      plan.logoDest.dy,
      plan.logoDest.dw,
      plan.logoDest.dh,
    )
    return
  }

  if (plan.label === null) return
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = plan.labelCss
  const fontSize = Math.min(
    88,
    Math.floor(plan.canvasW / Math.max(plan.label.length * 0.55, 6)),
  )
  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`
  ctx.fillText(plan.label, plan.canvasW / 2, plan.canvasH / 2)
}
