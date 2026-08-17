/**
 * Shared 2D map chrome for ops + stream PiP (Phase 8.7 + Phase 11 stream graphic).
 * Canvas drawing only — no Three.js, no tiles.
 *
 * Ops metrics stay dense/utilitarian. Stream metrics favor glanceability;
 * stream-only helpers (`drawStreamMapBackdrop`, `drawStreamCompass`) must not
 * be called from the ops redraw path. Wind readout (`drawMapWindReadout`) is
 * shared; arrow is travel, label is from-deg + kt.
 */

import type { LayoutFeature } from './features/types.ts'
import { pairLayoutGates } from './features/layoutFeatures.ts'
import { northFromSceneZ } from '../geodesy/index.ts'
import { msToKnots, normalizeDirectionFromDeg, windTravelSceneXZ } from '../telemetry/windDirection.ts'
import type { WindFrame, WindTravelXZ } from '../telemetry/windTypes.ts'

/** Mirror of map2d variant — kept local to avoid import cycles. */
export type MapChromeVariant = 'ops' | 'stream'

export type MapProjectFn = (
  east: number,
  north: number,
) => { x: number; y: number }

function projectScene(
  project: MapProjectFn,
  p: { x: number; z: number },
): { x: number; y: number } {
  return project(p.x, northFromSceneZ(p.z))
}

/** Demo boat hull sprite (Unity `tekne_yeni` / 2DMapBoat). */
export const MAP_BOAT_SPRITE_URL = '/textures/map/tekne_yeni.png'
/** Optional sail accent (Unity `sailing-icon-15`). */
export const MAP_SAIL_SPRITE_URL = '/textures/map/sail-icon.png'

export type MapChromeMetrics = {
  variant: MapChromeVariant
  /** Boat icon half-length (px along heading). */
  boatLen: number
  /** Boat icon half-beam (px). */
  boatBeam: number
  droneR: number
  labelFont: string
  sfFont: string
  gateLine: number
  courseLine: number
  sponsorLine: number
  markR: number
  gateEndR: number
  /** Label pill box height (px). */
  labelH: number
  /** Label pill horizontal padding (px). */
  labelPadX: number
  /** Wind readout arrow half-length (px). */
  windArrowLen: number
}

export function mapChromeMetrics(variant: MapChromeVariant): MapChromeMetrics {
  const stream = variant === 'stream'
  return {
    variant,
    boatLen: stream ? 15 : 9,
    boatBeam: stream ? 7.5 : 4.5,
    droneR: stream ? 8 : 5,
    labelFont: stream
      ? 'bold 13px ui-sans-serif, system-ui, Segoe UI, sans-serif'
      : '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    sfFont: stream
      ? 'bold 13px ui-sans-serif, system-ui, Segoe UI, sans-serif'
      : 'bold 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    gateLine: stream ? 3 : 2,
    courseLine: stream ? 4.5 : 3,
    sponsorLine: stream ? 4.5 : 3,
    markR: stream ? 6 : 3.5,
    gateEndR: stream ? 4 : 2.5,
    labelH: stream ? 16 : 12,
    labelPadX: stream ? 5 : 3,
    windArrowLen: stream ? 16 : 10,
  }
}

/**
 * Scene XZ travel (`windTravelSceneXZ`) → north-up map canvas delta.
 * +dx = screen right (east), +dy = screen down (south).
 */
export function windTravelToMapCanvasDelta(travel: WindTravelXZ): {
  dx: number
  dy: number
} {
  return {
    dx: travel.x,
    dy: -northFromSceneZ(travel.z),
  }
}

/** On-air / ops label: meteorological from + knots. */
export function formatMapWindLabel(frame: WindFrame): string {
  const from = Math.round(normalizeDirectionFromDeg(frame.directionFromDeg))
  const padded = String(from).padStart(3, '0')
  const kt = Math.round(msToKnots(frame.speedMs) * 10) / 10
  const ktText = Number.isInteger(kt) ? String(kt) : kt.toFixed(1)
  return `from ${padded}° · ${ktText} kt`
}

const WIND_STALE_AFTER_MS = 10 * 60 * 1000

function windReadoutAlpha(frame: WindFrame, nowMs: number): number {
  if (frame.source === 'default') return 0.78
  if (nowMs - frame.updatedAtMs >= WIND_STALE_AFTER_MS) return 0.78
  return 1
}

function drawWindTravelArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  len: number,
  dx: number,
  dy: number,
  fill: string,
): void {
  const mag = Math.hypot(dx, dy)
  if (mag < 1e-9) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.atan2(dy, dx))
  ctx.fillStyle = fill
  ctx.strokeStyle = fill
  ctx.lineWidth = Math.max(1.4, len * 0.12)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-len, 0)
  ctx.lineTo(len * 0.28, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(len, 0)
  ctx.lineTo(len * 0.18, len * 0.42)
  ctx.lineTo(len * 0.18, -len * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Corner wind chrome for ops + stream maps. Arrow is **travel** (from
 * `windTravelSceneXZ`); label is meteorological **from** + kt.
 * Stream: larger pill, bottom-left (clear of the north compass).
 * Ops: dense top-left (clear of OSM attribution).
 */
export function drawMapWindReadout(
  ctx: CanvasRenderingContext2D,
  _w: number,
  h: number,
  frame: WindFrame,
  metrics: MapChromeMetrics,
  nowMs = Date.now(),
): void {
  const stream = metrics.variant === 'stream'
  const label = formatMapWindLabel(frame)
  const travel = windTravelToMapCanvasDelta(
    windTravelSceneXZ(frame.directionFromDeg),
  )
  const arrowLen = metrics.windArrowLen
  const slot = arrowLen * 2 + (stream ? 10 : 6)
  const padX = stream ? 10 : 5
  const padY = stream ? 7 : 4
  const boxH = Math.max(metrics.labelH + padY * 2, slot + 4)

  ctx.save()
  ctx.font = metrics.labelFont
  const textW = ctx.measureText(label).width
  const boxW = padX + slot + 6 + textW + padX
  const x0 = stream ? 12 : 6
  const y0 = stream ? h - boxH - 12 : 6

  ctx.globalAlpha = windReadoutAlpha(frame, nowMs)
  ctx.fillStyle = stream
    ? 'rgba(6, 12, 20, 0.82)'
    : 'rgba(10, 14, 20, 0.72)'
  ctx.fillRect(x0, y0, boxW, boxH)

  if (stream) {
    ctx.strokeStyle = 'rgba(140, 180, 210, 0.28)'
    ctx.lineWidth = 1
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, boxW - 1, boxH - 1)
  }

  const ax = x0 + padX + slot / 2
  const ay = y0 + boxH / 2
  const fill = stream ? '#e8f2fa' : '#9ec4e8'
  drawWindTravelArrow(ctx, ax, ay, arrowLen, travel.dx, travel.dy, fill)

  ctx.fillStyle = stream ? '#eef4fa' : '#c0ccd8'
  ctx.textAlign = 'start'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x0 + padX + slot + 6, ay)
  ctx.restore()
}

/**
 * Pose / boat `brg` yaw → canvas radians for north-up map.
 * Convention: 0° = North (screen up), 90° = East (screen right), clockwise
 * (matches editor `segmentBearingDeg` and boat pose `brg`).
 * Local icon is drawn pointing north; `ctx.rotate` is clockwise-positive.
 */
export function yawDegToCanvasRad(yawDeg: number): number {
  if (!Number.isFinite(yawDeg)) return 0
  return (yawDeg * Math.PI) / 180
}

/** Parse editor arrow label `brg NNN°` → degrees, or null. */
export function parseArrowBearingDeg(label: string | undefined): number | null {
  if (!label) return null
  const m = /brg\s*(\d{1,3})°?/i.exec(label)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  return ((n % 360) + 360) % 360
}

function hexFill(color: number | undefined, fallback: string): string {
  if (color === undefined || !Number.isFinite(color)) return fallback
  const n = Math.max(0, Math.min(0xffffff, Math.floor(color)))
  return `#${n.toString(16).padStart(6, '0')}`
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
  ctx.fill()
}

function drawLabelPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  fill: string,
  bg = 'rgba(10, 14, 20, 0.72)',
  labelH = 12,
  padX = 3,
): void {
  ctx.font = font
  const w = ctx.measureText(text).width
  const padY = 2
  const h = labelH
  ctx.fillStyle = bg
  ctx.fillRect(x - padX, y - h + padY, w + padX * 2, h)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/**
 * Stream-only water wash + soft vignette (ops keeps its own flat/grid path).
 */
export function drawStreamMapBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const base = ctx.createRadialGradient(
    w * 0.42,
    h * 0.38,
    12,
    w * 0.5,
    h * 0.52,
    w * 0.78,
  )
  base.addColorStop(0, '#1a3048')
  base.addColorStop(0.55, '#122030')
  base.addColorStop(1, '#0a1018')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Soft vignette toward edges for a framed graphic feel.
  const vig = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    Math.min(w, h) * 0.28,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72,
  )
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  // Inner hairline (canvas-side frame complementing CSS card).
  ctx.strokeStyle = 'rgba(140, 180, 210, 0.22)'
  ctx.lineWidth = 1
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3)
}

