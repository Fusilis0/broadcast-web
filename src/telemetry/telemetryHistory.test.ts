import { describe, expect, it } from 'vitest'
import type { BoatTelemetry, TelemetryData, TelemetryQuaternion } from './types.ts'
import {
  BOAT_T_ERR_UNSYNCED,
  DEFAULT_BOAT_HOLD_MS,
  DEFAULT_EXTRAPOLATE_MS,
  DEFAULT_FIX_AGE_SKIP_DR_MS,
  DEFAULT_HOLD_MS,
  DJI_NTP_ERR_UNSYNCED,
  createTelemetryHistory,
  hermite,
  offsetLatLon,
  shortestDegDelta,
} from './telemetryHistory.ts'

const ORIGIN = { lat: 41.084, lon: 29.004, alt: 12.3 }

function identityQuat(yaw = 0, pitch = 0, roll = 0): TelemetryQuaternion {
  return { x: 0, y: 0, z: 0, w: 1, yaw, pitch, roll }
}

function makeDrone(overrides: Partial<TelemetryData> & { pos?: Partial<TelemetryData['pos']> } = {}): TelemetryData {
  const { pos: posOverride, ...rest } = overrides
  return {
    ts: 1_000,
    seq: 1,
    id: '5',
    ntp_synced: true,
    ntp_err_ms: 30,
    pos: { ...ORIGIN, ...posOverride },
    rot: identityQuat(10, 2, -1),
    gimbal: identityQuat(15, -20, 0),
    vel: { x: 0, y: 0, z: 0 },
    cam: { fov: 84 },
    meta: { bat: 87, sat: 14, sig: 3 },
    ...rest,
  }
}

function makeBoat(overrides: Partial<BoatTelemetry> & { fix_age_ms?: number } = {}): BoatTelemetry {
  const { fix_age_ms: _age, ...rest } = overrides
  const packet: BoatTelemetry & { fix_age_ms?: number } = {
    lat: ORIGIN.lat,
    lon: ORIGIN.lon,
    alt: 1.2,
    acc: 5.1,
    spd: 0.72,
    brg: 90,
    time: 1_000,
    id: '31',
    t_sync: true,
    t_err: 30,
    ...rest,
  }
  if (_age !== undefined) packet.fix_age_ms = _age
  return packet
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6_378_137
  const toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR
  const dLon = (lon2 - lon1) * toR
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)))
}

function yawNear(actual: number, expected: number, eps = 0.51): void {
  expect(Math.abs(shortestDegDelta(expected, actual))).toBeLessThan(eps)
}

describe('createTelemetryHistory', () => {
  it('returns null for unknown id, empty history, or t before the first sample', () => {
    const h = createTelemetryHistory()
    expect(h.sampleDroneAt('5', 1_000)).toBeNull()
    expect(h.sampleBoatAt('31', 1_000)).toBeNull()
    expect(h.sampleBuoyAt('91', 1_000)).toBeNull()
    h.addDrone(makeDrone({ ts: 2_000 }))
    expect(h.sampleDroneAt('5', 1_999)).toBeNull()
    expect(h.sampleDroneAt('other', 2_000)).toBeNull()
    expect(() => h.sampleDroneAt('5', Number.NaN)).not.toThrow()
    expect(h.sampleDroneAt('5', Number.NaN)).toBeNull()
  })

  it('clones on insert so later mutation of the caller object is ignored', () => {
    const h = createTelemetryHistory()
    const packet = makeDrone({ ts: 1_000, pos: { lat: 41, lon: 29, alt: 10 } })
    h.addDrone(packet)
    packet.pos.lat = 0
    const sample = h.sampleDroneAt('5', 1_000)
    expect(sample?.pos.lat).toBe(41)
  })
})

