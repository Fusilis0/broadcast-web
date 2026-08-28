/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildSyncDebugSnapshot,
  clampAdaptiveLatencyMs,
  emptyPtsNtpHealth,
  formatHealthLine,
  isFreeRun,
  PRESENTATION_LATENCY_MAX_MS,
  PRESENTATION_LATENCY_MIN_MS,
  startSyncDebugPanel,
  syncDebugBadges,
  type SyncDebugStreamSnapshot,
} from './syncDebugPanel.ts'
import type { PtsNtpHealth } from '../telemetry/ptsNtpMap.ts'

const here = dirname(fileURLToPath(import.meta.url))

function healthyAnchors(): PtsNtpHealth {
  return {
    pacingCount: 8,
    frameCount: 4,
    slope: 1.002,
    lastAnchorNtpMs: 1_700_000_000_000,
    lastPacingPts90k: 7_593_150,
    lastAnchorAgeMs: 120,
    rejected: {
      ntpUnsynced: 0,
      ntpNotFinite: 0,
      ptsUnusable: 1,
      unknownKind: 0,
      wrongStream: 0,
      clockStep: 0,
    },
    residualMs: 3.5,
  }
}

function fullRow(
  partial: Partial<SyncDebugStreamSnapshot> = {},
): SyncDebugStreamSnapshot {
  return buildSyncDebugSnapshot({
    povId: '5',
    srtId: '30',
    health: healthyAnchors(),
    syncTrimMs: 40,
    presentedPts90k: 90000,
    resolvedNtpMs: 1_700_000_000_100,
    ptsMode: 'interpolated',
    extrapolatedByMs: 0,
    presentationLatencyMs: 180,
    poseAgeMs: 80,
    poseMode: 'interpolated',
    tNtpMs: 1_700_000_000_100,
    newestPoseNtpMs: 1_700_000_000_000,
    poseMinusVideoMs: -100,
    boats: [{ id: '21', mode: 'held', heldBearingUnknown: true }],
    decoder: { framesDecoded: 12, framesDropped: 1, queueDepth: 2 },
    ...partial,
  })
}

describe('clampAdaptiveLatencyMs', () => {
  it('pins at 100 and 400', () => {
    expect(clampAdaptiveLatencyMs(40)).toEqual({
      effectiveMs: PRESENTATION_LATENCY_MIN_MS,
      pinned: 'floor',
    })
    expect(clampAdaptiveLatencyMs(900)).toEqual({
      effectiveMs: PRESENTATION_LATENCY_MAX_MS,
      pinned: 'ceiling',
    })
    expect(clampAdaptiveLatencyMs(180)).toEqual({
      effectiveMs: 180,
      pinned: null,
    })
  })
})

describe('buildSyncDebugSnapshot / badges', () => {
  it('free-run when pacingCount is 0', () => {
    const row = buildSyncDebugSnapshot({
      povId: '5',
      srtId: '30',
      health: emptyPtsNtpHealth(),
      syncTrimMs: 0,
    })
    expect(isFreeRun(row.health)).toBe(true)
    expect(row.freeRun).toBe(true)
    expect(row.ptsMode).toBe('unavailable')
    expect(syncDebugBadges(row)).toContain('FREE-RUN')
  })

  it('does not badge FREE-RUN when holding (pacingCount 0 override)', () => {
    const row = buildSyncDebugSnapshot({
      povId: '5',
      srtId: '30',
      health: emptyPtsNtpHealth(),
      syncTrimMs: 0,
      freeRun: false,
      poseMode: 'held',
    })
    expect(row.freeRun).toBe(false)
    expect(syncDebugBadges(row)).not.toContain('FREE-RUN')
    expect(row.poseMode).toBe('held')
  })

  it('distinguishes extrapolating, clamp pinned, pose stale, boat held', () => {
    const row = fullRow({
      ptsMode: 'extrapolated',
      extrapolatedByMs: 250,
      presentationLatencyMs: 800,
      poseAgeMs: 3500,
      poseMode: 'held',
    })
    // rebuild so clamp / stale flags apply
    const built = buildSyncDebugSnapshot({
      povId: row.povId,
      srtId: row.srtId,
      health: row.health,
      syncTrimMs: row.syncTrimMs,
      presentedPts90k: row.presentedPts90k,
      resolvedNtpMs: row.resolvedNtpMs,
      ptsMode: 'extrapolated',
      extrapolatedByMs: 250,
      presentationLatencyMs: 800,
      poseAgeMs: 3500,
      poseMode: 'held',
      boats: row.boats,
      decoder: row.decoder,
    })
    const badges = syncDebugBadges(built)
    expect(badges).toEqual(
      expect.arrayContaining([
        'EXTRAPOLATING',
        'CLAMP PINNED',
        'POSE STALE',
        'BOAT HELD',
      ]),
    )
    expect(badges).not.toContain('FREE-RUN')
    expect(built.latencyClampPinned).toBe('ceiling')
    expect(built.poseStale).toBe(true)
  })

  it('formatHealthLine includes pacing/frames/slope/residual/age/rejects', () => {
    const line = formatHealthLine(healthyAnchors())
    expect(line).toMatch(/pacing 8/)
    expect(line).toMatch(/frames 4/)
    expect(line).toMatch(/slope 1\.0020/)
    expect(line).toMatch(/resid 3\.5ms/)
    expect(line).toMatch(/age 120ms/)
    expect(line).toMatch(/pts1/)
  })
})

