import { describe, expect, it } from 'vitest'
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
})
