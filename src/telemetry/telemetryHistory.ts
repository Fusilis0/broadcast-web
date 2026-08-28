import type {
  BoatTelemetry,
  BuoyTelemetry,
  TelemetryData,
  TelemetryPosition,
  TelemetryQuaternion,
  TelemetryVelocity,
} from './types.ts'

/** Sliding window depth. Matches Phase 17 ~30 s ring. */
export const DEFAULT_HISTORY_WINDOW_MS = 30_000
/**
 * Hard cap per entity. 10 Hz × 30 s = 300; headroom for bursts / clustered stamps.
 * Window is the usual bound; this stops unbounded growth if timestamps stall.
 */
export const DEFAULT_MAX_SAMPLES_PER_ENTITY = 512
/** Drone vel-based forward projection past the newest pose (§4.b). */
export const DEFAULT_EXTRAPOLATE_MS = 150
/**
 * After the extrapolate window, hold the last drone pose until this age, then
 * `unavailable`. 2000 ms matches the producer dropping SDK pose stale > 2 s.
 */
export const DEFAULT_HOLD_MS = 2_000
/** Do not lerp drone pose across a gap many times the 10 Hz period without `degraded`. */
export const DEFAULT_DRONE_GAP_DEGRADED_MS = 500
/** Boat GPS in motion is ~0.5–2 Hz; flag gaps well beyond that. */
export const DEFAULT_BOAT_GAP_DEGRADED_MS = 2_000
/**
 * Boat still-holes run ~6.3 s in the reference archive. Hold (do not mark
 * `unavailable`) across that, with margin.
 */
export const DEFAULT_BOAT_HOLD_MS = 10_000
/** Skip boat DR when wire `fix_age_ms` is large (§4.d). `0` means unknown, not perfect. */
export const DEFAULT_FIX_AGE_SKIP_DR_MS = 200
/** gps_111 zeros bearing at or below this speed when course is untrusted. */
export const BOAT_STILL_SPD_MPS = 0.3
/** DJI `estimatedErrorMs()` when not NTP-locked. */
export const DJI_NTP_ERR_UNSYNCED = 2_147_483_647
/** gps_111 `t_err` when not NTP-locked (unlike DJI's Int.MAX_VALUE). */
export const BOAT_T_ERR_UNSYNCED = -1
/** WGS84 equatorial radius (m). Used only for lat/lon steps — not GEO ENU. */
const WGS84_A_M = 6_378_137
const DEG = 180 / Math.PI

export type SampleMode = 'interpolated' | 'extrapolated' | 'held' | 'unavailable'

export type SampleQuality = {
  mode: SampleMode
  /** `ntpMs − A.ntp` of the last fix at or before `t`. */
  sourceAgeMs: number
  degraded: boolean
}

/** DTO-shaped drone pose at `t`, plus a quality badge TEL-08 / ops can read. */
export type DroneSample = TelemetryData & { quality: SampleQuality }
/** DTO-shaped boat (or buoy) GPS at `t`, plus quality. */
export type BoatSample = BoatTelemetry & { quality: SampleQuality }

export type EntityHistoryStats = {
  count: number
  oldestNtpMs: number | null
  newestNtpMs: number | null
  lastGapMs: number | null
}

export type TelemetryHistoryStats = {
  drones: Record<string, EntityHistoryStats>
  boats: Record<string, EntityHistoryStats>
  buoys: Record<string, EntityHistoryStats>
}

export type TelemetryHistoryOptions = {
  windowMs?: number
  maxSamplesPerEntity?: number
  extrapolateMs?: number
  holdMs?: number
  boatHoldMs?: number
  droneGapDegradedMs?: number
  boatGapDegradedMs?: number
  fixAgeSkipDrMs?: number
}

export type TelemetryHistory = {
  addDrone(packet: TelemetryData): boolean
  addBoat(packet: BoatTelemetry): boolean
  addBuoy(packet: BuoyTelemetry): boolean
  sampleDroneAt(id: string, ntpMs: number): DroneSample | null
  sampleBoatAt(id: string, ntpMs: number): BoatSample | null
  sampleBuoyAt(id: string, ntpMs: number): BoatSample | null
  prune(nowNtpMs?: number): void
  reset(): void
  stats(): TelemetryHistoryStats
}