describe('drone interpolation', () => {
  it('midpoint of two poses 100 ms apart is the midpoint, mode interpolated', () => {
    const dtSec = 0.1
    const vel = { x: 0, y: 10, z: -4 }
    const aPos = { lat: 41.0, lon: 29.0, alt: 10 }
    const bLL = offsetLatLon(aPos.lat, aPos.lon, vel.x * dtSec, vel.y * dtSec)
    const bPos = { lat: bLL.lat, lon: bLL.lon, alt: aPos.alt - vel.z * dtSec }
    const h = createTelemetryHistory()
    h.addDrone(
      makeDrone({
        ts: 1_000,
        pos: aPos,
        gimbal: identityQuat(10, -20, 4),
        vel,
      }),
    )
    h.addDrone(
      makeDrone({
        ts: 1_100,
        seq: 2,
        pos: bPos,
        gimbal: identityQuat(20, -10, 8),
        vel,
      }),
    )
    const s = h.sampleDroneAt('5', 1_050)
    expect(s).not.toBeNull()
    expect(s!.quality.mode).toBe('interpolated')
    expect(s!.quality.degraded).toBe(false)
    const midLL = offsetLatLon(aPos.lat, aPos.lon, vel.x * dtSec * 0.5, vel.y * dtSec * 0.5)
    expect(s!.pos.lat).toBeCloseTo(midLL.lat, 10)
    expect(s!.pos.lon).toBeCloseTo(midLL.lon, 10)
    expect(s!.pos.alt).toBeCloseTo((aPos.alt + bPos.alt) / 2, 10)
    expect(s!.gimbal.yaw).toBeCloseTo(15, 10)
    expect(s!.gimbal.pitch).toBeCloseTo(-15, 10)
    expect(s!.gimbal.roll).toBeCloseTo(6, 10)
    expect(s!.ts).toBe(1_050)
  })

  it('constant-velocity Hermite stays on the geodesic at 25/50/75% of the span', () => {
    const dtMs = 100
    const dtSec = dtMs / 1000
    const vel = { x: 8, y: 0, z: 2 }
    const aPos = { ...ORIGIN }
    const bLL = offsetLatLon(aPos.lat, aPos.lon, vel.x * dtSec, vel.y * dtSec)
    const bPos = { lat: bLL.lat, lon: bLL.lon, alt: aPos.alt - vel.z * dtSec }
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000, pos: aPos, vel }))
    h.addDrone(makeDrone({ ts: 1_000 + dtMs, seq: 2, pos: bPos, vel }))
    const spanM = Math.hypot(vel.x, vel.y) * dtSec
    for (const u of [0.25, 0.5, 0.75]) {
      const s = h.sampleDroneAt('5', 1_000 + u * dtMs)!
      const expectLL = offsetLatLon(aPos.lat, aPos.lon, vel.x * u * dtSec, vel.y * u * dtSec)
      expect(s.quality.mode).toBe('interpolated')
      expect(s.pos.lat).toBeCloseTo(expectLL.lat, 8)
      expect(s.pos.lon).toBeCloseTo(expectLL.lon, 8)
      expect(s.pos.alt).toBeCloseTo(aPos.alt - vel.z * u * dtSec, 8)
      const distA = haversineM(aPos.lat, aPos.lon, s.pos.lat, s.pos.lon)
      expect(distA).toBeCloseTo(spanM * u, 3)
    }
    expect(hermite(0, 1, 1, 1, 0.5)).toBeCloseTo(0.5, 12)
  })

  it('falls back to linear lat/lon/alt when either sample has unusable vel', () => {
    const h = createTelemetryHistory()
    h.addDrone(
      makeDrone({
        ts: 1_000,
        pos: { lat: 41.0, lon: 29.0, alt: 10 },
        vel: { x: Number.NaN, y: 0, z: 0 },
      }),
    )
    h.addDrone(
      makeDrone({
        ts: 1_100,
        seq: 2,
        pos: { lat: 41.2, lon: 29.4, alt: 20 },
        vel: { x: 2, y: 4, z: 6 },
      }),
    )
    const s = h.sampleDroneAt('5', 1_050)!
    expect(s.pos.lat).toBeCloseTo(41.1, 10)
    expect(s.pos.lon).toBeCloseTo(29.2, 10)
    expect(s.pos.alt).toBeCloseTo(15, 10)
  })

  it('gimbal/rot xyzw at u=0.5 is a slerp blend, not a snap to A or B', () => {
    const half = Math.SQRT1_2
    const aQ: TelemetryQuaternion = { x: 0, y: 0, z: 0, w: 1, yaw: 0, pitch: 0, roll: 0 }
    const bQ: TelemetryQuaternion = { x: 0, y: 0, z: half, w: half, yaw: 90, pitch: 4, roll: -2 }
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000, gimbal: aQ, rot: aQ }))
    h.addDrone(makeDrone({ ts: 1_100, seq: 2, gimbal: bQ, rot: bQ }))
    const s = h.sampleDroneAt('5', 1_050)!
    const z45 = Math.sin(Math.PI / 8)
    const w45 = Math.cos(Math.PI / 8)
    expect(s.gimbal.x).toBeCloseTo(0, 6)
    expect(s.gimbal.y).toBeCloseTo(0, 6)
    expect(s.gimbal.z).toBeCloseTo(z45, 6)
    expect(s.gimbal.w).toBeCloseTo(w45, 6)
    expect(Math.abs(s.gimbal.z - 0)).toBeGreaterThan(0.2)
    expect(Math.abs(s.gimbal.z - half)).toBeGreaterThan(0.2)
    expect(s.rot.z).toBeCloseTo(z45, 6)
    expect(s.rot.w).toBeCloseTo(w45, 6)
    expect(s.gimbal.yaw).toBeCloseTo(45, 10)
    expect(s.gimbal.pitch).toBeCloseTo(2, 10)
    expect(s.gimbal.roll).toBeCloseTo(-1, 10)
  })

  it('yaw interpolation takes the short way across the 0/360 seam', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000, gimbal: identityQuat(359, 0, 0) }))
    h.addDrone(makeDrone({ ts: 1_100, seq: 2, gimbal: identityQuat(1, 0, 0) }))
    const s = h.sampleDroneAt('5', 1_050)
    expect(s!.quality.mode).toBe('interpolated')
    yawNear(s!.gimbal.yaw, 0)
    expect(Math.abs(shortestDegDelta(0, s!.gimbal.yaw))).toBeLessThan(1)
    expect(Math.abs(shortestDegDelta(180, s!.gimbal.yaw))).toBeGreaterThan(90)
  })

  it('past the newest with no B: extrapolated within 150 ms, then held, then unavailable', () => {
    const h = createTelemetryHistory()
    h.addDrone(
      makeDrone({
        ts: 1_000,
        pos: { ...ORIGIN },
        vel: { x: 10, y: 0, z: 2 },
      }),
    )
    const midExtrap = h.sampleDroneAt('5', 1_000 + DEFAULT_EXTRAPOLATE_MS / 2)
    expect(midExtrap!.quality.mode).toBe('extrapolated')
    expect(midExtrap!.quality.degraded).toBe(false)
    expect(midExtrap!.pos.lat).toBeGreaterThan(ORIGIN.lat)
    expect(midExtrap!.pos.alt).toBeCloseTo(ORIGIN.alt - 2 * (DEFAULT_EXTRAPOLATE_MS / 2 / 1000), 5)

    const held = h.sampleDroneAt('5', 1_000 + DEFAULT_EXTRAPOLATE_MS + 20)
    expect(held!.quality.mode).toBe('held')
    expect(held!.quality.degraded).toBe(true)
    expect(held!.pos.lat).toBeCloseTo(ORIGIN.lat, 10)
    expect(held!.pos.alt).toBeCloseTo(ORIGIN.alt, 10)

    const gone = h.sampleDroneAt('5', 1_000 + DEFAULT_HOLD_MS + 1)
    expect(gone!.quality.mode).toBe('unavailable')
    expect(gone!.quality.degraded).toBe(true)

    expect(midExtrap!.quality.mode).not.toBe('interpolated')
    expect(held!.quality.mode).not.toBe('interpolated')
    expect(gone!.quality.mode).not.toBe('interpolated')
    expect(DEFAULT_EXTRAPOLATE_MS).toBe(150)
  })

  it('never labels a one-sided sample as interpolated after the last stamp', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000 }))
    for (const dt of [1, 50, 149, 151, 500, 3_000]) {
      const s = h.sampleDroneAt('5', 1_000 + dt)
      expect(s!.quality.mode).not.toBe('interpolated')
    }
    expect(h.sampleDroneAt('5', 1_000)!.quality.mode).toBe('interpolated')
  })

  it('flags degraded when the bracketing gap is ≫ 500 ms', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000, pos: { lat: 41.0, lon: 29.0, alt: 10 } }))
    h.addDrone(makeDrone({ ts: 1_000 + 501, seq: 2, pos: { lat: 41.1, lon: 29.1, alt: 12 } }))
    const s = h.sampleDroneAt('5', 1_250)
    expect(s!.quality.mode).toBe('interpolated')
    expect(s!.quality.degraded).toBe(true)

    const hTight = createTelemetryHistory()
    hTight.addDrone(makeDrone({ ts: 1_000 }))
    hTight.addDrone(makeDrone({ ts: 1_100, seq: 2 }))
    expect(hTight.sampleDroneAt('5', 1_050)!.quality.degraded).toBe(false)
  })

  it('extrapolates NED vel in lat/lon terms (x north, y east, z down) without ENU conversion', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000, vel: { x: 0, y: 8, z: 0 } }))
    const s = h.sampleDroneAt('5', 1_100)
    expect(s!.quality.mode).toBe('extrapolated')
    expect(s!.pos.lon).toBeGreaterThan(ORIGIN.lon)
    expect(s!.pos.lat).toBeCloseTo(ORIGIN.lat, 6)
    const expected = offsetLatLon(ORIGIN.lat, ORIGIN.lon, 0, 0.8)
    expect(s!.pos.lat).toBeCloseTo(expected.lat, 10)
    expect(s!.pos.lon).toBeCloseTo(expected.lon, 10)
  })
})

