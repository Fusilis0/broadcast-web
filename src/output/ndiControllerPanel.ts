import {
  clampNdiDelayMs,
  isNdiDelayHighMemory,
  NDI_DELAY_MS_MAX,
  NDI_DELAY_MS_MIN,
  normalizeOutputDelayMs,
  type OutputDelayMsConfig,
} from './ndiDelayBuffer.ts'
import {
  DEFAULT_NDI_CHANNEL,
  getStudioBridge,
  NDI_CHANNEL_IDS,
  type NdiChannelId,
  type StudioNdiStatus,
  type StudioNdiStatusAll,
} from './studioBridge.ts'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'
import type { StreamMapNdiPumpHandle } from './streamMapNdiPump.ts'

/** Minimal pump surface for status rows (AR / 3D / 2D). */
export type NdiStatusPumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
}

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

/** Per-channel row state (includes idle for senders not yet started). */
export type NdiChannelIndicator = NdiAirIndicator | 'idle'

/**
 * Multi-sender bridge + 2D stream-map pump (Phase 13.4).
 * When true, the NDI tab toggle enables/disables channel `'2d'` only.
 */
export const STREAM_MAP_NDI_BRIDGE_SUPPORTED = true

export type ResolveNdiAirIndicatorInput = {
  studioBridgePresent: boolean
  pump: NdiStatusPumpHandle | null
}

/** Pure status resolution for unit tests + panel refresh (AR / pump path). */
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

export type ResolveNdiChannelIndicatorInput = {
  studioBridgePresent: boolean
  channel: NdiChannelId
  /** Bridge status for this channel (null when Chrome / not polled yet). */
  status: StudioNdiStatus | null
  /**
   * Frame-pump handle for AR (`'ar'`) or 3D (`'3d'`) starting/live nuance.
   */
  pump?: NdiStatusPumpHandle | null
  /** 2D stream-map pump — used when `channel === '2d'`. */
  streamMapPump?: StreamMapNdiPumpHandle | null
}

/**
 * Per-channel indicator. Idle = no sender started yet (not an error).
 * AR / 3D prefer the frame-pump handle when present; 2d prefers stream-map pump.
 */
export function resolveNdiChannelIndicator(
  input: ResolveNdiChannelIndicatorInput,
): NdiChannelIndicator {
  if (!input.studioBridgePresent) return 'unavailable'

  if (
    (input.channel === DEFAULT_NDI_CHANNEL || input.channel === '3d') &&
    input.pump !== undefined
  ) {
    const fromPump = resolveNdiAirIndicator({
      studioBridgePresent: true,
      pump: input.pump ?? null,
    })
    // Pump stopped + bridge inactive → idle (channel never started / stopped cleanly).
    if (fromPump === 'stopped') {
      if (input.status?.active) return 'live'
      if (input.status?.error) return 'error'
      return 'idle'
    }
    return fromPump
  }

  if (input.channel === '2d' && input.streamMapPump !== undefined) {
    const mapPump = input.streamMapPump
    if (!mapPump || !mapPump.isEnabled()) {
      if (input.status?.active) return 'live'
      if (input.status?.error) return 'error'
      return 'idle'
    }
    const err = mapPump.getError()
    if (err) return 'error'
    if (mapPump.getSourceName()) return 'live'
    return 'starting'
  }

  const st = input.status
  if (!st) return 'idle'
  if (st.error && !st.active) return 'error'
  if (st.active) return 'live'
  if (st.error) return 'error'
  return 'idle'
}