type Stored<T> = {
  ntpMs: number
  packet: T
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

function wrapDeg(deg: number): number {
  const m = deg % 360
  return m < 0 ? m + 360 : m
}

/** Shortest signed delta in (−180, 180]. JS `%` is remainder — double-mod for negatives. */
export function shortestDegDelta(fromDeg: number, toDeg: number): number {
  return (((toDeg - fromDeg) % 360) + 540) % 360 - 180
}

function lerpYaw(fromDeg: number, toDeg: number, u: number): number {
  return wrapDeg(fromDeg + shortestDegDelta(fromDeg, toDeg) * u)
}

/** Cubic Hermite basis on u ∈ [0, 1]. m0/m1 are d(p)/du (endpoint tangents). */
export function hermite(p0: number, m0: number, p1: number, m1: number, u: number): number {
  const u2 = u * u
  const u3 = u2 * u
  const h00 = 2 * u3 - 3 * u2 + 1
  const h10 = u3 - 2 * u2 + u
  const h01 = -2 * u3 + 3 * u2
  const h11 = u3 - u2
  return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1
}

function hasUsableVel(vel: TelemetryVelocity | undefined): boolean {
  return isFiniteNumber(vel?.x) && isFiniteNumber(vel?.y) && isFiniteNumber(vel?.z)
}

/**
 * NED vel → rates in the interpolant's lat/lon/alt units (deg/s, deg/s, m/s up).
 * `vel.z` is down, so altitude rate is −z.
 */
function nedToLlAltRates(
  latDeg: number,
  vel: TelemetryVelocity,
): { dLat: number; dLon: number; dAlt: number } {
  const dLat = (vel.x / WGS84_A_M) * DEG
  const cosLat = Math.cos((latDeg * Math.PI) / 180)
  const dLon = Math.abs(cosLat) < 1e-12 ? 0 : (vel.y / (WGS84_A_M * cosLat)) * DEG
  return { dLat, dLon, dAlt: -vel.z }
}

/**
 * C1 lat/lon/alt from NED vel at both ends. Tangents are scaled by span so u∈[0,1].
 * When vel matches the chord (constant velocity), this is identical to linear lerp.
 */
function hermiteLatLonAlt(
  aPos: TelemetryPosition,
  aVel: TelemetryVelocity,
  bPos: TelemetryPosition,
  bVel: TelemetryVelocity,
  u: number,
  spanSec: number,
): TelemetryPosition {
  const aRates = nedToLlAltRates(aPos.lat, aVel)
  const bRates = nedToLlAltRates(bPos.lat, bVel)
  const t = spanSec
  return {
    lat: hermite(aPos.lat, aRates.dLat * t, bPos.lat, bRates.dLat * t, u),
    lon: hermite(aPos.lon, aRates.dLon * t, bPos.lon, bRates.dLon * t, u),
    alt: hermite(aPos.alt, aRates.dAlt * t, bPos.alt, bRates.dAlt * t, u),
  }
}

function lerpLatLonAlt(aPos: TelemetryPosition, bPos: TelemetryPosition, u: number): TelemetryPosition {
  return {
    lat: lerp(aPos.lat, bPos.lat, u),
    lon: lerp(aPos.lon, bPos.lon, u),
    alt: lerp(aPos.alt, bPos.alt, u),
  }
}

/** Ground NED from boat `spd`/`brg`. Null when the TEL-02 DR gate would refuse. */
function boatNedVel(packet: BoatTelemetry): TelemetryVelocity | null {
  if (!isFiniteNumber(packet.spd) || !isFiniteNumber(packet.brg)) return null
  if (packet.spd < BOAT_STILL_SPD_MPS) return null
  if (packet.brg === 0) return null
  const br = (packet.brg * Math.PI) / 180
  return { x: packet.spd * Math.cos(br), y: packet.spd * Math.sin(br), z: 0 }
}

const QUAT_SLERP_EPS = 1e-12
const QUAT_LERP_DOT = 0.9995

function slerpXyzw(
  ax: number,
  ay: number,
  az: number,
  aw: number,
  bx: number,
  by: number,
  bz: number,
  bw: number,
  u: number,
): { x: number; y: number; z: number; w: number } {
  const na = Math.hypot(ax, ay, az, aw)
  const nb = Math.hypot(bx, by, bz, bw)
  if (na < QUAT_SLERP_EPS || nb < QUAT_SLERP_EPS) {
    return u < 0.5 ? { x: ax, y: ay, z: az, w: aw } : { x: bx, y: by, z: bz, w: bw }
  }
  ax /= na
  ay /= na
  az /= na
  aw /= na
  bx /= nb
  by /= nb
  bz /= nb
  bw /= nb
  let dot = ax * bx + ay * by + az * bz + aw * bw
  if (dot < 0) {
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
    dot = -dot
  }
  if (dot > QUAT_LERP_DOT) {
    const x = lerp(ax, bx, u)
    const y = lerp(ay, by, u)
    const z = lerp(az, bz, u)
    const w = lerp(aw, bw, u)
    const n = Math.hypot(x, y, z, w) || 1
    return { x: x / n, y: y / n, z: z / n, w: w / n }
  }
  const theta = Math.acos(Math.min(1, dot))
  const s = Math.sin(theta)
  const wa = Math.sin((1 - u) * theta) / s
  const wb = Math.sin(u * theta) / s
  return {
    x: wa * ax + wb * bx,
    y: wa * ay + wb * by,
    z: wa * az + wb * bz,
    w: wa * aw + wb * bw,
  }
}

/** Shortest-path Euler + xyzw slerp. Does not snap xyzw to the nearer sample. */
function lerpQuat(a: TelemetryQuaternion, b: TelemetryQuaternion, u: number): TelemetryQuaternion {
  const q = slerpXyzw(a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, u)
  return {
    x: q.x,
    y: q.y,
    z: q.z,
    w: q.w,
    yaw: lerpYaw(a.yaw, b.yaw, u),
    pitch: lerp(a.pitch, b.pitch, u),
    roll: lerp(a.roll, b.roll, u),
  }
}

/**
 * Offset WGS84 lat/lon by a **north/east** metre step (spherical).
 *
 * Drone `vel` is NED (x north, y east, z down) per `ntp-matching.md` §2.1.
 * This helper stays in lat/lon; it does **not** convert to ENU — that is
 * `droneRawPose` / GEO's job.
 */
export function offsetLatLon(
  lat: number,
  lon: number,
  northM: number,
  eastM: number,
): { lat: number; lon: number } {
  const latRad = (lat * Math.PI) / 180
  const dLat = (northM / WGS84_A_M) * DEG
  const cosLat = Math.cos(latRad)
  const dLon = Math.abs(cosLat) < 1e-12 ? 0 : (eastM / (WGS84_A_M * cosLat)) * DEG
  return { lat: lat + dLat, lon: lon + dLon }
}

function emptyQuat(): TelemetryQuaternion {
  return { x: 0, y: 0, z: 0, w: 1, yaw: 0, pitch: 0, roll: 0 }
}

/** Missing / non-finite GPS is stored as 0,0 — converters must not GEO-project it. */
export function hasUsableGps(lat: number, lon: number): boolean {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lon) &&
    (Math.abs(lat) > 0.001 || Math.abs(lon) > 0.001)
  )
}

