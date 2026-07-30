import type { WorldFeature, WorldFeatureType, WorldGpsPoint } from '../types.ts'
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
    case 'start':
    case 'finish':
    case 'arrow':
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
  }

  return base
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