/**
 * Stream-only north compass ring (replaces plain "N" / "N↑" title cue).
 * Drawn top-right; north is screen-up.
 */
export function drawStreamCompass(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
): void {
  const r = Math.max(16, Math.min(w, _h) * 0.055)
  const cx = w - r - 14
  const cy = r + 14

  ctx.save()
  ctx.translate(cx, cy)

  ctx.fillStyle = 'rgba(8, 14, 22, 0.55)'
  ctx.beginPath()
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(180, 210, 230, 0.55)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()

  // Cardinal ticks (N emphasized).
  ctx.strokeStyle = 'rgba(200, 220, 235, 0.7)'
  ctx.lineWidth = 1.2
  for (const ang of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const isN = ang === 0
    const inner = isN ? r * 0.45 : r * 0.72
    const outer = r - 1
    // ang 0 = north; canvas 0 rad = east → shift by −π/2.
    const a = ang - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer)
    ctx.stroke()
  }

  // North arrowhead.
  ctx.fillStyle = '#f2f7fb'
  ctx.beginPath()
  ctx.moveTo(0, -r + 2)
  ctx.lineTo(4.5, -r * 0.35)
  ctx.lineTo(-4.5, -r * 0.35)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#e8f2fa'
  ctx.font = 'bold 11px ui-sans-serif, system-ui, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('N', 0, r * 0.28)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'

  ctx.restore()
}

/** Fleet id label — stream uses a readable pill; ops stays bare text. */
export function drawMapFleetLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  metrics: MapChromeMetrics,
  fill = '#d0d8e0',
): void {
  if (metrics.variant === 'stream') {
    drawLabelPill(
      ctx,
      text,
      x,
      y,
      metrics.labelFont,
      '#eef4fa',
      'rgba(6, 12, 20, 0.78)',
      metrics.labelH,
      metrics.labelPadX,
    )
    return
  }
  ctx.fillStyle = fill
  ctx.font = metrics.labelFont
  ctx.fillText(text, x, y)
}

/**
 * Procedural sailboat (north-up local): hull + triangular sail.
 * Used when sprite missing / still loading.
 */
export function drawProceduralSailboat(
  ctx: CanvasRenderingContext2D,
  fill: string,
  len: number,
  beam: number,
): void {
  // Hull pointing north (−y).
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(0, -len)
  ctx.lineTo(beam * 0.85, len * 0.55)
  ctx.lineTo(beam * 0.35, len * 0.75)
  ctx.lineTo(-beam * 0.35, len * 0.75)
  ctx.lineTo(-beam * 0.85, len * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Sail (lighter accent).
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.beginPath()
  ctx.moveTo(0, -len * 0.75)
  ctx.lineTo(beam * 0.95, len * 0.15)
  ctx.lineTo(0, len * 0.35)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  // Mast tick.
  ctx.strokeStyle = 'rgba(220,230,240,0.9)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(0, -len * 0.85)
  ctx.lineTo(0, len * 0.4)
  ctx.stroke()
}

function drawTintedSprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  fill: string,
  w: number,
  h: number,
): void {
  const iw =
    'naturalWidth' in img && typeof img.naturalWidth === 'number'
      ? img.naturalWidth
      : w
  const ih =
    'naturalHeight' in img && typeof img.naturalHeight === 'number'
      ? img.naturalHeight
      : h
  if (iw <= 0 || ih <= 0) return

  // Offscreen tint: alpha mask × category colour.
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.ceil(w))
  off.height = Math.max(1, Math.ceil(h))
  const octx = off.getContext('2d')
  if (!octx) return
  octx.drawImage(img, 0, 0, off.width, off.height)
  octx.globalCompositeOperation = 'source-in'
  octx.fillStyle = fill
  octx.fillRect(0, 0, off.width, off.height)

  ctx.drawImage(off, -w / 2, -h / 2, w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(-w / 2, -h / 2, w, h)
}

