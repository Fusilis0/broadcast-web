/**
 * Optional OSM raster basemap under ops / World Authoring and the stream
 * on-air 2D canvas. Visible tiles cover the canvas (1-tile pad; coarsen z
 * instead of truncating). Best-effort only — fetch failures silently leave
 * the wash/grid. Session in-memory tile cache; no persistent store.
 */

export type LatLon = { lat: number; lon: number }

export type BasemapGeoBridge = {
  /** ENU east/north (m) → WGS84. */
  enuToLatLon: (east: number, north: number) => LatLon
  /** WGS84 → ENU east/north (m). */
  latLonToEnu: (lat: number, lon: number) => { east: number; north: number }
}

export type MapBoundsLike = {
  minE: number
  maxE: number
  minN: number
  maxN: number
}

/** Standard OSM raster endpoint (no API key). */
export const OSM_TILE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const OSM_ATTRIBUTION = '© OpenStreetMap'

const EARTH_R = 6378137
const MAX_LAT = 85.05112878

/** Clamp latitude for Web Mercator. */
export function clampMercatorLat(lat: number): number {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
}

/** Lon/lat → Web Mercator meters (EPSG:3857-ish). */
export function latLonToMercator(lat: number, lon: number): { x: number; y: number } {
  const φ = (clampMercatorLat(lat) * Math.PI) / 180
  const λ = (lon * Math.PI) / 180
  return {
    x: EARTH_R * λ,
    y: EARTH_R * Math.log(Math.tan(Math.PI / 4 + φ / 2)),
  }
}

/** Web Mercator meters → lon/lat. */
export function mercatorToLatLon(x: number, y: number): LatLon {
  const lon = (x / EARTH_R) * (180 / Math.PI)
  const lat =
    (2 * Math.atan(Math.exp(y / EARTH_R)) - Math.PI / 2) * (180 / Math.PI)
  return { lat, lon }
}

/** Tile XYZ for lon/lat at zoom. */
export function latLonToTile(
  lat: number,
  lon: number,
  zoom: number,
): { x: number; y: number; z: number } {
  const z = Math.max(0, Math.min(19, Math.floor(zoom)))
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (clampMercatorLat(lat) * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n,
  )
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
    z,
  }
}

/** NW corner of tile → lon/lat. */
export function tileNwLatLon(
  x: number,
  y: number,
  z: number,
): LatLon {
  const n = 2 ** z
  const lon = (x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  return { lat: (latRad * 180) / Math.PI, lon }
}

/**
 * Pick an integer zoom so one tile ≈ `targetTileM` meters at the viewport center.
 */
export function pickOsmZoom(
  centerLat: number,
  halfExtentN: number,
  canvasHeightPx: number,
  targetTilePx = 256,
): number {
  const metersPerPx = (2 * Math.max(halfExtentN, 1)) / Math.max(canvasHeightPx, 1)
  const tileM = metersPerPx * targetTilePx
  const latRad = (clampMercatorLat(centerLat) * Math.PI) / 180
  // Earth circumference * cos(lat) / 2^z ≈ tile width in meters
  const circ = 2 * Math.PI * EARTH_R * Math.cos(latRad)
  const z = Math.log2(circ / Math.max(tileM, 1))
  return Math.max(0, Math.min(18, Math.round(z)))
}

export type OsmTileRef = { z: number; x: number; y: number }

/** Extra ring around the viewport so edges/corners stay covered. */
export const OSM_TILE_PAD = 1

/**
 * Cap visible requests. If the padded range would exceed this, drop zoom
 * (coarser tiles) rather than returning a truncated NW slice with holes.
 */
export const MAX_OSM_VISIBLE_TILES = 48

export function osmTileUrl(
  tile: OsmTileRef,
  template = OSM_TILE_URL,
): string {
  return template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
}

function enuBoundsSamples(
  bounds: MapBoundsLike,
  geo: BasemapGeoBridge,
): LatLon[] {
  const midE = (bounds.minE + bounds.maxE) / 2
  const midN = (bounds.minN + bounds.maxN) / 2
  return [
    geo.enuToLatLon(bounds.minE, bounds.minN),
    geo.enuToLatLon(bounds.maxE, bounds.minN),
    geo.enuToLatLon(bounds.minE, bounds.maxN),
    geo.enuToLatLon(bounds.maxE, bounds.maxN),
    geo.enuToLatLon(midE, midN),
    geo.enuToLatLon(bounds.minE, midN),
    geo.enuToLatLon(bounds.maxE, midN),
    geo.enuToLatLon(midE, bounds.minN),
    geo.enuToLatLon(midE, bounds.maxN),
  ]
}

/** Inclusive XYZ range covering ENU bounds at `z`, plus `pad` tiles. */
export function osmTileRangeForBounds(
  bounds: MapBoundsLike,
  geo: BasemapGeoBridge,
  z: number,
  pad = OSM_TILE_PAD,
): { minTx: number; maxTx: number; minTy: number; maxTy: number; z: number } {
  const zoom = Math.max(0, Math.min(19, Math.floor(z)))
  const n = 2 ** zoom
  let minTx = Infinity
  let maxTx = -Infinity
  let minTy = Infinity
  let maxTy = -Infinity
  for (const c of enuBoundsSamples(bounds, geo)) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue
    const t = latLonToTile(c.lat, c.lon, zoom)
    minTx = Math.min(minTx, t.x)
    maxTx = Math.max(maxTx, t.x)
    minTy = Math.min(minTy, t.y)
    maxTy = Math.max(maxTy, t.y)
  }
  if (!Number.isFinite(minTx)) {
    return { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0, z: zoom }
  }
  const p = Math.max(0, Math.floor(pad))
  return {
    minTx: Math.max(0, minTx - p),
    maxTx: Math.min(n - 1, maxTx + p),
    minTy: Math.max(0, minTy - p),
    maxTy: Math.min(n - 1, maxTy + p),
    z: zoom,
  }
}

