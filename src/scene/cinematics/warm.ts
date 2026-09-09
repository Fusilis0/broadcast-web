/**
 * Cinematic tile warm (Phase 21.3b / DSP-SCN-20260908-07).
 * Manifest in git; ion bytes on disk via PLT cache. No MP4.
 * Sequence JSON may carry `tileWarm.contentUrls` (tile IDs for other PCs).
 */

import type { PerspectiveCamera, WebGLRenderer } from 'three'
import {
  CESIUM_ION_BING_AERIAL_ASSET_ID,
  CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
} from '../terrain/constants.ts'
import { CESIUM_ION_OSM_BUILDINGS_ASSET_ID } from '../buildings/constants.ts'
import { applyCinematicCamera } from './applyCamera.ts'
import { defaultCinematicGeo } from './evaluate.ts'
import {
  cinematicTileCacheHas,
  cinematicTileCacheIdle,
  collectedWarmContentUrls,
  type TileDiskCacheHooks,
} from './tileDiskCache.ts'
import { interpolateKeyframe } from './spline.ts'
import type {
  CinematicDomain,
  CinematicSample,
  CinematicSequence,
} from './types.ts'

export const WARM_MANIFEST_URL = '/cinematics/warm/intro-bosphorus.json'

/** Globe country holds — Aerial SSE. Play + warm. Lower = sharper (was 16). */
export const WARM_GLOBE_ERROR_TARGET_MIN = 8
export const WARM_GLOBE_ERROR_TARGET_MAX = 8
/** İstanbul ENU — Bing Aerial ion 2. Warm prefetch. */
export const WARM_ISTANBUL_ERROR_TARGET = 3
/**
 * Play SSE over the Bosphorus. Finer than this (warm's 3) stalls the tick
 * while Cesium tries to refine the 3rd bridge.
 */
export const CINEMATIC_ENU_PLAY_ERROR_TARGET = 8

export const WARM_REGION_TIMEOUT_MS = 50_000
export const WARM_TOTAL_TIMEOUT_MS = 360_000
export const WARM_IDLE_FRAMES = 8

export type WarmIonAssets = {
  worldTerrain: number
  bingAerial: number
  osmBuildings: number
}

export type WarmRegion = {
  id: string
  domain: CinematicDomain
  errorTarget: number
  osm: boolean
  lat: number
  lon: number
  altMsl: number
  lookLat: number
  lookLon: number
  lookAltMsl: number
}

export type WarmManifest = {
  id: string
  ionAssets: WarmIonAssets
  regions: readonly WarmRegion[]
  /** Optional dump of content URLs for a later commit (no binaries). */
  contentUrls: readonly string[]
}

export type ParseWarmManifestResult =
  | { ok: true; manifest: WarmManifest }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function isCoarseGlobeRegion(region: WarmRegion): boolean {
  return region.domain === 'globe' && region.osm === false
}

export function isIstanbulDetailRegion(region: WarmRegion): boolean {
  return (
    region.domain === 'enu' &&
    region.osm === true &&
    region.errorTarget <= WARM_ISTANBUL_ERROR_TARGET
  )
}

export function regionUsesOsm(region: WarmRegion): boolean {
  return region.domain === 'enu' && region.osm === true
}

function parseIonAssets(value: unknown): WarmIonAssets | { error: string } {
  if (!isRecord(value)) {
    return { error: 'ionAssets must be an object' }
  }
  const worldTerrain = finiteNumber(value.worldTerrain)
  const bingAerial = finiteNumber(value.bingAerial)
  const osmBuildings = finiteNumber(value.osmBuildings)
  if (
    worldTerrain === null ||
    bingAerial === null ||
    osmBuildings === null
  ) {
    return { error: 'ionAssets needs worldTerrain, bingAerial, osmBuildings' }
  }
  return {
    worldTerrain: Math.floor(worldTerrain),
    bingAerial: Math.floor(bingAerial),
    osmBuildings: Math.floor(osmBuildings),
  }
}

