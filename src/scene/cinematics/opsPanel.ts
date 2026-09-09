import { CINEMATIC_CATALOGUE } from './constants.ts'
import type { CinematicTransport } from './createPlayer.ts'
import type { WarmTilesStatus } from './warm.ts'
import { formatWarmTilesStatus } from './warm.ts'

export type CinematicsOpsHandle = {
  setTransport: (transport: CinematicTransport) => void
  setWarmStatus: (status: WarmTilesStatus) => void
  setRecordStatus: (msg: string) => void
  setRecordBusy: (busy: boolean) => void
  getSelectedId: () => string
  setSelectedId: (id: string) => void
  dispose: () => void
}

export type CinematicsOpsOptions = {
  catalogue?: readonly { id: string; label: string; url: string }[]
  onSequenceChange?: (id: string, url: string) => void
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (tSec: number) => void
  onStop?: () => void
  onDumpWarmUrls?: () => void
  onRecord?: () => void
}

function formatTime(tSec: number, durationSec: number): string {
  const t = Number.isFinite(tSec) ? Math.max(0, tSec) : 0
  const d = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0
  return `${t.toFixed(2)} / ${d.toFixed(2)} s`
}

/**
 * Minimal authoring transport: sequence select, Play, Pause, scrub, time.
 * Record starts OUT silent 1080p30 MP4 (wired from main.ts).
 */