export type DrawBoatIconOptions = {
  fill: string
  yawDeg: number
  len: number
  beam: number
  /** Unity hull sprite when loaded. */
  boatSprite?: CanvasImageSource | null
  /** Optional sail overlay sprite. */
  sailSprite?: CanvasImageSource | null
}

/** Category-coloured boat icon oriented by yaw (shared ops + stream). */
export function drawMapBoatIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: DrawBoatIconOptions,
): void {
  const { fill, yawDeg, len, beam, boatSprite, sailSprite } = opts
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(yawDegToCanvasRad(yawDeg))

  const spriteOk =
    boatSprite &&
    'naturalWidth' in boatSprite &&
    (boatSprite as HTMLImageElement).naturalWidth > 0

  if (spriteOk) {
    const w = len * 2.2
    const h = beam * 2.1
    drawTintedSprite(ctx, boatSprite!, fill, w, h)
    if (
      sailSprite &&
      'naturalWidth' in sailSprite &&
      (sailSprite as HTMLImageElement).naturalWidth > 0
    ) {
      const sw = beam * 1.4
      const sh = len * 1.1
      ctx.globalAlpha = 0.9
      ctx.drawImage(sailSprite, -sw * 0.15, -sh * 0.85, sw, sh)
      ctx.globalAlpha = 1
    }
  } else {
    drawProceduralSailboat(ctx, fill, len, beam)
  }

  ctx.restore()
}

export function drawMapDroneIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  r: number,
): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.strokeStyle = '#ffe08a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

/** Procedural CW / heading chevron (Unity PNG sprites deferred — large). */
export function drawMapArrowGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bearingDeg: number,
  kind: 'arrow' | 'rotation',
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(yawDegToCanvasRad(bearingDeg))
  ctx.strokeStyle = '#9ec4e8'
  ctx.fillStyle = '#9ec4e8'
  ctx.lineWidth = 1.8
  ctx.lineJoin = 'round'

  if (kind === 'rotation') {
    // Curved RCW-ish arc + tip (cheap stand-in for CWArrow / RCWArrow).
    ctx.beginPath()
    ctx.arc(0, 0, 7, -Math.PI * 0.75, Math.PI * 0.55, false)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(4.5, 5.5)
    ctx.lineTo(8.5, 2)
    ctx.lineTo(2.5, 1.2)
    ctx.closePath()
    ctx.fill()
  } else {
    // Straight chevron pointing north in local space.
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(5.5, 5)
    ctx.lineTo(0, 2)
    ctx.lineTo(-5.5, 5)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()
}

export type DrawLayoutOptions = {
  project: MapProjectFn
  metrics: MapChromeMetrics
  selectedIds: ReadonlySet<string>
}

/**
 * Course / gate / sponsor / S/F / flag / arrow overlays (under fleet icons).
 */