function tileCountInRange(range: {
  minTx: number
  maxTx: number
  minTy: number
  maxTy: number
}): number {
  return (
    Math.max(0, range.maxTx - range.minTx + 1) *
    Math.max(0, range.maxTy - range.minTy + 1)
  )
}

function tilesFromRange(range: {
  minTx: number
  maxTx: number
  minTy: number
  maxTy: number
  z: number
}): OsmTileRef[] {
  const tiles: OsmTileRef[] = []
  for (let y = range.minTy; y <= range.maxTy; y++) {
    for (let x = range.minTx; x <= range.maxTx; x++) {
      tiles.push({ z: range.z, x, y })
    }
  }
  return tiles
}

/**
 * Visible OSM tiles covering an ENU viewport (via geo bridge).
 * Always a complete rectangle (padded); never an empty set for finite bounds.
 * Over-budget ranges drop zoom instead of punching holes in the SE.
 */
export function tilesForEnuBounds(
  bounds: MapBoundsLike,
  geo: BasemapGeoBridge,
  canvasHeightPx: number,
): OsmTileRef[] {
  const sw = geo.enuToLatLon(bounds.minE, bounds.minN)
  const ne = geo.enuToLatLon(bounds.maxE, bounds.maxN)
  const centerLat =
    Number.isFinite(sw.lat) && Number.isFinite(ne.lat)
      ? (sw.lat + ne.lat) / 2
      : 0
  const halfN = Math.max(Math.abs(bounds.maxN - bounds.minN) / 2, 1)
  let z = pickOsmZoom(centerLat, halfN, canvasHeightPx)

  let range = osmTileRangeForBounds(bounds, geo, z, OSM_TILE_PAD)
  while (tileCountInRange(range) > MAX_OSM_VISIBLE_TILES && z > 0) {
    z -= 1
    range = osmTileRangeForBounds(bounds, geo, z, OSM_TILE_PAD)
  }

  const tiles = tilesFromRange(range)
  if (tiles.length > 0) return tiles
  const fallback = latLonToTile(centerLat, Number.isFinite(sw.lon) ? sw.lon : 0, z)
  return [{ z: fallback.z, x: fallback.x, y: fallback.y }]
}

export type TileCacheEntry = HTMLImageElement | 'loading' | 'failed'

export type TileCache = {
  get: (key: string) => TileCacheEntry | undefined
  set: (key: string, value: TileCacheEntry) => void
}

export function createTileCache(): TileCache {
  const map = new Map<string, TileCacheEntry>()
  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value)
    },
  }
}

export function tileCacheKey(t: OsmTileRef): string {
  return `${t.z}/${t.x}/${t.y}`
}

