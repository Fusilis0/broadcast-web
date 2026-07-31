import type { WorldFeature, WorldFeatureType, WorldGpsPoint } from './types.ts'

/** GeoJSON position: [lon, lat] or [lon, lat, alt]. */
export type GeoJsonPosition = [number, number] | [number, number, number]

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: GeoJsonPosition }
  | { type: 'LineString'; coordinates: GeoJsonPosition[] }

export type GeoJsonFeature = {
  type: 'Feature'
  id?: string | number
  properties?: Record<string, unknown> | null
  geometry?: GeoJsonGeometry | { type: string; coordinates?: unknown } | null
}

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export type GeojsonImportResult = {
  features: WorldFeature[]
  skipped: number
}

const WORLD_TYPES = new Set<string>([
  'mark',
  'gateLeft',
  'gateRight',
  'sponsor',
  'flagP1',
  'flagP2',
  'start',
  'finish',
  'arrow',
  'rotation',
])

const POINT_TYPES = new Set<WorldFeatureType>([
  'mark',
  'gateLeft',
  'gateRight',
  'flagP1',
  'flagP2',
  'arrow',
  'rotation',
])

/**
 * Parse a GeoJSON FeatureCollection (or unknown JSON) into WorldFeature[].
 * Invalid features are skipped with console.warn — never throws on bad items.
 */
export function geojsonToWorldFeatures(input: unknown): GeojsonImportResult {
  const features: WorldFeature[] = []
  let skipped = 0
  let gen = 0

  if (!isFeatureCollection(input)) {
    console.warn('[geojson] expected FeatureCollection; got', summarize(input))
    return { features, skipped: 1 }
  }

  for (let i = 0; i < input.features.length; i++) {
    const raw = input.features[i]
    const converted = convertOneFeature(raw, i, () => {
      gen += 1
      return gen
    })
    if (!converted) {
      skipped += 1
      continue
    }
    for (const f of converted) features.push(f)
  }

  return { features, skipped }
}

/** WorldFeature[] → GeoJSON FeatureCollection (geojson.io-friendly). */
export function worldFeaturesToGeojson(
  features: readonly WorldFeature[],
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: features.map(worldFeatureToGeoJsonFeature),
  }
}

/** Pretty-printed GeoJSON string (trailing newline). */
export function serializeWorldFeaturesGeojson(
  features: readonly WorldFeature[],
): string {
  return `${JSON.stringify(worldFeaturesToGeojson(features), null, 2)}\n`
}