export function drawMapLayoutFeatures(
  ctx: CanvasRenderingContext2D,
  features: readonly LayoutFeature[],
  opts: DrawLayoutOptions,
): void {
  const { project, metrics, selectedIds } = opts

  for (const gate of pairLayoutGates(features)) {
    const a = gate.left.points[0]
    const b = gate.right.points[0]
    if (!a || !b) continue
    const pa = projectScene(project, a)
    const pb = projectScene(project, b)
    ctx.strokeStyle = hexFill(gate.left.color ?? gate.right.color, '#00ff80')
    ctx.lineWidth = metrics.gateLine
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const f of features) {
    const selected = selectedIds.has(f.id)

    if (
      (f.type === 'sponsor' || f.type === 'start' || f.type === 'finish') &&
      f.points.length >= 2
    ) {
      const a = f.points[0]!
      const b = f.points[1]!
      const pa = projectScene(project, a)
      const pb = projectScene(project, b)
      const isSF = f.type === 'start' || f.type === 'finish'
      const fallback = isSF ? '#c01010' : '#2a8f9a'
      ctx.strokeStyle = hexFill(f.color, fallback)
      ctx.lineWidth = selected
        ? metrics.courseLine + 2
        : isSF
          ? metrics.courseLine
          : metrics.sponsorLine
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()

      // End caps for S/F readability.
      if (isSF) {
        const r = 3.5
        ctx.fillStyle = hexFill(f.color, fallback)
        ctx.beginPath()
        ctx.arc(pa.x, pa.y, r, 0, Math.PI * 2)
        ctx.arc(pb.x, pb.y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      const mx = (pa.x + pb.x) / 2
      const my = (pa.y + pb.y) / 2
      if (selected) drawSelectionRing(ctx, mx, my, 9)
      const text =
        f.label ??
        (f.type === 'start' ? 'START' : f.type === 'finish' ? 'FINISH' : '')
      if (text) {
        drawLabelPill(
          ctx,
          text,
          mx + 5,
          my - 3,
          metrics.sfFont,
          isSF ? '#ff9090' : '#c0ccd8',
          'rgba(10, 14, 20, 0.72)',
          metrics.labelH,
          metrics.labelPadX,
        )
      }
      continue
    }

    if (f.type === 'billboardChain' && f.points.length >= 2) {
      ctx.strokeStyle = hexFill(f.color, '#4a9fb0')
      ctx.lineWidth = selected ? metrics.sponsorLine + 1.5 : metrics.sponsorLine
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const pFirst = projectScene(project, f.points[0]!)
      ctx.moveTo(pFirst.x, pFirst.y)
      for (let i = 1; i < f.points.length; i++) {
        const pi = projectScene(project, f.points[i]!)
        ctx.lineTo(pi.x, pi.y)
      }
      ctx.stroke()
      for (const pt of f.points) {
        const { x, y } = projectScene(project, pt)
        ctx.fillStyle = hexFill(f.color, '#4a9fb0')
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      const mid = f.points[Math.floor(f.points.length / 2)]!
      const pm = projectScene(project, mid)
      if (selected) drawSelectionRing(ctx, pm.x, pm.y, 9)
      if (f.label) {
        drawLabelPill(
          ctx,
          f.label,
          pm.x + 5,
          pm.y - 3,
          metrics.sfFont,
          '#a8d4e0',
          'rgba(10, 14, 20, 0.72)',
          metrics.labelH,
          metrics.labelPadX,
        )
      }
      continue
    }

    const p0 = f.points[0]
    if (!p0) continue
    const { x, y } = projectScene(project, p0)

    if (f.type === 'mark' || f.type === 'buoy') {
      ctx.fillStyle = hexFill(
        f.color,
        f.type === 'buoy' ? '#ffb200' : '#ffb200',
      )
      ctx.beginPath()
      ctx.arc(x, y, f.type === 'buoy' ? metrics.markR + 1 : metrics.markR, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'
      ctx.lineWidth = 1
      ctx.stroke()
      if (f.type === 'buoy' && f.telemetryId) {
        ctx.strokeStyle = '#5ec8ff'
        ctx.beginPath()
        ctx.arc(x, y, metrics.markR + 4, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (f.type === 'gateLeft' || f.type === 'gateRight') {
      ctx.fillStyle = hexFill(f.color, '#00ff80')
      ctx.beginPath()
      ctx.arc(x, y, metrics.gateEndR, 0, Math.PI * 2)
      ctx.fill()
    } else if (f.type === 'flagP1') {
      drawDiamond(ctx, x, y, 6, '#f0f0f0')
    } else if (f.type === 'flagP2') {
      drawDiamond(ctx, x, y, 6, '#ff8c00')
    } else if (f.type === 'start' || f.type === 'finish') {
      ctx.strokeStyle = hexFill(f.color, '#c01010')
      ctx.lineWidth = metrics.courseLine
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - 9, y)
      ctx.lineTo(x + 9, y)
      ctx.stroke()
      drawLabelPill(
        ctx,
        f.type === 'start' ? 'S' : 'F',
        x + 6,
        y - 4,
        metrics.sfFont,
        '#ff9090',
        'rgba(10, 14, 20, 0.72)',
        metrics.labelH,
        metrics.labelPadX,
      )
    } else if (f.type === 'arrow' || f.type === 'rotation') {
      const brg = parseArrowBearingDeg(f.label) ?? 0
      drawMapArrowGlyph(ctx, x, y, brg, f.type)
      if (f.label && f.type === 'arrow') {
        drawLabelPill(
          ctx,
          f.label,
          x + 10,
          y + 3,
          metrics.labelFont,
          '#a8c0d8',
          'rgba(10, 14, 20, 0.72)',
          metrics.labelH,
          metrics.labelPadX,
        )
      }
    }

    if (selected) drawSelectionRing(ctx, x, y, 10)
  }
}

/** Load map sprite; resolves null on failure (caller uses procedural fallback). */
export function loadMapSprite(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}
