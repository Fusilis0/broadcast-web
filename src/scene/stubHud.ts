import type { AppConfig } from '../config/types.ts'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import {
  telemetryBus,
  type LiveWsStatus,
} from '../telemetry/index.ts'
import { formatBoatEnuStatus } from './fleetRegistry.ts'
import type { LayoutFeature } from './features/types.ts'
import { createMap2d, type Map2dHandle } from './map2d.ts'
import { formatPovStatus, resolvePovIdList } from './povSwitcher.ts'

export type TelemetryModeUi = AppConfig['telemetryMode']

/** Modes that can switch ingest at runtime (mock | replay | live). */
export type TelemetryModeSwitchable = TelemetryModeUi

/** Per-channel live WS statuses for the ops HUD. */
export type HudLiveChannelStatus = {
  drone: LiveWsStatus
  boat: LiveWsStatus
}

/**
 * Connection line for the stub HUD.
 * - `non_live`: mock/replay — never fake open sockets
 * - `live`: surface real drone/boat WS state from TEL
 */
export type ConnectionStatusUi =
  | { kind: 'non_live'; mode: 'mock' | 'replay' }
  | { kind: 'live'; channels: HudLiveChannelStatus }

export type StubHudOptions = {
  container: HTMLElement
  initialMode?: TelemetryModeUi
  /** Invoked for mock | replay | live; caller restarts TEL ingest. */
  onModeChange?: (mode: TelemetryModeSwitchable) => void
  /**
   * Initial POV allow-list (from `loadConfig().povIds` after boot).
   * May be empty until `setPovIds` after config loads.
   */
  povIds?: readonly string[]
  /** Invoked when ops picks a POV id in the HUD select. */
  onPovChange?: (povId: string) => void
  /** Countdown flag controls (Phase 2.6). */
  onCountdownControl?: (
    action: 'start' | 'pause' | 'reset' | 'restart',
  ) => void
  /**
   * Start with world editor open (`?editor=1` or explicit).
   * Checkbox in HUD also toggles; notifies `onEditorToggle`.
   */
  editorInitiallyOpen?: boolean
  /** Invoked when ops toggles the world editor checkbox. */
  onEditorToggle?: (open: boolean) => void
}