function parseRegion(
  value: unknown,
  index: number,
): { region: WarmRegion } | { error: string } {
  if (!isRecord(value)) {
    return { error: `regions[${index}] must be an object` }
  }
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  if (id === '') return { error: `regions[${index}].id is required` }
  const domain = value.domain
  if (domain !== 'globe' && domain !== 'enu') {
    return { error: `regions[${index}].domain must be globe|enu` }
  }
  const errorTarget = finiteNumber(value.errorTarget)
  const lat = finiteNumber(value.lat)
  const lon = finiteNumber(value.lon)
  const altMsl = finiteNumber(value.altMsl)
  const lookLat = finiteNumber(value.lookLat)
  const lookLon = finiteNumber(value.lookLon)
  const lookAltMsl = finiteNumber(value.lookAltMsl)
  if (
    errorTarget === null ||
    lat === null ||
    lon === null ||
    altMsl === null ||
    lookLat === null ||
    lookLon === null ||
    lookAltMsl === null
  ) {
    return {
      error: `regions[${index}] needs errorTarget, lat/lon/altMsl, look*`,
    }
  }
  if (errorTarget <= 0) {
    return { error: `regions[${index}].errorTarget must be > 0` }
  }
  const osm = value.osm === true
  if (domain === 'globe' && osm) {
    return { error: `regions[${index}] globe must not set osm` }
  }
  return {
    region: {
      id,
      domain,
      errorTarget,
      osm,
      lat,
      lon,
      altMsl,
      lookLat,
      lookLon,
      lookAltMsl,
    },
  }
}

function parseContentUrls(value: unknown): string[] | { error: string } {
  if (value === undefined) return []
  if (!Array.isArray(value)) return { error: 'contentUrls must be an array' }
  const out: string[] = []
  for (let i = 0; i < value.length; i++) {
    const item = value[i]
    if (typeof item !== 'string' || item.trim() === '') {
      return { error: `contentUrls[${i}] must be a non-empty string` }
    }
    out.push(item.trim())
  }
  return out
}

export function parseWarmManifest(raw: unknown): ParseWarmManifestResult {
  if (!isRecord(raw)) return { ok: false, error: 'manifest must be an object' }
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (id === '') return { ok: false, error: 'id is required' }
  const assets = parseIonAssets(raw.ionAssets)
  if ('error' in assets) return { ok: false, error: assets.error }
  if (!Array.isArray(raw.regions) || raw.regions.length === 0) {
    return { ok: false, error: 'regions must be a non-empty array' }
  }
  const regions: WarmRegion[] = []
  for (let i = 0; i < raw.regions.length; i++) {
    const parsed = parseRegion(raw.regions[i], i)
    if ('error' in parsed) return { ok: false, error: parsed.error }
    regions.push(parsed.region)
  }
  const urls = parseContentUrls(raw.contentUrls)
  if (!Array.isArray(urls)) return { ok: false, error: urls.error }
  return {
    ok: true,
    manifest: {
      id,
      ionAssets: assets,
      regions,
      contentUrls: urls,
    },
  }
}

export function mergeContentUrls(
  ...lists: readonly (readonly string[] | undefined)[]
): string[] {
  const out = new Set<string>()
  for (const list of lists) {
    if (!list) continue
    for (const item of list) {
      const trimmed = item.trim()
      if (trimmed !== '') out.add(trimmed)
    }
  }
  return [...out].sort()
}

function regionDedupeKey(region: WarmRegion): string {
  const latDigits = region.domain === 'globe' ? 2 : 4
  const lonDigits = region.domain === 'globe' ? 2 : 4
  const altStep = region.domain === 'globe' ? 100_000 : 40
  return [
    region.domain,
    region.lat.toFixed(latDigits),
    region.lon.toFixed(lonDigits),
    String(Math.round(region.altMsl / altStep)),
    region.osm ? 'osm' : 'no-osm',
  ].join('|')
}

/**
 * Extra warm cameras from sequence keyframes so transits and ENU beats
 * pull tiles, not only the 8 sidecar poses.
 */
export function regionsFromSequence(
  sequence: CinematicSequence,
): WarmRegion[] {
  const out: WarmRegion[] = []
  const seen = new Set<string>()
  for (let si = 0; si < sequence.shots.length; si++) {
    const shot = sequence.shots[si]!
    const errorTarget =
      shot.domain === 'globe'
        ? WARM_GLOBE_ERROR_TARGET_MIN
        : WARM_ISTANBUL_ERROR_TARGET
    const osm = shot.domain === 'enu' && shot.buildings
    const stamps = [0, 0.25, 0.5, 0.75, 1]
    for (let ti = 0; ti < stamps.length; ti++) {
      const kf = interpolateKeyframe(shot, stamps[ti]!)
      const region: WarmRegion = {
        id: `seq-${sequence.id}-${si}-${ti}`,
        domain: shot.domain,
        errorTarget,
        osm,
        lat: kf.lat,
        lon: kf.lon,
        altMsl: kf.altMsl,
        lookLat: kf.lookLat,
        lookLon: kf.lookLon,
        lookAltMsl: kf.lookAltMsl,
      }
      const key = regionDedupeKey(region)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(region)
    }
  }
  return out
}

