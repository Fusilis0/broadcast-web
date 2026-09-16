/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { startStubHud } from './stubHud.ts'

afterEach(() => {
  document.body.replaceChildren()
  sessionStorage.removeItem('bw.streamMap.boatScale')
  sessionStorage.removeItem('bw.buildings.enabled')
  sessionStorage.removeItem('bw.heroes.enabled')
  sessionStorage.removeItem('bw.terrain.overlay')
  sessionStorage.removeItem('bw.terrain.imageryLook')
})

describe('stubHud two-rail hosts', () => {
  it('re-homes environment + wind rows and fires water-discard callback', () => {
    const project = document.createElement('div')
    const ops = document.createElement('div')
    const environment = document.createElement('div')
    const wind = document.createElement('div')
    const map = document.createElement('div')
    const streamMapHost = document.createElement('div')
    document.body.append(project, ops, environment, wind, map, streamMapHost)

    const seen: number[] = []
    const seaSeen: number[] = []
    const hud = startStubHud({
      container: document.body,
      hosts: { project, ops, environment, wind, map, streamMapHost },
      onTerrainWaterDiscardYChange: (yM) => {
        seen.push(yM)
      },
      onSeaHeightYChange: (yM) => {
        seaSeen.push(yM)
      },
    })

    expect(environment.querySelector('#ops-environment-mode')).toBeTruthy()
    expect(
      (environment.querySelector('#ops-environment-mode') as HTMLSelectElement)
        .value,
    ).toBe('realistic')
    expect(
      (environment.querySelector('#ops-terrain-mode') as HTMLSelectElement)
        .value,
    ).toBe('on')
    expect(environment.querySelector('#ops-terrain-nudge')).toBeTruthy()
    expect(environment.querySelector('#ops-terrain-overlay')).toBeTruthy()
    expect(environment.querySelector('#ops-terrain-aerial')).toBeNull()
    expect(
      (environment.querySelector('#ops-terrain-overlay') as HTMLSelectElement)
        .value,
    ).toBe('aerial')
    expect(hud.getTerrainOverlay()).toBe('aerial')
    expect(environment.querySelector('#ops-buildings-enabled')).toBeTruthy()
    expect(
      (environment.querySelector('#ops-buildings-enabled') as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(hud.getBuildingsEnabled()).toBe(true)
    expect(environment.querySelector('#ops-heroes-enabled')).toBeTruthy()
    expect(
      (environment.querySelector('#ops-heroes-enabled') as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(hud.getHeroesEnabled()).toBe(true)
    expect(environment.querySelector('[data-ops="terrain-water-discard"]')).toBeTruthy()
    expect(environment.querySelector('[data-ops="sea-height"]')).toBeTruthy()
    expect(
      environment.querySelector('label[for="ops-terrain-water-y"]')?.textContent,
    ).toMatch(/Cesium hide/i)
    expect(
      environment.querySelector('label[for="ops-sea-height-y"]')?.textContent,
    ).toBe('sea m')
    expect(
      (ops.querySelector('#ops-view-mode') as HTMLSelectElement).value,
    ).toBe('free')
    expect(ops.querySelector('#ops-environment-mode')).toBeNull()
    expect(ops.querySelector('#ops-stream-map')).toBeNull()
    expect(streamMapHost.querySelector('.stream-map')).toBeTruthy()
    const streamCanvas = hud.getStreamMap().getCanvas()
    expect(streamCanvas.width).toBe(1920)
    expect(streamCanvas.height).toBe(1080)
    const boatScale = streamMapHost.querySelector(
      '[data-ops="stream-boat-scale"]',
    )
    expect(boatScale).toBeTruthy()
    expect(boatScale?.textContent).toMatch(/Boat size/)
    const boatInput = boatScale?.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement
    expect(boatInput.min).toBe('0.25')
    expect(boatInput.max).toBe('2')
    expect(boatInput.step).toBe('0.05')
    expect(boatInput.value).toBe('0.5')
    expect(hud.getStreamMap().getBoatIconScale()).toBe(0.5)
    boatInput.value = '0.25'
    boatInput.dispatchEvent(new Event('input'))
    expect(hud.getStreamMap().getBoatIconScale()).toBe(0.25)
    expect(sessionStorage.getItem('bw.streamMap.boatScale')).toBe('0.25')
    expect(wind.querySelector('[data-ops="wind"]')).toBeTruthy()
    expect(ops.querySelector('[data-ops="wind"]')).toBeNull()
    expect(hud.getTerrainWaterDiscardYM()).toBe(0.5)

    expect(ops.querySelector('[data-ops="preview-fps"]')).toBeTruthy()
    expect(ops.querySelector('[data-ops="gpu-renderer"]')?.textContent).toMatch(
      /GPU/,
    )
    expect(ops.querySelector('[data-ops="preview-hitch"]')?.textContent).toBe('0')
    hud.setGpuLabel('GPU · NVIDIA GeForce RTX 4070')
    hud.setHitchCounts({ over33: 5, over50: 2 })
    expect(ops.querySelector('[data-ops="gpu-renderer"]')?.textContent).toBe(
      'GPU · NVIDIA GeForce RTX 4070',
    )
    expect(ops.querySelector('[data-ops="preview-hitch"]')?.textContent).toBe(
      '2 / 1s (>50ms)',
    )

    const input = environment.querySelector(
      '[data-ops="terrain-water-discard"]',
    ) as HTMLInputElement
    input.value = '1.2'
    input.dispatchEvent(new Event('change'))
    expect(seen).toEqual([1.2])
    expect(hud.getTerrainWaterDiscardYM()).toBe(1.2)

    hud.setSrtSituation('SRT  studio=yes  AR bg=video picture=no')
    expect(ops.querySelector('[data-ops="srt-situation"]')?.textContent).toMatch(
      /studio=yes/,
    )

    input.value = '99'
    input.dispatchEvent(new Event('change'))
    expect(seen[1]).toBe(5)
    expect(input.value).toBe('5')

    input.value = '-2'
    input.dispatchEvent(new Event('change'))
    expect(seen[2]).toBe(-2)
    expect(input.value).toBe('-2')
    expect(hud.getTerrainWaterDiscardYM()).toBe(-2)
    expect(input.min).toBe('-20')

    const seaInput = environment.querySelector(
      '[data-ops="sea-height"]',
    ) as HTMLInputElement
    expect(hud.getSeaHeightYM()).toBe(0)
    seaInput.value = '-2'
    seaInput.dispatchEvent(new Event('change'))
    expect(seaSeen).toEqual([-2])
    expect(hud.getSeaHeightYM()).toBe(-2)
    seaInput.value = '99'
    seaInput.dispatchEvent(new Event('change'))
    expect(seaSeen[1]).toBe(20)
    expect(seaInput.value).toBe('20')

    hud.stop()
  })

  it('map overlay defaults aerial, toggles road, remounts via callback, and persists', () => {
    const project = document.createElement('div')
    const ops = document.createElement('div')
    const environment = document.createElement('div')
    const wind = document.createElement('div')
    const map = document.createElement('div')
    const streamMapHost = document.createElement('div')
    document.body.append(project, ops, environment, wind, map, streamMapHost)

    const seen: string[] = []
    const hud = startStubHud({
      container: document.body,
      hosts: { project, ops, environment, wind, map, streamMapHost },
      onTerrainOverlayChange: (kind) => {
        seen.push(kind)
      },
    })

    const overlay = environment.querySelector(
      '#ops-terrain-overlay',
    ) as HTMLSelectElement
    expect(overlay).toBeTruthy()
    expect(environment.querySelector('#ops-terrain-aerial')).toBeNull()
    expect(overlay.value).toBe('aerial')
    expect(hud.getTerrainOverlay()).toBe('aerial')
    expect(sessionStorage.getItem('bw.terrain.overlay')).toBeNull()
    expect(sessionStorage.getItem('bw.terrain.imageryLook')).toBeNull()

    overlay.value = 'road'
    overlay.dispatchEvent(new Event('change'))
    expect(seen).toEqual(['road'])
    expect(hud.getTerrainOverlay()).toBe('road')
    expect(sessionStorage.getItem('bw.terrain.overlay')).toBe('road')

    overlay.value = 'aerial'
    overlay.dispatchEvent(new Event('change'))
    expect(seen).toEqual(['road', 'aerial'])
    expect(hud.getTerrainOverlay()).toBe('aerial')
    expect(sessionStorage.getItem('bw.terrain.overlay')).toBe('aerial')

    hud.stop()
  })

  it('boots map aerial from overlay session; leftover imageryLook does not win', () => {
    sessionStorage.setItem('bw.terrain.imageryLook', 'color')
    sessionStorage.setItem('bw.terrain.overlay', 'aerial')
    const project = document.createElement('div')
    const ops = document.createElement('div')
    const environment = document.createElement('div')
    const wind = document.createElement('div')
    const map = document.createElement('div')
    const streamMapHost = document.createElement('div')
    document.body.append(project, ops, environment, wind, map, streamMapHost)

    const hud = startStubHud({
      container: document.body,
      hosts: { project, ops, environment, wind, map, streamMapHost },
    })
    expect(
      (environment.querySelector('#ops-terrain-overlay') as HTMLSelectElement)
        .value,
    ).toBe('aerial')
    expect(hud.getTerrainOverlay()).toBe('aerial')
    expect(environment.querySelector('#ops-terrain-aerial')).toBeNull()
    hud.stop()
  })

  it('mounts Cinematics Play/Pause/scrub and an enabled Record', () => {
    const project = document.createElement('div')
    const ops = document.createElement('div')
    const environment = document.createElement('div')
    const cinematics = document.createElement('div')
    const wind = document.createElement('div')
    const map = document.createElement('div')
    const streamMapHost = document.createElement('div')
    document.body.append(
      project,
      ops,
      environment,
      cinematics,
      wind,
      map,
      streamMapHost,
    )
    const hud = startStubHud({
      container: document.body,
      hosts: { project, ops, environment, cinematics, wind, map, streamMapHost },
    })
    expect(cinematics.querySelector('#ops-cinematic-sequence')).toBeTruthy()
    expect(cinematics.querySelector('#ops-cinematic-play')).toBeTruthy()
    expect(cinematics.querySelector('#ops-cinematic-pause')).toBeTruthy()
    expect(
      (cinematics.querySelector('#ops-cinematic-record') as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    expect(cinematics.querySelector('#ops-cinematic-scrub')).toBeTruthy()
    expect(ops.querySelector('#ops-cinematic-play')).toBeNull()
    hud.setCinematicChromeHidden(true)
    expect(map.hidden).toBe(true)
    expect(streamMapHost.hidden).toBe(true)
    hud.setCinematicChromeHidden(false)
    expect(map.hidden).toBe(false)
    hud.stop()
  })
})
