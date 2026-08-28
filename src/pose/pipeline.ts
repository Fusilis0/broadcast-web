/**
 * Subscribe to TEL telemetryBus → ENU + midpoint lerp → poseBus.
 * Drives lerp on requestAnimationFrame (or manual tick for tests).
 *
 * Matched mode (`matchClock.enabled`, Phase 17.3/17.4): sample telemetry at the
 * presented frame's NTP instead of lerping toward wall-clock now. Alpha /
 * connecting (no picture, no PTS) keep today's push smoother — do not mix
 * the two on one tick. Video clock + missing LUT **free-runs** (push lerp);
 * unsynced motion beats a frozen world (TEL-03; TEL-10 hold-on-miss is void).
 * `sampleAt` unavailable inside the history hold window re-emits lastMatched
 * (no vanish). Past that window, emit the newest history sample.
 */

import {
  telemetryBus as defaultTelemetryBus,
  type TelemetryBus,
} from '../telemetry/bus.ts'
import {
  flowTap as defaultFlowTap,
  type FlowTap,
} from '../telemetry/flowTap.ts'
import {
  createTelemetryHistory,
  type TelemetryHistory,
} from '../telemetry/telemetryHistory.ts'
import { getPtsNtpMap } from '../telemetry/ptsNtpMap.ts'
import type {
  BoatTelemetry,
  BuoyTelemetry,
  StreamAnchorMessage,
  TelemetryData,
} from '../telemetry/types.ts'
import { poseBus as defaultPoseBus, type PoseBus } from './bus.ts'
import { boatRawPose, droneRawPose } from './convert.ts'
import { MidpointLerp } from './lerp.ts'
import type { EnuPosition, PoseEvent, PoseKind, PoseRotation } from './types.ts'

export type PoseMatchClock = {
  /**
   * When true, matched sampling may engage (typically `arBackground === 'video'`).
   * Default / omitted = always push+lerp (shipped alpha path).
   */
  enabled?: () => boolean
  getActivePovId?: () => string | null
  /** LUT key — SRT id, not telemetry `povId`. */
  getLutStreamId?: (povId: string) => string
  getPresentedPts90k?: (povId: string) => number | null
  /** Per-POV CAL trim. `t_ntp = toNtp(pts) + syncTrimMs`. */
  getSyncTrimMs?: (povId: string) => number
  /** `framesDecoded > 0` — video clock even before PTS is wired. */
  hasPicture?: (povId: string) => boolean
  /** Fleet `srtByPovId`: telemetry POV id → operator SRT catalog id. */
  getSrtIdForTelemId?: (telemId: string) => string | null
  getTelemIdForSrtId?: (srtId: string) => string | null
}

export type PoseSyncBoatRow = {
  id: string
  mode: string
  /** Producer `brg === 0` — held, not walked north. */
  heldBearingUnknown: boolean
}

export type PoseSyncDebug = {
  matched: boolean
  /**
   * TEL-10 LUT-miss freeze. TEL-03 never uses this as a steady state
   * (`toNtp` miss free-runs). Short `sampleAt` hold is `poseMode: 'held'`.
   */
  held: boolean
  /** Push+lerp toward newest, or degraded newest after `sampleAt` unavailable. */
  freeRun: boolean
  poseMode: string | null
  poseAgeMs: number | null
  boats: PoseSyncBoatRow[]
  /** Presented `t_ntp` (PTS → LUT + trim). Null when LUT/`toNtp` is not ready. */
  tNtpMs: number | null
  /** Newest drone NTP in the matched buffer for this POV. */
  newestPoseNtpMs: number | null
  /** `newestPoseNtpMs − tNtpMs`. Negative = video ahead of the pose buffer. */
  poseMinusVideoMs: number | null
  /** Pacing anchors on the LUT used for this POV (SRT id, else telem id). */
  pacingCount: number
}

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
  /**
   * NTP-keyed history. Shared with the video presentation policy
   * (`getNewestPoseNtp`) so adaptive latency sees the matched buffer.
   */
  history?: TelemetryHistory
  matchClock?: PoseMatchClock
  /** SCN-10 inspector ring. Default: shared `flowTap`. */
  flowTap?: FlowTap
}

export type PosePipelineHandle = {
  stop: () => void
  /** Advance lerps and emit (also used by RAF). */
  tick: (dtSec: number) => void
  /** Test/debug: entity ids currently tracked. */
  entityIds: () => string[]
  /** Newest synced drone NTP in the matched buffer (adaptive policy). */
  newestDroneNtp: (id: string) => number | null
  /** Per-POV HUD rows (sampleAt at that stream's presented t_ntp). */
  getSyncPoseDebug: (povId: string) => PoseSyncDebug
  readonly history: TelemetryHistory
}

