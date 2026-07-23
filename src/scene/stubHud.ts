import type { AppConfig } from '../config/types.ts'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import { telemetryBus } from '../telemetry/index.ts'
import { createMap2d, type Map2dHandle } from './map2d.ts'

export type TelemetryModeUi = AppConfig['telemetryMode']

/** Modes that can switch ingest at runtime (mock | replay | live). */
export type TelemetryModeSwitchable = TelemetryModeUi

export type StubHudOptions = {
  container: HTMLElement
  initialMode?: TelemetryModeUi
  /** Invoked for mock | replay | live; caller restarts TEL ingest. */
  onModeChange?: (mode: TelemetryModeSwitchable) => void
}

export type StubHudHandle = {
  /** Set mode control + status label (does not change TEL ingest). */
  setMode: (mode: TelemetryModeUi) => void
  setBootMessage: (msg: string) => void
  stop: () => void
}

function fmtEnu(p: { x: number; y: number; z: number }): string {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`
}

function modeHintText(mode: TelemetryModeUi): string {
  if (mode === 'live') return 'live WS'
  if (mode === 'replay') return 'fixture replay'
  return 'mock source'
}

/**
 * Ops overlay: stub HUD (mode + TEL counts + last ENU) and 2D fleet map.
 * Positions from poseBus only. Mode select restarts ingest via `onModeChange`.
 */
export function startStubHud(options: StubHudOptions): StubHudHandle {
  const initialMode = options.initialMode ?? 'mock'

  const root = document.createElement('div')
  root.className = 'ops-overlay'
  options.container.appendChild(root)

  const hud = document.createElement('div')
  hud.className = 'ops-hud'
  root.appendChild(hud)

  const modeRow = document.createElement('div')
  modeRow.className = 'ops-hud__mode-row'
  hud.appendChild(modeRow)

  const modeLabel = document.createElement('label')
  modeLabel.className = 'ops-hud__mode-label'
  modeLabel.htmlFor = 'ops-telemetry-mode'
  modeLabel.textContent = 'telemetry'
  modeRow.appendChild(modeLabel)

  const modeSelect = document.createElement('select')
  modeSelect.id = 'ops-telemetry-mode'
  modeSelect.className = 'ops-hud__mode-select'
  modeSelect.title = 'mock | replay | live — switches ingest (live needs wsUrl)'
  for (const m of ['mock', 'replay', 'live'] as const) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = m
    modeSelect.appendChild(opt)
  }
  modeSelect.value = initialMode
  modeRow.appendChild(modeSelect)

  const modeHint = document.createElement('span')
  modeHint.className = 'ops-hud__mode-hint'
  modeHint.textContent = modeHintText(initialMode)
  modeRow.appendChild(modeHint)

  const statusEl = document.createElement('pre')
  statusEl.className = 'ops-hud__status'
  hud.appendChild(statusEl)

  const map: Map2dHandle = createMap2d({ sizePx: 240 })
  root.appendChild(map.root)

  const counts = { drone: 0, boat: 0, stream_anchor: 0 }
  const lastEnu = { drone: '—', boat: '—' }
  let uiMode: TelemetryModeUi = initialMode
  let bootMessage: string | null = 'boot: loading config…'

  function renderStatus(): void {
    if (bootMessage) {
      statusEl.textContent = bootMessage
      return
    }
    statusEl.textContent =
      `mode=${uiMode}  drone=${counts.drone}  boat=${counts.boat}  stream_anchor=${counts.stream_anchor}\n` +
      `ENU m  drone=${lastEnu.drone}  boat=${lastEnu.boat}`
  }

  function onPose(pose: PoseEvent): void {
    const s = fmtEnu(pose.position)
    if (pose.kind === 'drone') lastEnu.drone = s
    else lastEnu.boat = s
    map.updatePose(pose)
    renderStatus()
  }

  modeSelect.addEventListener('change', () => {
    const next = modeSelect.value as TelemetryModeUi
    uiMode = next
    modeHint.textContent = modeHintText(next)
    options.onModeChange?.(next)
    renderStatus()
  })

  const unsubTel = [
    telemetryBus.on('drone', () => {
      counts.drone += 1
    }),
    telemetryBus.on('boat', () => {
      counts.boat += 1
    }),
    telemetryBus.on('stream_anchor', () => {
      counts.stream_anchor += 1
    }),
  ]
  const unsubPose = poseBus.on('pose', onPose)

  const refreshId = window.setInterval(() => {
    if (!bootMessage) renderStatus()
  }, 200)

  renderStatus()

  return {
    setMode(mode: TelemetryModeUi): void {
      uiMode = mode
      modeSelect.value = mode
      modeHint.textContent = modeHintText(mode)
      bootMessage = null
      renderStatus()
    },
    setBootMessage(msg: string): void {
      bootMessage = msg
      renderStatus()
    },
    stop(): void {
      window.clearInterval(refreshId)
      unsubPose()
      for (const u of unsubTel) u()
      map.dispose()
      root.remove()
    },
  }
}
