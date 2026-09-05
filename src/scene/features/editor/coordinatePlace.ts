/**
 * Coordinate Add / Edit for World Authoring (Phase 19.7).
 * Pure GPS drafts → in-memory WorldFeature[] (or fleet place). GEO convert
 * is injected (`gpsToEnuAmsl` / `enuToGpsAmsl`); no second frame.
 */

import { DEFAULT_LINE_SIGN_WIDTH_M } from '../../lineSigns/lineSignLayout.ts'
import type { BillboardLogo } from '../../billboardLogos.ts'
import type { BoatVisibilityMode } from '../../boatVisibility.ts'
import type {
  GpsToEnuAmslFn,
  WorldFeature,
  WorldFeatureType,
  WorldGpsPoint,
} from '../types.ts'
import type { RoundingSense } from '../rounding.ts'
import {
  applySponsorScaleOnEdit,
  stampSponsorBoardAspect,
} from '../../sponsors/sponsorLayout.ts'
import {
  createArrowFeature,
  createBillboardChainFeature,
  createBuoyFeature,
  createGatePairFeatures,
  createLineSignFeature,
  createPointFeature,
  createSponsorFeature,
  DEFAULT_BILLBOARD_CHAIN_SPACING_M,
  type EnuToGpsAmslFn,
  type FeatureIdCounter,
} from './featureFactory.ts'
import type { EditorTool } from './tools.ts'

/** Authoring type dropdown — world features + fleet. */
export type PlaceKind =
  | WorldFeatureType
  | 'gatePair'
  | 'boat'
  | 'drone'

export const PLACE_KIND_ORDER: readonly PlaceKind[] = [
  'mark',
  'buoy',
  'gateLeft',
  'gateRight',
  'gatePair',
  'sponsor',
  'billboardChain',
  'start',
  'finish',
  'flagP1',
  'flagP2',
  'arrow',
  'boat',
  'drone',
]

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  mark: 'Mark',
  buoy: 'Buoy',
  gateLeft: 'Gate L',
  gateRight: 'Gate R',
  gatePair: 'Gate pair',
  sponsor: 'Sponsor',
  billboardChain: 'Billboard chain',
  start: 'Start',
  finish: 'Finish',
  flagP1: 'Flag P1',
  flagP2: 'Flag P2',
  arrow: 'Arrow',
  rotation: 'Rotation',
  boat: 'Fleet boat',
  drone: 'Drone',
}

/** Default A→B span when the operator types only one lat/lon (metres East). */
export const DEFAULT_SPONSOR_SPAN_M = 20
export const DEFAULT_CHAIN_SPAN_M = 40
export const DEFAULT_GATE_SPAN_M = 10
export const DEFAULT_ARROW_SPAN_M = 10

export type CoordinatePlaceDraft = {
  kind: PlaceKind
  name: string
  label: string
  lat: number
  lon: number
  altMsl: number
  latB?: number
  lonB?: number
  altBMsl?: number
  heightM?: number
  spacingM?: number
  color?: number
  panelColor?: number
  panelAlpha?: number
  telemetryId?: string
  textureUrl?: string | null
  logos?: BillboardLogo[]
  rounding?: RoundingSense
  visible3d?: boolean
  visibleBuoyMesh?: boolean
  visibleTag?: boolean
  visibility?: BoatVisibilityMode
}

export type CoordinatePlaceGeo = {
  gpsToEnuAmsl: GpsToEnuAmslFn
  enuToGpsAmsl: EnuToGpsAmslFn
}

export type FleetPlaceInput = {
  kind: 'boat' | 'drone'
  id: string
  lat: number
  lon: number
  altMsl: number
  name?: string
  label?: string
  heightM?: number
  visibility?: BoatVisibilityMode
}

export type CoordinateAddResult =
  | { ok: true; mode: 'features'; features: WorldFeature[]; createdIds: string[] }
  | { ok: true; mode: 'fleet'; fleet: FleetPlaceInput }
  | { ok: false; error: string }

export function isFleetPlaceKind(kind: PlaceKind): kind is 'boat' | 'drone' {
  return kind === 'boat' || kind === 'drone'
}

export function isTwoPointPlaceKind(kind: PlaceKind): boolean {
  return (
    kind === 'sponsor' ||
    kind === 'start' ||
    kind === 'finish' ||
    kind === 'gatePair' ||
    kind === 'billboardChain'
  )
}

export function toolForPlaceKind(kind: PlaceKind): EditorTool {
  if (kind === 'boat') return 'placeBoat'
  if (kind === 'drone') return 'placeDrone'
  if (kind === 'rotation') return 'select'
  return kind
}

