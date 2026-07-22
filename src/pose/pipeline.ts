/**
 * Subscribe to TEL telemetryBus → ENU + midpoint lerp → poseBus.
 * Drives lerp on requestAnimationFrame (or manual tick for tests).
 */

import {
  telemetryBus as defaultTelemetryBus,
  type TelemetryBus,
} from '../telemetry/bus.ts'
import type { BoatTelemetry, TelemetryData } from '../telemetry/types.ts'
import { poseBus as defaultPoseBus, type PoseBus } from './bus.ts'
import { boatRawPose, droneRawPose } from './convert.ts'
import { MidpointLerp } from './lerp.ts'
import type { PoseEvent, PoseKind } from './types.ts'

export type PosePipelineOptions = {
  telemetryBus?: TelemetryBus
  poseBus?: PoseBus
  takeoffAltitudeMSL?: number
  /** Seconds clock; default `performance.now()/1000`. */
  nowSec?: () => number
  /**
   * When true, do not start RAF — call `tick(dtSec)` from tests / host.
   * Default false (browser RAF).
   */
  manualTick?: boolean
}

export type PosePipelineHandle = {
  stop: () => void
  /** Advance lerps and emit (also used by RAF). */
  tick: (dtSec: number) => void
  /** Test/debug: entity ids currently tracked. */
  entityIds: () => string[]
}

type EntityState = {
  kind: PoseKind
  id: string
  ts: number
  /** Latest CAL FOV (not lerped). */
  fovHDeg: number
  lerp: MidpointLerp
}

let running: PosePipelineHandle | null = null

function defaultNowSec(): number {
  return performance.now() / 1000
}

/**
 * Start pose pipeline. Idempotent stop of any prior instance.
 * Caller must have applied config origin + EGM96 before poses matter.
 */
export function startPosePipeline(
  options: PosePipelineOptions = {},
): PosePipelineHandle {
  stopPosePipeline()

  const telBus = options.telemetryBus ?? defaultTelemetryBus
  const outBus = options.poseBus ?? defaultPoseBus
  const takeoffAltitudeMSL = options.takeoffAltitudeMSL ?? 0
  const nowSec = options.nowSec ?? defaultNowSec
  const manualTick = options.manualTick ?? false

  const entities = new Map<string, EntityState>()
  const unsubs: Array<() => void> = []
  let rafId: number | null = null
  let lastFrameSec = nowSec()
  let stopped = false

  function upsert(
    kind: PoseKind,
    id: string,
    ts: number,
    position: { x: number; y: number; z: number },
    rotation: { yawDeg: number; pitchDeg: number; rollDeg: number },
    fovHDeg: number,
  ): void {
    let state = entities.get(id)
    if (!state) {
      state = { kind, id, ts, fovHDeg, lerp: new MidpointLerp() }
      entities.set(id, state)
    }
    state.kind = kind
    state.ts = ts
    state.fovHDeg = fovHDeg
    state.lerp.setTarget(position, rotation, nowSec())
  }

  function onDrone(data: TelemetryData): void {
    const hasGps =
      Math.abs(data.pos.lat) > 0.001 || Math.abs(data.pos.lon) > 0.001
    if (!hasGps) return
    const raw = droneRawPose(data, takeoffAltitudeMSL)
    upsert('drone', data.id, data.ts, raw.position, raw.rotation, raw.fovHDeg)
  }

  function onBoat(data: BoatTelemetry): void {
    const raw = boatRawPose(data)
    upsert('boat', data.id, data.time, raw.position, raw.rotation, raw.fovHDeg)
  }

  function emitEntity(state: EntityState): void {
    const sample = {
      position: state.lerp.currentPos,
      rotation: state.lerp.currentRot,
    }
    const event: PoseEvent = {
      id: state.id,
      kind: state.kind,
      position: { ...sample.position },
      rotation: { ...sample.rotation },
      fovHDeg: state.fovHDeg,
      ts: state.ts,
    }
    outBus.emit('pose', event)
  }

  function tick(dtSec: number): void {
    if (stopped) return
    for (const state of entities.values()) {
      if (!state.lerp.isFirstData) {
        state.lerp.tick(dtSec)
      }
      emitEntity(state)
    }
  }

  function frame(): void {
    if (stopped) return
    const t = nowSec()
    const dt = Math.max(0, Math.min(0.25, t - lastFrameSec))
    lastFrameSec = t
    tick(dt)
    rafId = requestAnimationFrame(frame)
  }

  unsubs.push(telBus.on('drone', onDrone))
  unsubs.push(telBus.on('boat', onBoat))
  // stream_anchor intentionally ignored for ENU

  if (!manualTick && typeof requestAnimationFrame === 'function') {
    lastFrameSec = nowSec()
    rafId = requestAnimationFrame(frame)
  }

  const handle: PosePipelineHandle = {
    stop: () => {
      if (stopped) return
      stopped = true
      for (const u of unsubs) u()
      unsubs.length = 0
      entities.clear()
      if (rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (running === handle) running = null
    },
    tick,
    entityIds: () => [...entities.keys()],
  }

  running = handle
  return handle
}

export function stopPosePipeline(): void {
  running?.stop()
  running = null
}
