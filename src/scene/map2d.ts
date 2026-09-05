import type { LayoutFeature } from './features/types.ts'
import {
  filterFeaturesFor2d,
  filterFeaturesForStreamMap,
} from './features/featureVisibility.ts'
import type { EnuPosition, PoseEvent, PoseKind } from '../pose/types.ts'
import { eastNorthFromScene, northFromSceneZ } from '../geodesy/index.ts'
import { closestPointOnSegment2d } from './features/editor/polylineInsert.ts'
import {
  cachedParentOsmTiles,
  createTileCache,
  drawOsmBasemap,
  ensureOsmTiles,
  isOsmTileImage,
  nextOsmDrawHistory,
  OSM_ATTRIBUTION,
  osmTilesDrawList,
  tileCacheKey,
  tilesForEnuBounds,
  type BasemapGeoBridge,
  type OsmTileRef,
} from './map2dBasemap.ts'
import {
  createDefaultMapView,
  fitMapViewToBounds,
  panMapView,
  viewToMapBounds,
  wheelZoomFactor,
  zoomMapViewAt,
  type MapBounds,
  type MapViewState,
} from './map2dView.ts'
import {
  drawMapBoatIcon,
  drawMapDroneIcon,
  drawMapFleetLabel,
  drawMapLayoutFeatures,
  drawMapWindReadout,
  drawStreamCompass,
  drawStreamMapBackdrop,
  drawStreamTitleStrip,
  loadMapSprite,
  mapChromeMetrics,
  MAP_BOAT_SPRITE_URL,
  MAP_SAIL_SPRITE_URL,
  clampStreamBoatIconScale,
  readStreamBoatIconScale,
  scaleStreamBoatChrome,
  STREAM_BOAT_ICON_SCALE_DEFAULT,
  STREAM_ROUNDING_ANIM_HZ,
  writeStreamBoatIconScale,
} from './mapChrome.ts'
import { resolveStreamFleetLabel } from './boatNames/categoryColor.ts'
import { windBus } from '../telemetry/windBus.ts'
import type { WindFrame } from '../telemetry/windTypes.ts'

export type { MapBounds, MapViewState } from './map2dView.ts'
export type { BasemapGeoBridge } from './map2dBasemap.ts'

export type MapPoint = {
  id: string
  kind: PoseKind
  east: number
  north: number
  up: number
  /** Compass-style yaw degrees (0=N, CW+); boats use pose `brg`. */
  yawDeg: number
}

function poseStoreKey(kind: PoseKind, id: string): string {
  return `${kind}:${id}`
}

/** Static course mark / gate end for 2D overlay (not a pose). Legacy simple dots. */
export type MapCourseMark = {
  name: string
  east: number
  north: number
}

const DEFAULT_HALF_EXTENT_M = 25
const PADDING_PX = 20

/** Fallback boat square fill when catalogue has no colour for the id. */
export const DEFAULT_BOAT_DOT_COLOR = '#f0a060'
/** Drone / POV circle fill (not catalogue-tinted). */
export const DEFAULT_DRONE_DOT_COLOR = '#5ec8ff'
/** Buoy pose / planned marker fill. */
export const DEFAULT_BUOY_DOT_COLOR = '#ffb200'

/**
 * Resolve fleet-map icon fill from pose kind + optional catalogue colour by id.
 * Pure helper — safe to unit-test without canvas.
 */
export function resolveMapDotFill(
  id: string,
  kind: PoseKind,
  boatColors: ReadonlyMap<string, string> = new Map(),
): string {
  if (kind === 'drone') return DEFAULT_DRONE_DOT_COLOR
  if (kind === 'buoy') return DEFAULT_BUOY_DOT_COLOR
  return boatColors.get(id) ?? DEFAULT_BOAT_DOT_COLOR
}

function collectLayoutEnu(
  features: readonly LayoutFeature[],
): Array<{ east: number; north: number }> {
  const out: Array<{ east: number; north: number }> = []
  for (const f of features) {
    for (const p of f.points) {
      out.push(eastNorthFromScene(p))
    }
  }
  return out
}

/**
 * Auto-fit ENU East/North AABB with padding; single/empty → fixed half-extent about centroid (or origin).
 * North-up panel: +N → top, +E → right.
 */