function defaultPos(pos: TelemetryData['pos'] | undefined): TelemetryPosition {
  return {
    lat: isFiniteNumber(pos?.lat) ? pos.lat : 0,
    lon: isFiniteNumber(pos?.lon) ? pos.lon : 0,
    alt: isFiniteNumber(pos?.alt) ? pos.alt : 0,
  }
}

function cloneDrone(packet: TelemetryData): TelemetryData {
  return {
    ...packet,
    pos: defaultPos(packet.pos),
    rot: packet.rot ? { ...packet.rot } : emptyQuat(),
    gimbal: packet.gimbal ? { ...packet.gimbal } : emptyQuat(),
    vel: packet.vel ? { ...packet.vel } : { x: 0, y: 0, z: 0 },
    cam: packet.cam ? { ...packet.cam } : { fov: 0 },
    meta: packet.meta ? { ...packet.meta } : { bat: 0, sat: 0, sig: 0 },
  }
}

function cloneBoat(packet: BoatTelemetry): BoatTelemetry {
  return { ...packet }
}

function readFixAgeMs(packet: BoatTelemetry): number | undefined {
  const raw = (packet as BoatTelemetry & { fix_age_ms?: unknown }).fix_age_ms
  return isFiniteNumber(raw) ? raw : undefined
}

