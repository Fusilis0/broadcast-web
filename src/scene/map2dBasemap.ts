/**
 * Optional OSM raster basemap under the ops 2D map.
 * Best-effort only — fetch failures silently leave the plain grid.
 * Session in-memory tile cache; no persistent store.
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

export function osmTileUrl(
  tile: OsmTileRef,
  template = OSM_TILE_URL,
): string {
  return template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
}

/** Visible OSM tiles covering an ENU viewport (via geo bridge). */
export function tilesForEnuBounds(
  bounds: MapBoundsLike,
  geo: BasemapGeoBridge,
  canvasHeightPx: number,
): OsmTileRef[] {
  const sw = geo.enuToLatLon(bounds.minE, bounds.minN)
  const ne = geo.enuToLatLon(bounds.maxE, bounds.maxN)
  const centerLat = (sw.lat + ne.lat) / 2
  const halfN = (bounds.maxN - bounds.minN) / 2
  const z = pickOsmZoom(centerLat, halfN, canvasHeightPx)

  const corners = [
    geo.enuToLatLon(bounds.minE, bounds.minN),
    geo.enuToLatLon(bounds.maxE, bounds.minN),
    geo.enuToLatLon(bounds.minE, bounds.maxN),
    geo.enuToLatLon(bounds.maxE, bounds.maxN),
  ]
  let minTx = Infinity
  let maxTx = -Infinity
  let minTy = Infinity
  let maxTy = -Infinity
  for (const c of corners) {
    const t = latLonToTile(c.lat, c.lon, z)
    minTx = Math.min(minTx, t.x)
    maxTx = Math.max(maxTx, t.x)
    minTy = Math.min(minTy, t.y)
    maxTy = Math.max(maxTy, t.y)
  }

  // Cap tile count for a small ops map (avoid storms of requests).
  const maxTiles = 24
  const tiles: OsmTileRef[] = []
  for (let y = minTy; y <= maxTy; y++) {
    for (let x = minTx; x <= maxTx; x++) {
      tiles.push({ z, x, y })
      if (tiles.length >= maxTiles) return tiles
    }
  }
  return tiles
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

function tileKey(t: OsmTileRef): string {
  return `${t.z}/${t.x}/${t.y}`
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
    const key = tileKey(t)
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
    const entry = cache.get(tileKey(t))
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