export type NdiControllerPanelOptions = {
  container: HTMLElement
  /** Current air NDI pump (null before boot / after stop / in Chrome). */
  getPump: () => NdiFramePumpHandle | null
  /** Continuous 3D opaque pump (Phase 13.3). */
  get3dPump?: () => NdiFramePumpHandle | null
  /** Active POV id for air lock display (from SCN). */
  getActivePovId: () => string | null | undefined
  /** 2D stream-map pump (null before boot / Chrome / when unsupported). */
  getStreamMapPump?: () => StreamMapNdiPumpHandle | null
  /**
   * Toggle callback for channel `'2d'` only (AR/3D unchanged).
   * Default **off** in studio — ops enables when needed (perf).
   */
  onStreamMapNdiEnabledChange?: (enabled: boolean) => void
  /**
   * Live per-channel delay (ms). Defaults 0. Changing does not restart pumps;
   * shrinking may drop buffered frames.
   */
  getDelayMs?: (channel: NdiChannelId) => number
  onDelayMsChange?: (channel: NdiChannelId, delayMs: number) => void
  /** Seed UI before pumps exist (from optional `config.outputDelayMs`). */
  initialDelayMs?: Partial<OutputDelayMsConfig>
  /** Poll interval for status refresh. Default 500 ms. */
  pollMs?: number
}

export type NdiControllerPanelHandle = {
  readonly root: HTMLElement
  refresh: () => void
  dispose: () => void
}

const DEFAULT_POLL_MS = 500

const CHANNEL_LABELS: Record<NdiChannelId, string> = {
  ar: 'AR (air plate)',
  '3d': '3D',
  '2d': '2D (stream map)',
}

