import type {
  CinematicEase,
  CinematicKeyframe,
  CinematicSequence,
  CinematicShot,
} from './types.ts'

function clamp01(t: number): number {
  if (!(t > 0)) return 0
  if (t >= 1) return 1
  return t
}

export function applyEase(t01: number, ease: CinematicEase | undefined): number {
  const t = clamp01(t01)
  if (ease === 'easeIn') return t * t
  if (ease === 'easeOut') {
    const u = 1 - t
    return 1 - u * u
  }
  if (ease === 'easeInOut') {
    // Smootherstep — calmer ramps than cubic smoothstep.
    return t * t * t * (t * (t * 6 - 15) + 10)
  }
  return t
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function unwrapLon(base: number, lon: number): number {
  let d = lon - base
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return base + d
}

function wrapLon(lon: number): number {
  let out = lon
  while (out > 180) out -= 360
  while (out < -180) out += 360
  return out
}

/** Shortest-arc longitude interpolation (degrees, wrapped to [-180, 180]). */
export function lerpLonDeg(a: number, b: number, t: number): number {
  let delta = b - a
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  let out = a + delta * t
  while (out > 180) out -= 360
  while (out < -180) out += 360
  return out
}

function sortedKeyframes(
  shot: CinematicShot,
): readonly CinematicKeyframe[] {
  if (shot.keyframes.length < 2) return shot.keyframes
  const copy = shot.keyframes.slice()
  copy.sort((a, b) => a.t01 - b.t01)
  return copy
}

/**
 * Interpolate geodetic keyframes in **shot-normalized time** (not rAF dt).
 * Piecewise lerp + optional ease on the left keyframe of each segment.
 */
export function interpolateKeyframe(
  shot: CinematicShot,
  shotT01: number,
): CinematicKeyframe {
  const keys = sortedKeyframes(shot)
  const first = keys[0]
  if (!first) {
    return {
      lat: 0,
      lon: 0,
      altMsl: 0,
      lookLat: 0,
      lookLon: 0,
      lookAltMsl: 0,
      t01: clamp01(shotT01),
    }
  }
  if (keys.length === 1) return { ...first, t01: clamp01(shotT01) }

  const t = clamp01(shotT01)
  let i = 0
  while (i < keys.length - 2 && t >= keys[i + 1]!.t01) i += 1
  const a = keys[i]!
  const b = keys[i + 1] ?? a
  const span = b.t01 - a.t01
  const local = span <= 1e-9 ? 0 : clamp01((t - a.t01) / span)
  const u = applyEase(local, a.ease)
  const lookId = u < 0.5 ? a.lookId ?? b.lookId : b.lookId ?? a.lookId
  const useSpline = keys.length >= 3
  const p0 = keys[i - 1] ?? a
  const p3 = keys[i + 2] ?? b
  const lon0 = unwrapLon(a.lon, p0.lon)
  const lon1 = a.lon
  const lon2 = unwrapLon(a.lon, b.lon)
  const lon3 = unwrapLon(a.lon, p3.lon)
  const lookLon0 = unwrapLon(a.lookLon, p0.lookLon)
  const lookLon1 = a.lookLon
  const lookLon2 = unwrapLon(a.lookLon, b.lookLon)
  const lookLon3 = unwrapLon(a.lookLon, p3.lookLon)
  const out: CinematicKeyframe = {
    lat: useSpline ? catmullRom(p0.lat, a.lat, b.lat, p3.lat, u) : lerp(a.lat, b.lat, u),
    lon: wrapLon(
      useSpline ? catmullRom(lon0, lon1, lon2, lon3, u) : lerp(lon1, lon2, u),
    ),
    altMsl: useSpline
      ? catmullRom(p0.altMsl, a.altMsl, b.altMsl, p3.altMsl, u)
      : lerp(a.altMsl, b.altMsl, u),
    lookLat: useSpline
      ? catmullRom(p0.lookLat, a.lookLat, b.lookLat, p3.lookLat, u)
      : lerp(a.lookLat, b.lookLat, u),
    lookLon: wrapLon(
      useSpline
        ? catmullRom(lookLon0, lookLon1, lookLon2, lookLon3, u)
        : lerp(lookLon1, lookLon2, u),
    ),
    lookAltMsl: useSpline
      ? catmullRom(p0.lookAltMsl, a.lookAltMsl, b.lookAltMsl, p3.lookAltMsl, u)
      : lerp(a.lookAltMsl, b.lookAltMsl, u),
    t01: t,
    ease: a.ease,
  }
  if (lookId) out.lookId = lookId
  return out
}

export function shotAtTime(
  sequence: CinematicSequence,
  tSec: number,
): CinematicShot {
  const shots = sequence.shots
  const last = shots[shots.length - 1]
  if (!last) {
    throw new Error('sequence has no shots')
  }
  const t = Number.isFinite(tSec)
    ? Math.min(Math.max(tSec, 0), sequence.durationSec)
    : 0
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]!
    const isLast = i === shots.length - 1
    if (t >= shot.t0 && (isLast ? t <= shot.t1 : t < shot.t1)) return shot
  }
  return last
}

/** Shot-local t01 from sequence time. */
export function shotT01(shot: CinematicShot, tSec: number): number {
  const span = shot.t1 - shot.t0
  if (!(span > 0)) return 0
  return clamp01((tSec - shot.t0) / span)
}
