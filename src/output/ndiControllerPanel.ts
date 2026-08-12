import { getStudioBridge } from './studioBridge.ts'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'

/**
 * Air NDI status for the ops controller tab (read-only).
 * NDI start/stop is tied to the Electron studio session lifecycle — no
 * manual controls in v1.
 */
export type NdiAirIndicator =
  | 'unavailable'
  | 'stopped'
  | 'starting'
  | 'live'
  | 'error'

/**
 * Electron `desktop/ndiSender.cjs` holds a single `sender` + one IPC channel
 * (`ndi:start` / `ndi:frame`). A second independently-named NDI source would
 * need a bridge refactor — stretch goal stays stubbed until then.
 */
export const STREAM_MAP_NDI_BRIDGE_SUPPORTED = false

export type ResolveNdiAirIndicatorInput = {
  studioBridgePresent: boolean
  pump: NdiFramePumpHandle | null
}

/** Pure status resolution for unit tests + panel refresh. */
export function resolveNdiAirIndicator(
  input: ResolveNdiAirIndicatorInput,
): NdiAirIndicator {
  if (!input.studioBridgePresent) return 'unavailable'
  const pump = input.pump
  if (!pump) return 'stopped'
  const err = pump.getError()
  if (err) return 'error'
  if (pump.getSourceName()) return 'live'
  return 'starting'
}

export type NdiControllerPanelOptions = {
  container: HTMLElement
  /** Current air NDI pump (null before boot / after stop / in Chrome). */
  getPump: () => NdiFramePumpHandle | null
  /** Active POV id for air lock display (from SCN). */
  getActivePovId: () => string | null | undefined
  /** Poll interval for status refresh. Default 500 ms. */
  pollMs?: number
}

export type NdiControllerPanelHandle = {
  readonly root: HTMLElement
  refresh: () => void
  dispose: () => void
}

const DEFAULT_POLL_MS = 500

/**
 * Ops sidebar **NDI** section: read-only air source status + stubbed 2D-map
 * second source toggle.
 *
 * **Invariant:** this panel is DOM-only. It never participates in
 * `renderer.render` / WebGL framebuffer readback / NDI IPC — collapsing it
 * must not change air pixels (`docs/architecture/unified-ops-sidebar.md` §2).
 */
export function startNdiControllerPanel(
  options: NdiControllerPanelOptions,
): NdiControllerPanelHandle {
  const pollMs =
    typeof options.pollMs === 'number' && options.pollMs > 0
      ? options.pollMs
      : DEFAULT_POLL_MS

  const root = document.createElement('div')
  root.className = 'ndi-ctrl'
  root.setAttribute('data-ops', 'ndi-controller')

  const statusRow = row('Status')
  const statusDot = document.createElement('span')
  statusDot.className = 'ndi-ctrl__dot'
  statusDot.setAttribute('aria-hidden', 'true')
  const statusText = document.createElement('span')
  statusText.className = 'ndi-ctrl__status-text'
  statusRow.value.append(statusDot, statusText)
  root.appendChild(statusRow.el)

  const sourceRow = row('Source')
  root.appendChild(sourceRow.el)

  const sdkRow = row('SDK')
  root.appendChild(sdkRow.el)

  const povRow = row('Active POV')
  root.appendChild(povRow.el)

  const errorRow = row('Error')
  root.appendChild(errorRow.el)

  const lockNote = document.createElement('p')
  lockNote.className = 'ndi-ctrl__hint'
  lockNote.textContent =
    'Air lock: NDI always frames the active POV (not free cam). Starts/stops with the Electron studio session — no manual control in v1.'
  root.appendChild(lockNote)

  const mapBlock = document.createElement('div')
  mapBlock.className = 'ndi-ctrl__map-block'
  const mapLabel = document.createElement('label')
  mapLabel.className = 'ndi-ctrl__map-label'
  const mapToggle = document.createElement('input')
  mapToggle.type = 'checkbox'
  mapToggle.disabled = true
  mapToggle.checked = false
  mapToggle.setAttribute('data-ops', 'ndi-stream-map-toggle')
  const mapTitle = document.createElement('span')
  mapTitle.textContent = '2D stream-map NDI source'
  mapLabel.append(mapToggle, mapTitle)
  mapBlock.appendChild(mapLabel)
  const mapHint = document.createElement('p')
  mapHint.className = 'ndi-ctrl__hint'
  mapHint.textContent = STREAM_MAP_NDI_BRIDGE_SUPPORTED
    ? 'Opt-in second NDI sender for the stream map PiP.'
    : 'Not supported by current NDI bridge (single sender). Follow-up: multi-sender desktop bridge.'
  mapBlock.appendChild(mapHint)
  root.appendChild(mapBlock)

  options.container.appendChild(root)

  function refresh(): void {
    const bridge = getStudioBridge()
    const pump = options.getPump()
    const indicator = resolveNdiAirIndicator({
      studioBridgePresent: bridge != null,
      pump,
    })

    statusDot.dataset.state = indicator
    statusText.textContent = labelFor(indicator)

    if (indicator === 'unavailable') {
      sourceRow.value.textContent = '—'
      sdkRow.value.textContent = '—'
      errorRow.value.textContent = 'NDI unavailable in this shell (Chrome / no studio bridge)'
      errorRow.el.hidden = false
    } else {
      sourceRow.value.textContent = pump?.getSourceName() ?? '—'
      sdkRow.value.textContent = pump?.getSdkVersion() ?? '—'
      const err = pump?.getError() ?? null
      if (err) {
        errorRow.value.textContent = err
        errorRow.el.hidden = false
      } else {
        errorRow.value.textContent = '—'
        errorRow.el.hidden = true
      }
    }

    const pov = options.getActivePovId()
    povRow.value.textContent =
      pov != null && String(pov).trim() !== '' ? String(pov) : '—'
  }

  refresh()
  const timer = window.setInterval(refresh, pollMs)

  return {
    root,
    refresh,
    dispose(): void {
      window.clearInterval(timer)
      root.remove()
    },
  }
}

function labelFor(indicator: NdiAirIndicator): string {
  switch (indicator) {
    case 'unavailable':
      return 'unavailable'
    case 'stopped':
      return 'stopped'
    case 'starting':
      return 'starting'
    case 'live':
      return 'live'
    case 'error':
      return 'error'
  }
}

function row(label: string): {
  el: HTMLElement
  value: HTMLElement
} {
  const el = document.createElement('div')
  el.className = 'ndi-ctrl__row'
  const lab = document.createElement('span')
  lab.className = 'ndi-ctrl__label'
  lab.textContent = label
  const value = document.createElement('span')
  value.className = 'ndi-ctrl__value'
  value.textContent = '—'
  el.append(lab, value)
  return { el, value }
}