/**
 * Ops sidebar **NDI** section: per-channel status (ar / 3d / 2d) + stream-map
 * 2D NDI enable toggle (Phase 13.4).
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

  const blocks = new Map<NdiChannelId, ChannelBlock>()
  const delayState = normalizeOutputDelayMs(options.initialDelayMs)
  for (const id of NDI_CHANNEL_IDS) {
    const block = channelBlock(id, delayState[id], (ms) => {
      delayState[id] = ms
      options.onDelayMsChange?.(id, ms)
    })
    blocks.set(id, block)
    root.appendChild(block.el)
  }

  const povRow = row('Active POV')
  root.appendChild(povRow.el)

  const lockNote = document.createElement('p')
  lockNote.className = 'ndi-ctrl__hint'
  lockNote.textContent =
    'Air lock: AR + 3D NDI always frame the active POV (not free cam). Both start/stop with the Electron studio session. Capture rates: AR ~30 fps, 3D ~10 fps (staggered so they never share a tick). 2D stream-map NDI is a separate sender (toggle below); default off — enable when needed (~10 fps). Per-channel delay (0–30000 ms) holds frames in RAM — default 0 allocates nothing; >3000 ms warns high memory. Shrinking delay drops buffered frames.'
  root.appendChild(lockNote)

  const mapBlock = document.createElement('div')
  mapBlock.className = 'ndi-ctrl__map-block'
  const mapLabel = document.createElement('label')
  mapLabel.className = 'ndi-ctrl__map-label'
  const mapToggle = document.createElement('input')
  mapToggle.type = 'checkbox'
  mapToggle.setAttribute('data-ops', 'ndi-stream-map-toggle')
  const mapTitle = document.createElement('span')
  mapTitle.textContent = '2D stream-map NDI source'
  mapLabel.append(mapToggle, mapTitle)
  mapBlock.appendChild(mapLabel)
  const mapHint = document.createElement('p')
  mapHint.className = 'ndi-ctrl__hint'
  mapBlock.appendChild(mapHint)
  root.appendChild(mapBlock)

  const bridgeAtMount = getStudioBridge() != null
  const mapToggleLive = STREAM_MAP_NDI_BRIDGE_SUPPORTED && bridgeAtMount
  mapToggle.disabled = !mapToggleLive
  // Perf default: 2D NDI off until ops enables (DSP-OUT-20260812-06).
  mapToggle.checked = false
  mapHint.textContent = mapToggleLive
    ? 'Sends race map on NDI `broadcast-web-2d` (1920×1080 letterbox @ ~10 fps). Default off — enable when needed. Independent of PiP visibility; does not affect AR/3D.'
    : STREAM_MAP_NDI_BRIDGE_SUPPORTED
      ? '2D stream-map NDI requires the Electron studio bridge.'
      : 'Bridge ready (multi-sender); 2D pump unavailable — toggle stays disabled.'

  if (mapToggleLive && options.onStreamMapNdiEnabledChange) {
    mapToggle.addEventListener('change', () => {
      options.onStreamMapNdiEnabledChange?.(mapToggle.checked)
    })
    // Apply default immediately so main can sync before pump exists.
    options.onStreamMapNdiEnabledChange(mapToggle.checked)
  }

  options.container.appendChild(root)

  let statusAll: StudioNdiStatusAll | null = null
  let statusFetchInFlight = false

  function refresh(): void {
    const bridge = getStudioBridge()
    const pump = options.getPump()
    const pump3d = options.get3dPump?.() ?? null
    const streamMapPump = options.getStreamMapPump?.() ?? null
    const bridgePresent = bridge != null

    if (bridge?.ndi.getStatusAll && !statusFetchInFlight) {
      statusFetchInFlight = true
      void bridge.ndi
        .getStatusAll()
        .then((all) => {
          statusAll = all
        })
        .catch(() => {
          /* ignore poll errors */
        })
        .finally(() => {
          statusFetchInFlight = false
        })
    }

    for (const id of NDI_CHANNEL_IDS) {
      const block = blocks.get(id)
      if (!block) continue
      const st = statusAll?.[id] ?? null
      const channelPump: NdiStatusPumpHandle | null | undefined =
        id === DEFAULT_NDI_CHANNEL
          ? pump
          : id === '3d'
            ? pump3d
            : undefined
      const indicator = resolveNdiChannelIndicator({
        studioBridgePresent: bridgePresent,
        channel: id,
        status: st,
        pump: channelPump !== undefined ? channelPump : undefined,
        streamMapPump: id === '2d' ? streamMapPump : undefined,
      })

      block.statusDot.dataset.state = indicator
      block.statusText.textContent = labelFor(indicator)

      if (indicator === 'unavailable') {
        block.source.value.textContent = '—'
        block.sdk.value.textContent = '—'
        block.error.value.textContent =
          'NDI unavailable in this shell (Chrome / no studio bridge)'
        block.error.el.hidden = false
      } else if (channelPump) {
        block.source.value.textContent =
          channelPump.getSourceName() ?? st?.sourceName ?? '—'
        block.sdk.value.textContent =
          channelPump.getSdkVersion() ?? st?.sdkVersion ?? '—'
        const err = channelPump.getError() ?? st?.error ?? null
        if (err) {
          block.error.value.textContent = err
          block.error.el.hidden = false
        } else {
          block.error.value.textContent = '—'
          block.error.el.hidden = true
        }
      } else if (id === '2d' && streamMapPump?.isEnabled()) {
        block.source.value.textContent =
          streamMapPump.getSourceName() ?? st?.sourceName ?? '—'
        block.sdk.value.textContent =
          streamMapPump.getSdkVersion() ?? st?.sdkVersion ?? '—'
        const err = streamMapPump.getError() ?? st?.error ?? null
        if (err) {
          block.error.value.textContent = err
          block.error.el.hidden = false
        } else {
          block.error.value.textContent = '—'
          block.error.el.hidden = true
        }
      } else {
        block.source.value.textContent = st?.sourceName ?? '—'
        block.sdk.value.textContent = st?.sdkVersion ?? '—'
        if (st?.error) {
          block.error.value.textContent = st.error
          block.error.el.hidden = false
        } else {
          block.error.value.textContent = '—'
          block.error.el.hidden = true
        }
      }

      const liveDelay =
        options.getDelayMs?.(id) ??
        (id === DEFAULT_NDI_CHANNEL
          ? (pump?.getDelayMs() ?? delayState[id])
          : id === '3d'
            ? (pump3d?.getDelayMs() ?? delayState[id])
            : (streamMapPump?.getDelayMs() ?? delayState[id]))
      delayState[id] = clampNdiDelayMs(liveDelay)
      if (document.activeElement !== block.delayInput) {
        block.delayInput.value = String(delayState[id])
      }
      block.delayWarn.hidden = !isNdiDelayHighMemory(delayState[id])
    }

    // Keep toggle in sync with pump when present (external setEnabled).
    if (mapToggleLive && streamMapPump) {
      mapToggle.checked = streamMapPump.isEnabled()
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

type ChannelBlock = {
  el: HTMLElement
  statusDot: HTMLElement
  statusText: HTMLElement
  source: { el: HTMLElement; value: HTMLElement }
  sdk: { el: HTMLElement; value: HTMLElement }
  error: { el: HTMLElement; value: HTMLElement }
  delayInput: HTMLInputElement
  delayWarn: HTMLElement
}

function channelBlock(
  id: NdiChannelId,
  initialDelayMs: number,
  onDelayChange: (ms: number) => void,
): ChannelBlock {
  const el = document.createElement('div')
  el.className = 'ndi-ctrl__channel'
  el.setAttribute('data-ndi-channel', id)

  const title = document.createElement('div')
  title.className = 'ndi-ctrl__channel-title'
  title.textContent = CHANNEL_LABELS[id]
  el.appendChild(title)

  const statusRow = row('Status')
  const statusDot = document.createElement('span')
  statusDot.className = 'ndi-ctrl__dot'
  statusDot.setAttribute('aria-hidden', 'true')
  const statusText = document.createElement('span')
  statusText.className = 'ndi-ctrl__status-text'
  statusRow.value.append(statusDot, statusText)
  el.appendChild(statusRow.el)

  const source = row('Source')
  el.appendChild(source.el)
  const sdk = row('SDK')
  el.appendChild(sdk.el)
  const error = row('Error')
  el.appendChild(error.el)

  const delayRow = document.createElement('div')
  delayRow.className = 'ndi-ctrl__row ndi-ctrl__delay-row'
  const delayLab = document.createElement('span')
  delayLab.className = 'ndi-ctrl__label'
  delayLab.textContent = 'Delay'
  const delayValue = document.createElement('span')
  delayValue.className = 'ndi-ctrl__value ndi-ctrl__delay-value'
  const delayInput = document.createElement('input')
  delayInput.type = 'number'
  delayInput.className = 'ndi-ctrl__delay-input'
  delayInput.min = String(NDI_DELAY_MS_MIN)
  delayInput.max = String(NDI_DELAY_MS_MAX)
  delayInput.step = '100'
  delayInput.value = String(clampNdiDelayMs(initialDelayMs))
  delayInput.setAttribute('data-ops', `ndi-delay-${id}`)
  delayInput.title = `NDI delay 0–${NDI_DELAY_MS_MAX} ms (0 = no buffer)`
  const delayUnit = document.createElement('span')
  delayUnit.className = 'ndi-ctrl__delay-unit'
  delayUnit.textContent = 'ms'
  delayValue.append(delayInput, delayUnit)
  delayRow.append(delayLab, delayValue)
  el.appendChild(delayRow)

  const delayWarn = document.createElement('p')
  delayWarn.className = 'ndi-ctrl__delay-warn'
  delayWarn.textContent = 'high memory'
  delayWarn.hidden = !isNdiDelayHighMemory(initialDelayMs)
  el.appendChild(delayWarn)

  const commitDelay = (): void => {
    const ms = clampNdiDelayMs(Number(delayInput.value))
    delayInput.value = String(ms)
    delayWarn.hidden = !isNdiDelayHighMemory(ms)
    onDelayChange(ms)
  }
  delayInput.addEventListener('change', commitDelay)
  delayInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      delayInput.blur()
      commitDelay()
    }
  })

  return {
    el,
    statusDot,
    statusText,
    source,
    sdk,
    error,
    delayInput,
    delayWarn,
  }
}

function labelFor(indicator: NdiChannelIndicator): string {
  switch (indicator) {
    case 'unavailable':
      return 'unavailable'
    case 'idle':
      return 'idle'
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