export function placeKindForTool(tool: EditorTool): PlaceKind | null {
  switch (tool) {
    case 'select':
    case 'setAnchor':
      return null
    case 'placeBoat':
      return 'boat'
    case 'placeDrone':
      return 'drone'
    default:
      return tool
  }
}

export function heightFieldCaption(kind: PlaceKind): string {
  if (kind === 'billboardChain') return 'heightM (vertical)'
  if (kind === 'sponsor') return 'heightM (glyph in A–B canvas)'
  if (kind === 'start' || kind === 'finish') return 'heightM (band uniform)'
  if (kind === 'boat') return 'heightM (uniform)'
  return 'heightM'
}

export function spacingFieldCaption(): string {
  return 'spacingM (logo pitch on ribbon)'
}

function eastNorthFromGps(
  lat: number,
  lon: number,
  altMsl: number,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): { east: number; north: number } {
  const enu = gpsToEnuAmsl(lat, lon, altMsl)
  return { east: enu.x, north: -enu.z }
}

function gpsPoint(lat: number, lon: number, altMsl: number): WorldGpsPoint {
  return { lat, lon, altMsl }
}

function finiteGps(
  lat: number,
  lon: number,
  altMsl: number,
): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(altMsl)
}

function resolvePointB(
  draft: CoordinatePlaceDraft,
  geo: CoordinatePlaceGeo,
  spanM: number,
): WorldGpsPoint {
  if (
    draft.latB !== undefined &&
    draft.lonB !== undefined &&
    Number.isFinite(draft.latB) &&
    Number.isFinite(draft.lonB)
  ) {
    const alt =
      draft.altBMsl !== undefined && Number.isFinite(draft.altBMsl)
        ? draft.altBMsl
        : draft.altMsl
    return gpsPoint(draft.latB, draft.lonB, alt)
  }
  const a = eastNorthFromGps(
    draft.lat,
    draft.lon,
    draft.altMsl,
    geo.gpsToEnuAmsl,
  )
  const g = geo.enuToGpsAmsl(a.east + spanM, 0, a.north)
  return gpsPoint(g.lat, g.lon, draft.altMsl)
}

function applyDraftMeta(feature: WorldFeature, draft: CoordinatePlaceDraft): WorldFeature {
  const next: WorldFeature = {
    ...feature,
    points: feature.points.map((p) => ({ ...p })),
    logos: feature.logos?.map((l) => ({ url: l.url, weight: l.weight })),
  }
  const name = draft.name.trim()
  if (name !== '') next.name = name
  const label = draft.label.trim()
  next.label = label === '' ? undefined : label
  if (draft.heightM !== undefined && Number.isFinite(draft.heightM) && draft.heightM >= 0.5) {
    next.heightM = draft.heightM
  }
  if (draft.color !== undefined) next.color = draft.color
  if (draft.panelColor !== undefined) next.panelColor = draft.panelColor
  if (draft.panelAlpha !== undefined) next.panelAlpha = draft.panelAlpha
  if (draft.spacingM !== undefined && Number.isFinite(draft.spacingM) && draft.spacingM > 0) {
    next.spacingM = draft.spacingM
  }
  if (draft.textureUrl !== undefined) next.textureUrl = draft.textureUrl
  if (draft.logos !== undefined) {
    next.logos = draft.logos.map((l) => ({ url: l.url, weight: l.weight }))
    next.textureUrl = draft.logos[0]?.url ?? null
  }
  if (draft.rounding !== undefined) next.rounding = draft.rounding
  if (draft.visible3d !== undefined) next.visible3d = draft.visible3d
  if (draft.visibleBuoyMesh !== undefined) {
    next.visibleBuoyMesh = draft.visibleBuoyMesh
  }
  if (draft.visibleTag !== undefined) next.visibleTag = draft.visibleTag
  if (next.type === 'buoy' || next.type === 'mark') {
    const tel = draft.telemetryId?.trim() ?? ''
    next.telemetryId = tel === '' ? null : tel
  }
  return next
}

function overwritePoints(
  feature: WorldFeature,
  points: WorldGpsPoint[],
): WorldFeature {
  return {
    ...feature,
    points: points.map((p) => ({ ...p })),
    logos: feature.logos?.map((l) => ({ url: l.url, weight: l.weight })),
  }
}

/**
 * Add from typed lat/lon. Mutates a copied features array — caller replaces
 * the in-memory store immediately (Assets list / map) then may remount 3D.
 */