describe('startSyncDebugPanel', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('is off by default and renders every field when enabled', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const handle = startSyncDebugPanel({
      container: host,
      getSnapshot: () => [fullRow()],
      pollMs: 10_000,
    })
    expect(handle.isEnabled()).toBe(false)
    expect(host.querySelector('.sync-debug__body')?.hasAttribute('hidden')).toBe(
      true,
    )

    handle.setEnabled(true)
    const stream = host.querySelector('[data-sync-pov="5"]')
    expect(stream).toBeTruthy()
    const text = stream?.textContent ?? ''
    expect(text).toMatch(/POV 5/)
    expect(text).toMatch(/SRT 30/)
    expect(text).toMatch(/90000/)
    expect(text).toMatch(/last pacing 7593150/)
    expect(text).toMatch(/1700000000100/)
    expect(text).toMatch(/interpolated/)
    expect(text).toMatch(/newest−t_ntp/)
    expect(text).toMatch(/-100ms/)
    expect(text).toMatch(/180ms/)
    expect(text).toMatch(/pacing 8/)
    expect(text).toMatch(/slope/)
    expect(text).toMatch(/held \(bearing unknown\)/)
    expect(text).toMatch(/decoded 12/)
    expect(text).toMatch(/dropped 1/)
    expect(text).toMatch(/queue 2/)
    expect(text).toMatch(/40ms \(CAL, read-only\)/)
    expect(host.querySelector('[data-sync-badge="BOAT HELD"]')).toBeTruthy()

    handle.dispose()
    expect(host.querySelector('[data-ops="sync-debug"]')).toBeNull()
  })

  it('badges FREE-RUN when a stream has no anchors', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const handle = startSyncDebugPanel({
      container: host,
      getSnapshot: () => [
        buildSyncDebugSnapshot({
          povId: '5',
          srtId: '30',
          health: emptyPtsNtpHealth(),
          syncTrimMs: 0,
        }),
      ],
      pollMs: 10_000,
    })
    handle.setEnabled(true)
    expect(host.querySelector('[data-sync-badge="FREE-RUN"]')).toBeTruthy()
    handle.dispose()
  })
})

describe('overlay never reaches NDI (source)', () => {
  it('is DOM-only — no WebGL / NDI / renderer.render', () => {
    const src = readFileSync(join(here, 'syncDebugPanel.ts'), 'utf8')
    expect(src).toMatch(/DOM-only/)
    expect(src).not.toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/WebGLRenderer/)
    expect(src).not.toMatch(/renderer\.render\s*=/)
    expect(src).not.toMatch(/ndi\.sendFrame/)
    expect(src).not.toMatch(/getStudioBridge/)
    expect(src).not.toMatch(/startNdiFramePump/)
  })
})
