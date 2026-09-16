/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createSrtChannelPresetStore } from './srtChannelVisibility.ts'
import { startSrtProgramBar } from './srtProgramBar.ts'
import type { LocalChannelFocus } from '../output/localChannelSwitcher.ts'

describe('startSrtProgramBar', () => {
  const hosts: HTMLElement[] = []
  afterEach(() => {
    for (const h of hosts) h.remove()
    hosts.length = 0
  })

  it('shows that channel’s toggles on local 3D → AR without copying 3D onto AR', () => {
    const store = createSrtChannelPresetStore()
    let focus: LocalChannelFocus = '3d'
    const host = document.createElement('div')
    document.body.appendChild(host)
    hosts.push(host)

    const bar = startSrtProgramBar({
      container: host,
      getFocus: () => focus,
      getPreset: (channel) => store.get(channel),
      onPresetChange: (channel, key, value) => {
        store.set(channel, { [key]: value })
      },
    })

    const root = host.querySelector('.srt-program-bar') as HTMLElement
    expect(root).toBeTruthy()
    expect(root.closest('.ops-sidebar')).toBeNull()

    const pane3d = host.querySelector('[data-pane="3d"]') as HTMLElement
    const paneAr = host.querySelector('[data-pane="ar"]') as HTMLElement
    expect(pane3d.hidden).toBe(false)
    expect(paneAr.hidden).toBe(true)

    const arTag = host.querySelector(
      '[data-pane="ar"] input[data-layer="boatTag"]',
    ) as HTMLInputElement
    const d3Boat = host.querySelector(
      '[data-pane="3d"] input[data-layer="boatModel"]',
    ) as HTMLInputElement
    const d3Tag = host.querySelector(
      '[data-pane="3d"] input[data-layer="boatTag"]',
    ) as HTMLInputElement
    expect(d3Boat.checked).toBe(true)
    expect(d3Tag.checked).toBe(true)
    expect(arTag.checked).toBe(true)

    d3Boat.checked = false
    d3Boat.dispatchEvent(new Event('change'))
    d3Tag.checked = false
    d3Tag.dispatchEvent(new Event('change'))
    expect(store.get('3d').boatModel).toBe(false)
    expect(store.get('3d').boatTag).toBe(false)
    expect(store.get('ar').boatModel).toBe(false)
    expect(store.get('ar').boatTag).toBe(true)

    focus = 'ar'
    bar.setFocus(focus)
    expect(pane3d.hidden).toBe(true)
    expect(paneAr.hidden).toBe(false)
    expect(
      (host.querySelector('[data-pane="ar"] input[data-layer="boatTag"]') as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(store.get('3d').boatModel).toBe(false)
    expect(store.get('ar')).toEqual(store.snapshot().ar)

    bar.stop()
  })

  it('latches Control 3D program and Frame boats; AR follow stays stubbed', () => {
    const store = createSrtChannelPresetStore()
    const host = document.createElement('div')
    document.body.appendChild(host)
    hosts.push(host)
    let control = false
    let framed = 0
    const bar = startSrtProgramBar({
      container: host,
      getFocus: () => '3d',
      getPreset: (channel) => store.get(channel),
      onPresetChange: () => {},
      getControl3dProgram: () => control,
      onControl3dProgram: (on) => {
        control = on
      },
      onFrameBoats: () => {
        framed += 1
      },
    })
    const box = host.querySelector(
      '[data-control="3d-program"]',
    ) as HTMLInputElement
    expect(box.disabled).toBe(false)
    expect(box.checked).toBe(false)
    box.checked = true
    box.dispatchEvent(new Event('change'))
    expect(control).toBe(true)
    bar.sync()
    expect(
      (host.querySelector('[data-control="3d-program"]') as HTMLInputElement)
        .checked,
    ).toBe(true)

    const frame = host.querySelector(
      '[data-action="frame-boats"]',
    ) as HTMLButtonElement
    expect(frame.disabled).toBe(false)
    frame.click()
    expect(framed).toBe(1)

    const stubs = [
      ...host.querySelectorAll('.srt-program-bar__stub'),
    ] as HTMLButtonElement[]
    expect(stubs.length).toBeGreaterThan(0)
    expect(stubs.every((b) => b.disabled)).toBe(true)
    expect(
      host.querySelector('[data-pane="ar"] .srt-program-bar__stub'),
    ).toBeTruthy()
    bar.stop()
  })

  it('2D pane follows centroid or one boat and edits offset/zoom', () => {
    const store = createSrtChannelPresetStore()
    const host = document.createElement('div')
    document.body.appendChild(host)
    hosts.push(host)
    const state = {
      follow: 'centroid' as 'centroid' | 'boat',
      boatId: null as string | null,
      offsetEastM: 0,
      offsetNorthM: 0,
      metresAcross: 250,
    }
    let boats = [{ id: '21', label: '21' }, { id: '22', label: '22' }]
    const bar = startSrtProgramBar({
      container: host,
      getFocus: () => '2d',
      getPreset: (channel) => store.get(channel),
      onPresetChange: () => {},
      getMap2dProgram: () => ({ ...state }),
      getFollowBoats: () => boats,
      onFollowCentroid: () => {
        state.follow = 'centroid'
        state.boatId = null
      },
      onFollowBoat: (id) => {
        state.follow = 'boat'
        state.boatId = id
      },
      onMap2dOffsetEast: (m) => {
        state.offsetEastM = m
      },
      onMap2dOffsetNorth: (m) => {
        state.offsetNorthM = m
      },
      onMap2dMetresAcross: (m) => {
        state.metresAcross = m
      },
    })
    const pane = host.querySelector('[data-pane="2d"]') as HTMLElement
    expect(pane.hidden).toBe(false)
    const centroid = host.querySelector(
      '[data-action="follow-centroid"]',
    ) as HTMLButtonElement
    expect(centroid.disabled).toBe(false)
    expect(centroid.getAttribute('aria-pressed')).toBe('true')

    const boatBtns = [
      ...host.querySelectorAll('[data-action="follow-boat"]'),
    ] as HTMLButtonElement[]
    expect(boatBtns.map((b) => b.dataset.boatId)).toEqual(['21', '22'])
    boatBtns[1]!.click()
    bar.sync()
    expect(state.follow).toBe('boat')
    expect(state.boatId).toBe('22')
    expect(
      (host.querySelector('[data-action="follow-centroid"]') as HTMLButtonElement)
        .getAttribute('aria-pressed'),
    ).toBe('false')
    expect(
      (host.querySelector('[data-boat-id="22"]') as HTMLButtonElement)
        .getAttribute('aria-pressed'),
    ).toBe('true')

    const east = host.querySelector(
      '[data-field="offset-east"]',
    ) as HTMLInputElement
    east.value = '15'
    east.dispatchEvent(new Event('change'))
    const across = host.querySelector(
      '[data-field="metres-across"]',
    ) as HTMLInputElement
    across.value = '80'
    across.dispatchEvent(new Event('change'))
    expect(state.offsetEastM).toBe(15)
    expect(state.metresAcross).toBe(80)

    boats = []
    bar.sync()
    centroid.click()
    bar.sync()
    expect(state.follow).toBe('centroid')
    bar.stop()
  })
})