export type StubHudHandle = {
  /** Set mode control + status label (does not change TEL ingest). */
  setMode: (mode: TelemetryModeUi) => void
  setBootMessage: (msg: string) => void
  /** Replace POV select options; keeps active if still listed. */
  setPovIds: (povIds: readonly string[], activePovId?: string) => void
  /** Sync active POV label without firing `onPovChange`. */
  setActivePovId: (povId: string) => void
  /** Static course mark dots on the 2D map (ENU east/north). Legacy. */
  setCourseMarks: (
    marks: readonly { name: string; x: number; z: number }[],
  ) => void
  /** Shared ENU world features for the 2D map (marks/gates/sponsors/flags). */
  setLayoutFeatures: (features: readonly LayoutFeature[]) => void
  /** Ops 2D map handle (editor attaches click tools). */
  getMap: () => Map2dHandle
  /** Sync editor checkbox without notifying (or with notify=true). */
  setEditorOpen: (open: boolean, notify?: boolean) => void
  /** Telemetry WS / non-live connection line (Phase 3.4). */
  setConnectionStatus: (status: ConnectionStatusUi) => void
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

/** Compact connection status for the HUD status block. */
export function formatConnectionStatus(status: ConnectionStatusUi): string {
  if (status.kind === 'non_live') {
    return `ws=n/a (${status.mode})`
  }
  const { drone, boat } = status.channels
  return `ws drone=${drone} boat=${boat}`
}

/**
 * Ops overlay: stub HUD (mode + POV + TEL counts + last ENU) and 2D fleet map.
 * Positions from poseBus only. Mode select restarts ingest via `onModeChange`.
 */
export function startStubHud(options: StubHudOptions): StubHudHandle {
  const initialMode = options.initialMode ?? 'mock'
  let povIds = resolvePovIdList(options.povIds)
  let activePovId = povIds[0] ?? '1'

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

  const povRow = document.createElement('div')
  povRow.className = 'ops-hud__mode-row'
  hud.appendChild(povRow)

  const povLabel = document.createElement('label')
  povLabel.className = 'ops-hud__mode-label'
  povLabel.htmlFor = 'ops-pov-id'
  povLabel.textContent = 'pov'
  povRow.appendChild(povLabel)

  const povSelect = document.createElement('select')
  povSelect.id = 'ops-pov-id'
  povSelect.className = 'ops-hud__mode-select'
  povSelect.title = 'Active render camera POV (drone/cam id)'
  povRow.appendChild(povSelect)

  const povHint = document.createElement('span')
  povHint.className = 'ops-hud__mode-hint'
  povHint.textContent = 'digit keys 1–4'
  povRow.appendChild(povHint)

  const countdownRow = document.createElement('div')
  countdownRow.className = 'ops-hud__mode-row'
  hud.appendChild(countdownRow)

  const countdownLabel = document.createElement('span')
  countdownLabel.className = 'ops-hud__mode-label'
  countdownLabel.textContent = 'countdown'
  countdownRow.appendChild(countdownLabel)

  for (const action of ['start', 'pause', 'reset', 'restart'] as const) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ops-hud__btn'
    btn.textContent = action
    btn.title = `Countdown ${action}`
    btn.addEventListener('click', () => {
      options.onCountdownControl?.(action)
    })
    countdownRow.appendChild(btn)
  }

  const editorRow = document.createElement('div')
  editorRow.className = 'ops-hud__mode-row'
  hud.appendChild(editorRow)

  const editorLabel = document.createElement('label')
  editorLabel.className = 'ops-hud__mode-label'
  editorLabel.htmlFor = 'ops-world-editor'
  editorLabel.textContent = 'editor'
  editorRow.appendChild(editorLabel)

  const editorCheck = document.createElement('input')
  editorCheck.id = 'ops-world-editor'
  editorCheck.type = 'checkbox'
  editorCheck.className = 'ops-hud__checkbox'
  editorCheck.title = 'World feature editor (also ?editor=1)'
  editorCheck.checked = options.editorInitiallyOpen ?? false
  editorRow.appendChild(editorCheck)

  const editorHint = document.createElement('span')
  editorHint.className = 'ops-hud__mode-hint'
  editorHint.textContent = '?editor=1'
  editorRow.appendChild(editorHint)

  const statusEl = document.createElement('pre')
  statusEl.className = 'ops-hud__status'
  hud.appendChild(statusEl)

  const map: Map2dHandle = createMap2d({ sizePx: 240 })
  root.appendChild(map.root)

  editorCheck.addEventListener('change', () => {
    options.onEditorToggle?.(editorCheck.checked)
  })

  const counts = { drone: 0, boat: 0, stream_anchor: 0 }
  let lastDroneEnu = '—'
  const lastBoatEnuById = new Map<string, string>()
  const seenPovIds = new Set<string>()
  let uiMode: TelemetryModeUi = initialMode
  let bootMessage: string | null = 'boot: loading config…'
  let connectionStatus: ConnectionStatusUi =
    initialMode === 'live'
      ? { kind: 'live', channels: { drone: 'idle', boat: 'idle' } }
      : { kind: 'non_live', mode: initialMode }

  function rebuildPovSelect(): void {
    povSelect.replaceChildren()
    for (const id of povIds) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = id
      povSelect.appendChild(opt)
    }
    if (!povIds.includes(activePovId)) {
      activePovId = povIds[0] ?? '1'
    }
    povSelect.value = activePovId
    povSelect.disabled = povIds.length <= 1
  }

  function renderStatus(): void {
    if (bootMessage) {
      statusEl.textContent = bootMessage
      return
    }
    statusEl.textContent =
      `mode=${uiMode}  drone=${counts.drone}  boat=${counts.boat}  stream_anchor=${counts.stream_anchor}\n` +
      `${formatConnectionStatus(connectionStatus)}\n` +
      `${formatPovStatus(activePovId, seenPovIds)}\n` +
      `ENU m  drone=${lastDroneEnu}  ${formatBoatEnuStatus(lastBoatEnuById)}`
  }

  function applyPovSelection(id: string, notify: boolean): void {
    if (!povIds.includes(id)) return
    const changed = id !== activePovId
    activePovId = id
    povSelect.value = id
    if (changed) renderStatus()
    if (notify && changed) options.onPovChange?.(id)
  }

  function onPose(pose: PoseEvent): void {
    const s = fmtEnu(pose.position)
    if (pose.kind === 'drone') {
      if (povIds.includes(pose.id)) {
        seenPovIds.add(pose.id)
      }
      if (pose.id === activePovId) {
        lastDroneEnu = s
      }
    } else if (pose.kind === 'boat') {
      lastBoatEnuById.set(pose.id, s)
    }
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

  povSelect.addEventListener('change', () => {
    applyPovSelection(povSelect.value, true)
  })

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return
    const target = ev.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return
    }
    // Digit keys 1–4 → POV id string when listed (Unity spirit; cams later).
    if (ev.key >= '1' && ev.key <= '4' && povIds.includes(ev.key)) {
      ev.preventDefault()
      applyPovSelection(ev.key, true)
    }
  }

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
  window.addEventListener('keydown', onKeyDown)

  const refreshId = window.setInterval(() => {
    if (!bootMessage) renderStatus()
  }, 200)

  rebuildPovSelect()
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
    setPovIds(nextIds, nextActive): void {
      povIds = resolvePovIdList(nextIds)
      if (nextActive !== undefined && povIds.includes(nextActive)) {
        activePovId = nextActive
      }
      // Drop seen ids outside the new allow-list.
      for (const id of [...seenPovIds]) {
        if (!povIds.includes(id)) seenPovIds.delete(id)
      }
      rebuildPovSelect()
      renderStatus()
    },
    setActivePovId(povId: string): void {
      applyPovSelection(povId, false)
    },
    setCourseMarks(marks): void {
      map.setCourseMarks(
        marks.map((m) => ({ name: m.name, east: m.x, north: m.z })),
      )
    },
    setLayoutFeatures(features): void {
      map.setLayoutFeatures(features)
    },
    getMap: () => map,
    setEditorOpen(open, notify = false): void {
      editorCheck.checked = open
      if (notify) options.onEditorToggle?.(open)
    },
    setConnectionStatus(status: ConnectionStatusUi): void {
      connectionStatus = status
      renderStatus()
    },
    stop(): void {
      window.clearInterval(refreshId)
      window.removeEventListener('keydown', onKeyDown)
      unsubPose()
      for (const u of unsubTel) u()
      map.dispose()
      root.remove()
    },
  }
}
