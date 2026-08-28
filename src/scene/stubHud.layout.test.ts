/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { startStubHud } from './stubHud.ts'

afterEach(() => {
  document.body.replaceChildren()
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
    const hud = startStubHud({
      container: document.body,
      hosts: { project, ops, environment, wind, map, streamMapHost },
      onTerrainWaterDiscardYChange: (yM) => {
        seen.push(yM)
      },
    })

    expect(environment.querySelector('#ops-environment-mode')).toBeTruthy()
    expect(environment.querySelector('#ops-terrain-nudge')).toBeTruthy()
    expect(environment.querySelector('[data-ops="terrain-water-discard"]')).toBeTruthy()
    expect(ops.querySelector('#ops-environment-mode')).toBeNull()
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

    hud.stop()
  })
})