describe('boat dead reckoning', () => {
  it('does not project through brg === 0 (does not walk north)', () => {
    const h = createTelemetryHistory()
    h.addBoat(makeBoat({ time: 1_000, spd: 5, brg: 0, lat: ORIGIN.lat, lon: ORIGIN.lon }))
    const s = h.sampleBoatAt('31', 2_000)
    expect(s).not.toBeNull()
    expect(s!.lat).toBeCloseTo(ORIGIN.lat, 12)
    expect(s!.lon).toBeCloseTo(ORIGIN.lon, 12)
    expect(s!.quality.mode).toBe('held')
    expect(s!.lat).toBe(ORIGIN.lat)
  })

  it('does not project when spd < 0.3', () => {
    const h = createTelemetryHistory()
    h.addBoat(makeBoat({ time: 1_000, spd: 0.29, brg: 90, lat: ORIGIN.lat, lon: ORIGIN.lon }))
    const s = h.sampleBoatAt('31', 2_000)
    expect(s!.lat).toBeCloseTo(ORIGIN.lat, 12)
    expect(s!.lon).toBeCloseTo(ORIGIN.lon, 12)
    expect(s!.quality.mode).toBe('held')
  })

  it('projects dist = spd * dt along brg (degrees east of true north)', () => {
    const h = createTelemetryHistory()
    h.addBoat(makeBoat({ time: 1_000, spd: 10, brg: 90, lat: ORIGIN.lat, lon: ORIGIN.lon }))
    const s = h.sampleBoatAt('31', 2_000)
    expect(s!.quality.mode).toBe('extrapolated')
    const dist = haversineM(ORIGIN.lat, ORIGIN.lon, s!.lat, s!.lon)
    expect(dist).toBeCloseTo(10, 1)
    expect(s!.lon).toBeGreaterThan(ORIGIN.lon)
    expect(s!.lat).toBeCloseTo(ORIGIN.lat, 6)

    const north = createTelemetryHistory()
    north.addBoat(makeBoat({ time: 1_000, spd: 10, brg: 0.1, lat: ORIGIN.lat, lon: ORIGIN.lon }))
    const n = north.sampleBoatAt('31', 2_000)!
    expect(n.lat).toBeGreaterThan(ORIGIN.lat)
    expect(haversineM(ORIGIN.lat, ORIGIN.lon, n.lat, n.lon)).toBeCloseTo(10, 1)
  })

  it('clamps rather than overshooting when B exists and t is close to B.time', () => {
    const h = createTelemetryHistory()
    const a = makeBoat({ time: 1_000, spd: 50, brg: 90, lat: ORIGIN.lat, lon: ORIGIN.lon })
    const bPos = offsetLatLon(ORIGIN.lat, ORIGIN.lon, 0, 5)
    const b = makeBoat({ time: 2_000, spd: 50, brg: 90, lat: bPos.lat, lon: bPos.lon })
    h.addBoat(a)
    h.addBoat(b)
    const t = 1_900
    const s = h.sampleBoatAt('31', t)!
    const unbounded = offsetLatLon(ORIGIN.lat, ORIGIN.lon, 0, 50 * 0.9)
    const distSampleToB = haversineM(s.lat, s.lon, b.lat, b.lon)
    const distUnbToB = haversineM(unbounded.lat, unbounded.lon, b.lat, b.lon)
    expect(distSampleToB).toBeLessThan(distUnbToB)
    expect(s.quality.mode).toBe('interpolated')
    const atB = h.sampleBoatAt('31', 2_000)!
    expect(atB.lat).toBeCloseTo(b.lat, 10)
    expect(atB.lon).toBeCloseTo(b.lon, 10)
  })

  it('holds A when B exists if brg === 0 (still does not walk north)', () => {
    const h = createTelemetryHistory()
    const northOfA = offsetLatLon(ORIGIN.lat, ORIGIN.lon, 20, 0)
    h.addBoat(makeBoat({ time: 1_000, spd: 4, brg: 0, lat: ORIGIN.lat, lon: ORIGIN.lon }))
    h.addBoat(makeBoat({ time: 2_000, spd: 4, brg: 0, lat: northOfA.lat, lon: northOfA.lon }))
    const s = h.sampleBoatAt('31', 1_500)!
    expect(s.lat).toBeCloseTo(ORIGIN.lat, 12)
    expect(s.lon).toBeCloseTo(ORIGIN.lon, 12)
  })

  it('cubic boat segment with valid brg/spd at both ends stays on the geodesic', () => {
    const spd = 10
    const brg = 90
    const dtMs = 1_000
    const bPos = offsetLatLon(ORIGIN.lat, ORIGIN.lon, 0, spd * (dtMs / 1000))
    const h = createTelemetryHistory()
    h.addBoat(makeBoat({ time: 1_000, spd, brg, lat: ORIGIN.lat, lon: ORIGIN.lon }))
    h.addBoat(makeBoat({ time: 1_000 + dtMs, spd, brg, lat: bPos.lat, lon: bPos.lon }))
    for (const u of [0.25, 0.5, 0.75]) {
      const s = h.sampleBoatAt('31', 1_000 + u * dtMs)!
      const expectLL = offsetLatLon(ORIGIN.lat, ORIGIN.lon, 0, spd * u * (dtMs / 1000))
      expect(s.quality.mode).toBe('interpolated')
      expect(s.lat).toBeCloseTo(expectLL.lat, 6)
      expect(s.lon).toBeCloseTo(expectLL.lon, 6)
    }
  })

  it('skips DR when fix_age_ms is large; treats 0 as unknown (not perfect)', () => {
    const stale = createTelemetryHistory()
    stale.addBoat(
      makeBoat({ time: 1_000, spd: 10, brg: 90, lat: ORIGIN.lat, lon: ORIGIN.lon, fix_age_ms: 1_585 }),
    )
    const held = stale.sampleBoatAt('31', 1_500)!
    expect(held.lat).toBeCloseTo(ORIGIN.lat, 12)
    expect(held.lon).toBeCloseTo(ORIGIN.lon, 12)
    expect(held.quality.degraded).toBe(true)

    const unknown = createTelemetryHistory()
    unknown.addBoat(
      makeBoat({ time: 1_000, spd: 10, brg: 90, lat: ORIGIN.lat, lon: ORIGIN.lon, fix_age_ms: 0 }),
    )
    const dr = unknown.sampleBoatAt('31', 1_500)!
    expect(dr.quality.mode).toBe('extrapolated')
    expect(dr.lon).toBeGreaterThan(ORIGIN.lon)

    const ok = createTelemetryHistory()
    ok.addBoat(
      makeBoat({
        time: 1_000,
        spd: 10,
        brg: 90,
        lat: ORIGIN.lat,
        lon: ORIGIN.lon,
        fix_age_ms: DEFAULT_FIX_AGE_SKIP_DR_MS,
      }),
    )
    expect(ok.sampleBoatAt('31', 1_500)!.lon).toBeGreaterThan(ORIGIN.lon)
  })

  it('covers a ~6 s still-hole as held, not unavailable', () => {
    const h = createTelemetryHistory()
    h.addBoat(makeBoat({ time: 1_000, spd: 0.1, brg: 0 }))
    const s = h.sampleBoatAt('31', 1_000 + 6_300)!
    expect(s.quality.mode).toBe('held')
    expect(s.quality.mode).not.toBe('unavailable')
    expect(1_000 + 6_300).toBeLessThan(1_000 + DEFAULT_BOAT_HOLD_MS)
  })
})

