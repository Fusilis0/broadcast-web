import {
  CINEMATIC_FPS,
  CINEMATIC_HEIGHT,
  CINEMATIC_WIDTH,
} from './constants.ts'
import type {
  CinematicDomain,
  CinematicEase,
  CinematicImagery,
  CinematicKeyframe,
  CinematicPin,
  CinematicPinKind,
  CinematicSequence,
  CinematicShot,
  CinematicTileWarm,
} from './types.ts'

export type ParseSequenceResult =
  | { ok: true; sequence: CinematicSequence }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseDomain(value: unknown): CinematicDomain | null {
  return value === 'globe' || value === 'enu' ? value : null
}

function parseImagery(value: unknown): CinematicImagery | null {
  return value === 'aerial' || value === 'road' ? value : null
}

function parseEase(value: unknown): CinematicEase | undefined {
  if (value === undefined) return undefined
  if (
    value === 'linear' ||
    value === 'easeIn' ||
    value === 'easeOut' ||
    value === 'easeInOut'
  ) {
    return value
  }
  return undefined
}

function parseKeyframe(
  value: unknown,
  index: number,
): { keyframe: CinematicKeyframe } | { error: string } {
  if (!isRecord(value)) {
    return { error: `keyframes[${index}] must be an object` }
  }
  const lat = finiteNumber(value.lat)
  const lon = finiteNumber(value.lon)
  const altMsl = finiteNumber(value.altMsl)
  const lookLat = finiteNumber(value.lookLat)
  const lookLon = finiteNumber(value.lookLon)
  const lookAltMsl = finiteNumber(value.lookAltMsl)
  const t01 = finiteNumber(value.t01)
  if (
    lat === null ||
    lon === null ||
    altMsl === null ||
    lookLat === null ||
    lookLon === null ||
    lookAltMsl === null ||
    t01 === null
  ) {
    return {
      error: `keyframes[${index}] needs lat, lon, altMsl, lookLat, lookLon, lookAltMsl, t01`,
    }
  }
  if (t01 < 0 || t01 > 1) {
    return { error: `keyframes[${index}].t01 must be in [0, 1]` }
  }
  const ease = parseEase(value.ease)
  if (value.ease !== undefined && ease === undefined) {
    return { error: `keyframes[${index}].ease is not a known ease` }
  }
  const keyframe: CinematicKeyframe = {
    lat,
    lon,
    altMsl,
    lookLat,
    lookLon,
    lookAltMsl,
    t01,
  }
  if (ease) keyframe.ease = ease
  if (typeof value.lookId === 'string' && value.lookId.trim() !== '') {
    keyframe.lookId = value.lookId.trim()
  }
  return { keyframe }
}

function parseShot(
  value: unknown,
  index: number,
): { shot: CinematicShot } | { error: string } {
  if (!isRecord(value)) {
    return { error: `shots[${index}] must be an object` }
  }
  const t0 = finiteNumber(value.t0)
  const t1 = finiteNumber(value.t1)
  const domain = parseDomain(value.domain)
  const imagery = parseImagery(value.imagery)
  const cloud01 = finiteNumber(value.cloud01)
  if (t0 === null || t1 === null) {
    return { error: `shots[${index}] needs t0 and t1` }
  }
  if (!(t1 > t0)) {
    return { error: `shots[${index}] t1 must be greater than t0` }
  }
  if (!domain) {
    return { error: `shots[${index}].domain must be globe | enu` }
  }
  if (typeof value.fog !== 'boolean') {
    return { error: `shots[${index}].fog must be boolean` }
  }
  if (typeof value.ocean !== 'boolean') {
    return { error: `shots[${index}].ocean must be boolean` }
  }
  if (typeof value.buildings !== 'boolean') {
    return { error: `shots[${index}].buildings must be boolean` }
  }
  if (!imagery) {
    return { error: `shots[${index}].imagery must be aerial | road` }
  }
  if (cloud01 === null || cloud01 < 0 || cloud01 > 1) {
    return { error: `shots[${index}].cloud01 must be in [0, 1]` }
  }
  if (!Array.isArray(value.keyframes) || value.keyframes.length < 1) {
    return { error: `shots[${index}] needs at least one keyframe` }
  }
  const keyframes: CinematicKeyframe[] = []
  for (let i = 0; i < value.keyframes.length; i++) {
    const parsed = parseKeyframe(value.keyframes[i], i)
    if ('error' in parsed) {
      return { error: `shots[${index}]: ${parsed.error}` }
    }
    keyframes.push(parsed.keyframe)
  }
  return {
    shot: {
      t0,
      t1,
      domain,
      fog: value.fog,
      ocean: value.ocean,
      buildings: value.buildings,
      imagery,
      cloud01,
      keyframes,
    },
  }
}