function droneGated(packet: TelemetryData): boolean {
  return packet.ntp_synced !== true || packet.ntp_err_ms === DJI_NTP_ERR_UNSYNCED
}

function droneNtpDegraded(packet: TelemetryData): boolean {
  return droneGated(packet)
}

function lastUsableDronePos(
  samples: Stored<TelemetryData>[],
  atOrBeforeIndex: number,
): TelemetryPosition {
  for (let i = atOrBeforeIndex; i >= 0; i--) {
    const pos = samples[i]!.packet.pos
    if (hasUsableGps(pos.lat, pos.lon)) return { ...pos }
  }
  return defaultPos(samples[atOrBeforeIndex]?.packet.pos)
}

function fillBoatGps(packet: BoatTelemetry, previous: BoatTelemetry | undefined): BoatTelemetry {
  const cloned = cloneBoat(packet)
  if (!isFiniteNumber(cloned.lat)) cloned.lat = 0
  if (!isFiniteNumber(cloned.lon)) cloned.lon = 0
  if (
    !hasUsableGps(cloned.lat, cloned.lon) &&
    previous &&
    hasUsableGps(previous.lat, previous.lon)
  ) {
    cloned.lat = previous.lat
    cloned.lon = previous.lon
  }
  if (!isFiniteNumber(cloned.alt)) {
    cloned.alt = previous && isFiniteNumber(previous.alt) ? previous.alt : 0
  }
  return cloned
}

function boatGated(packet: BoatTelemetry): boolean {
  return packet.t_sync !== true || packet.t_err === BOAT_T_ERR_UNSYNCED
}

/** Store on identity + NTP stamp. GPS and ntp_synced are not required. */
function droneStoreable(packet: TelemetryData): boolean {
  return typeof packet.id === 'string' && packet.id.length > 0 && isFiniteNumber(packet.ts)
}

/** Store on identity + `time`. Missing lat/lon is filled from the last usable fix. */
function boatStoreable(packet: BoatTelemetry): boolean {
  return (
    typeof packet.id === 'string' &&
    packet.id.length > 0 &&
    isFiniteNumber(packet.time) &&
    !boatGated(packet)
  )
}