export function mountCinematicsOps(
  host: HTMLElement,
  options: CinematicsOpsOptions = {},
): CinematicsOpsHandle {
  const catalogue = options.catalogue ?? CINEMATIC_CATALOGUE
  const root = document.createElement('div')
  root.className = 'ops-hud ops-hud--cinematics'
  root.setAttribute('data-ops', 'cinematics')

  const seqRow = document.createElement('div')
  seqRow.className = 'ops-hud__mode-row'
  const seqLabel = document.createElement('label')
  seqLabel.className = 'ops-hud__mode-label'
  seqLabel.htmlFor = 'ops-cinematic-sequence'
  seqLabel.textContent = 'sequence'
  const seqSelect = document.createElement('select')
  seqSelect.id = 'ops-cinematic-sequence'
  seqSelect.className = 'ops-hud__mode-select'
  seqSelect.title = 'Cinematic sequence (authoring). Off = race view.'
  const off = document.createElement('option')
  off.value = ''
  off.textContent = 'Off (race view)'
  seqSelect.appendChild(off)
  for (const entry of catalogue) {
    const opt = document.createElement('option')
    opt.value = entry.id
    opt.textContent = entry.label
    seqSelect.appendChild(opt)
  }
  seqRow.append(seqLabel, seqSelect)
  root.appendChild(seqRow)

  const btnRow = document.createElement('div')
  btnRow.className = 'ops-hud__mode-row'
  const playBtn = document.createElement('button')
  playBtn.type = 'button'
  playBtn.className = 'ops-hud__btn'
  playBtn.id = 'ops-cinematic-play'
  playBtn.textContent = 'Play'
  const pauseBtn = document.createElement('button')
  pauseBtn.type = 'button'
  pauseBtn.className = 'ops-hud__btn'
  pauseBtn.id = 'ops-cinematic-pause'
  pauseBtn.textContent = 'Pause'
  const recordBtn = document.createElement('button')
  recordBtn.type = 'button'
  recordBtn.className = 'ops-hud__btn'
  recordBtn.id = 'ops-cinematic-record'
  recordBtn.textContent = 'Record'
  recordBtn.disabled = false
  recordBtn.title = 'Record silent 1080p30 MP4 (Electron). vMix plays the file.'
  const dumpBtn = document.createElement('button')
  dumpBtn.type = 'button'
  dumpBtn.className = 'ops-hud__btn'
  dumpBtn.id = 'ops-cinematic-dump-warm-urls'
  dumpBtn.textContent = 'Save tile list'
  dumpBtn.title =
    'Download this sequence JSON with tileWarm.contentUrls (tile IDs for other PCs). No map binaries — cache stays local.'
  btnRow.append(playBtn, pauseBtn, recordBtn, dumpBtn)
  root.appendChild(btnRow)

  const warmReadout = document.createElement('span')
  warmReadout.className = 'ops-hud__mode-hint'
  warmReadout.id = 'ops-cinematic-warm-status'
  warmReadout.setAttribute('data-ops', 'cinematic-warm')
  warmReadout.textContent = ''
  const recordReadout = document.createElement('span')
  recordReadout.className = 'ops-hud__mode-hint'
  recordReadout.id = 'ops-cinematic-record-status'
  recordReadout.setAttribute('data-ops', 'cinematic-record')
  recordReadout.textContent = ''
  const warmRow = document.createElement('div')
  warmRow.className = 'ops-hud__mode-row'
  warmRow.append(warmReadout, recordReadout)
  root.appendChild(warmRow)

  const scrubRow = document.createElement('div')
  scrubRow.className = 'ops-hud__mode-row'
  const scrub = document.createElement('input')
  scrub.type = 'range'
  scrub.id = 'ops-cinematic-scrub'
  scrub.className = 'ops-hud__input ops-hud__input--cinematic-scrub'
  scrub.min = '0'
  scrub.max = '1'
  scrub.step = '0.001'
  scrub.value = '0'
  scrub.setAttribute('aria-label', 'Cinematic time')
  const timeReadout = document.createElement('span')
  timeReadout.className = 'ops-hud__mode-hint'
  timeReadout.setAttribute('data-ops', 'cinematic-time')
  timeReadout.textContent = formatTime(0, 0)
  scrubRow.append(scrub, timeReadout)
  root.appendChild(scrubRow)

  host.appendChild(root)

  let durationSec = 0
  let applying = false

  seqSelect.addEventListener('change', () => {
    const id = seqSelect.value
    if (id === '') {
      options.onStop?.()
      return
    }
    const entry = catalogue.find((e) => e.id === id)
    if (!entry) return
    options.onSequenceChange?.(id, entry.url)
  })
  playBtn.addEventListener('click', () => {
    options.onPlay?.()
  })
  pauseBtn.addEventListener('click', () => {
    options.onPause?.()
  })
  recordBtn.addEventListener('click', () => {
    options.onRecord?.()
  })
  dumpBtn.addEventListener('click', () => {
    options.onDumpWarmUrls?.()
  })
  const onScrub = () => {
    if (applying) return
    const t = Number(scrub.value)
    options.onSeek?.(Number.isFinite(t) ? t : 0)
  }
  scrub.addEventListener('input', onScrub)
  scrub.addEventListener('change', onScrub)

  return {
    setTransport(transport): void {
      applying = true
      durationSec = transport.durationSec
      scrub.max = String(Math.max(durationSec, 0.001))
      scrub.value = String(transport.tSec)
      timeReadout.textContent = formatTime(transport.tSec, durationSec)
      if (transport.sequenceId && seqSelect.value !== transport.sequenceId) {
        const exists = [...seqSelect.options].some(
          (o) => o.value === transport.sequenceId,
        )
        if (exists) seqSelect.value = transport.sequenceId
      }
      if (!transport.active && !transport.sequenceId) {
        seqSelect.value = ''
      }
      applying = false
    },
    setWarmStatus(status): void {
      warmReadout.textContent = formatWarmTilesStatus(status)
    },
    setRecordStatus(msg: string): void {
      recordReadout.textContent = msg
    },
    setRecordBusy(busy: boolean): void {
      recordBtn.disabled = busy === true
    },
    getSelectedId: () => seqSelect.value,
    setSelectedId(id: string): void {
      seqSelect.value = id
    },
    dispose(): void {
      root.remove()
    },
  }
}