export function addFromCoordinates(
  features: readonly WorldFeature[],
  draft: CoordinatePlaceDraft,
  geo: CoordinatePlaceGeo,
  idCounter: FeatureIdCounter,
): CoordinateAddResult {
  if (isFleetPlaceKind(draft.kind)) {
    const id = (draft.telemetryId?.trim() || draft.name.trim())
    if (id === '') {
      return { ok: false, error: 'Telemetry id required' }
    }
    if (!finiteGps(draft.lat, draft.lon, draft.altMsl)) {
      return { ok: false, error: 'lat / lon / alt required' }
    }
    return {
      ok: true,
      mode: 'fleet',
      fleet: {
        kind: draft.kind,
        id,
        lat: draft.lat,
        lon: draft.lon,
        altMsl: draft.altMsl,
        name: draft.name.trim() || undefined,
        label: draft.label.trim() || undefined,
        heightM: draft.heightM,
        visibility: draft.visibility,
      },
    }
  }

  if (!finiteGps(draft.lat, draft.lon, draft.altMsl)) {
    return { ok: false, error: 'lat / lon / alt required' }
  }

  const aEnu = eastNorthFromGps(
    draft.lat,
    draft.lon,
    draft.altMsl,
    geo.gpsToEnuAmsl,
  )
  const pointA = gpsPoint(draft.lat, draft.lon, draft.altMsl)
  const created: WorldFeature[] = []

  if (draft.kind === 'gatePair') {
    const b = resolvePointB(draft, geo, DEFAULT_GATE_SPAN_M)
    const bEnu = eastNorthFromGps(b.lat, b.lon, b.altMsl, geo.gpsToEnuAmsl)
    const [left, right] = createGatePairFeatures(
      aEnu.east,
      aEnu.north,
      bEnu.east,
      bEnu.north,
      geo.enuToGpsAmsl,
      idCounter,
    )
    created.push(
      applyDraftMeta(overwritePoints(left, [pointA]), draft),
      applyDraftMeta(overwritePoints(right, [b]), draft),
    )
  } else if (draft.kind === 'sponsor') {
    const b = resolvePointB(draft, geo, DEFAULT_SPONSOR_SPAN_M)
    const bEnu = eastNorthFromGps(b.lat, b.lon, b.altMsl, geo.gpsToEnuAmsl)
    const raw = createSponsorFeature(
      aEnu.east,
      aEnu.north,
      bEnu.east,
      bEnu.north,
      geo.enuToGpsAmsl,
      idCounter,
    )
    created.push(
      stampSponsorBoardAspect(
        applyDraftMeta(overwritePoints(raw, [pointA, b]), draft),
        geo.gpsToEnuAmsl,
      ),
    )
  } else if (draft.kind === 'start' || draft.kind === 'finish') {
    const b = resolvePointB(draft, geo, DEFAULT_LINE_SIGN_WIDTH_M)
    const bEnu = eastNorthFromGps(b.lat, b.lon, b.altMsl, geo.gpsToEnuAmsl)
    const raw = createLineSignFeature(
      draft.kind,
      aEnu.east,
      aEnu.north,
      bEnu.east,
      bEnu.north,
      geo.enuToGpsAmsl,
      idCounter,
    )
    created.push(
      applyDraftMeta(overwritePoints(raw, [pointA, b]), draft),
    )
  } else if (draft.kind === 'billboardChain') {
    const b = resolvePointB(draft, geo, DEFAULT_CHAIN_SPAN_M)
    const bEnu = eastNorthFromGps(b.lat, b.lon, b.altMsl, geo.gpsToEnuAmsl)
    const raw = createBillboardChainFeature(
      [
        { east: aEnu.east, north: aEnu.north },
        { east: bEnu.east, north: bEnu.north },
      ],
      geo.enuToGpsAmsl,
      idCounter,
      {
        spacingM: draft.spacingM ?? DEFAULT_BILLBOARD_CHAIN_SPACING_M,
        textureUrl: draft.textureUrl,
        logos: draft.logos,
        label: draft.label.trim() || undefined,
        heightM: draft.heightM,
        color: draft.color,
      },
    )
    if (!raw) {
      return { ok: false, error: 'Need ≥2 points for a billboard chain' }
    }
    created.push(
      applyDraftMeta(overwritePoints(raw, [pointA, b]), draft),
    )
  } else if (draft.kind === 'arrow') {
    const b = resolvePointB(draft, geo, DEFAULT_ARROW_SPAN_M)
    const bEnu = eastNorthFromGps(b.lat, b.lon, b.altMsl, geo.gpsToEnuAmsl)
    const raw = createArrowFeature(
      aEnu.east,
      aEnu.north,
      bEnu.east,
      bEnu.north,
      geo.enuToGpsAmsl,
      idCounter,
    )
    created.push(applyDraftMeta(overwritePoints(raw, [pointA]), draft))
  } else if (draft.kind === 'buoy') {
    const raw = createBuoyFeature(
      aEnu.east,
      aEnu.north,
      geo.enuToGpsAmsl,
      idCounter,
      { telemetryId: draft.telemetryId?.trim() || null },
    )
    created.push(applyDraftMeta(overwritePoints(raw, [pointA]), draft))
  } else if (draft.kind === 'rotation') {
    return { ok: false, error: 'Place rotation on the map (stub)' }
  } else {
    const raw = createPointFeature(
      draft.kind,
      aEnu.east,
      aEnu.north,
      geo.enuToGpsAmsl,
      idCounter,
    )
    if (!raw) {
      return { ok: false, error: `Cannot place type ${draft.kind}` }
    }
    created.push(applyDraftMeta(overwritePoints(raw, [pointA]), draft))
  }

  const next = [...features.map(cloneWorldFeature), ...created]
  return {
    ok: true,
    mode: 'features',
    features: next,
    createdIds: created.map((f) => f.id),
  }
}