export function mergeWarmManifest(
  manifest: WarmManifest,
  sequence: CinematicSequence | null,
): WarmManifest {
  const extra = sequence ? regionsFromSequence(sequence) : []
  const seen = new Set(manifest.regions.map(regionDedupeKey))
  const regions = [...manifest.regions]
  for (const region of extra) {
    const key = regionDedupeKey(region)
    if (seen.has(key)) continue
    seen.add(key)
    regions.push(region)
  }
  return {
    ...manifest,
    regions,
    contentUrls: mergeContentUrls(
      manifest.contentUrls,
      sequence?.tileWarm.contentUrls,
    ),
  }
}

export async function loadWarmManifest(
  url: string = WARM_MANIFEST_URL,
): Promise<WarmManifest | null> {
  const trimmed = url.trim()
  if (trimmed === '') return null
  try {
    const res = await fetch(trimmed)
    if (!res.ok) {
      console.warn(`[cinematics] warm manifest ${trimmed}: HTTP ${res.status}`)
      return null
    }
    const parsed = parseWarmManifest(await res.json())
    if (!parsed.ok) {
      console.warn(`[cinematics] warm manifest ${trimmed}: ${parsed.error}`)
      return null
    }
    return parsed.manifest
  } catch (err) {
    console.warn(`[cinematics] warm manifest ${trimmed} failed`, err)
    return null
  }
}

export type WarmTilesStatus = {
  phase: 'idle' | 'warming' | 'ready' | 'skipped'
  label: string
  done: number
  total: number
}

export const WARM_STATUS_IDLE: WarmTilesStatus = {
  phase: 'idle',
  label: '',
  done: 0,
  total: 0,
}

export function formatWarmTilesStatus(status: WarmTilesStatus): string {
  if (status.phase === 'warming') {
    return `tiles: warming ${status.done}/${status.total}`
  }
  if (status.phase === 'ready') return 'tiles: warm'
  if (status.phase === 'skipped') return status.label || 'tiles: skipped'
  return ''
}

export type WarmTilesAdapter = {
  setErrorTarget: (value: number) => void
  getErrorTarget: () => number
  isDownloadIdle: () => boolean
  getVisibleTileCount: () => number
  tick: (
    previewCamera: PerspectiveCamera,
    airCamera: PerspectiveCamera,
    renderer: WebGLRenderer,
  ) => void
}

export type WarmCinematicHost = {
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  opaqueClearSafe: () => boolean
  token: () => string
  applyRegionLook: (region: WarmRegion) => void
  restoreLook: () => void
  terrain: () => WarmTilesAdapter | null
  buildings: () => WarmTilesAdapter | null
  nowMs?: () => number
  waitFrame?: () => Promise<void>
}

function regionSample(region: WarmRegion): CinematicSample {
  const geo = defaultCinematicGeo
  const kf = {
    lat: region.lat,
    lon: region.lon,
    altMsl: region.altMsl,
    lookLat: region.lookLat,
    lookLon: region.lookLon,
    lookAltMsl: region.lookAltMsl,
    t01: 0 as const,
  }
  const pose =
    region.domain === 'globe'
      ? {
          eye: (() => {
            const e = geo.geodeticToEcefMeters(kf.lat, kf.lon, kf.altMsl)
            return { x: e.x, y: e.y, z: e.z }
          })(),
          target: (() => {
            const t = geo.geodeticToEcefMeters(
              kf.lookLat,
              kf.lookLon,
              kf.lookAltMsl,
            )
            return { x: t.x, y: t.y, z: t.z }
          })(),
          up: (() => {
            const eye = geo.geodeticToEcefMeters(kf.lat, kf.lon, kf.altMsl)
            const target = geo.geodeticToEcefMeters(
              kf.lookLat,
              kf.lookLon,
              kf.lookAltMsl,
            )
            const basis = geo.ecefLookAt(eye, target)
            return { x: basis.up.x, y: basis.up.y, z: basis.up.z }
          })(),
        }
      : {
          eye: geo.enuKeyframeToScene(kf.lat, kf.lon, kf.altMsl),
          target: geo.enuKeyframeToScene(
            kf.lookLat,
            kf.lookLon,
            kf.lookAltMsl,
          ),
          up: { x: 0, y: 1, z: 0 },
        }
  return {
    tSec: 0,
    shot: {
      t0: 0,
      t1: 1,
      domain: region.domain,
      fog: false,
      ocean: region.domain === 'enu',
      buildings: regionUsesOsm(region),
      imagery: 'aerial',
      cloud01: 0,
      keyframes: [kf],
    },
    domain: region.domain,
    fog: false,
    ocean: region.domain === 'enu',
    buildings: regionUsesOsm(region),
    imagery: 'aerial',
    cloud01: 0,
    pose,
    keyframe: kf,
  }
}

function defaultWaitFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 16)
  })
}

async function waitUntilIdle(
  host: WarmCinematicHost,
  timeoutMs: number,
): Promise<void> {
  const now = host.nowMs ?? (() => performance.now())
  const wait = host.waitFrame ?? defaultWaitFrame
  const start = now()
  let idleFrames = 0
  while (now() - start < timeoutMs) {
    const terrain = host.terrain()
    const buildings = host.buildings()
    if (terrain) {
      terrain.tick(host.camera, host.camera, host.renderer)
    }
    if (buildings) {
      buildings.tick(host.camera, host.camera, host.renderer)
    }
    const terrainIdle = !terrain || terrain.isDownloadIdle()
    const buildingsIdle = !buildings || buildings.isDownloadIdle()
    const fetchIdle = cinematicTileCacheIdle()
    if (terrainIdle && buildingsIdle && fetchIdle) {
      idleFrames += 1
      if (idleFrames >= WARM_IDLE_FRAMES) return
    } else {
      idleFrames = 0
    }
    await wait()
  }
}

/**
 * Prefetch listed content URLs that are not already on disk.
 * Hits skip ion. Misses still need a later camera warm (no ion bearer here).
 */
export async function prefetchManifestContentUrls(
  urls: readonly string[],
  hooks: TileDiskCacheHooks = {},
): Promise<{ hit: number; miss: number }> {
  let hit = 0
  let miss = 0
  for (const url of urls) {
    if (await cinematicTileCacheHas(url, hooks)) hit += 1
    else miss += 1
  }
  return { hit, miss }
}

export type WarmCinematicTilesResult = {
  status: WarmTilesStatus
  skipped: boolean
  regionLogs: readonly string[]
}

/**
 * Pose each manifest region, `tiles.update` until the download queue is idle
 * (timeout, no throw). Globe does not pull OSM. ENU pulls OSM + Aerial.
 */
