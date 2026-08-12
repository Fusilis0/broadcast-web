import type { WorldFeature, WorldFeatureType, WorldGpsPoint } from '../types.ts'
import { segmentBearingDeg } from './segmentReadout.ts'
import type { EditorTool } from './tools.ts'

export type EnuToGpsAmslFn = (
  east: number,
  up: number,
  north: number,
) => { lat: number; lon: number; alt: number }

export type FeatureIdCounter = { n: number }

function nextId(prefix: string, counter: FeatureIdCounter): string {
  counter.n += 1
  return `${prefix}:${counter.n}`
}

function gpsAtEnu(
  east: number,
  north: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  altMsl = 0,
): WorldGpsPoint {
  const g = enuToGpsAmsl(east, 0, north)
  return { lat: g.lat, lon: g.lon, altMsl }
}

/** Point-feature tools → WorldFeatureType (one click). */
export function pointTypeForTool(tool: EditorTool): WorldFeatureType | null {
  switch (tool) {
    case 'mark':
    case 'gateLeft':
    case 'gateRight':
    case 'flagP1':
    case 'flagP2':
    case 'arrow':
    case 'buoy':
      return tool
    default:
      return null
  }
}

/**
 * Create a single-point WorldFeature at ENU east/north (water plane).
 * `tool` must be a one-click place tool.
 */
export function createPointFeature(
  tool: EditorTool,
  east: number,
  north: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
): WorldFeature | null {
  const type = pointTypeForTool(tool)
  if (!type) return null

  const id = nextId(type, counter)
  const name = `${type}-${counter.n}`
  const point = gpsAtEnu(east, north, enuToGpsAmsl)

  const base: WorldFeature = {
    id,
    name,
    type,
    points: [point],
  }

  if (type === 'mark' || type === 'gateLeft' || type === 'gateRight') {
    base.heightM = 5
    base.color = type === 'mark' ? 0xffdd33 : 0x00ff80
  } else if (type === 'flagP1' || type === 'flagP2') {
    base.heightM = 10
    base.label = type === 'flagP1' ? 'P1' : 'P2'
  } else if (type === 'arrow') {
    base.label = 'arrow'
  } else if (type === 'buoy') {
    base.heightM = 5
    base.color = 0xffb200
    base.label = 'buoy'
  }

  return base
}

/** Default spacing between billboard-chain instances (meters). */
export const DEFAULT_BILLBOARD_CHAIN_SPACING_M = 12

/**
 * Create a free-floating buoy WorldFeature (distinct from course `mark`).
 * Optional `telemetryId` binds to TEL buoy channel when available.
 */
export function createBuoyFeature(
  east: number,
  north: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
  opts?: { telemetryId?: string | null },
): WorldFeature {
  const id = nextId('buoy', counter)
  const feature: WorldFeature = {
    id,
    name: `buoy-${counter.n}`,
    type: 'buoy',
    points: [gpsAtEnu(east, north, enuToGpsAmsl)],
    heightM: 5,
    color: 0xffb200,
    label: 'buoy',
  }
  if (opts?.telemetryId) {
    feature.telemetryId = opts.telemetryId
  }
  return feature
}

/**
 * Polyline billboard chain (≥2 ENU points). Instances spaced at `spacingM`
 * along the path; texture from library (stub list OK until PLT-01).
 */
export function createBillboardChainFeature(
  enuPoints: readonly { east: number; north: number }[],
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
  opts?: {
    spacingM?: number
    textureUrl?: string | null
    label?: string
    heightM?: number
    color?: number
  },
): WorldFeature | null {
  if (enuPoints.length < 2) return null
  const id = nextId('billboardChain', counter)
  const spacingM =
    opts?.spacingM !== undefined &&
    Number.isFinite(opts.spacingM) &&
    opts.spacingM > 0
      ? opts.spacingM
      : DEFAULT_BILLBOARD_CHAIN_SPACING_M
  return {
    id,
    name: `billboardChain-${counter.n}`,
    type: 'billboardChain',
    points: enuPoints.map((p) => gpsAtEnu(p.east, p.north, enuToGpsAmsl)),
    heightM: opts?.heightM ?? 8,
    color: opts?.color ?? 0x2a6f7a,
    label: opts?.label ?? `Chain ${counter.n}`,
    textureUrl: opts?.textureUrl ?? null,
    spacingM,
  }
}

/**
 * Two-click arrow: position at A; B sets bearing (label `brg NNN°`).
 * Point feature stays single-GPS (heading later / 3D stub).
 */
export function createArrowFeature(
  eastA: number,
  northA: number,
  eastB: number,
  northB: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
): WorldFeature {
  const id = nextId('arrow', counter)
  const brg = Math.round(
    segmentBearingDeg(eastA, northA, eastB, northB),
  )
    .toString()
    .padStart(3, '0')
  return {
    id,
    name: `arrow-${counter.n}`,
    type: 'arrow',
    points: [gpsAtEnu(eastA, northA, enuToGpsAmsl)],
    label: `brg ${brg}°`,
  }
}

/** Two-click start or finish line A–B (Unity BillboardBetweenTwoPoints). */
export function createLineSignFeature(
  kind: 'start' | 'finish',
  eastA: number,
  northA: number,
  eastB: number,
  northB: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
): WorldFeature {
  const id = nextId(kind, counter)
  const label = kind === 'start' ? 'START' : 'FINISH'
  return {
    id,
    name: `${kind}-${counter.n}`,
    type: kind,
    points: [
      gpsAtEnu(eastA, northA, enuToGpsAmsl),
      gpsAtEnu(eastB, northB, enuToGpsAmsl),
    ],
    color: 0xad0000,
    label,
  }
}

/** Two-click sponsor A–B. */
export function createSponsorFeature(
  eastA: number,
  northA: number,
  eastB: number,
  northB: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
): WorldFeature {
  const id = nextId('sponsor', counter)
  return {
    id,
    name: id,
    type: 'sponsor',
    points: [
      gpsAtEnu(eastA, northA, enuToGpsAmsl),
      gpsAtEnu(eastB, northB, enuToGpsAmsl),
    ],
    heightM: 8,
    color: 0x2a6f7a,
    label: `Sponsor ${counter.n}`,
  }
}

/** Two-click gate pair (left then right), shared base name. */
export function createGatePairFeatures(
  eastL: number,
  northL: number,
  eastR: number,
  northR: number,
  enuToGpsAmsl: EnuToGpsAmslFn,
  counter: FeatureIdCounter,
): [WorldFeature, WorldFeature] {
  counter.n += 1
  const base = `Gate${counter.n}`
  const left: WorldFeature = {
    id: `course:${base}-Left`,
    name: `${base}-Left`,
    type: 'gateLeft',
    points: [gpsAtEnu(eastL, northL, enuToGpsAmsl)],
    heightM: 5,
    color: 0x00ff80,
  }
  const right: WorldFeature = {
    id: `course:${base}-Right`,
    name: `${base}-Right`,
    type: 'gateRight',
    points: [gpsAtEnu(eastR, northR, enuToGpsAmsl)],
    heightM: 5,
    color: 0x00ff80,
  }
  return [left, right]
}
