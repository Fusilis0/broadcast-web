import { describe, expect, it } from 'vitest'
import { formatOpsViewStatus } from './freeCam.ts'
import { clampTerrainWaterDiscardYM, formatConnectionStatus, formatHitchLabel } from './stubHud.ts'
import { DEFAULT_TERRAIN_WATER_DISCARD_Y } from './terrain/index.ts'

describe('formatConnectionStatus', () => {
  it('labels mock / replay as non-live', () => {
    expect(formatConnectionStatus({ kind: 'non_live', mode: 'mock' })).toBe(
      'ws=n/a (mock)',
    )
    expect(formatConnectionStatus({ kind: 'non_live', mode: 'replay' })).toBe(
      'ws=n/a (replay)',
    )
  })

  it('formats live per-channel statuses without inventing open', () => {
    expect(
      formatConnectionStatus({
        kind: 'live',
        channels: { drone: 'idle', boat: 'idle' },
      }),
    ).toBe('ws drone=idle boat=idle')
    expect(
      formatConnectionStatus({
        kind: 'live',
        channels: { drone: 'open', boat: 'connecting' },
      }),
    ).toBe('ws drone=open boat=connecting')
    expect(
      formatConnectionStatus({
        kind: 'live',
        channels: { drone: 'closed', boat: 'closed' },
      }),
    ).toBe('ws drone=closed boat=closed')
  })

  it('formats per-id open vs nopkt', () => {
    expect(
      formatConnectionStatus({
        kind: 'live',
        channels: {
          drone: 'idle',
          boat: 'open',
          droneIds: [],
          boatIds: [
            {
              id: '40',
              url: 'ws://x/ws?type=client&subscribe=40',
              status: 'open',
              lastPacketAtMs: null,
              lastPacketAgeMs: null,
            },
          ],
        },
      }),
    ).toBe('ws drone=idle b40=open/nopkt')
    expect(
      formatConnectionStatus({
        kind: 'live',
        channels: {
          drone: 'open',
          boat: 'open',
          droneIds: [
            {
              id: '1',
              url: 'ws://x/ws?type=client&subscribe=1',
              status: 'open',
              lastPacketAtMs: Date.now() - 120,
              lastPacketAgeMs: 120,
            },
          ],
          boatIds: [
            {
              id: '40',
              url: 'ws://x/ws?type=client&subscribe=40',
              status: 'open',
              lastPacketAtMs: Date.now() - 2100,
              lastPacketAgeMs: 2100,
            },
          ],
        },
      }),
    ).toBe('ws d1=open/120ms b40=open/2.1s')
  })

  it('formats retrying with backoff delay', () => {
    expect(
      formatConnectionStatus({
        kind: 'live',
        channels: {
          drone: 'retrying',
          boat: 'closed',
          droneIds: [
            {
              id: '1',
              url: 'ws://x/ws?type=client&subscribe=1',
              status: 'retrying',
              lastPacketAtMs: null,
              lastPacketAgeMs: null,
              retryInMs: 500,
            },
          ],
          boatIds: [
            {
              id: '40',
              url: 'ws://x/ws?type=client&subscribe=40',
              status: 'closed',
              lastPacketAtMs: null,
              lastPacketAgeMs: null,
            },
          ],
        },
      }),
    ).toBe('ws d1=retrying/500ms b40=closed/nopkt')
  })
})

describe('formatOpsViewStatus', () => {
  it('labels follow vs free preview', () => {
    expect(formatOpsViewStatus('follow')).toBe('view=follow')
    expect(formatOpsViewStatus('free')).toBe('view=free')
  })
})

describe('clampTerrainWaterDiscardYM', () => {
  it('clamps −20…+5 m and defaults non-finite to 0.5', () => {
    expect(DEFAULT_TERRAIN_WATER_DISCARD_Y).toBe(0.5)
    expect(clampTerrainWaterDiscardYM(0.5)).toBe(0.5)
    expect(clampTerrainWaterDiscardYM(0)).toBe(0)
    expect(clampTerrainWaterDiscardYM(5)).toBe(5)
    expect(clampTerrainWaterDiscardYM(-1)).toBe(-1)
    expect(clampTerrainWaterDiscardYM(-2)).toBe(-2)
    expect(clampTerrainWaterDiscardYM(-20)).toBe(-20)
    expect(clampTerrainWaterDiscardYM(-21)).toBe(-20)
    expect(clampTerrainWaterDiscardYM(9)).toBe(5)
    expect(clampTerrainWaterDiscardYM(Number.NaN)).toBe(0.5)
  })
})

describe('formatHitchLabel', () => {
  it('shows 0 when no >50 ms frames, else N / 1s (>50ms)', () => {
    expect(formatHitchLabel(0)).toBe('0')
    expect(formatHitchLabel(2)).toBe('2 / 1s (>50ms)')
  })
})
