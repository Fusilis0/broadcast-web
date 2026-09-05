import type { WorldFeature, WorldGpsPoint } from '../features/types.ts'
import { SPONSOR_BOARD_WIDTH } from './boardCompose.ts'
import { DEFAULT_SPONSOR_HEIGHT_M } from './normalizeSponsors.ts'
import type {
  GpsToEnuAmslFn,
  SponsorEnuEndpoints,
  SponsorsData,
} from './types.ts'

/**
 * Water-plane Y for sponsor panel baselines (same as course / Unity `waterSurfaceY`).
 * AMSL→ENU `y` is ignored for graphics so Istanbul geoid offset does not lift panels.
 */
export const SPONSOR_WATER_Y = 0

/** Along / across (width / depth). Default matches 1024×512 compose canvas. */
export const DEFAULT_SPONSOR_BOARD_ASPECT = 2

/**
 * Horizontal width and midpoint from two ENU endpoints (y ignored).
 * Pure — safe to unit-test with mocked vectors.
 */

/**
 * Horizontal ENU span of a two-point GPS feature (y ignored).
 */
export function horizontalSpanFromGps(
  points: readonly WorldGpsPoint[],
  gpsToEnuAmsl: GpsToEnuAmslFn,
): number {
  const a = points[0]
  const b = points[1]
  if (!a || !b) return 0
  const ea = gpsToEnuAmsl(a.lat, a.lon, a.altMsl)
  const eb = gpsToEnuAmsl(b.lat, b.lon, b.altMsl)
  return horizontalSpanFromEnu(ea.x, ea.z, eb.x, eb.z).widthM
}

export function parseOptionalBoardAspect(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

/**
 * World plane size: A–B is the along-water canvas; across-water follows
 * `DEFAULT_SPONSOR_BOARD_ASPECT` (2). Authored `heightM` and packed
 * `boardAspect` (often rewritten from a 36/100/120 m slab) do **not** grow
 * the OBB. Stretching A–B still scales width and across together.
 */
export function sponsorPlaneSize(
  spanM: number,
  _heightM?: number,
  _boardAspect?: number,
): { widthM: number; heightM: number } {
  const widthM = spanM
  return { widthM, heightM: widthM / DEFAULT_SPONSOR_BOARD_ASPECT }
}

/** Glyph scale inside a fixed A–B canvas. Never > 1 (cannot enlarge the OBB). */
export function glyphScaleInsideCanvas(
  authoredHeightM: number | undefined,
  canvasAcrossM: number,
): number {
  const h =
    authoredHeightM !== undefined &&
    Number.isFinite(authoredHeightM) &&
    authoredHeightM > 0
      ? authoredHeightM
      : DEFAULT_SPONSOR_HEIGHT_M
  const c =
    canvasAcrossM > 0 && Number.isFinite(canvasAcrossM) ? canvasAcrossM : 1
  return Math.min(1, h / c)
}

/** Canvas pixel size matching plane aspect so the logo is not UV-stretched. */
export function sponsorBoardCanvasSize(
  widthM: number,
  heightM: number,
  canvasW = SPONSOR_BOARD_WIDTH,
): { canvasW: number; canvasH: number } {
  const w = widthM > 0 && Number.isFinite(widthM) ? widthM : 1
  const h = heightM > 0 && Number.isFinite(heightM) ? heightM : 1
  return {
    canvasW,
    canvasH: Math.max(1, Math.round(canvasW * (h / w))),
  }
}

/**
 * Stamp / update after a span or glyph-height edit.
 * A–B-only changes scale authored `heightM` with the span (uniform mark).
 * Height-field changes store the new glyph metres; they do **not** rewrite
 * `boardAspect` into a 100 m across-track slab. Canvas aspect stays default 2.
 */
export function applySponsorScaleOnEdit(
  prev: WorldFeature,
  next: WorldFeature,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): WorldFeature {
  if (next.type !== 'sponsor') return next
  const oldSpan = horizontalSpanFromGps(prev.points, gpsToEnuAmsl)
  const newSpan = horizontalSpanFromGps(next.points, gpsToEnuAmsl)
  const prevH = prev.heightM ?? DEFAULT_SPONSOR_HEIGHT_M
  const nextH = next.heightM ?? prevH
  const heightChanged = Math.abs(nextH - prevH) > 1e-6
  const aspect = DEFAULT_SPONSOR_BOARD_ASPECT
  let heightM = nextH
  if (!heightChanged && oldSpan > 0.01 && newSpan > 0.01) {
    heightM = prevH * (newSpan / oldSpan)
  }
  return { ...next, boardAspect: aspect, heightM }
}

/** First place / Add: A–B canvas aspect; `heightM` is glyph scale inside it. */
export function stampSponsorBoardAspect(
  feature: WorldFeature,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): WorldFeature {
  if (feature.type !== 'sponsor') return feature
  const span = horizontalSpanFromGps(feature.points, gpsToEnuAmsl)
  const h = feature.heightM ?? DEFAULT_SPONSOR_HEIGHT_M
  if (span < 0.01) return feature
  return {
    ...feature,
    heightM: h,
    boardAspect: DEFAULT_SPONSOR_BOARD_ASPECT,
  }
}

export function horizontalSpanFromEnu(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { widthM: number; midX: number; midZ: number } {
  const dx = bx - ax
  const dz = bz - az
  const widthM = Math.hypot(dx, dz)
  return {
    widthM,
    midX: (ax + bx) / 2,
    midZ: (az + bz) / 2,
  }
}

/**
 * Convert sponsor GPS pairs to water-plane ENU endpoints via injected GEO helper.
 * Pure — no Three.js.
 */
export function buildSponsorLayout(
  data: SponsorsData,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): SponsorEnuEndpoints[] {
  const out: SponsorEnuEndpoints[] = []
  for (const sp of data.sponsors) {
    const a = gpsToEnuAmsl(sp.a.lat, sp.a.lon, sp.a.altMsl)
    const b = gpsToEnuAmsl(sp.b.lat, sp.b.lon, sp.b.altMsl)
    const span = horizontalSpanFromEnu(a.x, a.z, b.x, b.z)
    if (span.widthM < 0.01) continue
    const plane = sponsorPlaneSize(span.widthM, sp.heightM, sp.boardAspect)
    const canvas = sponsorBoardCanvasSize(plane.widthM, plane.heightM)
    const endpoints: SponsorEnuEndpoints = {
      id: sp.id,
      label: sp.label,
      heightM: plane.heightM,
      glyphScale: glyphScaleInsideCanvas(sp.heightM, plane.heightM),
      textureUrl: sp.textureUrl,
      color: sp.color,
      ax: a.x,
      az: a.z,
      bx: b.x,
      bz: b.z,
      midX: span.midX,
      midY: (a.y + b.y) / 2,
      midZ: span.midZ,
      widthM: plane.widthM,
      canvasW: canvas.canvasW,
      canvasH: canvas.canvasH,
    }
    if (sp.panelColor !== undefined) endpoints.panelColor = sp.panelColor
    if (sp.frameColor !== undefined) endpoints.frameColor = sp.frameColor
    if (sp.panelAlpha !== undefined) endpoints.panelAlpha = sp.panelAlpha
    if (sp.boardAspect !== undefined) endpoints.boardAspect = sp.boardAspect
    out.push(endpoints)
  }
  return out
}