export function boundsFromPoints(
  points: readonly MapPoint[],
  courseMarks: readonly MapCourseMark[] = [],
  layoutFeatures: readonly LayoutFeature[] = [],
): MapBounds {
  const layoutPts = collectLayoutEnu(layoutFeatures)
  if (
    points.length === 0 &&
    courseMarks.length === 0 &&
    layoutPts.length === 0
  ) {
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
  for (const m of layoutPts) {
    minE = Math.min(minE, m.east)
    maxE = Math.max(maxE, m.east)
    minN = Math.min(minN, m.north)
    maxN = Math.max(maxN, m.north)
  }

  if (maxE - minE < 1e-3 && maxN - minN < 1e-3) {
    const e = points[0]?.east ?? courseMarks[0]?.east ?? layoutPts[0]!.east
    const n = points[0]?.north ?? courseMarks[0]?.north ?? layoutPts[0]!.north
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

/** Geographic East/North metres → panel px (origin top-left). North-up, East-right.
 * Scene Vector3 is x=East, z=−North — convert with `northFromSceneZ` / `eastNorthFromScene`. */
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

/** Panel px → ENU East/North (inverse of `enuToMapPx`). */
export function mapPxToEnu(
  x: number,
  y: number,
  bounds: MapBounds,
  width: number,
  height: number,
  paddingPx = PADDING_PX,
): { east: number; north: number } {
  const innerW = Math.max(width - paddingPx * 2, 1)
  const innerH = Math.max(height - paddingPx * 2, 1)
  const spanE = Math.max(bounds.maxE - bounds.minE, 1e-6)
  const spanN = Math.max(bounds.maxN - bounds.minN, 1e-6)
  const east = bounds.minE + ((x - paddingPx) / innerW) * spanE
  const north = bounds.maxN - ((y - paddingPx) / innerH) * spanN
  return { east, north }
}

export type MapEnuPoint = { east: number; north: number }

/** Vertex hit for select-tool drag (feature id + point index). */
export type MapVertexHit = {
  featureId: string
  pointIndex: number
  east: number
  north: number
}

/** Insert a vertex on a polyline (splice index). */
export type MapPolylineInsertHit = {
  featureId: string
  insertIndex: number
  east: number
  north: number
}

export type MapDraftSegment = {
  a: MapEnuPoint
  b: MapEnuPoint
}

/** Polyline draft while placing a billboard chain. */
export type MapDraftPolyline = {
  points: MapEnuPoint[]
  cursor: MapEnuPoint | null
}

export type Map2dHandle = {
  root: HTMLElement
  /**
   * Backing store for map chrome. Safe to sample when the panel is
   * `hidden` — redraw still updates pixels (OUT 2D NDI pump).
   */
  getCanvas: () => HTMLCanvasElement
  updatePose: (pose: PoseEvent) => void
  /** @deprecated Prefer `setLayoutFeatures` for gates/sponsors/flags. */
  setCourseMarks: (marks: readonly MapCourseMark[]) => void
  /** Shared ENU world features (marks, gates, sponsors, flags, stubs). */
  setLayoutFeatures: (features: readonly LayoutFeature[]) => void
  /** Highlight selected feature ids (editor). */
  setSelectedFeatureIds: (ids: readonly string[]) => void
  /** Enable pointer interaction for editor clicks. */
  setInteractive: (on: boolean) => void
  /** Resize canvas (editor enlarges map). Stream preserves current aspect. */
  setSizePx: (sizePx: number) => void
  /** Show/hide panel (stream map lives off-screen when not local 2D). */
  setVisible: (on: boolean) => void
  isVisible: () => boolean
  /** Update panel title (stream branding strip / race name). */
  setTitle: (title: string) => void
  /**
   * Hit-test nearest layout feature to ENU east/north.
   * `maxDistPx` is screen-space threshold after projection.
   */
  hitTestFeature: (
    east: number,
    north: number,
    maxDistPx?: number,
  ) => LayoutFeature | null
  /**
   * Hit-test nearest fleet pose icon (boats/drones). Hidden ids are skipped.
   * `kinds` limits the search (default: all pose kinds on this map).
   */
  hitTestPose: (
    east: number,
    north: number,
    maxDistPx?: number,
    kinds?: readonly PoseKind[],
  ) => MapPoint | null
  hitTestVertex: (
    east: number,
    north: number,
    maxDistPx?: number,
    preferFeatureIds?: ReadonlySet<string> | readonly string[],
  ) => MapVertexHit | null
  /**
   * Closest point on a billboard-chain (or other polyline) segment.
   * `insertIndex` is the splice index for a new vertex (1…n-1).
   */
  hitTestPolylineInsert: (
    east: number,
    north: number,
    maxDistPx?: number,
    types?: readonly LayoutFeature['type'][],
  ) => MapPolylineInsertHit | null
  /**
   * Nearest layout vertex in screen space (editor snap).
   * Returns ENU east/north or null when outside `maxDistPx`.
   */
  nearestVertex: (
    east: number,
    north: number,
    maxDistPx?: number,
  ) => MapEnuPoint | null
  /** Yellow snap crosshair (editor); null clears. */
  setSnapGuide: (point: MapEnuPoint | null) => void
  /** Dashed A→B preview while drawing (editor); null clears. */
  setDraftSegment: (segment: MapDraftSegment | null) => void
  /** Polyline draft (billboard chain); null clears. */
  setDraftPolyline: (poly: MapDraftPolyline | null) => void
  /** Subscribe to map clicks in ENU (editor). Returns unsubscribe. */
  onMapClick: (
    cb: (east: number, north: number) => void,
  ) => () => void
  /** Pointer move in ENU while interactive (editor bearing / snap). */
  onMapPointerMove: (
    cb: (east: number, north: number) => void,
  ) => () => void
  /**
   * Pointerdown claimers — return true to own the gesture (skip pan).
   * Used by the feature editor for vertex drag while `select` is active.
   */
  onMapPointerDown: (
    cb: (east: number, north: number, ev: PointerEvent) => boolean,
  ) => () => void
  /**
   * Stream-only: scale boat hull + fleet pills + course chrome (0.25–2, default 0.5).
   * Ops map is a no-op. Same canvas is what NDI samples.
   */
  setBoatIconScale: (scale: number) => void
  /** Current stream boat-icon scale; ops always reports 1. */
  getBoatIconScale: () => number
  /** Per-boat map dot CSS colors (category / catalogue). */
  setBoatDotColors: (colors: ReadonlyMap<string, string>) => void
  /** Catalogue names for stream fleet pills (ops still draws ids). */
  setBoatNames: (names: ReadonlyMap<string, string>) => void
  /**
   * Optional OSM basemap. Ops: checkbox, default off. Stream: default on
   * when `geoBridge` is set (no checkbox; NDI samples the canvas).
   */
  setBasemapEnabled: (on: boolean) => void
  isBasemapEnabled: () => boolean
  /** GEO bridge required for OSM tiles + click-to-anchor lat/lon. */
  setGeoBridge: (bridge: BasemapGeoBridge | null) => void
  /** Reset pan/zoom to fit current fleet + features. */
  resetView: () => void
  /**
   * Center the viewport on an ENU point (ops Focus). Disables auto-fit.
   * `halfExtentN` defaults to a medium close-up (~80 m half-height).
   */
  focusEnu: (east: number, north: number, halfExtentN?: number) => void
  /**
   * Pose ids whose map icons are hidden (boats/POVs Show/Hide 2D).
   * Independent of layout-feature `visible2d`.
   */
  setHiddenPoseIds: (ids: ReadonlySet<string> | readonly string[]) => void
  /**
   * Drop a single fleet/buoy pose icon. Returns true when an entry existed.
   * Layout features are untouched.
   */
  removePose: (id: string) => boolean
  /**
   * Drop boat/drone icons whose id is not in `ids`. Buoy poses are kept
   * (independent of the Live fleet list). Returns how many points were removed.
   */
  retainPoseIds: (ids: readonly string[]) => number
  /** Current pose icon ids (fleet + buoy); for tests / debug. */
  getPoseIds: () => string[]
  redraw: () => void
  dispose: () => void
}

export type Map2dVariant = 'ops' | 'stream'

export type Map2dOptions = {
  /** CSS size hint; canvas internal resolution follows client size. */
  sizePx?: number
  /** Canvas width. Defaults to `sizePx` (square). Stream map uses 16:9. */
  widthPx?: number
  /** Canvas height. Defaults to `sizePx` (square). Stream map uses 16:9. */
  heightPx?: number
  /**
   * `ops` — small correction/editor map (default).
   * `stream` — on-air / local-2D graphic (off-screen host; 1920×1080).
   */
  variant?: Map2dVariant
  /** Panel title; defaults by variant. */
  title?: string
  /**
   * Initial visibility. Stream defaults `true` (off-screen host, not a PiP).
   * Ops defaults `true`.
   */
  visible?: boolean
}

/**
 * Top-down fleet map from poseBus ENU (x=E, z=N). Not Three.js.
 * Shared chrome (`mapChrome`) draws course overlays + sailboat icons for
 * both ops and stream variants. Stream adds broadcast backdrop/compass/title;
 * OSM draws on both when a geo bridge is set (stream default on, no checkbox).
 * Ops map supports pan/zoom + optional OSM and stays utilitarian.
 * Both variants subscribe to `windBus` (no fetch) and draw a travel arrow
 * + from-deg/kt readout.
 */
export function createMap2d(options: Map2dOptions = {}): Map2dHandle {
  const variant: Map2dVariant = options.variant ?? 'ops'
  const isStream = variant === 'stream'
  const chrome = mapChromeMetrics(variant)
  const defaultSize = isStream ? 1080 : 240
  let canvasW = Math.max(
    120,
    Math.floor(
      options.widthPx ??
        options.sizePx ??
        (isStream ? 1920 : defaultSize),
    ),
  )
  let canvasH = Math.max(
    120,
    Math.floor(options.heightPx ?? options.sizePx ?? defaultSize),
  )
  let visible = options.visible ?? true

  const root = document.createElement('div')
  root.className = isStream ? 'ops-map stream-map' : 'ops-map'
  root.setAttribute(
    'aria-label',
    isStream
      ? 'Stream race map (ENU East/North)'
      : 'Fleet map (ENU East/North)',
  )
  root.hidden = !visible

  let titleText = options.title ?? (isStream ? 'Race map' : 'Map ENU · N↑')
  const title = document.createElement('div')
  title.className = isStream
    ? 'ops-map__title stream-map__title'
    : 'ops-map__title'
  title.textContent = titleText
  // Stream title is burned on the canvas (NDI samples pixels). Skip the DOM
  // strip so local 2D and air match — no double title.
  if (!isStream) {
    root.appendChild(title)
  }

  const toolbar = document.createElement('div')
  toolbar.className = 'ops-map__toolbar'
  if (!isStream) {
    const basemapLabel = document.createElement('label')
    basemapLabel.className = 'ops-map__check'
    const basemapInput = document.createElement('input')
    basemapInput.type = 'checkbox'
    basemapInput.checked = false
    basemapInput.addEventListener('change', () => {
      basemapEnabled = basemapInput.checked
      redraw()
    })
    basemapLabel.appendChild(basemapInput)
    basemapLabel.appendChild(document.createTextNode(' OSM'))
    basemapLabel.title =
      'Optional OpenStreetMap tiles (offline → plain grid). No API key.'
    toolbar.appendChild(basemapLabel)

    const fitBtn = document.createElement('button')
    fitBtn.type = 'button'
    fitBtn.className = 'ops-hud__btn ops-map__fit'
    fitBtn.textContent = 'Fit'
    fitBtn.title = 'Reset pan/zoom to fit fleet + features'
    fitBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      resetView()
    })
    toolbar.appendChild(fitBtn)
    root.appendChild(toolbar)
  }

  const canvas = document.createElement('canvas')
  canvas.className = 'ops-map__canvas'
  canvas.width = canvasW
  canvas.height = canvasH
  root.appendChild(canvas)
  if (isStream) {
    root.style.width = `${canvasW}px`
  }

  const ctx = canvas.getContext('2d')
  const points = new Map<string, MapPoint>()
  let boatDotColors = new Map<string, string>()
  let boatNames = new Map<string, string>()
  let courseMarks: MapCourseMark[] = []
  let layoutFeatures: LayoutFeature[] = []
  let selectedIds = new Set<string>()
  let hiddenPoseIds = new Set<string>()
  let lastBounds: MapBounds = boundsFromPoints([], [], [])
  let view: MapViewState = createDefaultMapView()
  let interactive = false
  let snapGuide: MapEnuPoint | null = null
  let draftSegment: MapDraftSegment | null = null
  let draftPolyline: MapDraftPolyline | null = null
  let boatSprite: HTMLImageElement | null = null
  let sailSprite: HTMLImageElement | null = null
  let disposed = false
  let windFrame: WindFrame | null = windBus.getSnapshot()
  let boatIconScale = isStream
    ? readStreamBoatIconScale()
    : STREAM_BOAT_ICON_SCALE_DEFAULT
  let basemapEnabled = isStream
  let geoBridge: BasemapGeoBridge | null = null
  const tileCache = createTileCache()
  let prevOsmTiles: OsmTileRef[] = []
  const clickListeners = new Set<(east: number, north: number) => void>()
  const moveListeners = new Set<(east: number, north: number) => void>()
  const pointerDownClaimers = new Set<
    (east: number, north: number, ev: PointerEvent) => boolean
  >()

  // Pan state (pointer drag). Distinguishes click vs pan.
  let panPointerId: number | null = null
  let panLast: { x: number; y: number } | null = null
  let panMoved = false
  const PAN_THRESHOLD_PX = 4

  void loadMapSprite(MAP_BOAT_SPRITE_URL).then((img) => {
    if (disposed || !img) return
    boatSprite = img
    redraw()
  })
  void loadMapSprite(MAP_SAIL_SPRITE_URL).then((img) => {
    if (disposed || !img) return
    sailSprite = img
    redraw()
  })

  function toMapPoint(pose: PoseEvent): MapPoint {
    const pos: EnuPosition = pose.position
    return {
      id: pose.id,
      kind: pose.kind,
      east: pos.x,
      north: northFromSceneZ(pos.z),
      up: pos.y,
      yawDeg: pose.rotation.yawDeg,
    }
  }

  function dataBounds(): MapBounds {
    return boundsFromPoints([...points.values()], courseMarks, layoutFeatures)
  }

  function activeBounds(w: number, h: number): MapBounds {
    if (view.autoFit) {
      view = fitMapViewToBounds(dataBounds())
    }
    return viewToMapBounds(view, w, h)
  }

  function resetView(): void {
    view = fitMapViewToBounds(dataBounds())
    redraw()
  }

  function focusEnu(east: number, north: number, halfExtentN = 80): void {
    const half = Math.max(halfExtentN, 10)
    view = {
      centerE: east,
      centerN: north,
      halfExtentN: half,
      autoFit: false,
    }
    redraw()
  }

  function redraw(): void {
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const bounds = activeBounds(w, h)
    lastBounds = bounds

    const project = (east: number, north: number) =>
      enuToMapPx(east, north, bounds, w, h)

    if (isStream) {
      drawStreamMapBackdrop(ctx, w, h)
    } else {
      ctx.fillStyle = '#0e141c'
      ctx.fillRect(0, 0, w, h)
    }

    // OSM underlay (ops checkbox; stream default on). Keep last zoom in the
    // canvas until the new integer z loads (no full blank). Missing tiles
    // leave the wash/grid fallback.
    let basemapDrawn = false
    if (basemapEnabled && geoBridge) {
      const tiles = tilesForEnuBounds(bounds, geoBridge, h)
      ensureOsmTiles(tiles, tileCache, () => {
        if (!disposed) redraw()
      })
      const drawTiles = osmTilesDrawList(tiles, [
        ...prevOsmTiles,
        ...cachedParentOsmTiles(tiles, tileCache),
      ])
      drawOsmBasemap(ctx, drawTiles, tileCache, geoBridge, project)
      basemapDrawn = drawTiles.some((t) =>
        isOsmTileImage(tileCache.get(tileCacheKey(t))),
      )
      prevOsmTiles = nextOsmDrawHistory(tiles, prevOsmTiles, tileCache)
      if (basemapDrawn) {
        // Soft darken so chrome stays readable.
        ctx.fillStyle = 'rgba(8, 14, 22, 0.35)'
        ctx.fillRect(0, 0, w, h)
      }
    }

    if (!isStream && !basemapDrawn) {
      // Subtle water wash (no tiles).
      const grad = ctx.createRadialGradient(
        w * 0.45,
        h * 0.4,
        8,
        w * 0.5,
        h * 0.5,
        w * 0.72,
      )
      grad.addColorStop(0, '#152030')
      grad.addColorStop(1, '#0e141c')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }

    if (!isStream) {
      ctx.strokeStyle = basemapDrawn ? 'rgba(42, 51, 64, 0.55)' : '#2a3340'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w / 2, h)
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      ctx.fillStyle = '#7a8a9a'
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      ctx.fillText('N', w / 2 - 4, 12)
      ctx.fillText('E', w - 12, h / 2 + 3)
    }

    if (basemapDrawn) {
      ctx.fillStyle = isStream
        ? 'rgba(200, 210, 220, 0.75)'
        : 'rgba(160, 170, 180, 0.7)'
      ctx.font = isStream
        ? '12px ui-sans-serif, system-ui, Segoe UI, sans-serif'
        : '8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      if (isStream) {
        ctx.textAlign = 'end'
        ctx.fillText(OSM_ATTRIBUTION, w - 10, h - 10)
        ctx.textAlign = 'start'
      } else {
        ctx.fillText(OSM_ATTRIBUTION, 6, h - 6)
      }
    }

    // Ops: visible2d. Stream: visible2d + on-air type allow-list (no chains/sponsors).
    const layoutForMap = isStream
      ? filterFeaturesForStreamMap(layoutFeatures)
      : filterFeaturesFor2d(layoutFeatures)
    const fleetChrome = isStream
      ? scaleStreamBoatChrome(chrome, boatIconScale)
      : chrome
    if (layoutForMap.length > 0) {
      drawMapLayoutFeatures(ctx, layoutForMap, {
        project,
        metrics: fleetChrome,
        selectedIds,
        nowSec: isStream ? performance.now() * 0.001 : undefined,
      })
    } else if (!isStream && layoutFeatures.length === 0) {
      // Legacy course-mark dots when layout not set (ops only).
      for (const m of courseMarks) {
        const { x, y } = project(m.east, m.north)
        ctx.fillStyle = '#ffb200'
        ctx.beginPath()
        ctx.arc(x, y, chrome.markR, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (const p of [...points.values()].sort((a, b) => {
      const rank = (k: PoseKind) =>
        k === 'boat' ? 2 : k === 'drone' ? 1 : 0
      return rank(a.kind) - rank(b.kind)
    })) {
      if (hiddenPoseIds.has(p.id)) continue
      if (isStream && p.kind === 'drone') continue
      const { x, y } = project(p.east, p.north)
      const fill = resolveMapDotFill(p.id, p.kind, boatDotColors)
      if (p.kind === 'drone') {
        drawMapDroneIcon(ctx, x, y, fill, chrome.droneR)
      } else if (p.kind === 'buoy') {
        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.arc(x, y, chrome.markR + 1, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'
        ctx.lineWidth = 1
        ctx.stroke()
      } else {
        drawMapBoatIcon(ctx, x, y, {
          fill,
          yawDeg: p.yawDeg,
          len: fleetChrome.boatLen,
          beam: fleetChrome.boatBeam,
          boatSprite,
          sailSprite,
        })
      }
      const labelX = x + fleetChrome.boatLen * 0.7 + 4
      const labelText =
        isStream && p.kind === 'boat'
          ? resolveStreamFleetLabel(p.id, boatNames)
          : `${p.id}`
      // Stream: boats keep name pills; drones are skipped above.
      if (!isStream || p.kind !== 'drone') {
        drawMapFleetLabel(ctx, labelText, labelX, y + 3, fleetChrome)
      }
      // Stream: id only (less clutter). Ops map keeps altitude hint.
      if (!isStream) {
        ctx.fillStyle = '#6a7888'
        ctx.font = chrome.labelFont
        ctx.fillText(`y${p.up.toFixed(0)}`, labelX, y + 14)
      }
    }

    if (draftPolyline && draftPolyline.points.length > 0) {
      ctx.strokeStyle = '#9ad4ff'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      const pts = draftPolyline.points
      const p0 = project(pts[0]!.east, pts[0]!.north)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < pts.length; i++) {
        const pi = project(pts[i]!.east, pts[i]!.north)
        ctx.lineTo(pi.x, pi.y)
      }
      if (draftPolyline.cursor) {
        const pc = project(
          draftPolyline.cursor.east,
          draftPolyline.cursor.north,
        )
        ctx.lineTo(pc.x, pc.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      for (const pt of pts) {
        const { x, y } = project(pt.east, pt.north)
        ctx.fillStyle = '#9ad4ff'
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (draftSegment) {
      const pa = project(draftSegment.a.east, draftSegment.a.north)
      const pb = project(draftSegment.b.east, draftSegment.b.north)
      ctx.strokeStyle = '#ffe08a'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ffe08a'
      ctx.beginPath()
      ctx.arc(pa.x, pa.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    if (snapGuide) {
      const { x, y } = project(snapGuide.east, snapGuide.north)
      ctx.strokeStyle = '#ffe08a'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - 8, y)
      ctx.lineTo(x + 8, y)
      ctx.moveTo(x, y - 8)
      ctx.lineTo(x, y + 8)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.stroke()
    }

    // HUD chrome: travel arrow + from/kt. Default/stale still draws.
    if (windFrame) {
      drawMapWindReadout(ctx, w, h, windFrame, chrome)
    }

    if (isStream) {
      drawStreamTitleStrip(ctx, w, h, titleText)
      drawStreamCompass(ctx, w, h)
    }
  }

  function canvasLocal(ev: { clientX: number; clientY: number }): {
    x: number
    y: number
  } {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / Math.max(rect.width, 1)
    const sy = canvas.height / Math.max(rect.height, 1)
    return {
      x: (ev.clientX - rect.left) * sx,
      y: (ev.clientY - rect.top) * sy,
    }
  }

  function enuFromLocal(x: number, y: number): MapEnuPoint {
    return mapPxToEnu(x, y, lastBounds, canvas.width, canvas.height)
  }

  function enuFromEvent(ev: { clientX: number; clientY: number }): MapEnuPoint {
    const { x, y } = canvasLocal(ev)
    return enuFromLocal(x, y)
  }

  function onCanvasClick(ev: MouseEvent): void {
    if (!interactive || clickListeners.size === 0) return
    // Suppress click after a pan drag.
    if (panMoved) {
      panMoved = false
      return
    }
    const { east, north } = enuFromEvent(ev)
    for (const cb of clickListeners) cb(east, north)
  }

  function onCanvasPointerMove(ev: PointerEvent): void {
    if (panPointerId !== null && panLast && ev.pointerId === panPointerId) {
      const loc = canvasLocal(ev)
      const dx = loc.x - panLast.x
      const dy = loc.y - panLast.y
      if (Math.hypot(dx, dy) > PAN_THRESHOLD_PX) panMoved = true
      if (panMoved) {
        const before = enuFromLocal(panLast.x, panLast.y)
        const after = enuFromLocal(loc.x, loc.y)
        view = panMapView(
          view,
          before.east - after.east,
          before.north - after.north,
        )
        panLast = loc
        redraw()
      }
      return
    }
    if (!interactive || moveListeners.size === 0) return
    const { east, north } = enuFromEvent(ev)
    for (const cb of moveListeners) cb(east, north)
  }

  function onPointerDown(ev: PointerEvent): void {
    if (ev.button !== 0) return
    const { east, north } = enuFromEvent(ev)
    for (const claim of pointerDownClaimers) {
      if (claim(east, north, ev)) {
        // Feature owns this gesture (e.g. vertex drag) — skip pan; suppress click.
        panPointerId = null
        panLast = null
        panMoved = true
        return
      }
    }
    // Pan with drag always (ops + stream); editor clicks still fire on click.
    panPointerId = ev.pointerId
    panLast = canvasLocal(ev)
    panMoved = false
    try {
      canvas.setPointerCapture(ev.pointerId)
    } catch {
      // ignore
    }
  }

  function onPointerUp(ev: PointerEvent): void {
    if (ev.pointerId !== panPointerId) return
    panPointerId = null
    panLast = null
    // panMoved cleared on click handler if click fires; else reset soon.
    window.setTimeout(() => {
      panMoved = false
    }, 0)
  }

  function onWheel(ev: WheelEvent): void {
    ev.preventDefault()
    const { east, north } = enuFromEvent(ev)
    // Ensure lastBounds matches current view before zooming.
    lastBounds = activeBounds(canvas.width, canvas.height)
    view = zoomMapViewAt(view, wheelZoomFactor(ev.deltaY), east, north)
    redraw()
  }

  canvas.addEventListener('click', onCanvasClick)
  canvas.addEventListener('pointermove', onCanvasPointerMove)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  const unsubWind = windBus.subscribe((frame) => {
    windFrame = frame
    if (!disposed) redraw()
  })

  redraw()

  let roundingAnimTimer: ReturnType<typeof setInterval> | null = null
  if (isStream) {
    const periodMs = Math.round(1000 / STREAM_ROUNDING_ANIM_HZ)
    roundingAnimTimer = setInterval(() => {
      if (!disposed) redraw()
    }, periodMs)
  }

  return {
    root,
    getCanvas(): HTMLCanvasElement {
      return canvas
    },
    updatePose(pose: PoseEvent): void {
      points.set(poseStoreKey(pose.kind, pose.id), toMapPoint(pose))
      redraw()
    },
    removePose(id: string): boolean {
      const key = id.trim()
      if (key === '') return false
      let removed = false
      for (const [storeKey, p] of [...points.entries()]) {
        if (p.id !== key) continue
        points.delete(storeKey)
        removed = true
      }
      if (removed) redraw()
      return removed
    },
    retainPoseIds(ids: readonly string[]): number {
      const allow = new Set(
        [...ids].map((id) => id.trim()).filter((id) => id !== ''),
      )
      let removed = 0
      for (const [storeKey, p] of [...points.entries()]) {
        if (p.kind === 'buoy') continue
        if (allow.has(p.id)) continue
        points.delete(storeKey)
        removed++
      }
      if (removed > 0) redraw()
      return removed
    },
    getPoseIds(): string[] {
      return [...new Set([...points.values()].map((p) => p.id))]
    },
    setCourseMarks(marks: readonly MapCourseMark[]): void {
      courseMarks = marks.map((m) => ({ ...m }))
      redraw()
    },
    setLayoutFeatures(features: readonly LayoutFeature[]): void {
      layoutFeatures = features.map((f) => ({
        ...f,
        points: f.points.map((p) => ({ ...p })),
        rawPoints: f.rawPoints.map((p) => ({ ...p })),
      }))
      redraw()
    },
    setSelectedFeatureIds(ids: readonly string[]): void {
      selectedIds = new Set(ids)
      redraw()
    },
    setInteractive(on: boolean): void {
      interactive = on
      root.classList.toggle('ops-map--interactive', on)
    },
    setSizePx(next: number): void {
      const h = Math.max(120, Math.floor(next))
      const aspect = canvasW / Math.max(canvasH, 1)
      canvasH = h
      canvasW =
        Math.abs(aspect - 1) < 1e-6
          ? h
          : Math.max(120, Math.round(h * aspect))
      canvas.width = canvasW
      canvas.height = canvasH
      root.style.width = `${canvasW}px`
      redraw()
    },
    setVisible(on: boolean): void {
      visible = on
      root.hidden = !on
      if (on) redraw()
    },
    isVisible(): boolean {
      return visible
    },
    setTitle(next: string): void {
      const trimmed = next.trim()
      titleText = trimmed || (isStream ? 'Race map' : 'Map ENU · N↑')
      title.textContent = titleText
      if (isStream) {
        root.setAttribute(
          'aria-label',
          `Stream race map: ${titleText}`,
        )
        redraw()
      }
    },
    hitTestFeature(east, north, maxDistPx = 12): LayoutFeature | null {
      const w = canvas.width
      const h = canvas.height
      const click = enuToMapPx(east, north, lastBounds, w, h)
      let best: LayoutFeature | null = null
      let bestD = maxDistPx
      for (const f of layoutFeatures) {
        for (const p of f.points) {
          const px = enuToMapPx(p.x, northFromSceneZ(p.z), lastBounds, w, h)
          const d = Math.hypot(px.x - click.x, px.y - click.y)
          if (d <= bestD) {
            bestD = d
            best = f
          }
        }
        if (
          (f.type === 'sponsor' || f.type === 'billboardChain') &&
          f.points.length >= 2
        ) {
          for (let i = 0; i < f.points.length - 1; i++) {
            const pa = f.points[i]!
            const pb = f.points[i + 1]!
            const a = enuToMapPx(
              pa.x,
              northFromSceneZ(pa.z),
              lastBounds,
              w,
              h,
            )
            const b = enuToMapPx(
              pb.x,
              northFromSceneZ(pb.z),
              lastBounds,
              w,
              h,
            )
            const near = closestPointOnSegment2d(
              click.x,
              click.y,
              a.x,
              a.y,
              b.x,
              b.y,
            )
            if (near.dist <= bestD) {
              bestD = near.dist
              best = f
            }
          }
        }
      }
      return best
    },
    hitTestVertex(
      east,
      north,
      maxDistPx = 12,
      preferFeatureIds,
    ): MapVertexHit | null {
      const prefer =
        preferFeatureIds == null
          ? null
          : preferFeatureIds instanceof Set
            ? preferFeatureIds
            : new Set(preferFeatureIds)
      const w = canvas.width
      const h = canvas.height
      const click = enuToMapPx(east, north, lastBounds, w, h)

      function nearestIn(
        features: readonly LayoutFeature[],
      ): MapVertexHit | null {
        let best: MapVertexHit | null = null
        let bestD = maxDistPx
        for (const f of features) {
          for (let i = 0; i < f.points.length; i++) {
            const p = f.points[i]!
            const px = enuToMapPx(p.x, northFromSceneZ(p.z), lastBounds, w, h)
            const d = Math.hypot(px.x - click.x, px.y - click.y)
            if (d <= bestD) {
              bestD = d
              best = {
                featureId: f.id,
                pointIndex: i,
                east: p.x,
                north: northFromSceneZ(p.z),
              }
            }
          }
        }
        return best
      }

      if (prefer && prefer.size > 0) {
        const preferred = layoutFeatures.filter((f) => prefer.has(f.id))
        const hit = nearestIn(preferred)
        if (hit) return hit
      }
      return nearestIn(layoutFeatures)
    },
    hitTestPolylineInsert(
      east,
      north,
      maxDistPx = 14,
      types,
    ): MapPolylineInsertHit | null {
      const allow =
        types && types.length > 0 ? new Set(types) : new Set(['billboardChain'])
      const w = canvas.width
      const h = canvas.height
      const click = enuToMapPx(east, north, lastBounds, w, h)
      let best: MapPolylineInsertHit | null = null
      let bestD = maxDistPx
      for (const f of layoutFeatures) {
        if (!allow.has(f.type) || f.points.length < 2) continue
        for (let i = 0; i < f.points.length - 1; i++) {
          const pa = f.points[i]!
          const pb = f.points[i + 1]!
          const a = enuToMapPx(pa.x, northFromSceneZ(pa.z), lastBounds, w, h)
          const b = enuToMapPx(pb.x, northFromSceneZ(pb.z), lastBounds, w, h)
          const near = closestPointOnSegment2d(
            click.x,
            click.y,
            a.x,
            a.y,
            b.x,
            b.y,
          )
          if (near.dist > bestD) continue
          const enu = mapPxToEnu(near.east, near.north, lastBounds, w, h)
          bestD = near.dist
          best = {
            featureId: f.id,
            insertIndex: i + 1,
            east: enu.east,
            north: enu.north,
          }
        }
      }
      return best
    },
    hitTestPose(
      east,
      north,
      maxDistPx = 16,
      kinds,
    ): MapPoint | null {
      const allow =
        kinds && kinds.length > 0 ? new Set(kinds) : null
      const w = canvas.width
      const h = canvas.height
      const click = enuToMapPx(east, north, lastBounds, w, h)
      let best: MapPoint | null = null
      let bestD = maxDistPx
      for (const p of points.values()) {
        if (hiddenPoseIds.has(p.id)) continue
        if (allow && !allow.has(p.kind)) continue
        const px = enuToMapPx(p.east, p.north, lastBounds, w, h)
        const d = Math.hypot(px.x - click.x, px.y - click.y)
        if (d <= bestD) {
          bestD = d
          best = { ...p }
        }
      }
      return best
    },
    nearestVertex(east, north, maxDistPx = 14): MapEnuPoint | null {
      const w = canvas.width
      const h = canvas.height
      const click = enuToMapPx(east, north, lastBounds, w, h)
      let best: MapEnuPoint | null = null
      let bestD = maxDistPx
      for (const f of layoutFeatures) {
        for (const p of f.points) {
          const px = enuToMapPx(p.x, northFromSceneZ(p.z), lastBounds, w, h)
          const d = Math.hypot(px.x - click.x, px.y - click.y)
          if (d <= bestD) {
            bestD = d
            best = eastNorthFromScene(p)
          }
        }
      }
      return best
    },
    setSnapGuide(point): void {
      snapGuide = point ? { ...point } : null
      redraw()
    },
    setDraftSegment(segment): void {
      draftSegment = segment
        ? {
            a: { ...segment.a },
            b: { ...segment.b },
          }
        : null
      redraw()
    },
    setDraftPolyline(poly): void {
      draftPolyline = poly
        ? {
            points: poly.points.map((p) => ({ ...p })),
            cursor: poly.cursor ? { ...poly.cursor } : null,
          }
        : null
      redraw()
    },
    onMapClick(cb): () => void {
      clickListeners.add(cb)
      return () => {
        clickListeners.delete(cb)
      }
    },
    onMapPointerMove(cb): () => void {
      moveListeners.add(cb)
      return () => {
        moveListeners.delete(cb)
      }
    },
    onMapPointerDown(cb): () => void {
      pointerDownClaimers.add(cb)
      return () => {
        pointerDownClaimers.delete(cb)
      }
    },
    setBoatIconScale(scale: number): void {
      if (!isStream) return
      boatIconScale = clampStreamBoatIconScale(scale)
      writeStreamBoatIconScale(boatIconScale)
      redraw()
    },
    getBoatIconScale(): number {
      return isStream ? boatIconScale : 1
    },
    setBoatDotColors(colors: ReadonlyMap<string, string>): void {
      boatDotColors = new Map(colors)
      redraw()
    },
    setBoatNames(names: ReadonlyMap<string, string>): void {
      boatNames = new Map(names)
      redraw()
    },
    setBasemapEnabled(on: boolean): void {
      basemapEnabled = on
      const input = toolbar.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null
      if (input) input.checked = on
      redraw()
    },
    isBasemapEnabled: () => basemapEnabled,
    setGeoBridge(bridge): void {
      geoBridge = bridge
      redraw()
    },
    resetView,
    focusEnu,
    setHiddenPoseIds(ids): void {
      hiddenPoseIds =
        ids instanceof Set
          ? new Set(ids)
          : new Set([...ids].map((id) => id.trim()).filter((id) => id !== ''))
      redraw()
    },
    redraw,
    dispose(): void {
      disposed = true
      if (roundingAnimTimer != null) {
        clearInterval(roundingAnimTimer)
        roundingAnimTimer = null
      }
      unsubWind()
      canvas.removeEventListener('click', onCanvasClick)
      canvas.removeEventListener('pointermove', onCanvasPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      clickListeners.clear()
      moveListeners.clear()
      pointerDownClaimers.clear()
      snapGuide = null
      draftSegment = null
      draftPolyline = null
      boatSprite = null
      sailSprite = null
      points.clear()
      boatDotColors.clear()
      boatNames.clear()
      courseMarks = []
      layoutFeatures = []
      selectedIds.clear()
      geoBridge = null
      root.remove()
    },
  }
}
