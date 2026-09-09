/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountCinematicsOps } from './opsPanel.ts'
import type { CinematicTransport } from './createPlayer.ts'

afterEach(() => {
  document.body.replaceChildren()
})

describe('cinematics ops row', () => {
  it('mounts sequence select, Play, Pause, scrub, and an enabled Record', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const plays: number[] = []
    const seeks: number[] = []
    const records: number[] = []
    const panel = mountCinematicsOps(host, {
      onPlay: () => {
        plays.push(1)
      },
      onSeek: (t) => {
        seeks.push(t)
      },
      onRecord: () => {
        records.push(1)
      },
    })
    expect(host.querySelector('#ops-cinematic-sequence')).toBeTruthy()
    expect(host.querySelector('#ops-cinematic-play')).toBeTruthy()
    expect(host.querySelector('#ops-cinematic-pause')).toBeTruthy()
    const record = host.querySelector(
      '#ops-cinematic-record',
    ) as HTMLButtonElement
    expect(record).toBeTruthy()
    expect(record.disabled).toBe(false)
    expect(host.querySelector('#ops-cinematic-scrub')).toBeTruthy()
    const dump = host.querySelector(
      '#ops-cinematic-dump-warm-urls',
    ) as HTMLButtonElement
    expect(dump).toBeTruthy()
    expect(dump.textContent).toBe('Save tile list')
    expect(host.querySelector('[data-ops="cinematic-warm"]')).toBeTruthy()
    expect(host.querySelector('[data-ops="cinematic-record"]')).toBeTruthy()
    ;(host.querySelector('#ops-cinematic-play') as HTMLButtonElement).click()
    expect(plays).toEqual([1])
    record.click()
    expect(records).toEqual([1])
    panel.setRecordStatus('desktop only')
    expect(
      (host.querySelector('[data-ops="cinematic-record"]') as HTMLElement)
        .textContent,
    ).toBe('desktop only')
    panel.setRecordBusy(true)
    expect(record.disabled).toBe(true)
    panel.setRecordBusy(false)
    expect(record.disabled).toBe(false)
    const transport: CinematicTransport = {
      active: true,
      playing: true,
      tSec: 0.5,
      sampleTSec: 0.5,
      durationSec: 2,
      fps: 30,
      sequenceId: '_empty',
    }
    panel.setTransport(transport)
    expect(
      (host.querySelector('[data-ops="cinematic-time"]') as HTMLElement)
        .textContent,
    ).toMatch(/0\.50/)
    panel.dispose()
  })
})