function parsePin(
  value: unknown,
  index: number,
): { pin: CinematicPin } | { error: string } {
  if (!isRecord(value)) {
    return { error: `pins[${index}] must be an object` }
  }
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const label = typeof value.label === 'string' ? value.label.trim() : ''
  const lat = finiteNumber(value.lat)
  const lon = finiteNumber(value.lon)
  if (id === '') {
    return { error: `pins[${index}].id must be a non-empty string` }
  }
  if (label === '') {
    return { error: `pins[${index}].label must be a non-empty string` }
  }
  if (lat === null || lon === null) {
    return { error: `pins[${index}] needs lat and lon` }
  }
  if (lat < -90 || lat > 90) {
    return { error: `pins[${index}].lat must be in [-90, 90]` }
  }
  const pin: CinematicPin = { id, label, lat, lon }
  if (typeof value.flag === 'string' && value.flag.trim() !== '') {
    pin.flag = value.flag.trim().toLowerCase()
  }
  const kind = parsePinKind(value.kind)
  if (value.kind !== undefined && kind === undefined) {
    return { error: `pins[${index}].kind must be country | hero | place` }
  }
  if (kind) pin.kind = kind
  return { pin }
}

function parsePinKind(value: unknown): CinematicPinKind | undefined {
  if (value === undefined) return undefined
  if (value === 'country' || value === 'hero' || value === 'place') return value
  return undefined
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

function parseTileWarm(
  value: unknown,
): { tileWarm: CinematicTileWarm } | { error: string } {
  if (value === undefined) return { tileWarm: { contentUrls: [] } }
  if (!isRecord(value)) return { error: 'tileWarm must be an object' }
  const urls = parseContentUrls(value.contentUrls)
  if (!Array.isArray(urls)) return { error: `tileWarm.${urls.error}` }
  return { tileWarm: { contentUrls: urls } }
}

function parsePins(
  value: unknown,
): { pins: CinematicPin[] } | { error: string } {
  if (value === undefined) return { pins: [] }
  if (!Array.isArray(value)) {
    return { error: 'pins must be an array' }
  }
  const pins: CinematicPin[] = []
  const seen = new Set<string>()
  for (let i = 0; i < value.length; i++) {
    const parsed = parsePin(value[i], i)
    if ('error' in parsed) return parsed
    if (seen.has(parsed.pin.id)) {
      return { error: `pins[${i}].id is duplicated` }
    }
    seen.add(parsed.pin.id)
    pins.push(parsed.pin)
  }
  return { pins }
}

/**
 * Validate cinematic sequence JSON. Requires 1920×1080 · 30 fps.
 */
export function parseSequence(raw: unknown): ParseSequenceResult {
  if (!isRecord(raw)) {
    return { ok: false, error: 'sequence must be an object' }
  }
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (id === '') {
    return { ok: false, error: 'id must be a non-empty string' }
  }
  const durationSec = finiteNumber(raw.durationSec)
  if (durationSec === null || durationSec <= 0) {
    return { ok: false, error: 'durationSec must be a positive number' }
  }
  const width = finiteNumber(raw.width)
  const height = finiteNumber(raw.height)
  const fps = finiteNumber(raw.fps)
  if (width !== CINEMATIC_WIDTH || height !== CINEMATIC_HEIGHT) {
    return {
      ok: false,
      error: `width/height must be ${CINEMATIC_WIDTH}×${CINEMATIC_HEIGHT}`,
    }
  }
  if (fps !== CINEMATIC_FPS) {
    return { ok: false, error: `fps must be ${CINEMATIC_FPS}` }
  }
  if (!Array.isArray(raw.shots) || raw.shots.length < 1) {
    return { ok: false, error: 'shots must be a non-empty array' }
  }
  const shots: CinematicShot[] = []
  for (let i = 0; i < raw.shots.length; i++) {
    const parsed = parseShot(raw.shots[i], i)
    if ('error' in parsed) return { ok: false, error: parsed.error }
    shots.push(parsed.shot)
  }
  const pinsParsed = parsePins(raw.pins)
  if ('error' in pinsParsed) {
    return { ok: false, error: pinsParsed.error }
  }
  const heroPinsParsed = parsePins(raw.heroPins)
  if ('error' in heroPinsParsed) {
    return { ok: false, error: heroPinsParsed.error.replace(/^pins/, 'heroPins') }
  }
  const tileWarmParsed = parseTileWarm(raw.tileWarm)
  if ('error' in tileWarmParsed) {
    return { ok: false, error: tileWarmParsed.error }
  }
  return {
    ok: true,
    sequence: {
      id,
      durationSec,
      width,
      height,
      fps,
      shots,
      pins: pinsParsed.pins,
      heroPins: heroPinsParsed.pins.map((p) => ({
        ...p,
        kind: p.kind ?? 'hero',
      })),
      tileWarm: tileWarmParsed.tileWarm,
    },
  }
}
