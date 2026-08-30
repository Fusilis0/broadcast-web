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

describe('fleet live telemetry disconnect', () => {
  afterEach(() => {
    document.body.replaceChildren()
    sessionStorage.clear()
  })

  function mount(opts?: {
    onLiveDisconnect?: () => void
    onLiveEnabledChange?: (s: { boatIds: string[]; povIds: string[] }) => void
    onLiveApply?: () => void
  }) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: ['21', '22'],
        povIds: ['1'],
        enabledBoatIds: ['21', '22'],
        enabledPovIds: ['1'],
        boats: [
          { id: '21', name: '21', category: '' },
          { id: '22', name: '22', category: '' },
        ],
        activePovId: '1',
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: opts?.onLiveApply ?? (() => {}),
      onLiveDisconnect: opts?.onLiveDisconnect,
      onLiveEnabledChange: opts?.onLiveEnabledChange,
    })
    return { host, handle }
  }

  it('places Disconnect beside Connect live / Reconnect without renaming Connect SRT', () => {
    const { host, handle } = mount()
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent)
    expect(labels).toContain('Disconnect')
    expect(labels).toContain('Connect live')
    expect(labels).toContain('Reconnect')
    expect(labels).toContain('Connect SRT')
    const disconnect = host.querySelector(
      '[data-ops="live-ws-disconnect"]',
    ) as HTMLButtonElement
    expect(disconnect).toBeTruthy()
    expect(disconnect.disabled).toBe(true)
    expect(host.querySelector('[data-ops="srt-situation"]')).toBeTruthy()
    handle.stop()
  })

  it('Disconnect click fires onLiveDisconnect', () => {
    let n = 0
    const { host, handle } = mount({ onLiveDisconnect: () => n++ })
    handle.setLiveStatus({
      drone: 'open',
      boat: 'open',
      droneIds: [
        {
          id: '1',
          url: 'ws://example/ws?subscribe=1',
          status: 'open',
          lastPacketAtMs: null,
          lastPacketAgeMs: null,
        },
      ],
      boatIds: [
        {
          id: '21',
          url: 'ws://example/ws?subscribe=21',
          status: 'open',
          lastPacketAtMs: null,
          lastPacketAgeMs: null,
        },
      ],
    })
    const disconnect = host.querySelector(
      '[data-ops="live-ws-disconnect"]',
    ) as HTMLButtonElement
    expect(disconnect.disabled).toBe(false)
    const connect = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Connect live',
    ) as HTMLButtonElement
    expect(connect.disabled).toBe(true)
    disconnect.click()
    expect(n).toBe(1)
    const status = host.querySelector('.fleet-live__status')
    expect(status?.textContent).toMatch(/disconnected/i)
    handle.stop()
  })

  it('unchecking Live notifies onLiveEnabledChange with that id removed', () => {
    const seen: { boatIds: string[]; povIds: string[] }[] = []
    const { host, handle } = mount({
      onLiveEnabledChange: (s) => seen.push(s),
    })
    const row = host.querySelector('[data-fleet-boat-id="21"]')
    const enable = row?.querySelector(
      '.fleet-live__enable',
    ) as HTMLInputElement
    expect(enable?.checked).toBe(true)
    enable.checked = false
    enable.dispatchEvent(new Event('change'))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]?.boatIds).not.toContain('21')
    expect(seen[seen.length - 1]?.boatIds).toContain('22')
    handle.stop()
  })
})

describe('fleet live SRT disconnect', () => {
  afterEach(() => {
    document.body.replaceChildren()
    sessionStorage.clear()
  })

  function mount(opts?: {
    onSrtDisconnect?: () => void
    onSrtEnabledChange?: (s: {
      enabledSrtPovIds: string[]
      streams: { povId: string; srtId: string; url: string }[]
    }) => void
    onSrtApply?: (s: {
      streams: { povId: string; srtId: string; url: string }[]
    }) => void
  }) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const handle = startFleetLivePanel({
      container: host,
      initial: {
        wsUrl: 'ws://example/ws',
        wsBoatUrl: 'ws://example/ws',
        boatIds: [],
        povIds: ['1', '2'],
        enabledBoatIds: [],
        enabledPovIds: [],
        boats: [],
        activePovId: '1',
        srtUrlTemplate: '',
        srtByPovId: { '1': '18', '2': '19' },
        enabledSrtPovIds: ['1', '2'],
      },
      onFleetChange: () => {},
      onPovChange: () => {},
      onLiveApply: () => {},
      onSrtApply: opts?.onSrtApply,
      onSrtDisconnect: opts?.onSrtDisconnect,
      onSrtEnabledChange: opts?.onSrtEnabledChange,
    })
    return { host, handle }
  }

  it('places Disconnect SRT beside Connect SRT without renaming telemetry Disconnect', () => {
    const { host, handle } = mount()
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent)
    expect(labels).toContain('Disconnect SRT')
    expect(labels).toContain('Connect SRT')
    expect(labels).toContain('Disconnect')
    const disconnect = host.querySelector(
      '[data-ops="srt-disconnect"]',
    ) as HTMLButtonElement
    expect(disconnect).toBeTruthy()
    expect(disconnect.disabled).toBe(true)
    expect(host.querySelector('[data-ops="srt-summary"]')).toBeTruthy()
    handle.stop()
  })

  it('Disconnect SRT click fires onSrtDisconnect', () => {
    let n = 0
    const { host, handle } = mount({ onSrtDisconnect: () => n++ })
    handle.setSrtStatus({
      povs: [
        { povId: '1', state: 'live', bitrateKbps: 1200 },
        { povId: '2', state: 'connecting', bitrateKbps: 0 },
      ],
    })
    const disconnect = host.querySelector(
      '[data-ops="srt-disconnect"]',
    ) as HTMLButtonElement
    expect(disconnect.disabled).toBe(false)
    const connect = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Connect SRT',
    ) as HTMLButtonElement
    expect(connect.disabled).toBe(true)
    disconnect.click()
    expect(n).toBe(1)
    const status = host.querySelector('.fleet-live__status')
    expect(status?.textContent).toMatch(/SRT disconnected/i)
    handle.stop()
  })

  it('unchecking Vid notifies onSrtEnabledChange with that POV removed', () => {
    const seen: {
      enabledSrtPovIds: string[]
      streams: { povId: string }[]
    }[] = []
    const { host, handle } = mount({
      onSrtEnabledChange: (s) => seen.push(s),
    })
    const vids = [
      ...host.querySelectorAll('[data-ops="srt-vid"]'),
    ] as HTMLInputElement[]
    expect(vids).toHaveLength(2)
    expect(vids[0]?.checked).toBe(true)
    vids[0]!.checked = false
    vids[0]!.dispatchEvent(new Event('change'))
    expect(seen.length).toBeGreaterThan(0)
    const last = seen[seen.length - 1]!
    expect(last.enabledSrtPovIds).not.toContain('1')
    expect(last.enabledSrtPovIds).toContain('2')
    expect(last.streams.map((s) => s.povId)).not.toContain('1')
    expect(last.streams.map((s) => s.povId)).toContain('2')
    handle.stop()
  })
})
