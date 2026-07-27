import type { EnuPosition, PoseEvent, PoseKind } from '../pose/types.ts'

export type MapBounds = {
  minE: number
  maxE: number
  minN: number
  maxN: number
}

export type MapPoint = {
  id: string
  kind: PoseKind
  east: number
  north: number
  up: number
}

/** Static course mark / gate end for 2D overlay (not a pose). */
export type MapCourseMark = {
  name: string
  east: number
  north: number
}

const DEFAULT_HALF_EXTENT_M = 25
const PADDING_PX = 20

/**
 * Auto-fit ENU East/North AABB with padding; single/empty → fixed half-extent about centroid (or origin).
 * North-up panel: +N → top, +E → right.
 */
export function boundsFromPoints(
  points: readonly MapPoint[],
  courseMarks: readonly MapCourseMark[] = [],
): MapBounds {
  if (points.length === 0 && courseMarks.length === 0) {
    return {
      minE: -DEFAULT_HALF_EXTENT_M,
      maxE: DEFAULT_HALF_EXTENT_M,
      minN: -DEFAULT_HALF_EXTENT_M,
      maxN: DEFAULT_HALF_EXTENT_M,
    }
  }

  let minE = Infinity
  let maxE = -Infinity
  let minN = Infinity
  let maxN = -Infinity
  for (const p of points) {
    minE = Math.min(minE, p.east)
    maxE = Math.max(maxE, p.east)
    minN = Math.min(minN, p.north)
    maxN = Math.max(maxN, p.north)
  }
  for (const m of courseMarks) {
    minE = Math.min(minE, m.east)
    maxE = Math.max(maxE, m.east)
    minN = Math.min(minN, m.north)
    maxN = Math.max(maxN, m.north)
  }

  if (maxE - minE < 1e-3 && maxN - minN < 1e-3) {
    const e = points[0]?.east ?? courseMarks[0]!.east
    const n = points[0]?.north ?? courseMarks[0]!.north
    return {
      minE: e - DEFAULT_HALF_EXTENT_M,
      maxE: e + DEFAULT_HALF_EXTENT_M,
      minN: n - DEFAULT_HALF_EXTENT_M,
      maxN: n + DEFAULT_HALF_EXTENT_M,
    }
  }

  const padE = Math.max((maxE - minE) * 0.15, 2)
  const padN = Math.max((maxN - minN) * 0.15, 2)
  return {
    minE: minE - padE,
    maxE: maxE + padE,
    minN: minN - padN,
    maxN: maxN + padN,
  }
}

/** ENU x=East, z=North → panel px (origin top-left). */
export function enuToMapPx(
  east: number,
  north: number,
  bounds: MapBounds,
  width: number,
  height: number,
  paddingPx = PADDING_PX,
): { x: number; y: number } {
  const innerW = Math.max(width - paddingPx * 2, 1)
  const innerH = Math.max(height - paddingPx * 2, 1)
  const spanE = Math.max(bounds.maxE - bounds.minE, 1e-6)
  const spanN = Math.max(bounds.maxN - bounds.minN, 1e-6)
  const x = paddingPx + ((east - bounds.minE) / spanE) * innerW
  const y = paddingPx + ((bounds.maxN - north) / spanN) * innerH
  return { x, y }
}

export type Map2dHandle = {
  root: HTMLElement
  updatePose: (pose: PoseEvent) => void
  setCourseMarks: (marks: readonly MapCourseMark[]) => void
  redraw: () => void
  dispose: () => void
}

export type Map2dOptions = {
  /** CSS size hint; canvas internal resolution follows client size. */
  sizePx?: number
}

/**
 * Simple top-down fleet map from poseBus ENU only (x=E, z=N). Not Three.js.
 * Optional static course mark dots (orange).
 */
export function createMap2d(options: Map2dOptions = {}): Map2dHandle {
  const sizePx = options.sizePx ?? 240

  const root = document.createElement('div')
  root.className = 'ops-map'
  root.setAttribute('aria-label', 'Fleet map (ENU East/North)')

  const title = document.createElement('div')
  title.className = 'ops-map__title'
  title.textContent = 'Map ENU · N↑'
  root.appendChild(title)

  const canvas = document.createElement('canvas')
  canvas.className = 'ops-map__canvas'
  canvas.width = sizePx
  canvas.height = sizePx
  root.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  const points = new Map<string, MapPoint>()
  let courseMarks: MapCourseMark[] = []

  function toMapPoint(pose: PoseEvent): MapPoint {
    const pos: EnuPosition = pose.position
    return {
      id: pose.id,
      kind: pose.kind,
      east: pos.x,
      north: pos.z,
      up: pos.y,
    }
  }

  function redraw(): void {
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const list = [...points.values()]
    const bounds = boundsFromPoints(list, courseMarks)

    ctx.fillStyle = '#12161c'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#2a3340'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    ctx.fillStyle = '#5a6a7a'
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    ctx.fillText('N', w / 2 - 4, 12)
    ctx.fillText('E', w - 12, h / 2 + 3)

    // Course marks under fleet icons.
    for (const m of courseMarks) {
      const { x, y } = enuToMapPx(m.east, m.north, bounds, w, h)
      ctx.fillStyle = '#ffb200'
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const p of list) {
      const { x, y } = enuToMapPx(p.east, p.north, bounds, w, h)
      const isDrone = p.kind === 'drone'
      ctx.fillStyle = isDrone ? '#5ec8ff' : '#f0a060'
      if (isDrone) {
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const s = 8
        ctx.fillRect(x - s / 2, y - s / 2, s, s)
      }
      ctx.fillStyle = '#c8d0d8'
      ctx.fillText(`${p.id}`, x + 7, y + 3)
      ctx.fillStyle = '#6a7888'
      ctx.fillText(`y${p.up.toFixed(0)}`, x + 7, y + 14)
    }
  }

  redraw()

  return {
    root,
    updatePose(pose: PoseEvent): void {
      points.set(pose.id, toMapPoint(pose))
      redraw()
    },
    setCourseMarks(marks: readonly MapCourseMark[]): void {
      courseMarks = marks.map((m) => ({ ...m }))
      redraw()
    },
    redraw,
    dispose(): void {
      points.clear()
      courseMarks = []
      root.remove()
    },
  }
}