/**
 * Edit the selected feature in place (id/type unchanged). Start/finish write
 * both GPS ends. Drone pose is not handled here (TEL-owned).
 */
export function editFromCoordinates(
  features: readonly WorldFeature[],
  selectedId: string,
  draft: CoordinatePlaceDraft,
  geo: CoordinatePlaceGeo,
): CoordinateAddResult {
  const idx = features.findIndex((f) => f.id === selectedId)
  if (idx < 0) {
    return { ok: false, error: 'No feature selected' }
  }
  const current = cloneWorldFeature(features[idx]!)
  if (!finiteGps(draft.lat, draft.lon, draft.altMsl)) {
    return { ok: false, error: 'lat / lon / alt required' }
  }

  const pointA = gpsPoint(draft.lat, draft.lon, draft.altMsl)
  let points = current.points.map((p) => ({ ...p }))
  if (points.length === 0) {
    points = [pointA]
  } else {
    points[0] = pointA
  }

  if (
    current.type === 'sponsor' ||
    current.type === 'start' ||
    current.type === 'finish' ||
    current.type === 'billboardChain'
  ) {
    const span =
      current.type === 'start' || current.type === 'finish'
        ? DEFAULT_LINE_SIGN_WIDTH_M
        : current.type === 'billboardChain'
          ? DEFAULT_CHAIN_SPAN_M
          : DEFAULT_SPONSOR_SPAN_M
    const b = resolvePointB(draft, geo, span)
    if (points.length < 2) {
      points = [pointA, b]
    } else if (
      current.type !== 'billboardChain' ||
      (draft.latB !== undefined && draft.lonB !== undefined)
    ) {
      points[1] = b
    }
  }

  const patched = applySponsorScaleOnEdit(
    current,
    applyDraftMeta(overwritePoints(current, points), draft),
    geo.gpsToEnuAmsl,
  )
  const next = features.map((f, i) =>
    i === idx ? patched : cloneWorldFeature(f),
  )
  return {
    ok: true,
    mode: 'features',
    features: next,
    createdIds: [patched.id],
  }
}

export function cloneWorldFeature(f: WorldFeature): WorldFeature {
  return {
    ...f,
    points: f.points.map((p) => ({ ...p })),
    logos: f.logos?.map((l) => ({ url: l.url, weight: l.weight })),
  }
}

export function draftFromFeature(f: WorldFeature): CoordinatePlaceDraft {
  const a = f.points[0]
  const b = f.points[1]
  return {
    kind: f.type,
    name: f.name,
    label: f.label ?? '',
    lat: a?.lat ?? 0,
    lon: a?.lon ?? 0,
    altMsl: a?.altMsl ?? 0,
    latB: b?.lat,
    lonB: b?.lon,
    altBMsl: b?.altMsl,
    heightM: f.heightM,
    spacingM: f.spacingM,
    color: f.color,
    panelColor: f.panelColor,
    panelAlpha: f.panelAlpha,
    telemetryId: f.telemetryId ?? '',
    textureUrl: f.textureUrl,
    logos: f.logos?.map((l) => ({ url: l.url, weight: l.weight })),
    rounding: f.rounding,
    visible3d: f.visible3d,
    visibleBuoyMesh: f.visibleBuoyMesh,
    visibleTag: f.visibleTag,
  }
}

export function emptyDraft(kind: PlaceKind): CoordinatePlaceDraft {
  return {
    kind,
    name: '',
    label: '',
    lat: Number.NaN,
    lon: Number.NaN,
    altMsl: 0,
  }
}
