/**
 * Billboard-chain logos: parse, default plate, weighted fair interleave,
 * frameless ribbon compose (logos on a continuous plate — no per-slot frames).
 * Pure — no Three.js (safe for parseRaceProject / geojson).
 */

import {
  containFitRect,
  drawImageKnockOutNearBlack,
  hexToCss,
  resolvePanelAlpha,
  type ContainFitRect,
  type SponsorBoardDrawCall,
} from './sponsors/boardCompose.ts'

export const DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR = 0x2a6fa6

/** Optional hairline along the ribbon top/bottom (no vertical bars). */
export const CHAIN_RIBBON_EDGE_COLOR = 0x1a2228
export const CHAIN_RIBBON_EDGE_LINE = 2
/** Inner pad fraction of each logo slot (contain-fit box). */
export const CHAIN_RIBBON_SLOT_PAD = 0.03

export type BillboardLogo = {
  url: string
  /** Integer ≥ 1. Relative share in the fair interleave period. */
  weight: number
}

export function resolveChainPanelColor(panelColor?: number): number {
  return panelColor !== undefined
    ? panelColor
    : DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR
}

function parseLogoWeight(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.trunc(raw))
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n)) return Math.max(1, n)
  }
  return 1
}

/**
 * Additive `logos` on WorldFeature. `undefined` = field omitted (fall back to
 * `textureUrl`). Empty array is valid (solid plate).
 */
export function parseBillboardLogos(raw: unknown): BillboardLogo[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return undefined
  const out: BillboardLogo[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (typeof o.url !== 'string') continue
    const url = o.url.trim()
    if (url === '') continue
    out.push({ url, weight: parseLogoWeight(o.weight) })
  }
  return out
}

export function cloneBillboardLogos(
  logos: readonly BillboardLogo[] | undefined,
): BillboardLogo[] | undefined {
  if (logos === undefined) return undefined
  return logos.map((l) => ({ url: l.url, weight: l.weight }))
}

/**
 * One period of weighted fair interleave.
 * `[3, 2]` → `[0, 0, 1, 0, 1]` (AABAB). Deterministic, not clustered AAA BB.
 */
export function weightedFairInterleave(
  weights: readonly number[],
): number[] {
  const w = weights.map((x) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return 0
    return Math.max(0, Math.trunc(x))
  })
  const period = w.reduce((a, b) => a + b, 0)
  if (period <= 0) return []
  const counts = w.map(() => 0)
  const out: number[] = []
  for (let i = 0; i < period; i++) {
    let best = -1
    let bestScore = -Infinity
    for (let j = 0; j < w.length; j++) {
      if (w[j]! <= 0) continue
      const should = Math.ceil(((i + 1) * w[j]!) / period)
      const score = should - counts[j]!
      if (score > bestScore) {
        bestScore = score
        best = j
      }
    }
    if (best < 0) break
    out.push(best)
    counts[best]! += 1
  }
  return out
}

/**
 * `logos` present (even `[]`) wins. Else a single `textureUrl` is weight 1.
 */
export function resolveChainLogos(f: {
  logos?: readonly BillboardLogo[]
  textureUrl?: string | null
}): BillboardLogo[] {
  if (f.logos !== undefined) {
    return f.logos.filter((l) => l.url.trim() !== '' && l.weight > 0)
  }
  const url = f.textureUrl?.trim()
  if (url) return [{ url, weight: 1 }]
  return []
}

export function pickChainTextureUrl(
  logos: readonly BillboardLogo[],
  sampleIndex: number,
): string | null {
  if (logos.length === 0) return null
  const period = weightedFairInterleave(logos.map((l) => l.weight))
  if (period.length === 0) return logos[0]?.url ?? null
  const n = period.length
  const slot = ((sampleIndex % n) + n) % n
  const idx = period[slot]!
  return logos[idx]?.url ?? null
}

/**
 * Canvas size for one logo slot (along-track `spacingM` × vertical `heightM`).
 * `heightM` scales canvas height only so logo aspect stays locked.
 */
export function chainBoardCanvasSize(
  spacingM: number,
  heightM: number,
  canvasW = 1024,
): { canvasW: number; canvasH: number } {
  const w = spacingM > 0 && Number.isFinite(spacingM) ? spacingM : 12
  const h = heightM > 0 && Number.isFinite(heightM) ? heightM : 8
  return {
    canvasW,
    canvasH: Math.max(1, Math.round(canvasW * (h / w))),
  }
}

/**
 * Canvas for one weighted-interleave period along the ribbon.
 * Slot width in world metres is `spacingM` (logo pitch); height is `heightM`.
 */
export function chainRibbonCanvasSize(
  spacingM: number,
  heightM: number,
  slotCount: number,
  pxPerSlot = 256,
): { canvasW: number; canvasH: number; slotW: number } {
  const n = Math.max(1, Math.trunc(slotCount))
  const slotW = Math.max(1, Math.trunc(pxPerSlot))
  const one = chainBoardCanvasSize(spacingM, heightM, slotW)
  return { canvasW: slotW * n, canvasH: one.canvasH, slotW }
}

