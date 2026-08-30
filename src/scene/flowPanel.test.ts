/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createFlowTap } from '../telemetry/flowTap.ts'
import {
  buildFlowCards,
  FLOW_CARD_RECENCY_MS,
  FLOW_LIVE_JSON_STORAGE_KEY,
  FLOW_POLL_MS,
  formatFlowJson,
  formatReceivedAt,
  normalizeFlowSnapshot,
  startFlowPanel,
} from './flowPanel.ts'

const here = dirname(fileURLToPath(import.meta.url))

afterEach(() => {
  sessionStorage.clear()
  document.body.replaceChildren()
})

describe('formatFlowJson / receivedAt', () => {
  it('pretty-prints and never emits a streamid token', () => {
    const secret = 'super-secret-token'
    const text = formatFlowJson({
      redactedUrl: `srt://49.13.20.49:9000?mode=caller&streamid=read:cam30:pub30:${secret}`,
    })
    expect(text).not.toContain(secret)
    expect(text).toMatch(/read:cam30:pub30:\*\*\*/)
    expect(text).toMatch(/\n/)
  })

  it('formats receivedAt as ISO + ms', () => {
    const line = formatReceivedAt(1_700_000_000_000)
    expect(line).toBe('2023-11-14T22:13:20.000Z (1700000000000)')
  })
})

describe('normalizeFlowSnapshot / buildFlowCards', () => {
  it('stubs empty when TEL-10 snapshot is missing', () => {
    expect(normalizeFlowSnapshot(undefined)).toEqual([])
    expect(normalizeFlowSnapshot(null)).toEqual([])
    expect(buildFlowCards(undefined, {}, 0)).toEqual([])
  })

  it('keeps registry boats as closed telem-only windows', () => {
    const cards = buildFlowCards(
      [],
      {
        boats: ['21'],
        povs: ['5'],
        buoys: ['91'],
      },
      0,
    )
    expect(cards.map((c) => c.id).sort()).toEqual(['21', '5', '91'])
    const boat = cards.find((c) => c.id === '21')!
    expect(boat.kind).toBe('boat')
    expect(boat.telem).toBeNull()
    expect(boat.srt).toBeNull()
    expect(boat.srtPlaceholder).toBe('no stream')
    expect(boat.badges).toEqual([])
    const pov = cards.find((c) => c.id === '5')!
    expect(pov.kind).toBe('drone')
    expect(pov.srtPlaceholder).toBe('null')
  })

  it('shows attitude-only telem + SRT + anchor badges', () => {
    const tap = createFlowTap({ nowMs: () => 50 })
    tap.push({
      kind: 'drone',
      id: '5',
      receivedAtMs: 10,
      body: { id: '5', ts: 99, pos: { lat: 0, lon: 0 }, gimbal: { yaw: 8 } },
    })
    tap.push({
      kind: 'anchor',
      id: '5',
      receivedAtMs: 11,
      body: { stream_id: '5', pts: 1 },
    })
    tap.push({
      kind: 'srt',
      id: '5',
      receivedAtMs: 12,
      body: { srtId: '30', framesDecoded: 3, redactedUrl: 'srt://h/?streamid=read:cam30:pub30:***' },
    })
    const cards = buildFlowCards(tap.snapshot(), { povs: ['5'] }, 12)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.badges).toEqual(['telem', 'srt', 'anchor'])
    expect(cards[0]!.telem?.body).toMatchObject({ ts: 99 })
    expect(cards[0]!.srt?.body).toMatchObject({ srtId: '30' })
  })

  it('always shows a registry id with no traffic (disconnected stays)', () => {
    const nowMs = 50_000
    const cards = buildFlowCards([], { povs: ['1', '2'] }, nowMs)
    expect(cards.map((c) => c.id)).toEqual(['1', '2'])
    expect(cards.every((c) => c.telem == null && c.srt == null)).toBe(true)
  })

  it('shows an unknown id that is actively sending', () => {
    const tap = createFlowTap()
    tap.push({
      kind: 'drone',
      id: 'dji-7',
      receivedAtMs: 9_000,
      body: { id: 'dji-7' },
    })
    const cards = buildFlowCards(tap.snapshot(), { povs: ['1'] }, 10_000)
    expect(cards.map((c) => c.id)).toEqual(['1', 'dji-7'])
  })

  it('drops an unknown id once it stops sending past the recency window', () => {
    const tap = createFlowTap()
    tap.push({
      kind: 'drone',
      id: 'dji-7',
      receivedAtMs: 4_000,
      body: { id: 'dji-7' },
    })
    const stillLive = buildFlowCards(
      tap.snapshot(),
      { povs: ['1'] },
      4_000 + FLOW_CARD_RECENCY_MS,
    )
    expect(stillLive.map((c) => c.id)).toEqual(['1', 'dji-7'])
    const aged = buildFlowCards(
      tap.snapshot(),
      { povs: ['1'] },
      4_000 + FLOW_CARD_RECENCY_MS + 1,
    )
    expect(aged.map((c) => c.id)).toEqual(['1'])
  })

  it('drops a deleted id after the tap is pruned, even if the last event is still recent', () => {
    const tap = createFlowTap()
    tap.push({ kind: 'drone', id: '1', receivedAtMs: 10_000, body: { id: '1' } })
    tap.push({ kind: 'drone', id: '2', receivedAtMs: 10_000, body: { id: '2' } })
    tap.retain(['1'])
    const cards = buildFlowCards(tap.snapshot(), { povs: ['1'] }, 10_000)
    expect(cards.map((c) => c.id)).toEqual(['1'])
  })

  it('ages out a non-registry SRT-only id when pushes stop', () => {
    const tap = createFlowTap()
    tap.push({
      kind: 'srt',
      id: '7',
      receivedAtMs: 1_000,
      body: { srtId: '30', framesDecoded: 1 },
    })
    const live = buildFlowCards(tap.snapshot(), { povs: ['1'] }, 2_000)
    expect(live.map((c) => c.id)).toEqual(['1', '7'])
    const aged = buildFlowCards(
      tap.snapshot(),
      { povs: ['1'] },
      1_000 + FLOW_CARD_RECENCY_MS + 1,
    )
    expect(aged.map((c) => c.id)).toEqual(['1'])
  })
})

