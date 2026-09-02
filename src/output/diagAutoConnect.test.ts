import { describe, expect, it } from 'vitest'
import {
  diagAutoConnectIsNoop,
  parseDiagAutoConnect,
  parseIdList,
} from './diagAutoConnect.ts'

describe('parseDiagAutoConnect', () => {
  it('is a no-op on the default studio URL', () => {
    const boot = parseDiagAutoConnect(
      '?race=demo-istanbul&outputMode=transparent',
    )
    expect(diagAutoConnectIsNoop(boot)).toBe(true)
    expect(boot.arBackground).toBeNull()
    expect(boot.autoConnectSrt).toBe(false)
    expect(boot.srtPovIds).toEqual([])
  })

  it('does not invent a POV when autoConnectSrt is set without srtPov', () => {
    const boot = parseDiagAutoConnect('?autoConnectSrt=1')
    expect(boot.autoConnectSrt).toBe(true)
    expect(boot.srtPovIds).toEqual([])
  })

  it('reads arBackground, live, and srt ids from the query', () => {
    const boot = parseDiagAutoConnect(
      '?arBackground=video&autoConnectLive=1&livePov=1&autoConnectSrt=true&srtPov=1,1,2',
    )
    expect(boot.arBackground).toBe('video')
    expect(boot.autoConnectLive).toBe(true)
    expect(boot.autoConnectSrt).toBe(true)
    expect(boot.livePovIds).toEqual(['1'])
    expect(boot.srtPovIds).toEqual(['1', '2'])
  })
})

describe('parseIdList', () => {
  it('trims, drops empties, and de-dupes', () => {
    expect(parseIdList(' 1, ,2,1 ')).toEqual(['1', '2'])
    expect(parseIdList(null)).toEqual([])
  })
})