describe('ordering, gating, prune, stats, buoys', () => {
  it('out-of-order inserts still sample correctly; duplicate timestamps last-win', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_200, pos: { lat: 41.2, lon: 29.2, alt: 12 } }))
    h.addDrone(makeDrone({ ts: 1_000, pos: { lat: 41.0, lon: 29.0, alt: 10 } }))
    h.addDrone(makeDrone({ ts: 1_100, seq: 2, pos: { lat: 41.1, lon: 29.1, alt: 11 } }))
    const mid = h.sampleDroneAt('5', 1_050)!
    expect(mid.pos.lat).toBeCloseTo(41.05, 10)
    expect(mid.quality.mode).toBe('interpolated')

    h.addDrone(makeDrone({ ts: 1_100, seq: 99, pos: { lat: 42, lon: 30, alt: 50 } }))
    const atDup = h.sampleDroneAt('5', 1_100)!
    expect(atDup.pos.lat).toBeCloseTo(42, 10)
    expect(atDup.seq).toBe(99)
  })

  it('stores unsynced drone packets as degraded; boats stay NTP-gated', () => {
    const h = createTelemetryHistory()
    expect(h.addDrone(makeDrone({ ntp_synced: false }))).toBe(true)
    expect(h.sampleDroneAt('5', 1_000)!.quality.degraded).toBe(true)
    expect(h.addDrone(makeDrone({ ntp_err_ms: DJI_NTP_ERR_UNSYNCED, ts: 1_100, seq: 2 }))).toBe(
      true,
    )
    const mid = h.sampleDroneAt('5', 1_050)!
    expect(mid.quality.mode).toBe('interpolated')
    expect(mid.quality.degraded).toBe(true)

    expect(h.addBoat(makeBoat({ t_sync: false }))).toBe(false)
    expect(h.addBoat(makeBoat({ t_err: BOAT_T_ERR_UNSYNCED }))).toBe(false)
    expect(h.sampleBoatAt('31', 1_000)).toBeNull()
  })

  it('window prunes: retained samples are bounded after windowMs of inserts', () => {
    const h = createTelemetryHistory({ windowMs: 1_000, maxSamplesPerEntity: 8 })
    for (let t = 0; t <= 4_000; t += 100) {
      h.addDrone(makeDrone({ ts: t, seq: t }))
    }
    const stats = h.stats().drones['5']!
    expect(stats.count).toBeLessThanOrEqual(8)
    expect(stats.oldestNtpMs).toBeGreaterThanOrEqual(4_000 - 1_000)
    expect(stats.newestNtpMs).toBe(4_000)

    h.prune(10_000)
    expect(h.stats().drones['5']).toBeUndefined()
    expect(h.sampleDroneAt('5', 10_000)).toBeNull()
  })

  it('maxSamplesPerEntity caps even inside the window', () => {
    const h = createTelemetryHistory({ windowMs: 60_000, maxSamplesPerEntity: 3 })
    for (let i = 0; i < 10; i++) h.addDrone(makeDrone({ ts: 1_000 + i * 10 }))
    expect(h.stats().drones['5']!.count).toBe(3)
    expect(h.stats().drones['5']!.oldestNtpMs).toBe(1_000 + 7 * 10)
  })

  it('stats expose per-entity count, oldest/newest NTP, last gap', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone({ ts: 1_000 }))
    h.addDrone(makeDrone({ ts: 1_100, seq: 2 }))
    h.addBoat(makeBoat({ time: 2_000, id: '31' }))
    const st = h.stats()
    expect(st.drones['5']).toEqual({
      count: 2,
      oldestNtpMs: 1_000,
      newestNtpMs: 1_100,
      lastGapMs: 100,
    })
    expect(st.boats['31']!.count).toBe(1)
    expect(st.boats['31']!.lastGapMs).toBeNull()
  })

  it('reset clears all entities', () => {
    const h = createTelemetryHistory()
    h.addDrone(makeDrone())
    h.addBoat(makeBoat())
    h.reset()
    expect(h.sampleDroneAt('5', 1_000)).toBeNull()
    expect(h.stats()).toEqual({ drones: {}, boats: {}, buoys: {} })
  })

  it('addBuoy / sampleBuoyAt use the boat DR path in a separate id namespace', () => {
    const h = createTelemetryHistory()
    h.addBuoy(makeBoat({ id: '91', time: 1_000, spd: 10, brg: 90 }))
    h.addBoat(makeBoat({ id: '91', time: 1_000, spd: 0, brg: 0, lat: 0, lon: 0 }))
    const buoy = h.sampleBuoyAt('91', 2_000)!
    expect(buoy.lon).toBeGreaterThan(ORIGIN.lon)
    expect(h.sampleBoatAt('91', 2_000)!.lat).toBe(0)
  })
})

