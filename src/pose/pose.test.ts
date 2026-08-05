import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { normalizeConfig } from '../config/loadConfig.ts'
import {
  applyConfigOrigin,
  gpsToEnu,
  gpsToEnuAmsl,
  gpsToEnuRelative,
  loadEgm96FromBuffer,
  resetEgm96ForTests,
  resetOriginForTests,
} from '../geodesy/index.ts'
import { TelemetryBus } from '../telemetry/bus.ts'
import type { BoatTelemetry, TelemetryData, TelemetryQuaternion } from '../telemetry/types.ts'
import { PoseBus } from './bus.ts'
import { boatRawPose, droneRawPose } from './convert.ts'
import { MidpointLerp } from './lerp.ts'
import { startPosePipeline, stopPosePipeline } from './pipeline.ts'
import { clearAllOffsets, DEFAULT_HFOV_DEG } from '../calibration/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN_PATH = resolve(__dirname, '../../public/EGM96_1deg.bin')

const ORIGIN = { lat: 41.0082, lon: 28.9784, altMsl: 0 }

function identityQuat(
  yaw = 0,
  pitch = 0,
  roll = 0,
): TelemetryQuaternion {
  return { x: 0, y: 0, z: 0, w: 1, yaw, pitch, roll }
}

function makeDrone(
  overrides: Partial<TelemetryData> & { pos?: Partial<TelemetryData['pos']> } = {},
): TelemetryData {
  const { pos: posOverride, ...rest } = overrides
  return {
    ts: 1_000,
    seq: 1,
    id: '1',
    ntp_synced: true,
    ntp_err_ms: 0,
    pos: {
      lat: ORIGIN.lat,
      lon: ORIGIN.lon,
      alt: 45,
      ...posOverride,
    },
    rot: identityQuat(10, 0, 0),
    gimbal: identityQuat(12, -15, 2),
    vel: { x: 0, y: 0, z: 0 },
    cam: { fov: 72 },
    meta: { bat: 100, sat: 12, sig: 90 },
    ...rest,
  }
}

function makeBoat(overrides: Partial<BoatTelemetry> = {}): BoatTelemetry {
  return {
    lat: ORIGIN.lat + 0.0001,
    lon: ORIGIN.lon + 0.0001,
    alt: 0.5,
    acc: 1,
    spd: 3,
    brg: 90,
    time: 2_000,
    id: '21',
    t_sync: true,
    t_err: 0,
    ...overrides,
  }
}

beforeAll(() => {
  const bytes = readFileSync(BIN_PATH)
  const ok = loadEgm96FromBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
  expect(ok).toBe(true)
})

afterEach(() => {
  stopPosePipeline()
  clearAllOffsets()
  resetOriginForTests()
  resetEgm96ForTests()
  const bytes = readFileSync(BIN_PATH)
  loadEgm96FromBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
})

describe('config origin fixture', () => {
  it('normalizeConfig reads Istanbul mock origin + takeoffAltitudeMSL', () => {
    const cfg = normalizeConfig({
      telemetryMode: 'mock',
      origin: ORIGIN,
      takeoffAltitudeMSL: 12,
    })
    expect(cfg.origin.lat).toBeCloseTo(41.0082, 4)
    expect(cfg.origin.lon).toBeCloseTo(28.9784, 4)
    expect(cfg.takeoffAltitudeMSL).toBe(12)
    applyConfigOrigin(cfg.origin)
    // Origin is AMSL; query same AMSL so ENU ≈ 0 (HAE=0 would sit ~N below).
    const atOrigin = gpsToEnuAmsl(ORIGIN.lat, ORIGIN.lon, ORIGIN.altMsl)
    expect(Math.hypot(atOrigin.x, atOrigin.y, atOrigin.z)).toBeLessThan(1)
  })
})

