import { describe, expect, it } from 'vitest'
import { formatOpsViewStatus } from './freeCam.ts'
import { formatConnectionStatus } from './stubHud.ts'

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
              url: 'ws://x/ws?type=drone&id=40',
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
              url: 'ws://x/ws?type=drone&id=1',
              status: 'open',
              lastPacketAtMs: Date.now() - 120,
              lastPacketAgeMs: 120,
            },
          ],
          boatIds: [
            {
              id: '40',
              url: 'ws://x/ws?type=drone&id=40',
              status: 'open',
              lastPacketAtMs: Date.now() - 2100,
              lastPacketAgeMs: 2100,
            },
          ],
        },
      }),
    ).toBe('ws d1=open/120ms b40=open/2.1s')
  })
})

describe('formatOpsViewStatus', () => {
  it('labels follow vs free preview', () => {
    expect(formatOpsViewStatus('follow')).toBe('view=follow')
    expect(formatOpsViewStatus('free')).toBe('view=free')
  })
})
