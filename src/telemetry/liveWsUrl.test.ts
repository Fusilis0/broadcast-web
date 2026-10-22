import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIVE_WS_BASE,
  buildLiveWsUrlForId,
  buildLiveWsUrlsForIds,
  stripLiveWsId,
} from './liveWsUrl.ts'

const EXAMPLE_WS = 'ws://127.0.0.1:8080/ws'

describe('liveWsUrl', () => {
  it('DEFAULT_LIVE_WS_BASE is empty in git (no production host)', () => {
    expect(DEFAULT_LIVE_WS_BASE).toBe('')
    expect(stripLiveWsId(DEFAULT_LIVE_WS_BASE)).toBe('')
  })

  it('stripLiveWsId removes type, id, and subscribe', () => {
    expect(
      stripLiveWsId(`${EXAMPLE_WS}?type=client&subscribe=40`),
    ).toBe(EXAMPLE_WS)
    expect(stripLiveWsId(`${EXAMPLE_WS}?type=drone&id=40`)).toBe(EXAMPLE_WS)
  })

  it('buildLiveWsUrlForId appends type=client and subscribe', () => {
    expect(buildLiveWsUrlForId(EXAMPLE_WS, '40')).toBe(
      `${EXAMPLE_WS}?type=client&subscribe=40`,
    )
  })

  it('buildLiveWsUrlsForIds one URL per unique id', () => {
    expect(
      buildLiveWsUrlsForIds(EXAMPLE_WS, ['40', '41', '40', '']),
    ).toEqual([
      `${EXAMPLE_WS}?type=client&subscribe=40`,
      `${EXAMPLE_WS}?type=client&subscribe=41`,
    ])
  })

  it('buildLiveWsUrlsForIds with only enabled boat 40 → one URL', () => {
    const enabled = ['40']
    expect(buildLiveWsUrlsForIds(EXAMPLE_WS, enabled)).toEqual([
      `${EXAMPLE_WS}?type=client&subscribe=40`,
    ])
  })

  it('buildLiveWsUrlsForIds empty enabled → no URLs', () => {
    expect(buildLiveWsUrlsForIds(EXAMPLE_WS, [])).toEqual([])
  })
})
