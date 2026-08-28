import { afterEach, describe, expect, it } from 'vitest'
import type { StreamAnchorMessage } from './types.ts'
import {
  PTS_MOD_33,
  clearPtsNtpMaps,
  createPtsNtpMap,
  getPtsNtpMap,
  ptsDiff33,
} from './ptsNtpMap.ts'

const BASE_NTP = 1_700_000_000_000
const TICKS_PER_MS = 90

function anchor(partial: Partial<StreamAnchorMessage> & { ntp_capture_ms: number }): StreamAnchorMessage {
  return {
    type: 'stream_anchor',
    stream_id: '5',
    kind: 'periodic',
    fps: 30,
    ntp_synced: true,
    ntp_err_ms: 10,
    ...partial,
  }
}

function addPacing(
  map: ReturnType<typeof createPtsNtpMap>,
  pts90k: number,
  ntpMs: number,
  extra: Partial<StreamAnchorMessage> = {},
): void {
  map.addAnchor(anchor({ pts_90khz: pts90k, ntp_capture_ms: ntpMs, ...extra }))
}

afterEach(() => {
  clearPtsNtpMaps()
})

describe('ptsDiff33', () => {
  it('returns the shortest signed 33-bit step across wrap', () => {
    expect(ptsDiff33(PTS_MOD_33 - 100, 50)).toBe(150)
    expect(ptsDiff33(50, PTS_MOD_33 - 100)).toBe(-150)
  })
})