/** Trigger browser download of `world-features.geojson`. */
export function downloadWorldFeaturesGeojson(
  features: readonly WorldFeature[],
  filename = 'world-features.geojson',
): void {
  const text = serializeWorldFeaturesGeojson(features)
  const blob = new Blob([text], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function worldFeatureToGeoJsonFeature(f: WorldFeature): GeoJsonFeature {
  const props: Record<string, unknown> = {
    type: f.type,
    name: f.name,
    id: f.id,
  }
  if (f.heightM !== undefined) props.heightM = f.heightM
  if (f.color !== undefined) {
    props.color = `#${f.color.toString(16).padStart(6, '0')}`
  }
  if (f.label !== undefined) props.label = f.label

  const coords = f.points.map(pointToPosition)
  let geometry: GeoJsonGeometry

  if (f.type === 'sponsor') {
    geometry = { type: 'LineString', coordinates: coords }
  } else if (
    (f.type === 'start' || f.type === 'finish') &&
    f.points.length >= 2
  ) {
    geometry = { type: 'LineString', coordinates: coords }
  } else {
    geometry = {
      type: 'Point',
      coordinates: coords[0] ?? [0, 0, 0],
    }
  }

  return {
    type: 'Feature',
    id: f.id,
    properties: props,
    geometry,
  }
}

function convertOneFeature(
  raw: unknown,
  index: number,
  nextGen: () => number,
): WorldFeature[] | null {
  if (!isPlainObject(raw) || raw.type !== 'Feature') {
    console.warn(`[geojson] skip #${index}: not a Feature`)
    return null
  }

  const props = isPlainObject(raw.properties) ? raw.properties : {}
  const typeRaw = typeof props.type === 'string' ? props.type.trim() : ''
  const geometry = raw.geometry

  if (!isPlainObject(geometry) || typeof geometry.type !== 'string') {
    console.warn(`[geojson] skip #${index}: missing geometry`)
    return null
  }

  const defaultAlt = readNumber(props.altMsl) ?? 0

  // Convenience: gate / gatePair LineString → gateLeft + gateRight
  if (
    (typeRaw === 'gate' || typeRaw === 'gatePair') &&
    geometry.type === 'LineString'
  ) {
    const positions = readLineStringCoords(geometry.coordinates, defaultAlt)
    if (!positions || positions.length !== 2) {
      console.warn(
        `[geojson] skip #${index}: gate/gatePair needs LineString with 2 positions`,
      )
      return null
    }
    const baseName =
      readString(props.name) ||
      readString(props.id) ||
      featureIdString(raw.id) ||
      `Gate-${nextGen()}`
    const baseId =
      featureIdString(raw.id) ||
      readString(props.id) ||
      `course:${baseName}`
    return [
      {
        id: `${baseId}-Left`,
        name: `${baseName}-Left`,
        type: 'gateLeft',
        points: [positions[0]!],
        ...optionalProps(props),
      },
      {
        id: `${baseId}-Right`,
        name: `${baseName}-Right`,
        type: 'gateRight',
        points: [positions[1]!],
        ...optionalProps(props),
      },
    ]
  }

  if (!WORLD_TYPES.has(typeRaw)) {
    console.warn(
      `[geojson] skip #${index}: unknown type ${JSON.stringify(typeRaw)}`,
    )
    return null
  }

  const type = typeRaw as WorldFeatureType
  const n = nextGen()
  const id =
    featureIdString(raw.id) ||
    readString(props.id) ||
    `geojson:${type}:${n}`
  const name = readString(props.name) || id || `${type}-${n}`

  let points: WorldGpsPoint[] | null = null

  if (POINT_TYPES.has(type)) {
    if (geometry.type !== 'Point') {
      console.warn(
        `[geojson] skip #${index}: ${type} requires Point geometry`,
      )
      return null
    }
    const p = readPosition(geometry.coordinates, defaultAlt)
    if (!p) {
      console.warn(`[geojson] skip #${index}: invalid Point coordinates`)
      return null
    }
    points = [p]
  } else if (type === 'sponsor') {
    if (geometry.type !== 'LineString') {
      console.warn(
        `[geojson] skip #${index}: sponsor requires LineString (A–B)`,
      )
      return null
    }
    const line = readLineStringCoords(geometry.coordinates, defaultAlt)
    if (!line || line.length !== 2) {
      console.warn(
        `[geojson] skip #${index}: sponsor LineString must have exactly 2 positions`,
      )
      return null
    }
    points = line
  } else {
    // start / finish: Point or LineString 1–2
    if (geometry.type === 'Point') {
      const p = readPosition(geometry.coordinates, defaultAlt)
      if (!p) {
        console.warn(`[geojson] skip #${index}: invalid Point coordinates`)
        return null
      }
      points = [p]
    } else if (geometry.type === 'LineString') {
      const line = readLineStringCoords(geometry.coordinates, defaultAlt)
      if (!line || line.length < 1 || line.length > 2) {
        console.warn(
          `[geojson] skip #${index}: ${type} LineString needs 1–2 positions`,
        )
        return null
      }
      points = line
    } else {
      console.warn(
        `[geojson] skip #${index}: ${type} needs Point or LineString`,
      )
      return null
    }
  }

  const feature: WorldFeature = {
    id,
    name,
    type,
    points,
    ...optionalProps(props),
  }
  return [feature]
}

function optionalProps(
  props: Record<string, unknown>,
): Pick<WorldFeature, 'heightM' | 'color' | 'label'> {
  const out: Pick<WorldFeature, 'heightM' | 'color' | 'label'> = {}
  const heightM = readNumber(props.heightM)
  if (heightM !== undefined) out.heightM = heightM
  const color = readColor(props.color)
  if (color !== undefined) out.color = color
  const label = readString(props.label)
  if (label !== undefined) out.label = label
  return out
}

function pointToPosition(p: WorldGpsPoint): GeoJsonPosition {
  return [p.lon, p.lat, p.altMsl]
}

function readPosition(
  coords: unknown,
  defaultAlt: number,
): WorldGpsPoint | null {
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lon = Number(coords[0])
  const lat = Number(coords[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  const alt =
    coords.length >= 3 && Number.isFinite(Number(coords[2]))
      ? Number(coords[2])
      : defaultAlt
  return { lat, lon, altMsl: alt }
}

function readLineStringCoords(
  coords: unknown,
  defaultAlt: number,
): WorldGpsPoint[] | null {
  if (!Array.isArray(coords) || coords.length === 0) return null
  const out: WorldGpsPoint[] = []
  for (const c of coords) {
    const p = readPosition(c, defaultAlt)
    if (!p) return null
    out.push(p)
  }
  return out
}

function readString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function readColor(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    return Math.trunc(v) & 0xffffff
  }
  if (typeof v !== 'string') return undefined
  const s = v.trim().replace(/^#/, '').replace(/^0x/i, '')
  if (/^[0-9a-fA-F]{6}$/.test(s)) return Number.parseInt(s, 16)
  return undefined
}

function featureIdString(id: unknown): string | undefined {
  if (typeof id === 'string' && id.trim() !== '') return id.trim()
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  return undefined
}

function isFeatureCollection(v: unknown): v is GeoJsonFeatureCollection {
  return (
    isPlainObject(v) &&
    v.type === 'FeatureCollection' &&
    Array.isArray(v.features)
  )
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function summarize(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array(len=${v.length})`
  if (typeof v === 'object') {
    const t = (v as { type?: unknown }).type
    return typeof t === 'string' ? `object type=${t}` : 'object'
  }
  return typeof v
}