describe('startFlowPanel', () => {
  it('defaults Live JSON off — no poll, empty body', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let snaps = 0
    const handle = startFlowPanel({
      container: host,
      getSnapshot: () => {
        snaps += 1
        return [{ id: '5', events: [] }]
      },
      getRegistryIds: () => ({ povs: ['5'] }),
      pollMs: FLOW_POLL_MS,
    })
    expect(handle.isLiveJson()).toBe(false)
    expect(host.querySelector('[data-ops="flow-body"]')?.hasAttribute('hidden')).toBe(
      true,
    )
    handle.refresh()
    expect(snaps).toBe(0)
    expect(host.querySelector('[data-flow-id]')).toBeNull()
    handle.dispose()
  })

  it('when on: renders JSON; toggle off stops updates', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let yaw = 1
    const handle = startFlowPanel({
      container: host,
      getSnapshot: () => [
        {
          id: '5',
          events: [
            {
              receivedAtMs: 100,
              kind: 'drone' as const,
              id: '5',
              body: { gimbal: { yaw } },
            },
          ],
        },
      ],
      getRegistryIds: () => ({ povs: ['5'] }),
      pollMs: 10_000,
    })
    handle.setLiveJson(true)
    const card = host.querySelector('[data-flow-id="5"]')
    expect(card).toBeTruthy()
    const telem = host.querySelector('[data-ops="flow-telem-json"]')
    expect(telem?.textContent).toMatch(/"yaw": 1/)
    expect(sessionStorage.getItem(FLOW_LIVE_JSON_STORAGE_KEY)).toBe('1')

    yaw = 99
    handle.setLiveJson(false)
    handle.refresh()
    expect(host.querySelector('[data-flow-id]')).toBeNull()
    expect(telem?.isConnected).toBe(false)

    handle.dispose()
  })

  it('token never appears in rendered SRT text; pop-out docks back', () => {
    const host = document.createElement('div')
    const overlay = document.createElement('div')
    document.body.append(host, overlay)
    const secret = 'n0t-in-the-dom'
    const handle = startFlowPanel({
      container: host,
      overlayHost: overlay,
      getSnapshot: () => [
        {
          id: '5',
          events: [
            {
              receivedAtMs: 1,
              kind: 'srt' as const,
              id: '5',
              body: {
                redactedUrl: `srt://h:9000?streamid=read:cam1:pub1:${secret}`,
              },
            },
          ],
        },
      ],
      getRegistryIds: () => ({ povs: ['5'] }),
      pollMs: 10_000,
    })
    handle.setLiveJson(true)
    const dump = host.textContent ?? ''
    expect(dump).not.toContain(secret)
    expect(host.querySelector('[data-ops="flow-srt-json"]')?.textContent).toMatch(
      /\*\*\*/,
    )

    const pop = host.querySelector('[data-ops="flow-pop"]') as HTMLButtonElement
    pop.click()
    const popped = overlay.querySelector('[data-flow-id="5"]')
    expect(popped).toBeTruthy()
    expect(popped?.classList.contains('flow-panel__card--pop')).toBe(true)
    const dock = overlay.querySelector('[data-ops="flow-pop"]') as HTMLButtonElement
    dock.click()
    expect(host.querySelector('[data-flow-id="5"]')).toBeTruthy()
    expect(overlay.querySelector('[data-flow-id="5"]')).toBeNull()
    handle.dispose()
  })

  it('beforePoll runs only while live', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let pushes = 0
    const handle = startFlowPanel({
      container: host,
      getSnapshot: () => [],
      beforePoll: () => {
        pushes += 1
      },
      pollMs: 10_000,
    })
    expect(pushes).toBe(0)
    handle.setLiveJson(true)
    expect(pushes).toBe(1)
    handle.setLiveJson(false)
    handle.refresh()
    expect(pushes).toBe(1)
    handle.dispose()
  })
})

describe('overlay never reaches NDI (source)', () => {
  it('is DOM-only — no WebGL / NDI / renderer.render', () => {
    const src = readFileSync(join(here, 'flowPanel.ts'), 'utf8')
    expect(src).toMatch(/DOM overlay only/)
    expect(src).not.toMatch(/readRenderTargetPixels/)
    expect(src).not.toMatch(/WebGLRenderer/)
    expect(src).not.toMatch(/renderer\.render\s*=/)
    expect(src).not.toMatch(/ndi\.sendFrame/)
    expect(src).not.toMatch(/getStudioBridge/)
    expect(src).not.toMatch(/startNdiFramePump/)
  })
})