describe('PtsNtpMap', () => {
  it('interpolates NTP between two pacing anchors', () => {
    const map = createPtsNtpMap()
    addPacing(map, 0, BASE_NTP)
    addPacing(map, 90_000, BASE_NTP + 1_000)

    const mid = map.toNtp(45_000)
    expect(mid.mode).toBe('interpolated')
    expect(mid.ntpMs).toBeCloseTo(BASE_NTP + 500, 6)
    expect(mid.extrapolatedByMs).toBe(0)

    const atEnd = map.toNtp(90_000)
    expect(atEnd.mode).toBe('interpolated')
    expect(atEnd.ntpMs).toBeCloseTo(BASE_NTP + 1_000, 6)
  })

  it('extrapolates a PTS newer than the last pacing anchor (live case)', () => {
    const map = createPtsNtpMap()
    addPacing(map, 0, BASE_NTP)
    addPacing(map, 90_000, BASE_NTP + 1_000)

    const ahead = map.toNtp(90_000 + 90 * 500)
    expect(ahead.mode).toBe('extrapolated')
    expect(ahead.ntpMs).not.toBeNull()
    expect(ahead.ntpMs).toBeCloseTo(BASE_NTP + 1_500, 5)
    expect(ahead.extrapolatedByMs).toBeCloseTo(500, 6)
  })

  it('returns unavailable past the extrapolation bound with no fabricated NTP', () => {
    const map = createPtsNtpMap({ extrapolateMaxMs: 2_000 })
    addPacing(map, 0, BASE_NTP)
    addPacing(map, 90_000, BASE_NTP + 1_000)

    const atBound = map.toNtp(90_000 + 90 * 2_000)
    expect(atBound.mode).toBe('extrapolated')
    expect(atBound.ntpMs).toBeCloseTo(BASE_NTP + 3_000, 5)

    const beyond = map.toNtp(90_000 + 90 * 2_001)
    expect(beyond.mode).toBe('unavailable')
    expect(beyond.ntpMs).toBeNull()
  })

  it('maps continuously across the 33-bit PTS wrap', () => {
    const map = createPtsNtpMap()
    const before = PTS_MOD_33 - 45_000
    const after = 45_000
    addPacing(map, before, BASE_NTP)
    addPacing(map, after, BASE_NTP + 1_000)

    const tBefore = map.toNtp(before)
    const tAfter = map.toNtp(after)
    expect(tBefore.mode).toBe('interpolated')
    expect(tAfter.mode).toBe('interpolated')
    expect(tAfter.ntpMs).toBeCloseTo(BASE_NTP + 1_000, 4)
    expect(tBefore.ntpMs).toBeCloseTo(BASE_NTP, 4)
    expect((tAfter.ntpMs ?? 0) - (tBefore.ntpMs ?? 0)).toBeCloseTo(1_000, 3)
    expect((tAfter.ntpMs ?? 0) - (tBefore.ntpMs ?? 0)).toBeLessThan(10_000)

    const justAfterWrap = map.toNtp(3_000)
    expect(justAfterWrap.mode).toBe('interpolated')
    expect(justAfterWrap.ntpMs).toBeCloseTo(BASE_NTP + 48_000 / TICKS_PER_MS, 3)
  })

  it('fits two kind:frame anchors when pacing is empty (same OLS / 2 s extra)', () => {
    const map = createPtsNtpMap()
    map.addAnchor(
      anchor({ kind: 'frame', pts_90khz: 0, ntp_capture_ms: BASE_NTP }),
    )
    expect(map.toNtp(0).mode).toBe('unavailable')
    expect(map.health().lastPacingPts90k).toBe(0)

    map.addAnchor(
      anchor({ kind: 'frame', pts_90khz: 90_000, ntp_capture_ms: BASE_NTP + 1_000 }),
    )
    const mid = map.toNtp(45_000)
    expect(mid.mode).toBe('interpolated')
    expect(mid.ntpMs).toBeCloseTo(BASE_NTP + 500, 6)
    expect(map.health().pacingCount).toBe(2)
    expect(map.health().frameCount).toBe(2)
    expect(map.health().lastPacingPts90k).toBe(90_000)
    expect(map.health().slope).toBeCloseTo(1, 5)

    const atBound = map.toNtp(90_000 + 90 * 2_000)
    expect(atBound.mode).toBe('extrapolated')
    expect(atBound.ntpMs).toBeCloseTo(BASE_NTP + 3_000, 5)

    const beyond = map.toNtp(90_000 + 90 * 2_001)
    expect(beyond.mode).toBe('unavailable')
    expect(beyond.ntpMs).toBeNull()
  })

  it('keeps kind:frame out of the fit and reports residualMs', () => {
    const map = createPtsNtpMap()
    for (let i = 0; i < 8; i++) {
      addPacing(map, i * 90_000, BASE_NTP + i * 1_000)
    }
    const pts = 3 * 90_000 + 45_000
    const before = map.toNtp(pts)
    expect(before.mode).toBe('interpolated')
    const ntpBefore = before.ntpMs

    for (let i = 0; i < 8; i++) {
      map.addAnchor(
        anchor({
          kind: 'frame',
          pts_90khz: i * 90_000,
          ntp_capture_ms: BASE_NTP + i * 1_000 + 80,
        }),
      )
    }

    const after = map.toNtp(pts)
    expect(after.ntpMs).toBe(ntpBefore)
    expect(after.mode).toBe(before.mode)
    expect(map.health().pacingCount).toBe(8)
    expect(map.health().frameCount).toBe(8)
    expect(map.health().residualMs).toBeCloseTo(80, 4)
  })

  it('rejects ntp_synced: false and counts it', () => {
    const map = createPtsNtpMap()
    addPacing(map, 0, BASE_NTP)
    addPacing(map, 90_000, BASE_NTP + 1_000)
    map.addAnchor(
      anchor({
        pts_90khz: 180_000,
        ntp_capture_ms: BASE_NTP + 2_000,
        ntp_synced: false,
      }),
    )
    expect(map.health().pacingCount).toBe(2)
    expect(map.health().rejected.ntpUnsynced).toBe(1)
    expect(map.toNtp(45_000).ntpMs).toBeCloseTo(BASE_NTP + 500, 6)
  })

  it('does not visibly bend the mapping for a single seconds-off outlier', () => {
    const map = createPtsNtpMap()
    for (let i = 0; i < 20; i++) {
      const ntp = BASE_NTP + i * 1_000 + (i === 10 ? 5_000 : 0)
      addPacing(map, i * 90_000, ntp)
    }
    const mid = map.toNtp(5 * 90_000)
    expect(mid.mode).toBe('interpolated')
    expect(mid.ntpMs).toBeCloseTo(BASE_NTP + 5_000, 0)
    expect(Math.abs((mid.ntpMs ?? 0) - (BASE_NTP + 5_000))).toBeLessThan(20)
  })

  it('resets the window on a backwards NTP clock step', () => {
    const map = createPtsNtpMap()
    for (let i = 0; i < 6; i++) {
      addPacing(map, i * 90_000, BASE_NTP + i * 1_000)
    }
    expect(map.health().pacingCount).toBe(6)

    addPacing(map, 6 * 90_000, BASE_NTP + 5_000 - 5_000)
    expect(map.health().rejected.clockStep).toBe(1)
    expect(map.health().pacingCount).toBe(1)

    addPacing(map, 7 * 90_000, BASE_NTP + 1_000)
    expect(map.health().pacingCount).toBe(2)
    const slope = map.health().slope
    expect(slope).not.toBeNull()
    expect(slope).toBeCloseTo(1, 3)
    expect(map.toNtp(6 * 90_000 + 45_000).mode).toBe('interpolated')
  })

  it('caps retained pacing anchors under a 30/s flood', () => {
    const map = createPtsNtpMap({ maxPacingCount: 16, windowMs: 60_000 })
    for (let i = 0; i < 200; i++) {
      addPacing(map, i * 3_000, BASE_NTP + i * (1000 / 30))
    }
    expect(map.health().pacingCount).toBe(16)
    expect(map.health().pacingCount).toBeLessThanOrEqual(16)
  })

  it('fits a clean synthetic 30 fps stream with slope ≈ 1', () => {
    const map = createPtsNtpMap()
    for (let i = 0; i < 60; i++) {
      addPacing(map, i * 3_000, BASE_NTP + (i * 1000) / 30)
    }
    const slope = map.health().slope
    expect(slope).not.toBeNull()
    expect(slope).toBeCloseTo(1, 5)
  })

  it('isolates maps per stream_id', () => {
    const a = getPtsNtpMap('5')
    const b = getPtsNtpMap('6')
    addPacing(a, 0, BASE_NTP, { stream_id: '5' })
    addPacing(a, 90_000, BASE_NTP + 1_000, { stream_id: '5' })
    addPacing(b, 0, BASE_NTP + 50_000, { stream_id: '6' })
    addPacing(b, 90_000, BASE_NTP + 51_000, { stream_id: '6' })

    expect(a.toNtp(45_000).ntpMs).toBeCloseTo(BASE_NTP + 500, 5)
    expect(b.toNtp(45_000).ntpMs).toBeCloseTo(BASE_NTP + 50_500, 5)
    expect(getPtsNtpMap('5')).toBe(a)
  })

  it('falls back to pts_basis_90khz and accepts kind:dji / gopro as pacing', () => {
    const map = createPtsNtpMap()
    map.addAnchor(
      anchor({
        kind: 'dji',
        pts_basis_90khz: 0,
        pts_90khz: null,
        ntp_capture_ms: BASE_NTP,
      }),
    )
    map.addAnchor(
      anchor({
        kind: 'gopro',
        pts_90khz: 90_000,
        ntp_capture_ms: BASE_NTP + 1_000,
      }),
    )
    expect(map.toNtp(45_000).ntpMs).toBeCloseTo(BASE_NTP + 500, 6)
    expect(map.health().pacingCount).toBe(2)
  })

  it('counts unknown kinds and unusable PTS', () => {
    const map = createPtsNtpMap({ streamId: '5' })
    map.addAnchor(anchor({ kind: 'mystery', pts_90khz: 0, ntp_capture_ms: BASE_NTP }))
    map.addAnchor(anchor({ pts_90khz: null, pts_basis_90khz: null, ntp_capture_ms: BASE_NTP }))
    map.addAnchor(anchor({ stream_id: '99', pts_90khz: 0, ntp_capture_ms: BASE_NTP }))
    map.addAnchor(anchor({ pts_90khz: 0, ntp_capture_ms: Number.NaN }))
    expect(map.health().rejected.unknownKind).toBe(1)
    expect(map.health().rejected.ptsUnusable).toBe(1)
    expect(map.health().rejected.wrongStream).toBe(1)
    expect(map.health().rejected.ntpNotFinite).toBe(1)
    expect(map.health().pacingCount).toBe(0)
  })

  it('reset() and dispose() clear state; dispose unregisters', () => {
    const map = getPtsNtpMap('7')
    addPacing(map, 0, BASE_NTP, { stream_id: '7' })
    addPacing(map, 90_000, BASE_NTP + 1_000, { stream_id: '7' })
    map.reset()
    expect(map.health().pacingCount).toBe(0)
    expect(map.health().lastPacingPts90k).toBeNull()
    expect(map.toNtp(45_000).mode).toBe('unavailable')

    addPacing(map, 0, BASE_NTP, { stream_id: '7' })
    map.dispose()
    expect(getPtsNtpMap('7')).not.toBe(map)
  })

  it('health.lastPacingPts90k is 33-bit PES of the last pacing sample', () => {
    const map = createPtsNtpMap()
    expect(map.health().lastPacingPts90k).toBeNull()
    addPacing(map, 90_000, BASE_NTP)
    expect(map.health().lastPacingPts90k).toBe(90_000)
    addPacing(map, PTS_MOD_33 + 3_000, BASE_NTP + 1_000)
    expect(map.health().lastPacingPts90k).toBe(3_000)
  })

  it('H.264 fallback reset zeros that stream only', () => {
    const srt = getPtsNtpMap('30')
    const telem = getPtsNtpMap('5')
    const other = getPtsNtpMap('other')
    addPacing(srt, 0, BASE_NTP, { stream_id: '30' })
    addPacing(srt, 90_000, BASE_NTP + 1_000, { stream_id: '30' })
    addPacing(telem, 0, BASE_NTP, { stream_id: '5' })
    addPacing(telem, 90_000, BASE_NTP + 1_000, { stream_id: '5' })
    addPacing(other, 0, BASE_NTP, { stream_id: 'other' })
    addPacing(other, 90_000, BASE_NTP + 1_000, { stream_id: 'other' })
    srt.reset()
    telem.reset()
    expect(srt.health().pacingCount).toBe(0)
    expect(telem.health().pacingCount).toBe(0)
    expect(srt.health().lastPacingPts90k).toBeNull()
    expect(other.health().pacingCount).toBe(2)
    expect(other.toNtp(45_000).mode).toBe('interpolated')
  })
})
