/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { buildSrtCallerUrl } from '../output/srtCallerUrl.ts'
import { startFleetLivePanel } from './fleetLivePanel.ts'

describe('fleet live SRT config (L9)', () => {
  afterEach(() => {
    document.body.replaceChildren()
    sessionStorage.clear()
  })

  it('puts SRT id beside telemetry id; template substitutes srtId not povId', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const srtApplies: { povId: string; srtId: string; url: string }[] = []
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: ['21'],
        povIds: ['5'],
        enabledBoatIds: [],
        enabledPovIds: [],
        boats: [{ id: '21', name: '21', category: '' }],
        activePovId: '5',
        srtUrlTemplate:
          'srt://49.13.20.49:9000?mode=caller&streamid=read:cam{srtId}:pub{srtId}:tok',
        srtByPovId: { '5': '30' },
        enabledSrtPovIds: ['5'],
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: () => {},
      onSrtApply: ({ streams }) => {
        srtApplies.push(...streams)
      },
    })

    const srtInput = host.querySelector(
      '.fleet-live__srt',
    ) as HTMLInputElement | null
    expect(srtInput?.value).toBe('30')
    const template = host.querySelector(
      'input[placeholder*="catalog"]',
    ) as HTMLInputElement | null
    expect(template?.value).toContain('{srtId}')

    const connectSrt = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Connect SRT',
    )
    expect(connectSrt).toBeTruthy()
    connectSrt?.click()
    expect(srtApplies).toHaveLength(1)
    expect(srtApplies[0]?.povId).toBe('5')
    expect(srtApplies[0]?.srtId).toBe('30')
    const sid = new URL(srtApplies[0]!.url).searchParams.get('streamid')
    expect(sid).toBe('read:cam30:pub30:tok')
    expect(sid).not.toMatch(/cam5|pub5/)

    const composed = buildSrtCallerUrl(handle.getState().srtUrlTemplate, '30')
    expect(composed.ok).toBe(true)
    if (composed.ok) {
      expect(new URL(composed.href).searchParams.get('streamid')).toBe(
        'read:cam30:pub30:tok',
      )
    }

    handle.stop()
  })

  it('empty template uses the catalog; filled template remains the escape hatch', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const srtApplies: { povId: string; srtId: string; url: string }[] = []
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: ['21'],
        povIds: ['5'],
        enabledBoatIds: [],
        enabledPovIds: [],
        boats: [{ id: '21', name: '21', category: '' }],
        activePovId: '5',
        srtUrlTemplate: '',
        srtByPovId: { '5': '18' },
        enabledSrtPovIds: ['5'],
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: () => {},
      onSrtApply: ({ streams }) => {
        srtApplies.push(...streams)
      },
    })

    const connectSrt = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Connect SRT',
    )
    connectSrt?.click()
    expect(srtApplies).toHaveLength(1)
    expect(srtApplies[0]?.srtId).toBe('18')
    const parsed = new URL(srtApplies[0]!.url)
    expect(parsed.hostname).toBe('49.13.20.49')
    expect(parsed.port).toBe('9000')
    expect(parsed.searchParams.get('streamid')).toBe(
      'read:cam18:pub18:e8r4m3',
    )
    expect(parsed.searchParams.get('mode')).toBe('caller')

    handle.stop()
  })

  it('dummy srt://host:… template uses the catalog instead of opening hostname host', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const srtApplies: { povId: string; srtId: string; url: string }[] = []
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: [],
        povIds: ['1'],
        enabledBoatIds: [],
        enabledPovIds: [],
        boats: [],
        activePovId: '1',
        srtUrlTemplate: 'srt://host:9000?mode=caller&streamid=read:cam{id}',
        srtByPovId: { '1': '1' },
        enabledSrtPovIds: ['1'],
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: () => {},
      onSrtApply: ({ streams }) => {
        srtApplies.push(...streams)
      },
    })

    const connectSrt = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Connect SRT',
    )
    connectSrt?.click()
    expect(srtApplies).toHaveLength(1)
    const parsed = new URL(srtApplies[0]!.url)
    expect(parsed.hostname).toBe('49.13.20.49')
    expect(parsed.searchParams.get('streamid')).toBe('read:cam1:pub1:k3q9x7')
    expect(handle.getState().srtUrlTemplate).toBe('')
    expect(host.querySelector('[data-ops="srt-situation"]')).toBeTruthy()

    handle.stop()
  })

  it('unknown catalog id does not open; empty SRT id still skips', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const srtApplies: { povId: string; srtId: string; url: string }[] = []
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: [],
        povIds: ['5', '6'],
        enabledBoatIds: [],
        enabledPovIds: [],
        boats: [],
        activePovId: '5',
        srtUrlTemplate: '',
        srtByPovId: { '5': '30', '6': '' },
        enabledSrtPovIds: ['5', '6'],
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: () => {},
      onSrtApply: ({ streams }) => {
        srtApplies.push(...streams)
      },
    })

    const connectSrt = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Connect SRT',
    )
    connectSrt?.click()
    expect(srtApplies).toHaveLength(0)
    const status = host.querySelector('.fleet-live__status')
    expect(status?.textContent).toMatch(/catalog/i)
    expect(status?.textContent).toMatch(/30/)

    handle.stop()
  })

  it('Video enable is independent of Live WS checkbox', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: [],
        povIds: ['5'],
        enabledBoatIds: [],
        enabledPovIds: [],
        boats: [],
        activePovId: '5',
        enabledSrtPovIds: ['5'],
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: () => {},
    })
    const state = handle.getState()
    expect(state.enabledPovIds).toEqual([])
    expect(state.enabledSrtPovIds).toEqual(['5'])
    handle.stop()
  })
})