export async function warmCinematicTiles(
  host: WarmCinematicHost,
  manifest: WarmManifest,
  onStatus?: (status: WarmTilesStatus) => void,
): Promise<WarmCinematicTilesResult> {
  const regionLogs: string[] = []
  const total = manifest.regions.length
  const emit = (status: WarmTilesStatus): void => {
    onStatus?.(status)
  }

  if (host.token().trim() === '') {
    const status: WarmTilesStatus = {
      phase: 'skipped',
      label: 'tiles: skipped (no ion token)',
      done: 0,
      total,
    }
    emit(status)
    return { status, skipped: true, regionLogs }
  }
  if (!host.opaqueClearSafe()) {
    const status: WarmTilesStatus = {
      phase: 'skipped',
      label: 'tiles: skipped (AR gate)',
      done: 0,
      total,
    }
    emit(status)
    return { status, skipped: true, regionLogs }
  }

  if (manifest.ionAssets.worldTerrain !== CESIUM_ION_WORLD_TERRAIN_ASSET_ID) {
    console.warn(
      '[cinematics] warm manifest worldTerrain id',
      manifest.ionAssets.worldTerrain,
    )
  }
  if (manifest.ionAssets.bingAerial !== CESIUM_ION_BING_AERIAL_ASSET_ID) {
    console.warn(
      '[cinematics] warm manifest bingAerial id',
      manifest.ionAssets.bingAerial,
    )
  }
  if (manifest.ionAssets.osmBuildings !== CESIUM_ION_OSM_BUILDINGS_ASSET_ID) {
    console.warn(
      '[cinematics] warm manifest osmBuildings id',
      manifest.ionAssets.osmBuildings,
    )
  }

  if (manifest.contentUrls.length > 0) {
    const skip = await prefetchManifestContentUrls(manifest.contentUrls)
    console.info(
      `[cinematics] warm contentUrls skip-if-present hit=${skip.hit} miss=${skip.miss}`,
    )
  }

  const now = host.nowMs ?? (() => performance.now())
  const t0 = now()
  emit({
    phase: 'warming',
    label: formatWarmTilesStatus({
      phase: 'warming',
      label: '',
      done: 0,
      total,
    }),
    done: 0,
    total,
  })

  try {
    for (let i = 0; i < manifest.regions.length; i++) {
      if (now() - t0 > WARM_TOTAL_TIMEOUT_MS) {
        console.warn('[cinematics] warm total timeout')
        break
      }
      const region = manifest.regions[i]!
      const remaining = Math.max(
        1_000,
        WARM_TOTAL_TIMEOUT_MS - (now() - t0),
      )
      const timeout = Math.min(WARM_REGION_TIMEOUT_MS, remaining)
      host.applyRegionLook(region)
      const terrain = host.terrain()
      const buildings = host.buildings()
      terrain?.setErrorTarget(region.errorTarget)
      if (regionUsesOsm(region)) {
        buildings?.setErrorTarget(region.errorTarget)
      }
      applyCinematicCamera(host.camera, regionSample(region))
      await waitUntilIdle(host, timeout)
      const tileCount = terrain?.getVisibleTileCount() ?? 0
      const buildingCount = regionUsesOsm(region)
        ? (buildings?.getVisibleTileCount() ?? 0)
        : 0
      const line = `[cinematics] warm region=${region.id} domain=${region.domain} errorTarget=${region.errorTarget} tiles=${tileCount}${
        regionUsesOsm(region) ? ` osm=${buildingCount}` : ' osm=off'
      }`
      regionLogs.push(line)
      console.info(line)
      emit({
        phase: 'warming',
        label: formatWarmTilesStatus({
          phase: 'warming',
          label: '',
          done: i + 1,
          total,
        }),
        done: i + 1,
        total,
      })
    }
  } finally {
    host.restoreLook()
  }

  const status: WarmTilesStatus = {
    phase: 'ready',
    label: 'tiles: warm',
    done: total,
    total,
  }
  emit(status)
  return { status, skipped: false, regionLogs }
}

export function dumpWarmContentUrlsJson(): string {
  return dumpSequenceTileWarmJson({
    id: 'intro-bosphorus',
  })
}

export function dumpSequenceTileWarmJson(
  sequenceRaw: Record<string, unknown>,
  extraUrls: readonly string[] = collectedWarmContentUrls(),
): string {
  const existing =
    sequenceRaw.tileWarm &&
    typeof sequenceRaw.tileWarm === 'object' &&
    !Array.isArray(sequenceRaw.tileWarm)
      ? (sequenceRaw.tileWarm as { contentUrls?: unknown }).contentUrls
      : undefined
  const fromExisting = Array.isArray(existing)
    ? existing.filter((u): u is string => typeof u === 'string')
    : []
  const next = {
    ...sequenceRaw,
    tileWarm: {
      contentUrls: mergeContentUrls(fromExisting, extraUrls),
    },
  }
  return `${JSON.stringify(next, null, 2)}\n`
}

export function downloadWarmContentUrls(
  filename = 'intro-bosphorus.json',
): void {
  downloadSequenceTileWarm({ id: 'intro-bosphorus' }, filename)
}

export function downloadSequenceTileWarm(
  sequenceRaw: Record<string, unknown>,
  filename?: string,
): void {
  if (typeof document === 'undefined') return
  const id =
    typeof sequenceRaw.id === 'string' && sequenceRaw.id.trim() !== ''
      ? sequenceRaw.id.trim()
      : 'intro-bosphorus'
  const name = filename ?? `${id}.json`
  const blob = new Blob(
    [dumpSequenceTileWarmJson(sequenceRaw, collectedWarmContentUrls())],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

export {
  cinematicTileCacheHas,
  cinematicTileCacheIdle,
  collectedWarmContentUrls,
  installCinematicTileFetchCache,
  isIonContentUrl,
} from './tileDiskCache.ts'