export function isOsmTileImage(
  entry: TileCacheEntry | undefined,
): entry is HTMLImageElement {
  return entry !== undefined && entry !== 'loading' && entry !== 'failed'
}

export function parentOsmTile(t: OsmTileRef): OsmTileRef | null {
  if (t.z <= 0) return null
  return { z: t.z - 1, x: t.x >> 1, y: t.y >> 1 }
}

/**
 * Cached coarser parents for tiles that are not ready yet (zoom-in underlay).
 * Does not fetch — cache hits only.
 */
export function cachedParentOsmTiles(
  tiles: readonly OsmTileRef[],
  cache: TileCache,
): OsmTileRef[] {
  const out: OsmTileRef[] = []
  const seen = new Set<string>()
  for (const t of tiles) {
    if (isOsmTileImage(cache.get(tileCacheKey(t)))) continue
    let x = t.x
    let y = t.y
    for (let z = t.z - 1; z >= 0; z--) {
      x >>= 1
      y >>= 1
      const parent: OsmTileRef = { z, x, y }
      const key = tileCacheKey(parent)
      if (seen.has(key)) break
      if (isOsmTileImage(cache.get(key))) {
        seen.add(key)
        out.push(parent)
        break
      }
    }
  }
  return out
}

/** Previous zoom first, then current — unique by `z/x/y`. */
export function osmTilesDrawList(
  current: readonly OsmTileRef[],
  previous: readonly OsmTileRef[],
): OsmTileRef[] {
  const seen = new Set<string>()
  const out: OsmTileRef[] = []
  for (const t of previous) {
    const key = tileCacheKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  for (const t of current) {
    const key = tileCacheKey(t)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/**
 * Keep last ready coverage across a zoom step so the canvas does not go blank
 * while the new integer z is still loading.
 */
export function nextOsmDrawHistory(
  current: readonly OsmTileRef[],
  previous: readonly OsmTileRef[],
  cache: TileCache,
): OsmTileRef[] {
  const currentReady = current.filter((t) =>
    isOsmTileImage(cache.get(tileCacheKey(t))),
  )
  if (current.length > 0 && currentReady.length === current.length) {
    return [...current]
  }
  if (currentReady.length === 0) return [...previous]
  return osmTilesDrawList(currentReady, previous)
}

/**
 * Ensure tiles are loading/cached. Caller should redraw when images load.
 * Never throws — offline/fetch failures stay silent.
 */
export function ensureOsmTiles(
  tiles: readonly OsmTileRef[],
  cache: TileCache,
  onTileSettled: () => void,
  urlTemplate = OSM_TILE_URL,
): void {
  for (const t of tiles) {
    const key = tileCacheKey(t)
    if (cache.get(key) !== undefined) continue
    cache.set(key, 'loading')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      cache.set(key, img)
      onTileSettled()
    }
    img.onerror = () => {
      cache.set(key, 'failed')
      // Silent offline fallback — no error UI.
    }
    try {
      img.src = osmTileUrl(t, urlTemplate)
    } catch {
      cache.set(key, 'failed')
    }
  }
}

export type ProjectEnuToPx = (
  east: number,
  north: number,
) => { x: number; y: number }

/**
 * Draw cached OSM tiles into the map canvas under overlays.
 * Missing/failed tiles are skipped (grid shows through).
 */
export function drawOsmBasemap(
  ctx: CanvasRenderingContext2D,
  tiles: readonly OsmTileRef[],
  cache: TileCache,
  geo: BasemapGeoBridge,
  project: ProjectEnuToPx,
): void {
  for (const t of tiles) {
    const entry = cache.get(tileCacheKey(t))
    if (!entry || entry === 'failed' || entry === 'loading') continue
    const nw = tileNwLatLon(t.x, t.y, t.z)
    const se = tileNwLatLon(t.x + 1, t.y + 1, t.z)
    const a = geo.latLonToEnu(nw.lat, nw.lon)
    const b = geo.latLonToEnu(se.lat, se.lon)
    const pa = project(a.east, a.north)
    const pb = project(b.east, b.north)
    const w = pb.x - pa.x
    const h = pb.y - pa.y
    if (!Number.isFinite(w) || !Number.isFinite(h) || w === 0 || h === 0) {
      continue
    }
    try {
      ctx.drawImage(entry, pa.x, pa.y, w, h)
    } catch {
      // drawImage can throw if image decoded badly — ignore.
    }
  }
}
