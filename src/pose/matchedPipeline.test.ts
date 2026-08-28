/**
 * DSP-TEL-20260826-08 — matched pose cutover.
 *
 * Alpha / omitted matchClock is covered by pose.test.ts (push + MidpointLerp).
 * These tests prove the additive video path and that it cannot leak into alpha.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { clearAllOffsets, setOffsets } from '../calibration/index.ts'
import {
  applyConfigOrigin,
  gpsToEnu,
  loadEgm96FromBuffer,
  resetEgm96ForTests,
  resetOriginForTests,
} from '../geodesy/index.ts'
import { TelemetryBus } from '../telemetry/bus.ts'
import { createFlowTap, resetFlowTap } from '../telemetry/flowTap.ts'
import { clearPtsNtpMaps, getPtsNtpMap } from '../telemetry/ptsNtpMap.ts'
import type {
  BoatTelemetry,
  StreamAnchorMessage,
  TelemetryData,
  TelemetryQuaternion,
} from '../telemetry/types.ts'
import { PoseBus } from './bus.ts'
import { boatRawPose } from './convert.ts'
import { startPosePipeline, stopPosePipeline } from './pipeline.ts'
import type { PoseEvent } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BIN_PATH = resolve(__dirname, '../../public/EGM96_1deg.bin')
const ORIGIN = { lat: 41.0082, lon: 28.9784, altMsl: 0 }

const SRT_A = 'srt-cam-a'
const SRT_B = 'srt-cam-b'
const NTP0 = 1_000_000
const PTS_1S = 90_000

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
    ts: NTP0,
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
    lat: ORIGIN.lat,
    lon: ORIGIN.lon,
    alt: 0.5,
    acc: 1,
    spd: 10,
    brg: 90,
    time: NTP0,
    id: '21',
    t_sync: true,
    t_err: 0,
    ...overrides,
  }
}

function pacingAnchor(
  streamId: string,
  pts90k: number,
  ntpMs: number,
): StreamAnchorMessage {
  return {
    type: 'stream_anchor',
    stream_id: streamId,
    kind: 'periodic',
    fps: 30,
    pts_90khz: pts90k,
    ntp_capture_ms: ntpMs,
    ntp_synced: true,
    ntp_err_ms: 0,
  }
}

function frameAnchor(
  streamId: string,
  pts90k: number,
  ntpMs: number,
): StreamAnchorMessage {
  return {
    type: 'stream_anchor',
    stream_id: streamId,
    kind: 'frame',
    fps: 30,
    pts_90khz: pts90k,
    ntp_capture_ms: ntpMs,
    ntp_synced: true,
    ntp_err_ms: 0,
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
  clearPtsNtpMaps()
  resetFlowTap()
  clearAllOffsets()
  resetOriginForTests()
  resetEgm96ForTests()
  const bytes = readFileSync(BIN_PATH)
  loadEgm96FromBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
})

describe('matched pose pipeline', () => {
  it('samples drone at presented NTP, not the newest packet (hard yaw)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let presentedPts = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))

    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 1_000, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    presentedPts = PTS_1S
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    handle.stop()
  })

  it('LUT alias: anchors on telem id still match when lookup uses mapped SRT id', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '5') last = p
    })

    let presentedPts = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '5',
        getLutStreamId: () => '1',
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
        getSrtIdForTelemId: (telemId) => (telemId === '5' ? '1' : null),
        getTelemIdForSrtId: (srtId) => (srtId === '1' ? '5' : null),
      },
    })

    tel.emit('stream_anchor', pacingAnchor('5', 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor('5', PTS_1S, NTP0 + 1_000))
    tel.emit(
      'drone',
      makeDrone({ id: '5', ts: NTP0, gimbal: identityQuat(10, 0, 0) }),
    )
    tel.emit(
      'drone',
      makeDrone({
        id: '5',
        ts: NTP0 + 1_000,
        seq: 2,
        gimbal: identityQuat(90, 0, 0),
      }),
    )
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    presentedPts = PTS_1S
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    handle.stop()
  })

  it('dji-1 kind:frame aliases onto LUT 1 and maps presented PTS → NTP', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let presentedPts = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => '1',
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', frameAnchor('dji-1', 0, NTP0))
    tel.emit('stream_anchor', frameAnchor('dji-1', PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 1_000, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    presentedPts = PTS_1S
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    const debug = handle.getSyncPoseDebug('1')
    expect(debug.matched).toBe(true)
    expect(debug.freeRun).toBe(false)
    expect(debug.tNtpMs).not.toBeNull()
    expect(debug.tNtpMs).toBeCloseTo(NTP0 + 1_000, 4)
    expect(debug.pacingCount).toBeGreaterThanOrEqual(2)
    expect(getPtsNtpMap('1').toNtp(PTS_1S).mode).toBe('interpolated')
    expect(getPtsNtpMap('dji-1').toNtp(PTS_1S).mode).toBe('interpolated')
    handle.stop()
  })

  it('unmapped telem/SRT mismatch + video PTS free-runs (yaw follows new packet)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let presentedPts: number | null = null
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(true)

    presentedPts = 0
    tel.emit('stream_anchor', pacingAnchor('5', 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor('5', PTS_1S, NTP0 + 1_000))
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 1_000, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    handle.tick(1)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    expect(handle.getSyncPoseDebug('1').held).toBe(false)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(true)
    expect(handle.getSyncPoseDebug('1').matched).toBe(false)
    handle.stop()
  })

  it('applies syncTrimMs as t_ntp = toNtp(pts) + trim (positive = AR leads)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    setOffsets('1', { syncTrimMs: 1_000 })
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => 0,
        getSyncTrimMs: (povId) => (povId === '1' ? 1_000 : 0),
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 1_000, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    handle.stop()
  })

  it('alpha / matchClock off keeps push lerp — isolation from a healthy LUT', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let t = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      nowSec: () => t,
      matchClock: {
        enabled: () => false,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => 0,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    t = 0.1
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 1_000, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    t = 1.1
    handle.tick(1)
    // Presented PTS maps to the first packet; lerp still reaches the newest.
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    handle.stop()
  })

  it('video PTS + empty LUT free-runs to newest yaw (pacingCount === 0)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let presentedPts: number | null = null
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('drone', makeDrone({ gimbal: identityQuat(10, 0, 0) }))
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(true)

    presentedPts = 0
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 100, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    handle.tick(1)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    expect(handle.getSyncPoseDebug('1').held).toBe(false)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(true)
    expect(handle.getSyncPoseDebug('1').matched).toBe(false)
    expect(handle.getSyncPoseDebug('1').pacingCount).toBe(0)
    handle.stop()
  })

  it('single pacing sample (toNtp unavailable) free-runs toward newest yaw', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let presentedPts: number | null = null
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('drone', makeDrone({ gimbal: identityQuat(10, 0, 0) }))
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    presentedPts = 0
    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 100, seq: 2, gimbal: identityQuat(33, 0, 0) }),
    )
    handle.tick(1)
    expect(last?.rotation.yawDeg).toBeCloseTo(33, 4)
    expect(handle.getSyncPoseDebug('1').held).toBe(false)
    expect(handle.getSyncPoseDebug('1').matched).toBe(false)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(true)
    expect(handle.getSyncPoseDebug('1').pacingCount).toBe(1)
    handle.stop()
  })

  it('POV switch swaps LUT + sampled pose in the same tick', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    const lastById = new Map<string, PoseEvent>()
    poses.on('pose', (p) => {
      if (p.kind === 'drone') lastById.set(p.id, p)
    })

    let active = '1'
    const presented: Record<string, number> = { '1': 0, '2': PTS_1S }
    const lut: Record<string, string> = { '1': SRT_A, '2': SRT_B }

    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => active,
        getLutStreamId: (povId) => lut[povId] ?? povId,
        getPresentedPts90k: (povId) => presented[povId] ?? null,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('stream_anchor', pacingAnchor(SRT_B, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_B, PTS_1S, NTP0 + 1_000))

    tel.emit(
      'drone',
      makeDrone({ id: '1', ts: NTP0, gimbal: identityQuat(10, 0, 0) }),
    )
    tel.emit(
      'drone',
      makeDrone({
        id: '1',
        ts: NTP0 + 1_000,
        seq: 2,
        gimbal: identityQuat(11, 0, 0),
      }),
    )
    tel.emit(
      'drone',
      makeDrone({ id: '2', ts: NTP0, gimbal: identityQuat(20, 0, 0) }),
    )
    tel.emit(
      'drone',
      makeDrone({
        id: '2',
        ts: NTP0 + 1_000,
        seq: 2,
        gimbal: identityQuat(80, 0, 0),
      }),
    )

    handle.tick(0)
    expect(lastById.get('1')?.rotation.yawDeg).toBeCloseTo(10, 4)

    active = '2'
    handle.tick(0)
    expect(lastById.get('2')?.rotation.yawDeg).toBeCloseTo(80, 4)
    handle.stop()
  })

  it('boat DR from sampleAt reaches ENU (spd is not dropped at convert)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let lastBoat: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'boat' && p.id === '21') lastBoat = p
    })

    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => PTS_1S,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0 }))
    tel.emit('drone', makeDrone({ ts: NTP0 + 1_000, seq: 2 }))
    tel.emit('boat', makeBoat({ time: NTP0, spd: 10, brg: 90 }))
    handle.tick(0)

    const parked = boatRawPose(makeBoat({ time: NTP0, spd: 10, brg: 90 }))
    expect(lastBoat).toBeDefined()
    const eastM = lastBoat!.position.x - parked.position.x
    expect(eastM).toBeGreaterThan(8)
    expect(eastM).toBeLessThan(12)
    handle.stop()
  })

  it('brg === 0 is held, not walked north, through the convert seam', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let lastBoat: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'boat' && p.id === '21') lastBoat = p
    })

    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => PTS_1S,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0 }))
    tel.emit('drone', makeDrone({ ts: NTP0 + 1_000, seq: 2 }))
    tel.emit('boat', makeBoat({ time: NTP0, spd: 10, brg: 0 }))
    handle.tick(0)

    const held = boatRawPose(makeBoat({ time: NTP0, spd: 10, brg: 0 }))
    const north = gpsToEnu(ORIGIN.lat + 0.0001, ORIGIN.lon, 0.5)
    expect(lastBoat!.position.x).toBeCloseTo(held.position.x, 5)
    expect(lastBoat!.position.z).toBeCloseTo(held.position.z, 5)
    expect(Math.abs(lastBoat!.position.z - north.z)).toBeGreaterThan(5)

    const debug = handle.getSyncPoseDebug('1')
    expect(debug.matched).toBe(true)
    expect(debug.boats.some((b) => b.id === '21' && b.heldBearingUnknown)).toBe(
      true,
    )
    handle.stop()
  })

  it('fills pose debug from sampleAt when matched', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => 0,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0 }))
    tel.emit('drone', makeDrone({ ts: NTP0 + 1_000, seq: 2 }))
    handle.tick(0)
    const debug = handle.getSyncPoseDebug('1')
    expect(debug.matched).toBe(true)
    expect(debug.poseMode).toBe('interpolated')
    expect(debug.poseAgeMs).toBe(0)
    expect(debug.tNtpMs).toBe(NTP0)
    expect(debug.newestPoseNtpMs).toBe(NTP0 + 1_000)
    expect(debug.poseMinusVideoMs).toBe(1_000)
    expect(debug.pacingCount).toBeGreaterThan(0)
    expect(handle.newestDroneNtp('1')).toBe(NTP0 + 1_000)
    handle.stop()
  })

  it('video NTP 300ms ahead of last drone still emits held pose (no vanish, no jump to newest)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    const pts300ms = 27_000
    let presentedPts = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    presentedPts = pts300ms
    last = undefined
    handle.tick(0)
    expect(last).toBeDefined()
    expect(last!.rotation.yawDeg).toBeCloseTo(10, 4)
    const held = handle.getSyncPoseDebug('1')
    expect(held.matched).toBe(true)
    expect(held.held).toBe(false)
    expect(held.freeRun).toBe(false)
    expect(held.poseMode).toBe('held')
    expect(held.tNtpMs).toBe(NTP0 + 300)
    expect(held.newestPoseNtpMs).toBe(NTP0)
    expect(held.poseMinusVideoMs).toBe(-300)
    expect(held.pacingCount).toBeGreaterThan(0)

    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 1_000, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    last = undefined
    handle.tick(0)
    expect(last).toBeDefined()
    expect(last!.rotation.yawDeg).not.toBeCloseTo(90, 4)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(false)
    handle.stop()
  })

  it('sampleAt unavailable (video NTP past hold window) emits newest pose, mesh stays', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    const pts2500ms = 225_000
    let presentedPts = 0
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => presentedPts,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit('drone', makeDrone({ ts: NTP0, gimbal: identityQuat(10, 0, 0) }))
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    presentedPts = pts2500ms
    last = undefined
    handle.tick(0)
    expect(last).toBeDefined()
    expect(last!.rotation.yawDeg).toBeCloseTo(10, 4)

    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 400, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    last = undefined
    handle.tick(0)
    expect(last).toBeDefined()
    expect(last!.rotation.yawDeg).toBeCloseTo(90, 4)
    const debug = handle.getSyncPoseDebug('1')
    expect(debug.matched).toBe(false)
    expect(debug.held).toBe(false)
    expect(debug.freeRun).toBe(true)
    expect(debug.poseMode).toBe('unavailable')
    expect(debug.poseMinusVideoMs).toBe(-2_100)
    expect(debug.pacingCount).toBeGreaterThan(0)
    handle.stop()
  })

  it('omitted matchClock is byte-identical to today (push, no GPS hold)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let lastYaw = Number.NaN
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '5') lastYaw = p.rotation.yawDeg
    })

    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
    })

    tel.emit(
      'drone',
      makeDrone({
        id: '5',
        pos: { lat: 0, lon: 0, alt: 2.2 },
        gimbal: identityQuat(54.6, -0.2, 1),
      }),
    )
    handle.tick(0.05)
    expect(lastYaw).toBeCloseTo(54.6, 4)
    handle.stop()
  })

  it('matched + attitude-only drone keeps gimbal and does not GEO-project 0,0', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => 0,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('stream_anchor', pacingAnchor(SRT_A, 0, NTP0))
    tel.emit('stream_anchor', pacingAnchor(SRT_A, PTS_1S, NTP0 + 1_000))
    tel.emit(
      'drone',
      makeDrone({
        ts: NTP0,
        pos: { lat: 0, lon: 0, alt: 2.2 },
        gimbal: identityQuat(54.6, -0.2, 1),
      }),
    )
    handle.tick(0)
    expect(last).toBeDefined()
    expect(last!.rotation.yawDeg).toBeCloseTo(54.6, 4)
    expect(Math.abs(last!.position.x)).toBeLessThan(1)
    expect(Math.abs(last!.position.z)).toBeLessThan(1)
    handle.stop()
  })

  it('hasPicture without PTS free-runs (no usable toNtp)', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    let last: PoseEvent | undefined
    poses.on('pose', (p) => {
      if (p.kind === 'drone' && p.id === '1') last = p
    })

    let hasPicture = false
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      matchClock: {
        enabled: () => true,
        getActivePovId: () => '1',
        getLutStreamId: () => SRT_A,
        getPresentedPts90k: () => null,
        hasPicture: () => hasPicture,
        getSyncTrimMs: () => 0,
      },
    })

    tel.emit('drone', makeDrone({ gimbal: identityQuat(10, 0, 0) }))
    handle.tick(0)
    expect(last?.rotation.yawDeg).toBeCloseTo(10, 4)

    hasPicture = true
    tel.emit(
      'drone',
      makeDrone({ ts: NTP0 + 100, seq: 2, gimbal: identityQuat(90, 0, 0) }),
    )
    handle.tick(1)
    expect(last?.rotation.yawDeg).toBeCloseTo(90, 4)
    expect(handle.getSyncPoseDebug('1').held).toBe(false)
    expect(handle.getSyncPoseDebug('1').freeRun).toBe(true)
    expect(handle.getSyncPoseDebug('1').matched).toBe(false)
    handle.stop()
  })

  it('flowTap records accepted drone and stream_anchor bodies', () => {
    applyConfigOrigin(ORIGIN)
    const tel = new TelemetryBus()
    const poses = new PoseBus()
    const tap = createFlowTap({ nowMs: () => 42 })
    const handle = startPosePipeline({
      telemetryBus: tel,
      poseBus: poses,
      takeoffAltitudeMSL: 0,
      manualTick: true,
      flowTap: tap,
    })
    tel.emit('drone', makeDrone({ id: '7', gimbal: identityQuat(1, 0, 0) }))
    tel.emit('stream_anchor', pacingAnchor('7', 0, NTP0))
    const snap = tap.snapshot()
    expect(snap.some((e) => e.kind === 'drone' && e.id === '7')).toBe(true)
    expect(snap.some((e) => e.kind === 'anchor' && e.id === '7')).toBe(true)
    handle.stop()
  })
})

describe('main.ts matched-pose wiring (DSP-TEL-08)', () => {
  it('isolates matched mode on arBackground video, injects newest matched-buffer NTP, swaps video on POV change', () => {
    const main = readFileSync(join(__dirname, '../main.ts'), 'utf8')
    expect(main).toMatch(/arBackgroundMode === 'video'/)
    expect(main).toMatch(/getNewestPoseNtp:\s*\(povId\)\s*=>/)
    expect(main).toMatch(/telemetryHistory\.stats\(\)\.drones/)
    expect(main).toMatch(/onActivePovChange:/)
    expect(main).toMatch(/videoStreamManager\?\.setActivePov/)
    expect(main).toMatch(/posePipeline\?\.getSyncPoseDebug/)
    expect(main).toMatch(/poseMinusVideoMs/)
    expect(main).toMatch(/mapped\.ntpMs \+ trim/)
    expect(main).toMatch(/hasPicture:/)
    expect(main).toMatch(/getSrtIdForTelemId:/)
    expect(main).toMatch(/getTelemIdForSrtId:/)
    expect(main).not.toMatch(/STUDIO_TICK_FPS\s*=/)
  })

  it('createScene notifies onActivePovChange after a real POV switch', () => {
    const src = readFileSync(join(__dirname, '../scene/createScene.ts'), 'utf8')
    expect(src).toMatch(/onActivePovChange\?: \(id: string\) => void/)
    expect(src).toMatch(/options\.onActivePovChange\?\.\(id\)/)
    expect(src).toMatch(/options\.onActivePovChange\?\.\(activePovId\)/)
  })
})