function lowerBound<T>(samples: Stored<T>[], ntpMs: number): number {
  let lo = 0
  let hi = samples.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (samples[mid]!.ntpMs < ntpMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

function lastAtOrBefore<T>(samples: Stored<T>[], ntpMs: number): number {
  const i = lowerBound(samples, ntpMs)
  if (i < samples.length && samples[i]!.ntpMs === ntpMs) return i
  return i - 1
}

function trim<T>(samples: Stored<T>[], newestNtpMs: number, windowMs: number, maxSamples: number): void {
  const cutoff = newestNtpMs - windowMs
  while (samples.length > 0 && samples[0]!.ntpMs < cutoff) samples.shift()
  while (samples.length > maxSamples) samples.shift()
}

function insert<T>(
  samples: Stored<T>[],
  ntpMs: number,
  packet: T,
  windowMs: number,
  maxSamples: number,
): boolean {
  const newest = samples.length > 0 ? samples[samples.length - 1]!.ntpMs : ntpMs
  const cutoff = Math.max(newest, ntpMs) - windowMs
  if (samples.length > 0 && ntpMs < cutoff) return false

  const i = lowerBound(samples, ntpMs)
  const row: Stored<T> = { ntpMs, packet }
  if (i < samples.length && samples[i]!.ntpMs === ntpMs) {
    samples[i] = row
  } else {
    samples.splice(i, 0, row)
  }
  const newNewest = samples[samples.length - 1]!.ntpMs
  trim(samples, newNewest, windowMs, maxSamples)
  return true
}

function entityStats<T>(samples: Stored<T>[]): EntityHistoryStats {
  if (samples.length === 0) {
    return { count: 0, oldestNtpMs: null, newestNtpMs: null, lastGapMs: null }
  }
  const oldest = samples[0]!.ntpMs
  const newest = samples[samples.length - 1]!.ntpMs
  const prev = samples.length >= 2 ? samples[samples.length - 2]!.ntpMs : null
  return {
    count: samples.length,
    oldestNtpMs: oldest,
    newestNtpMs: newest,
    lastGapMs: prev === null ? null : newest - prev,
  }
}

function statsMap<T>(byId: Map<string, Stored<T>[]>): Record<string, EntityHistoryStats> {
  const out: Record<string, EntityHistoryStats> = {}
  for (const [id, samples] of byId) {
    if (samples.length === 0) continue
    out[id] = entityStats(samples)
  }
  return out
}

function nearer<T>(a: Stored<T>, b: Stored<T>, ntpMs: number): Stored<T> {
  return Math.abs(ntpMs - a.ntpMs) <= Math.abs(b.ntpMs - ntpMs) ? a : b
}

function canDeadReckon(packet: BoatTelemetry, fixAgeMs: number | undefined, fixAgeSkipDrMs: number): boolean {
  if (!hasUsableGps(packet.lat, packet.lon)) return false
  if (!isFiniteNumber(packet.spd) || !isFiniteNumber(packet.brg)) return false
  if (packet.spd < BOAT_STILL_SPD_MPS) return false
  // Producer forces brg to 0 to mean "bearing unknown", not due north.
  if (packet.brg === 0) return false
  if (fixAgeMs !== undefined && fixAgeMs !== 0 && fixAgeMs > fixAgeSkipDrMs) return false
  return true
}

function projectBoat(packet: BoatTelemetry, dtSec: number): { lat: number; lon: number } {
  const dist = packet.spd * dtSec
  const br = (packet.brg * Math.PI) / 180
  const north = dist * Math.cos(br)
  const east = dist * Math.sin(br)
  return offsetLatLon(packet.lat, packet.lon, north, east)
}

function projectDrone(packet: TelemetryData, dtSec: number): TelemetryData['pos'] {
  const vel = packet.vel
  const north = (vel?.x ?? 0) * dtSec
  const east = (vel?.y ?? 0) * dtSec
  const down = (vel?.z ?? 0) * dtSec
  const ll = offsetLatLon(packet.pos.lat, packet.pos.lon, north, east)
  return { lat: ll.lat, lon: ll.lon, alt: packet.pos.alt - down }
}

/**
 * NTP-keyed ring buffer + sampler. Pure: no bus, no ENU, no timers.
 *
 * Answers: where was this entity at NTP instant `t`? Returns interpolated
 * **DTO-shaped** values so existing converters (`droneRawPose` / `boatRawPose`)
 * stay the geodesy boundary. Between A and B, drone lat/lon/alt is cubic
 * Hermite from NED `vel` (linear if either vel is unusable). Attitude is
 * shortest-path Euler + xyzw slerp. Cubic does **not** extend the 150 ms
 * extrapolate window past the newest sample.
 */
export function createTelemetryHistory(options: TelemetryHistoryOptions = {}): TelemetryHistory {
  const windowMs = options.windowMs ?? DEFAULT_HISTORY_WINDOW_MS
  const maxSamples = options.maxSamplesPerEntity ?? DEFAULT_MAX_SAMPLES_PER_ENTITY
  const extrapolateMs = options.extrapolateMs ?? DEFAULT_EXTRAPOLATE_MS
  const holdMs = options.holdMs ?? DEFAULT_HOLD_MS
  const boatHoldMs = options.boatHoldMs ?? DEFAULT_BOAT_HOLD_MS
  const droneGapDegradedMs = options.droneGapDegradedMs ?? DEFAULT_DRONE_GAP_DEGRADED_MS
  const boatGapDegradedMs = options.boatGapDegradedMs ?? DEFAULT_BOAT_GAP_DEGRADED_MS
  const fixAgeSkipDrMs = options.fixAgeSkipDrMs ?? DEFAULT_FIX_AGE_SKIP_DR_MS

  const drones = new Map<string, Stored<TelemetryData>[]>()
  const boats = new Map<string, Stored<BoatTelemetry>[]>()
  const buoys = new Map<string, Stored<BoatTelemetry>[]>()
  const boatFixAge = new Map<string, Map<number, number | undefined>>()

  function bucket<T>(map: Map<string, Stored<T>[]>, id: string): Stored<T>[] {
    let samples = map.get(id)
    if (!samples) {
      samples = []
      map.set(id, samples)
    }
    return samples
  }

  function rememberFixAge(kind: 'boat' | 'buoy', id: string, ntpMs: number, age: number | undefined): void {
    const key = `${kind}:${id}`
    let inner = boatFixAge.get(key)
    if (!inner) {
      inner = new Map()
      boatFixAge.set(key, inner)
    }
    inner.set(ntpMs, age)
  }

  function readStoredFixAge(kind: 'boat' | 'buoy', id: string, ntpMs: number): number | undefined {
    return boatFixAge.get(`${kind}:${id}`)?.get(ntpMs)
  }

  function pruneFixAge(kind: 'boat' | 'buoy', id: string, samples: Stored<BoatTelemetry>[]): void {
    const key = `${kind}:${id}`
    const inner = boatFixAge.get(key)
    if (!inner) return
    const keep = new Set(samples.map((s) => s.ntpMs))
    for (const ntp of inner.keys()) {
      if (!keep.has(ntp)) inner.delete(ntp)
    }
    if (inner.size === 0) boatFixAge.delete(key)
  }

  function addTimed<T>(
    map: Map<string, Stored<T>[]>,
    id: string,
    ntpMs: number,
    packet: T,
  ): boolean {
    return insert(bucket(map, id), ntpMs, packet, windowMs, maxSamples)
  }

  function sampleDroneAt(id: string, ntpMs: number): DroneSample | null {
    if (!isFiniteNumber(ntpMs)) return null
    const samples = drones.get(id)
    if (!samples || samples.length === 0) return null
    const aIndex = lastAtOrBefore(samples, ntpMs)
    if (aIndex < 0) return null
    const a = samples[aIndex]!
    const b = aIndex + 1 < samples.length ? samples[aIndex + 1]! : undefined
    const sourceAgeMs = ntpMs - a.ntpMs

    if (b) {
      const span = b.ntpMs - a.ntpMs
      const u = span <= 0 ? 0 : (ntpMs - a.ntpMs) / span
      const pick = nearer(a, b, ntpMs).packet
      const data = cloneDrone(pick)
      data.ts = ntpMs
      data.id = id
      data.ntp_synced = true
      const aGps = hasUsableGps(a.packet.pos.lat, a.packet.pos.lon)
      const bGps = hasUsableGps(b.packet.pos.lat, b.packet.pos.lon)
      if (aGps && bGps) {
        const spanSec = span / 1000
        const useHermite = hasUsableVel(a.packet.vel) && hasUsableVel(b.packet.vel) && spanSec > 0
        data.pos = useHermite
          ? hermiteLatLonAlt(a.packet.pos, a.packet.vel, b.packet.pos, b.packet.vel, u, spanSec)
          : lerpLatLonAlt(a.packet.pos, b.packet.pos, u)
      } else {
        data.pos = lastUsableDronePos(samples, aIndex)
      }
      data.rot = lerpQuat(a.packet.rot, b.packet.rot, u)
      data.gimbal = lerpQuat(a.packet.gimbal, b.packet.gimbal, u)
      data.vel = {
        x: lerp(a.packet.vel.x, b.packet.vel.x, u),
        y: lerp(a.packet.vel.y, b.packet.vel.y, u),
        z: lerp(a.packet.vel.z, b.packet.vel.z, u),
      }
      data.cam = { fov: lerp(a.packet.cam.fov, b.packet.cam.fov, u) }
      return {
        ...data,
        quality: {
          mode: 'interpolated',
          sourceAgeMs,
          degraded:
            span > droneGapDegradedMs ||
            droneNtpDegraded(a.packet) ||
            droneNtpDegraded(b.packet),
        },
      }
    }

    let mode: SampleMode
    let degraded: boolean
    if (sourceAgeMs <= 0) {
      mode = 'interpolated'
      degraded = false
    } else if (sourceAgeMs <= extrapolateMs) {
      mode = 'extrapolated'
      degraded = false
    } else if (sourceAgeMs <= holdMs) {
      mode = 'held'
      degraded = true
    } else {
      mode = 'unavailable'
      degraded = true
    }

    const data = cloneDrone(a.packet)
    data.ts = ntpMs
    if (mode === 'extrapolated' && hasUsableGps(a.packet.pos.lat, a.packet.pos.lon)) {
      data.pos = projectDrone(a.packet, sourceAgeMs / 1000)
    } else if (!hasUsableGps(data.pos.lat, data.pos.lon)) {
      data.pos = lastUsableDronePos(samples, aIndex)
    }
    if (droneNtpDegraded(a.packet)) degraded = true
    return { ...data, quality: { mode, sourceAgeMs, degraded } }
  }

  function sampleBoatLike(
    map: Map<string, Stored<BoatTelemetry>[]>,
    kind: 'boat' | 'buoy',
    id: string,
    ntpMs: number,
  ): BoatSample | null {
    if (!isFiniteNumber(ntpMs)) return null
    const samples = map.get(id)
    if (!samples || samples.length === 0) return null
    const aIndex = lastAtOrBefore(samples, ntpMs)
    if (aIndex < 0) return null
    const a = samples[aIndex]!
    const b = aIndex + 1 < samples.length ? samples[aIndex + 1]! : undefined
    const sourceAgeMs = ntpMs - a.ntpMs
    const fixAge = readStoredFixAge(kind, id, a.ntpMs)
    const still = isFiniteNumber(a.packet.spd) && a.packet.spd < BOAT_STILL_SPD_MPS
    const doDr = canDeadReckon(a.packet, fixAge, fixAgeSkipDrMs)
    const spanToB = b ? b.ntpMs - a.ntpMs : 0
    const u = b && spanToB > 0 ? Math.min(1, Math.max(0, (ntpMs - a.ntpMs) / spanToB)) : 0

    const packet = cloneBoat(b && u >= 0.5 ? b.packet : a.packet)
    packet.id = id
    packet.time = ntpMs
    packet.t_sync = true

    let mode: SampleMode
    let degraded = false
    let lat = a.packet.lat
    let lon = a.packet.lon
    let alt = isFiniteNumber(a.packet.alt) ? a.packet.alt : 0

    if (b && ntpMs <= b.ntpMs) {
      const geoAlt = lerp(
        isFiniteNumber(a.packet.alt) ? a.packet.alt : 0,
        isFiniteNumber(b.packet.alt) ? b.packet.alt : 0,
        u,
      )
      const doDrB = canDeadReckon(b.packet, readStoredFixAge(kind, id, b.ntpMs), fixAgeSkipDrMs)
      const aVel = boatNedVel(a.packet)
      const bVel = boatNedVel(b.packet)
      const bGps = hasUsableGps(b.packet.lat, b.packet.lon)
      if (doDr && doDrB && aVel && bVel && bGps && spanToB > 0) {
        const pos = hermiteLatLonAlt(
          { lat: a.packet.lat, lon: a.packet.lon, alt },
          aVel,
          { lat: b.packet.lat, lon: b.packet.lon, alt: isFiniteNumber(b.packet.alt) ? b.packet.alt : 0 },
          bVel,
          u,
          spanToB / 1000,
        )
        lat = pos.lat
        lon = pos.lon
        alt = geoAlt
        mode = 'interpolated'
      } else if (doDr) {
        const dr = projectBoat(a.packet, sourceAgeMs / 1000)
        // Blend DR toward B so the projection cannot finish past B as t → B.time.
        lat = lerp(dr.lat, b.packet.lat, u)
        lon = lerp(dr.lon, b.packet.lon, u)
        alt = geoAlt
        mode = 'interpolated'
      } else if (still || a.packet.brg === 0) {
        // Never wait for B, never project through unknown/still course — hold A.
        lat = a.packet.lat
        lon = a.packet.lon
        alt = isFiniteNumber(a.packet.alt) ? a.packet.alt : geoAlt
        mode = 'held'
        degraded = a.packet.brg === 0 && !still
      } else {
        lat = a.packet.lat
        lon = a.packet.lon
        mode = 'held'
        degraded = true
      }
      packet.spd = lerp(a.packet.spd, b.packet.spd, u)
      packet.brg = doDr ? lerpYaw(a.packet.brg, b.packet.brg, u) : a.packet.brg
      packet.acc = lerp(a.packet.acc, b.packet.acc, u)
      if (spanToB > boatGapDegradedMs && !still) degraded = true
    } else {
      const ageLimit = boatHoldMs
      if (doDr && sourceAgeMs <= ageLimit) {
        const dr = projectBoat(a.packet, sourceAgeMs / 1000)
        lat = dr.lat
        lon = dr.lon
        mode = sourceAgeMs <= 0 ? 'interpolated' : 'extrapolated'
        degraded = sourceAgeMs > boatGapDegradedMs
      } else if (sourceAgeMs <= 0) {
        mode = 'interpolated'
        degraded = false
      } else if (sourceAgeMs <= ageLimit) {
        mode = 'held'
        degraded = !(still || sourceAgeMs <= boatGapDegradedMs)
        if (a.packet.brg === 0 && !still) degraded = true
        if (fixAge !== undefined && fixAge !== 0 && fixAge > fixAgeSkipDrMs) degraded = true
      } else {
        mode = 'unavailable'
        degraded = true
      }
    }

    packet.lat = lat
    packet.lon = lon
    packet.alt = alt
    return { ...packet, quality: { mode, sourceAgeMs, degraded } }
  }

  function pruneMap<T>(map: Map<string, Stored<T>[]>, nowNtpMs: number | undefined): void {
    for (const [id, samples] of map) {
      const newest =
        nowNtpMs ?? (samples.length > 0 ? samples[samples.length - 1]!.ntpMs : undefined)
      if (newest === undefined) continue
      trim(samples, newest, windowMs, maxSamples)
      if (samples.length === 0) map.delete(id)
    }
  }

  return {
    addDrone(packet) {
      if (!droneStoreable(packet)) return false
      return addTimed(drones, packet.id, packet.ts, cloneDrone(packet))
    },
    addBoat(packet) {
      if (!boatStoreable(packet)) return false
      const samples = bucket(boats, packet.id)
      const previous = samples.length > 0 ? samples[samples.length - 1]!.packet : undefined
      const stored = fillBoatGps(packet, previous)
      const ok = addTimed(boats, packet.id, packet.time, stored)
      if (ok) {
        rememberFixAge('boat', packet.id, packet.time, readFixAgeMs(packet))
        pruneFixAge('boat', packet.id, boats.get(packet.id) ?? [])
      }
      return ok
    },
    addBuoy(packet) {
      if (!boatStoreable(packet)) return false
      const samples = bucket(buoys, packet.id)
      const previous = samples.length > 0 ? samples[samples.length - 1]!.packet : undefined
      const stored = fillBoatGps(packet, previous)
      const ok = addTimed(buoys, packet.id, packet.time, stored)
      if (ok) {
        rememberFixAge('buoy', packet.id, packet.time, readFixAgeMs(packet))
        pruneFixAge('buoy', packet.id, buoys.get(packet.id) ?? [])
      }
      return ok
    },
    sampleDroneAt,
    sampleBoatAt(id, ntpMs) {
      return sampleBoatLike(boats, 'boat', id, ntpMs)
    },
    sampleBuoyAt(id, ntpMs) {
      return sampleBoatLike(buoys, 'buoy', id, ntpMs)
    },
    prune(nowNtpMs) {
      pruneMap(drones, nowNtpMs)
      pruneMap(boats, nowNtpMs)
      pruneMap(buoys, nowNtpMs)
      for (const id of boats.keys()) pruneFixAge('boat', id, boats.get(id) ?? [])
      for (const id of buoys.keys()) pruneFixAge('buoy', id, buoys.get(id) ?? [])
    },
    reset() {
      drones.clear()
      boats.clear()
      buoys.clear()
      boatFixAge.clear()
    },
    stats() {
      return {
        drones: statsMap(drones),
        boats: statsMap(boats),
        buoys: statsMap(buoys),
      }
    },
  }
}