type EntityState = {
  kind: PoseKind
  id: string
  ts: number
  /** Latest CAL FOV (not lerped). */
  fovHDeg: number
  lerp: MidpointLerp
}

type MatchedRaw = {
  kind: PoseKind
  id: string
  ts: number
  position: EnuPosition
  rotation: PoseRotation
  fovHDeg: number
}

const EMPTY_SYNC_DEBUG: PoseSyncDebug = {
  matched: false,
  held: false,
  freeRun: false,
  poseMode: null,
  poseAgeMs: null,
  boats: [],
  tNtpMs: null,
  newestPoseNtpMs: null,
  poseMinusVideoMs: null,
  pacingCount: 0,
}

let running: PosePipelineHandle | null = null

function defaultNowSec(): number {
  return performance.now() / 1000
}

function hasUsableGps(lat: number, lon: number): boolean {
  return Math.abs(lat) > 0.001 || Math.abs(lon) > 0.001
}

function trimId(raw: string | null | undefined): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : ''
}

/** Producer `dji-1` / `dji1` → Fleet telem/SRT digit id `"1"`. */
function djiDigitAlias(streamId: string): string | null {
  const m = /^dji-?(\d+)$/i.exec(streamId)
  return m?.[1] ?? null
}

function lutToNtp(lutId: string, pts: number, trimMs: number): number | null {
  if (!lutId) return null
  const lut = getPtsNtpMap(lutId)
  if (lut.health().pacingCount === 0) return null
  const mapped = lut.toNtp(pts)
  if (mapped.mode === 'unavailable' || mapped.ntpMs == null) return null
  return mapped.ntpMs + (Number.isFinite(trimMs) ? trimMs : 0)
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
  const history = options.history ?? createTelemetryHistory()
  const clock = options.matchClock
  const tap = options.flowTap ?? defaultFlowTap

  const entities = new Map<string, EntityState>()
  const lastMatched = new Map<string, MatchedRaw>()
  const unsubs: Array<() => void> = []
  let rafId: number | null = null
  let lastFrameSec = nowSec()
  let stopped = false
  let wasMatched = false

  function lutIdFor(povId: string): string {
    return trimId(clock?.getLutStreamId?.(povId))
  }

  function matchEnabled(): boolean {
    return clock?.enabled?.() === true
  }

  function presentedPtsFor(povId: string): number | null {
    const pts = clock?.getPresentedPts90k?.(povId)
    if (pts == null || !Number.isFinite(pts)) return null
    return pts
  }

  function resolveMatchedNtp(povId: string): number | null {
    if (!matchEnabled()) return null
    const pts = presentedPtsFor(povId)
    if (pts == null) return null
    const trim = clock?.getSyncTrimMs?.(povId) ?? 0
    const srtId = lutIdFor(povId)
    const ntpSrt = lutToNtp(srtId, pts, trim)
    if (ntpSrt != null) return ntpSrt
    const ntpTelem = lutToNtp(povId, pts, trim)
    if (ntpTelem != null) return ntpTelem
    return null
  }

  function activeMatchedNtp(): number | null {
    if (!matchEnabled()) return null
    const povId = clock?.getActivePovId?.() ?? null
    if (!povId) return null
    return resolveMatchedNtp(povId)
  }

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

  function holdDroneEnu(
    data: TelemetryData,
    converted: EnuPosition,
  ): EnuPosition {
    if (hasUsableGps(data.pos.lat, data.pos.lon)) return converted
    const matched = lastMatched.get(data.id)
    if (matched) return { ...matched.position }
    const existing = entities.get(data.id)
    if (existing) return { ...existing.lerp.currentPos }
    return { x: 0, y: data.pos.alt, z: 0 }
  }

  function onDrone(data: TelemetryData): void {
    const accepted = history.addDrone(data)
    if (accepted) tap.push({ kind: 'drone', id: data.id, body: data })
    if (activeMatchedNtp() != null) return
    // Always apply attitude (gimbal/rot). Without GPS, do not ENU-project
    // lat/lon 0,0 (would fling the camera) — hold last ENU or park at origin.
    const raw = droneRawPose(data, takeoffAltitudeMSL)
    const position = holdDroneEnu(data, raw.position)
    upsert('drone', data.id, data.ts, position, raw.rotation, raw.fovHDeg)
  }

  function onBoat(data: BoatTelemetry): void {
    const accepted = history.addBoat(data)
    if (accepted) tap.push({ kind: 'boat', id: data.id, body: data })
    if (activeMatchedNtp() != null) return
    const raw = boatRawPose(data)
    upsert('boat', data.id, data.time, raw.position, raw.rotation, raw.fovHDeg)
  }

  /** Buoy uses the same ENU convert as boat (identical wire shape). */
  function onBuoy(data: BuoyTelemetry): void {
    const accepted = history.addBuoy(data)
    if (accepted) tap.push({ kind: 'buoy', id: data.id, body: data })
    if (activeMatchedNtp() != null) return
    const raw = boatRawPose(data)
    upsert('buoy', data.id, data.time, raw.position, raw.rotation, raw.fovHDeg)
  }

  function onAnchor(anchor: StreamAnchorMessage): void {
    const sid = trimId(anchor.stream_id)
    if (!sid) return
    const keys = new Set<string>([sid])
    const srtAlias = trimId(clock?.getSrtIdForTelemId?.(sid) ?? '')
    if (srtAlias) keys.add(srtAlias)
    const telemAlias = trimId(clock?.getTelemIdForSrtId?.(sid) ?? '')
    if (telemAlias) keys.add(telemAlias)
    const djiAlias = djiDigitAlias(sid)
    if (djiAlias) keys.add(djiAlias)
    for (const key of keys) {
      const copy = key === sid ? anchor : { ...anchor, stream_id: key }
      getPtsNtpMap(key).addAnchor(copy)
    }
    tap.push({ kind: 'anchor', id: sid, body: anchor })
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

  function emitMatchedRaw(raw: MatchedRaw): void {
    lastMatched.set(raw.id, raw)
    const event: PoseEvent = {
      id: raw.id,
      kind: raw.kind,
      position: { ...raw.position },
      rotation: { ...raw.rotation },
      fovHDeg: raw.fovHDeg,
      ts: raw.ts,
    }
    outBus.emit('pose', event)
  }

  /**
   * Video NTP slightly ahead of the pose buffer (`sampleAt` null / held)
   * must not drop the entity. Re-emit last matched while still inside the
   * history hold window. Past that window (`unavailable`), emit the newest
   * history sample instead of pinning `lastMatched` forever.
   */
  function emitMatchedOrLast<T extends { quality: { mode: string } }>(
    id: string,
    sample: T | null,
    buildRaw: (sample: T) => MatchedRaw,
    newestSample: () => T | null,
  ): void {
    if (sample && sample.quality.mode !== 'unavailable') {
      emitMatchedRaw(buildRaw(sample))
      return
    }
    if (sample?.quality.mode === 'unavailable') {
      const latest = newestSample()
      if (latest && latest.quality.mode !== 'unavailable') {
        emitMatchedRaw(buildRaw(latest))
        return
      }
      emitMatchedRaw(buildRaw(sample))
      return
    }
    const prev = lastMatched.get(id)
    if (prev) emitMatchedRaw(prev)
  }

  function emitMatched(ntpMs: number): void {
    const stats = history.stats()
    for (const id of Object.keys(stats.drones)) {
      const sample = history.sampleDroneAt(id, ntpMs)
      emitMatchedOrLast(
        id,
        sample,
        (s) => {
          const converted = droneRawPose(s, takeoffAltitudeMSL)
          return {
            kind: 'drone',
            id,
            ts: s.ts,
            position: holdDroneEnu(s, converted.position),
            rotation: converted.rotation,
            fovHDeg: converted.fovHDeg,
          }
        },
        () => {
          const newest = history.stats().drones[id]?.newestNtpMs
          return newest != null ? history.sampleDroneAt(id, newest) : null
        },
      )
    }
    for (const id of Object.keys(stats.boats)) {
      const sample = history.sampleBoatAt(id, ntpMs)
      emitMatchedOrLast(
        id,
        sample,
        (s) => {
          const converted = boatRawPose(s)
          return {
            kind: 'boat',
            id,
            ts: s.time,
            position: converted.position,
            rotation: converted.rotation,
            fovHDeg: converted.fovHDeg,
          }
        },
        () => {
          const newest = history.stats().boats[id]?.newestNtpMs
          return newest != null ? history.sampleBoatAt(id, newest) : null
        },
      )
    }
    for (const id of Object.keys(stats.buoys)) {
      const sample = history.sampleBuoyAt(id, ntpMs)
      emitMatchedOrLast(
        id,
        sample,
        (s) => {
          const converted = boatRawPose(s)
          return {
            kind: 'buoy',
            id,
            ts: s.time,
            position: converted.position,
            rotation: converted.rotation,
            fovHDeg: converted.fovHDeg,
          }
        },
        () => {
          const newest = history.stats().buoys[id]?.newestNtpMs
          return newest != null ? history.sampleBuoyAt(id, newest) : null
        },
      )
    }
  }

  function seedLerpFromMatched(): void {
    for (const raw of lastMatched.values()) {
      upsert(
        raw.kind,
        raw.id,
        raw.ts,
        raw.position,
        raw.rotation,
        raw.fovHDeg,
      )
    }
  }

  /** History packets that arrived during matched sampling were never upserted. */
  function seedLerpFromHistoryNewest(): void {
    const stats = history.stats()
    for (const id of Object.keys(stats.drones)) {
      const ntp = stats.drones[id]?.newestNtpMs
      if (ntp == null) continue
      const s = history.sampleDroneAt(id, ntp)
      if (!s) continue
      const converted = droneRawPose(s, takeoffAltitudeMSL)
      upsert(
        'drone',
        id,
        s.ts,
        holdDroneEnu(s, converted.position),
        converted.rotation,
        converted.fovHDeg,
      )
    }
    for (const id of Object.keys(stats.boats)) {
      const ntp = stats.boats[id]?.newestNtpMs
      if (ntp == null) continue
      const s = history.sampleBoatAt(id, ntp)
      if (!s) continue
      const converted = boatRawPose(s)
      upsert('boat', id, s.time, converted.position, converted.rotation, converted.fovHDeg)
    }
    for (const id of Object.keys(stats.buoys)) {
      const ntp = stats.buoys[id]?.newestNtpMs
      if (ntp == null) continue
      const s = history.sampleBuoyAt(id, ntp)
      if (!s) continue
      const converted = boatRawPose(s)
      upsert('buoy', id, s.time, converted.position, converted.rotation, converted.fovHDeg)
    }
  }

  function tick(dtSec: number): void {
    if (stopped) return
    const matchedNtp = activeMatchedNtp()
    if (matchedNtp != null) {
      emitMatched(matchedNtp)
      wasMatched = true
      return
    }
    if (wasMatched) {
      seedLerpFromMatched()
      seedLerpFromHistoryNewest()
      wasMatched = false
    }
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

  function newestDroneNtp(id: string): number | null {
    return history.stats().drones[id]?.newestNtpMs ?? null
  }

  /** Same LUT preference as `resolveMatchedNtp`: SRT id first, then telem `povId`. */
  function pacingCountFor(povId: string): number {
    const srtId = lutIdFor(povId)
    if (srtId) {
      const n = getPtsNtpMap(srtId).health().pacingCount
      if (n > 0) return n
    }
    return getPtsNtpMap(povId).health().pacingCount
  }

  function syncClockFields(povId: string, tNtpMs: number | null) {
    const newestPoseNtpMs = history.stats().drones[povId]?.newestNtpMs ?? null
    const poseMinusVideoMs =
      tNtpMs != null && newestPoseNtpMs != null ? newestPoseNtpMs - tNtpMs : null
    return {
      tNtpMs,
      newestPoseNtpMs,
      poseMinusVideoMs,
      pacingCount: pacingCountFor(povId),
    }
  }

  function getSyncPoseDebug(povId: string): PoseSyncDebug {
    const ntp = resolveMatchedNtp(povId)
    const clockFields = syncClockFields(povId, ntp)
    if (ntp != null) {
      const drone = history.sampleDroneAt(povId, ntp)
      const pastHold = drone?.quality.mode === 'unavailable'
      const boats: PoseSyncBoatRow[] = []
      for (const id of Object.keys(history.stats().boats)) {
        const sample = history.sampleBoatAt(id, ntp)
        if (!sample) continue
        boats.push({
          id,
          mode: sample.quality.mode,
          heldBearingUnknown: sample.brg === 0,
        })
      }
      return {
        matched: !pastHold,
        held: false,
        freeRun: pastHold,
        poseMode: drone?.quality.mode ?? null,
        poseAgeMs: drone?.quality.sourceAgeMs ?? null,
        boats,
        ...clockFields,
      }
    }
    if (matchEnabled()) {
      return {
        ...EMPTY_SYNC_DEBUG,
        ...clockFields,
        freeRun: true,
      }
    }
    return { ...EMPTY_SYNC_DEBUG, ...clockFields }
  }

  unsubs.push(telBus.on('drone', onDrone))
  unsubs.push(telBus.on('boat', onBoat))
  unsubs.push(telBus.on('buoy', onBuoy))
  unsubs.push(telBus.on('stream_anchor', onAnchor))

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
      lastMatched.clear()
      if (rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (running === handle) running = null
    },
    tick,
    entityIds: () => {
      const ids = new Set<string>([...entities.keys(), ...lastMatched.keys()])
      return [...ids]
    },
    newestDroneNtp,
    getSyncPoseDebug,
    history,
  }

  running = handle
  return handle
}

export function stopPosePipeline(): void {
  running?.stop()
  running = null
}
