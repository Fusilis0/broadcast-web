import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIVE_WS_BASE,
  buildLiveWsUrlForId,
  buildLiveWsUrlsForIds,
  stripLiveWsId,
} from './liveWsUrl.ts'

describe('liveWsUrl', () => {
  it('DEFAULT_LIVE_WS_BASE has no subscribe/id', () => {
    expect(DEFAULT_LIVE_WS_BASE).toBe('ws://49.13.20.49:8080/ws')
    expect(stripLiveWsId(DEFAULT_LIVE_WS_BASE)).toBe(DEFAULT_LIVE_WS_BASE)
  })

  it('stripLiveWsId removes type, id, and subscribe', () => {
    expect(
      stripLiveWsId('ws://49.13.20.49:8080/ws?type=client&subscribe=40'),
    ).toBe('ws://49.13.20.49:8080/ws')
    expect(
      stripLiveWsId('ws://49.13.20.49:8080/ws?type=drone&id=40'),
    ).toBe('ws://49.13.20.49:8080/ws')
  })

  it('buildLiveWsUrlForId appends type=client and subscribe', () => {
    expect(buildLiveWsUrlForId(DEFAULT_LIVE_WS_BASE, '40')).toBe(
      'ws://49.13.20.49:8080/ws?type=client&subscribe=40',
    )
  })

  it('buildLiveWsUrlsForIds one URL per unique id', () => {
    expect(
      buildLiveWsUrlsForIds(DEFAULT_LIVE_WS_BASE, ['40', '41', '40', '']),
    ).toEqual([
      'ws://49.13.20.49:8080/ws?type=client&subscribe=40',
      'ws://49.13.20.49:8080/ws?type=client&subscribe=41',
    ])
  })

  it('buildLiveWsUrlsForIds with only enabled boat 40 → one URL', () => {
    const enabled = ['40']
    expect(buildLiveWsUrlsForIds(DEFAULT_LIVE_WS_BASE, enabled)).toEqual([
      'ws://49.13.20.49:8080/ws?type=client&subscribe=40',
    ])
  })

  it('buildLiveWsUrlsForIds empty enabled → no URLs', () => {
    expect(buildLiveWsUrlsForIds(DEFAULT_LIVE_WS_BASE, [])).toEqual([])
  })
})
