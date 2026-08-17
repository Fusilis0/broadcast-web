import { windTravelSceneXZ } from '../../telemetry/windDirection.ts'
import { DEFAULT_WIND_SPEED_KT, KT_TO_MS } from '../../telemetry/windTypes.ts'
import type { WindFrame, WindTravelXZ } from '../../telemetry/windTypes.ts'

/**
 * Phase 14.2b — map `windBus` frames onto Gerstner uniforms and ramp them.
 *
 * Travel comes from TEL `windTravelSceneXZ` (do not re-derive from/to).
 * `directionRad = atan2(tz, tx)` matches Gerstner `(cos θ, sin θ)`:
 * from-north (000°) → +Z; from-east (090°) → −X.
 */

/** Operator / API steps lerp over this many seconds (no on-air snap). */
export const WIND_OCEAN_RAMP_SECONDS = 3

/** 6 kt in m/s — amplitude scale is 1.0 here. */
const AMPLITUDE_REF_MS = DEFAULT_WIND_SPEED_KT * KT_TO_MS

export type WindOceanApply = {
  setDirectionRad: (rad: number) => void
  setWindSpeed: (ms: number) => void
  setAmplitudeScale?: (scale: number) => void
}

export type WindOceanDriver = {
  setTarget: (frame: WindFrame, snap?: boolean) => void
  /** Advance the ramp. Honors injected `now`, or `dtSeconds` when `now` is frozen. */
  step: (dtSeconds: number) => void
  getCurrentDirectionRad: () => number
  getCurrentSpeedMs: () => number
}

export type WindOceanDriverOptions = {
  apply: WindOceanApply
  now: () => number
  rampSeconds?: number
}

/**
 * Gerstner travel radians from a scene-XZ unit vector.
 * `θ = 0` → +X; `θ = π/2` → +Z.
 */
export function directionRadFromWindTravel(travel: WindTravelXZ): number {
  return Math.atan2(travel.z, travel.x)
}

/** `directionFromDeg` → `windTravelSceneXZ` → `atan2`. */
export function directionRadFromWindFrame(frame: WindFrame): number {
  return directionRadFromWindTravel(windTravelSceneXZ(frame.directionFromDeg))
}

export function shortestAngleDelta(fromRad: number, toRad: number): number {
  let d = toRad - fromRad
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export function lerpAngle(fromRad: number, toRad: number, t: number): number {
  return fromRad + shortestAngleDelta(fromRad, toRad) * t
}

/**
 * Mild swell-amplitude scale from speed. 1.0 at the venue default (6 kt);
 * clamped so the Gerstner train does not jelly. Not a named preset UI.
 */
export function amplitudeScaleFromSpeedMs(speedMs: number): number {
  const s = Number.isFinite(speedMs) && speedMs > 0 ? speedMs : 0
  const raw = 0.65 + 0.35 * (s / AMPLITUDE_REF_MS)
  return Math.min(1.25, Math.max(0.65, raw))
}

export function createWindOceanDriver(
  options: WindOceanDriverOptions,
): WindOceanDriver {
  const rampMs =
    (options.rampSeconds ?? WIND_OCEAN_RAMP_SECONDS) * 1000
  const apply = options.apply
  const now = options.now

  let lastWall = now()
  let simMs = lastWall
  let initialized = false
  let fromMs = simMs
  let fromDir = 0
  let fromSpeed = 0
  let targetDir = 0
  let targetSpeed = 0
  let currentDir = 0
  let currentSpeed = 0

  function applyCurrent(): void {
    apply.setDirectionRad(currentDir)
    apply.setWindSpeed(currentSpeed)
    apply.setAmplitudeScale?.(amplitudeScaleFromSpeedMs(currentSpeed))
  }

  function sampleClock(dtSeconds: number): void {
    const wall = now()
    if (wall !== lastWall) {
      simMs = wall
      lastWall = wall
    } else if (dtSeconds > 0) {
      simMs += dtSeconds * 1000
    }
  }

  return {
    setTarget(frame: WindFrame, snap = false): void {
      targetDir = directionRadFromWindFrame(frame)
      targetSpeed =
        Number.isFinite(frame.speedMs) && frame.speedMs >= 0 ? frame.speedMs : 0
      if (snap || !initialized) {
        fromDir = targetDir
        fromSpeed = targetSpeed
        currentDir = targetDir
        currentSpeed = targetSpeed
        fromMs = simMs
        initialized = true
        applyCurrent()
        return
      }
      fromDir = currentDir
      fromSpeed = currentSpeed
      fromMs = simMs
    },
    step(dtSeconds: number): void {
      sampleClock(dtSeconds)
      if (!initialized) return
      const t = Math.min(1, Math.max(0, (simMs - fromMs) / Math.max(rampMs, 1)))
      currentDir = lerpAngle(fromDir, targetDir, t)
      currentSpeed = fromSpeed + (targetSpeed - fromSpeed) * t
      applyCurrent()
    },
    getCurrentDirectionRad: () => currentDir,
    getCurrentSpeedMs: () => currentSpeed,
  }
}
