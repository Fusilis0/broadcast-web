/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { LANDMARK_CATALOGUE } from '../landmarks/catalogue.ts'
import { ZERO_LANDMARK_POSE } from '../landmarks/projectLandmarks.ts'
import { startHeroesPanel } from './heroesPanel.ts'
import type { LandmarkPoseOffset } from '../landmarks/types.ts'

afterEach(() => {
  document.body.replaceChildren()
})

describe('startHeroesPanel', () => {
  it('lists every catalogue hero with Focus and texture chips', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const focused: string[] = []
    const panel = startHeroesPanel({
      container: host,
      getOffsets: () => ({}),
      getTextureReport: () =>
        LANDMARK_CATALOGUE.map((e) => ({
          id: e.id,
          kind: e.kind === 'proxy' ? 'proxy' : 'no image',
        })),
      onFocus: (id) => {
        focused.push(id)
      },
      onOffsetChange: () => {},
    })
    const rows = host.querySelectorAll('[data-landmark-id]')
    expect(rows).toHaveLength(LANDMARK_CATALOGUE.length)
    expect(LANDMARK_CATALOGUE).toHaveLength(13)
    expect(host.textContent).toMatch(/Maiden/)
    expect(host.textContent).toMatch(/Rumeli/)
    const rumeli = host.querySelector('[data-landmark-id="rumeli-hisari"]')
    expect(rumeli?.textContent).toMatch(/no image/)
    const maidens = host.querySelector('[data-landmark-id="maidens-tower"]')
    const focus = maidens?.querySelector('button') as HTMLButtonElement
    focus.click()
    expect(focused).toEqual(['maidens-tower'])
    panel.dispose()
  })

  it('live-edits XYZ and yaw and does not invent a download', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const seen: LandmarkPoseOffset[] = []
    const panel = startHeroesPanel({
      container: host,
      getOffsets: () => ({
        'maidens-tower': { ...ZERO_LANDMARK_POSE, x: 1 },
      }),
      getTextureReport: () => [
        { id: 'maidens-tower', kind: 'textured' },
      ],
      onFocus: () => {},
      onOffsetChange: (_id, pose) => {
        seen.push(pose)
      },
    })
    const row = host.querySelector('[data-landmark-id="maidens-tower"]')
    expect(row?.textContent).toMatch(/textured/)
    const xInput = row?.querySelector(
      '.heroes-panel__field input',
    ) as HTMLInputElement
    expect(xInput.value).toBe('1')
    xInput.value = '4.5'
    xInput.dispatchEvent(new Event('input'))
    expect(seen.at(-1)?.x).toBe(4.5)
    expect(document.querySelector('a[download]')).toBeNull()

    const scaleInput = [...(row?.querySelectorAll(
      '.heroes-panel__field input',
    ) ?? [])].at(-1) as HTMLInputElement
    expect(scaleInput.value).toBe('1')
    scaleInput.value = '2'
    scaleInput.dispatchEvent(new Event('input'))
    expect(seen.at(-1)?.scale).toBe(2)
    panel.dispose()
  })
})
