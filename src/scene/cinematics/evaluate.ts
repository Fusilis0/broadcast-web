import {
  ecefLookAt,
  enuKeyframeToScene,
  geodeticToEcefMeters,
  type EcefLookAt,
  type EcefMeters,
} from '../../geodesy/index.ts'
import { interpolateKeyframe, shotAtTime, shotT01 } from './spline.ts'
import type {
  CinematicKeyframe,
  CinematicPose,
  CinematicSample,
  CinematicSequence,
  Vec3,
} from './types.ts'

export type CinematicGeo = {
  geodeticToEcefMeters: (
    lat: number,
    lon: number,
    altMsl: number,
  ) => EcefMeters
  ecefLookAt: (eye: EcefMeters, target: EcefMeters) => EcefLookAt
  enuKeyframeToScene: (
    lat: number,
    lon: number,
    altMsl: number,
  ) => Vec3
}

export const defaultCinematicGeo: CinematicGeo = {
  geodeticToEcefMeters,
  ecefLookAt,
  enuKeyframeToScene,
}

function vecFromEcef(v: EcefMeters): Vec3 {
  return { x: v.x, y: v.y, z: v.z }
}

function globePose(
  kf: CinematicKeyframe,
  geo: CinematicGeo,
): CinematicPose {
  const eye = geo.geodeticToEcefMeters(kf.lat, kf.lon, kf.altMsl)
  const target = geo.geodeticToEcefMeters(
    kf.lookLat,
    kf.lookLon,
    kf.lookAltMsl,
  )
  const basis = geo.ecefLookAt(eye, target)
  return {
    eye: vecFromEcef(basis.eye),
    target: vecFromEcef(target),
    up: vecFromEcef(basis.up),
  }
}

function enuPose(kf: CinematicKeyframe, geo: CinematicGeo): CinematicPose {
  const eye = geo.enuKeyframeToScene(kf.lat, kf.lon, kf.altMsl)
  const target = geo.enuKeyframeToScene(
    kf.lookLat,
    kf.lookLon,
    kf.lookAltMsl,
  )
  return {
    eye: { x: eye.x, y: eye.y, z: eye.z },
    target: { x: target.x, y: target.y, z: target.z },
    up: { x: 0, y: 1, z: 0 },
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Smooth cloud across shot boundaries. Shot `cloud01` is the value at **t1**;
 * we lerp from the previous shot's value so 0.5 s steps no longer pop.
 */
export function interpolateShotCloud01(
  sequence: CinematicSequence,
  tSec: number,
): number {
  const shot = shotAtTime(sequence, tSec)
  const idx = sequence.shots.indexOf(shot)
  const prev = idx > 0 ? sequence.shots[idx - 1] : undefined
  const from = prev ? prev.cloud01 : shot.cloud01
  const to = shot.cloud01
  if (from === to) return to
  return lerp(from, to, shotT01(shot, tSec))
}

/**
 * Sample the sequence at `tSec` (already quantized by the 30 Hz clock).
 * Globe uses GEO ECEF; ENU uses `enuKeyframeToScene` (origin must be set).
 */
export function evaluateCinematicAt(
  sequence: CinematicSequence,
  tSec: number,
  geo: CinematicGeo = defaultCinematicGeo,
): CinematicSample {
  const duration = sequence.durationSec
  const t =
    Number.isFinite(tSec) && tSec > 0
      ? Math.min(tSec, duration)
      : 0
  const shot = shotAtTime(sequence, t)
  const keyframe = interpolateKeyframe(shot, shotT01(shot, t))
  const pose =
    shot.domain === 'globe' ? globePose(keyframe, geo) : enuPose(keyframe, geo)
  return {
    tSec: t,
    shot,
    domain: shot.domain,
    fog: shot.fog,
    ocean: shot.ocean,
    buildings: shot.buildings,
    imagery: shot.imagery,
    cloud01: interpolateShotCloud01(sequence, t),
    pose,
    keyframe,
    lookId: keyframe.lookId,
  }
}