export type ChainRibbonPlan = {
  canvasW: number
  canvasH: number
  panelCss: string
  edgeCss: string
  edgeLineWidth: number
  slotW: number
  /** Per-slot contain-fit dest, or null when that slot has no logo. */
  logoDests: (ContainFitRect | null)[]
}

/**
 * Frameless SailGP ribbon: solid plate, logos contain-fit in U slots, optional
 * hairline top/bottom. No vertical bars between logos.
 */
export function planChainRibbon(input: {
  panelColor?: number
  panelAlpha?: number
  spacingM: number
  heightM: number
  /** Natural size per slot; `null` = plate only in that slot. */
  slots: readonly ({ width: number; height: number } | null)[]
  pxPerSlot?: number
}): ChainRibbonPlan {
  const n = Math.max(1, input.slots.length)
  const { canvasW, canvasH, slotW } = chainRibbonCanvasSize(
    input.spacingM,
    input.heightM,
    n,
    input.pxPerSlot,
  )
  const pad = CHAIN_RIBBON_SLOT_PAD
  const logoDests: (ContainFitRect | null)[] = []
  for (let i = 0; i < n; i++) {
    const logo = input.slots[i] ?? null
    if (!logo || logo.width <= 0 || logo.height <= 0) {
      logoDests.push(null)
      continue
    }
    const boxX = i * slotW + slotW * pad
    const boxY = canvasH * pad
    const boxW = slotW * (1 - 2 * pad)
    const boxH = canvasH * (1 - 2 * pad)
    logoDests.push(
      containFitRect(logo.width, logo.height, boxX, boxY, boxW, boxH),
    )
  }
  return {
    canvasW,
    canvasH,
    panelCss: hexToCss(
      input.panelColor ?? DEFAULT_BILLBOARD_CHAIN_PANEL_COLOR,
      resolvePanelAlpha(input.panelAlpha),
    ),
    edgeCss: hexToCss(CHAIN_RIBBON_EDGE_COLOR),
    edgeLineWidth: CHAIN_RIBBON_EDGE_LINE,
    slotW,
    logoDests,
  }
}

/** Draw-call list for tests (plate fill, optional logos, hairline edges). */
export function recordChainRibbonDraws(input: {
  panelColor?: number
  panelAlpha?: number
  spacingM: number
  heightM: number
  slots: readonly ({ width: number; height: number } | null)[]
  pxPerSlot?: number
}): SponsorBoardDrawCall[] {
  const plan = planChainRibbon(input)
  const calls: SponsorBoardDrawCall[] = [
    {
      op: 'fillRect',
      x: 0,
      y: 0,
      w: plan.canvasW,
      h: plan.canvasH,
      fill: plan.panelCss,
    },
  ]
  for (const dest of plan.logoDests) {
    if (!dest) continue
    calls.push({
      op: 'drawImage',
      dx: dest.dx,
      dy: dest.dy,
      dw: dest.dw,
      dh: dest.dh,
    })
  }
  const ew = plan.edgeLineWidth
  calls.push({
    op: 'fillRect',
    x: 0,
    y: 0,
    w: plan.canvasW,
    h: ew,
    fill: plan.edgeCss,
  })
  calls.push({
    op: 'fillRect',
    x: 0,
    y: plan.canvasH - ew,
    w: plan.canvasW,
    h: ew,
    fill: plan.edgeCss,
  })
  return calls
}

export function drawChainRibbon(
  ctx: CanvasRenderingContext2D,
  plan: ChainRibbonPlan,
  logos: readonly (CanvasImageSource | null | undefined)[],
): void {
  ctx.fillStyle = plan.panelCss
  ctx.fillRect(0, 0, plan.canvasW, plan.canvasH)

  for (let i = 0; i < plan.logoDests.length; i++) {
    const dest = plan.logoDests[i]
    const logo = logos[i]
    if (!dest || !logo) continue
    // Knock out library PNG black so logos don't stamp boxes on the blue wall.
    drawImageKnockOutNearBlack(ctx, logo, dest.dx, dest.dy, dest.dw, dest.dh)
  }

  ctx.strokeStyle = plan.edgeCss
  ctx.lineWidth = plan.edgeLineWidth
  ctx.beginPath()
  ctx.moveTo(0, plan.edgeLineWidth / 2)
  ctx.lineTo(plan.canvasW, plan.edgeLineWidth / 2)
  ctx.moveTo(0, plan.canvasH - plan.edgeLineWidth / 2)
  ctx.lineTo(plan.canvasW, plan.canvasH - plan.edgeLineWidth / 2)
  ctx.stroke()
}

/** Ordered logo URLs for one fair-interleave period (length = sum of weights). */
export function chainRibbonPeriodUrls(
  logos: readonly BillboardLogo[],
): string[] {
  if (logos.length === 0) return []
  const period = weightedFairInterleave(logos.map((l) => l.weight))
  if (period.length === 0) return []
  return period.map((idx) => logos[idx]!.url)
}