describe('altitude contracts', () => {
  it('drone uses relative+takeoff; boat uses HAE — distinct Y near origin', () => {
    applyConfigOrigin(ORIGIN)
    const takeoff = 10
    const drone = makeDrone({ pos: { lat: ORIGIN.lat, lon: ORIGIN.lon, alt: 45 } })
    const boat = makeBoat({
      lat: ORIGIN.lat,
      lon: ORIGIN.lon,
      alt: 0.5,
    })

    const d = droneRawPose(drone, takeoff)
    const b = boatRawPose(boat)

    const expectedDrone = gpsToEnuRelative(ORIGIN.lat, ORIGIN.lon, 45, takeoff)
    const expectedBoat = gpsToEnu(ORIGIN.lat, ORIGIN.lon, 0.5)

    expect(d.position.y).toBeCloseTo(expectedDrone.y, 5)
    expect(b.position.y).toBeCloseTo(expectedBoat.y, 5)
    // Relative+takeoff HAE ≫ boat HAE 0.5 → different up
    expect(Math.abs(d.position.y - b.position.y)).toBeGreaterThan(40)

    // Default CAL FOV (not telemetry cam.fov=72)
    expect(d.fovHDeg).toBe(DEFAULT_HFOV_DEG)
    expect(b.fovHDeg).toBe(DEFAULT_HFOV_DEG)

    // Local meters near origin (not ~1e6)
    expect(Math.hypot(d.position.x, d.position.z)).toBeLessThan(5)
    expect(Math.hypot(b.position.x, b.position.z)).toBeLessThan(5)
    console.log(
      `[test] drone ENU ≈ (${d.position.x.toFixed(2)}, ${d.position.y.toFixed(2)}, ${d.position.z.toFixed(2)})`,
    )
    console.log(
      `[test] boat ENU ≈ (${b.position.x.toFixed(2)}, ${b.position.y.toFixed(2)}, ${b.position.z.toFixed(2)})`,
    )
  })
})

describe('MidpointLerp', () => {
  it('first packet snaps to target', () => {
    const lerp = new MidpointLerp()
    lerp.setTarget({ x: 10, y: 20, z: 30 }, { yawDeg: 45, pitchDeg: 0, rollDeg: 0 }, 1)
    expect(lerp.currentPos).toEqual({ x: 10, y: 20, z: 30 })
    expect(lerp.currentRot.yawDeg).toBeCloseTo(45, 5)
    expect(lerp.isFirstData).toBe(false)
  })

  it('at half packet interval, position is midpoint between start and target', () => {
    const lerp = new MidpointLerp()
    lerp.setTarget({ x: 0, y: 0, z: 0 }, { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }, 0)
    // Second packet 0.1s later → packetInterval smoothed toward 0.1
    lerp.setTarget({ x: 100, y: 0, z: 0 }, { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }, 0.1)
    expect(lerp.packetIntervalSec).toBeGreaterThan(0.01)

    const half = lerp.packetIntervalSec / 2
    const sample = lerp.sampleAt(half)
    // At end of first half: at mid = lerp(start, target, 0.5)
    expect(sample.position.x).toBeCloseTo(50, 5)
    expect(sample.position.y).toBeCloseTo(0, 5)
    expect(sample.position.z).toBeCloseTo(0, 5)
  })
})

describe('pose pipeline', () => {
  it('applies drone attitude when lat/lon are 0 (no GPS)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let lastYaw = Number.NaN
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '5') lastYaw = p.rotation.yawDeg
    })

    let t = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      nowSec: () => t,
    })

    tel.emit(
      'drone',
      makeDrone({
        id: '5',
        pos: { lat: 0, lon: 0, alt: 2.2 },
        gimbal: identityQuat(54.6, -0.2, 1),
      }),
    )
    t = 0.05
    handle.tick(0.05)
    expect(lastYaw).toBeCloseTo(54.6, 4)
    handle.stop()
  })

  it('emits drone/boat poses; ignores stream_anchor', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    const received: string[] = []
    poses.on('pose', (p) => {
      received.push(`${p.kind}:${p.id}`)
    })

    let t = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      nowSec: () => t,
    })

    tel.emit('drone', makeDrone())
    t = 0.05
    handle.tick(0.05)
    expect(received.some((s) => s.startsWith('drone:1'))).toBe(true)

    received.length = 0
    tel.emit('boat', makeBoat())
    t = 0.1
    handle.tick(0.05)
    expect(received.some((s) => s.startsWith('boat:21'))).toBe(true)

    const before = received.length
    tel.emit('stream_anchor', {
      type: 'stream_anchor',
      stream_id: '1',
      kind: 'periodic',
      fps: 30,
      ntp_capture_ms: 1,
      ntp_synced: true,
      ntp_err_ms: 0,
    })
    handle.tick(0.01)
    // No new entity from stream_anchor
    expect(handle.entityIds()).toEqual(expect.arrayContaining(['1', '21']))
    expect(handle.entityIds()).not.toContain('stream_anchor')
    expect(received.length).toBeGreaterThanOrEqual(before)

    const lastDrone = received.filter((s) => s.startsWith('drone')).pop()
    expect(lastDrone).toBeDefined()
    handle.stop()
  })
})