describe('attitude-only / missing GPS (TEL-10)', () => {
  it('addDrone succeeds with id+ts when pos is 0,0 or omitted; sample returns gimbal', () => {
    const h = createTelemetryHistory()
    expect(
      h.addDrone(
        makeDrone({
          pos: { lat: 0, lon: 0, alt: 12 },
          gimbal: identityQuat(44, -8, 1),
        }),
      ),
    ).toBe(true)
    const zero = h.sampleDroneAt('5', 1_000)!
    expect(zero.gimbal.yaw).toBeCloseTo(44, 10)
    expect(zero.pos.lat).toBe(0)
    expect(zero.pos.lon).toBe(0)

    const missing = makeDrone({ ts: 1_100, seq: 2, gimbal: identityQuat(50, -8, 1) })
    delete (missing as { pos?: unknown }).pos
    expect(h.addDrone(missing)).toBe(true)
    const sampled = h.sampleDroneAt('5', 1_100)!
    expect(sampled.pos).toEqual({ lat: 0, lon: 0, alt: 0 })
    expect(sampled.gimbal.yaw).toBeCloseTo(50, 10)
  })

  it('interpolates gimbal across 0,0 GPS without walking lat/lon toward the equator', () => {
    const h = createTelemetryHistory()
    h.addDrone(
      makeDrone({
        ts: 1_000,
        pos: { lat: ORIGIN.lat, lon: ORIGIN.lon, alt: 10 },
        gimbal: identityQuat(10, 0, 0),
      }),
    )
    h.addDrone(
      makeDrone({
        ts: 1_100,
        seq: 2,
        pos: { lat: 0, lon: 0, alt: 10 },
        gimbal: identityQuat(30, 0, 0),
      }),
    )
    const s = h.sampleDroneAt('5', 1_050)!
    expect(s.quality.mode).toBe('interpolated')
    expect(s.gimbal.yaw).toBeCloseTo(20, 10)
    expect(s.pos.lat).toBeCloseTo(ORIGIN.lat, 8)
    expect(s.pos.lon).toBeCloseTo(ORIGIN.lon, 8)
  })

  it('stores a boat packet with time+id when lat/lon are missing; holds last GPS', () => {
    const h = createTelemetryHistory()
    expect(h.addBoat(makeBoat({ time: 1_000, lat: ORIGIN.lat, lon: ORIGIN.lon }))).toBe(true)
    const late = makeBoat({ time: 1_500, spd: 0, brg: 0 })
    delete (late as { lat?: unknown }).lat
    delete (late as { lon?: unknown }).lon
    expect(h.addBoat(late)).toBe(true)
    const s = h.sampleBoatAt('31', 1_500)!
    expect(s.lat).toBeCloseTo(ORIGIN.lat, 10)
    expect(s.lon).toBeCloseTo(ORIGIN.lon, 10)
  })
})
