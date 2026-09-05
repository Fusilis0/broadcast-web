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
import {
  defaultNdiChannelWanted,
  type NdiChannelWanted,
} from './ndiChannelWanted.ts'
import type { NdiFramePumpHandle } from './ndiFramePump.ts'
import { formatNdiSendFps } from './perfCounters.ts'
import type { StreamMapNdiPumpHandle } from './streamMapNdiPump.ts'
import {
  applyNdiMainPerfSummary,
  fallbackHudFlags,
  formatNdiStageDump,
  formatNdiStageHud,
  clearNdiSyncFallbacks,
} from './ndiStageTiming.ts'

/** Minimal pump surface for status rows (AR / 3D / 2D). */
export type NdiStatusPumpHandle = {
  getSourceName: () => string | null
  getSdkVersion: () => string | null
  getError: () => string | null
  getSendFps?: () => number
  isEnabled?: () => boolean
}

/**
 * Air NDI status for the ops controller tab (read-only indicator).
 * Phase 19.4: hand toggles pause/resume each channel; session-only.
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
 * Multi-sender bridge ready (Phase 13.4+). Phase 19.4: AR/3D/2D each have
 * independent hand toggles (session-only; default all on).
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
    const pump = input.pump ?? null
    if (pump && pump.isEnabled && !pump.isEnabled()) {
      if (input.status?.active) return 'live'
      if (input.status?.error) return 'error'
      return 'idle'
    }
    const fromPump = resolveNdiAirIndicator({
      studioBridgePresent: true,
      pump,
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

/**
 * Status text for the NDI tab. Sender **live** with no successful send this
 * window must not look healthy (BW: Send — while Status live).
 */
export function formatNdiLiveStatus(
  indicator: NdiChannelIndicator,
  sendFps: number | null | undefined,
): string {
  if (indicator !== 'live') return labelFor(indicator)
  if (sendFps == null || !Number.isFinite(sendFps) || sendFps <= 0) {
    return 'live · no send'
  }
  return 'live'
}

/**
 * Yellow SYNC READBACK / SYNC 2D banner. Hidden when every Send box is off
 * (must not stay latched from a boot probe). Hidden unless a live enabled
 * channel is actually on emergency sync.
 */
export function shouldShowNdiSyncFallbackBanner(input: {
  syncReadback: boolean
  sync2dCapture: boolean
  arEnabled: boolean
  d3Enabled: boolean
  mapEnabled: boolean
}): boolean {
  if (!input.arEnabled && !input.d3Enabled && !input.mapEnabled) return false
  return input.syncReadback || input.sync2dCapture
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
   * Phase 19.4: hand toggle for any channel (AR / 3D / 2D). Session-only.
   * Default all **on**.
   */
  onNdiChannelWantedChange?: (channel: NdiChannelId, enabled: boolean) => void
  /**
   * @deprecated Prefer `onNdiChannelWantedChange` (still fired for `'2d'`).
   */
  onStreamMapNdiEnabledChange?: (enabled: boolean) => void
  /** Seed toggle UI from session wanted flags (default all on). */
  initialChannelWanted?: Partial<NdiChannelWanted>
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
  const wantedState: NdiChannelWanted = {
    ...defaultNdiChannelWanted(),
    ...options.initialChannelWanted,
  }
  const bridgeAtMount = getStudioBridge() != null
  const togglesLive = STREAM_MAP_NDI_BRIDGE_SUPPORTED && bridgeAtMount
  let ready = false

  function emitWanted(channel: NdiChannelId, enabled: boolean): void {
    wantedState[channel] = enabled
    options.onNdiChannelWantedChange?.(channel, enabled)
    if (channel === '2d') {
      options.onStreamMapNdiEnabledChange?.(enabled)
    }
    if (ready) refresh()
  }

  for (const id of NDI_CHANNEL_IDS) {
    const block = channelBlock(
      id,
      delayState[id],
      (ms) => {
        delayState[id] = ms
        options.onDelayMsChange?.(id, ms)
      },
      {
        enabled: wantedState[id] !== false,
        togglesLive,
        onEnabledChange: (on) => emitWanted(id, on),
      },
    )
    blocks.set(id, block)
    root.appendChild(block.el)
  }

  const povRow = row('Active POV')
  root.appendChild(povRow.el)

  const lockNote = document.createElement('p')
  lockNote.className = 'ndi-ctrl__hint'
  lockNote.textContent =
    'Air lock: AR + 3D NDI always frame the active POV (not free cam). Independent hand toggles (AR / 3D / 2D) pause or resume each sender for this session only — not saved to project.json. Default all on. Capture rates: AR and 3D ~30 fps on independent clocks (60 Hz studio tick). 2D stream-map NDI is a separate sender @ ~30 fps. Per-channel delay (0–30000 ms) holds frames in RAM — default 0 allocates nothing; >3000 ms warns high memory. Shrinking delay drops buffered frames.'
  root.appendChild(lockNote)


  const fallbackEl = document.createElement('p')
  fallbackEl.className = 'ndi-ctrl__fallback'
  fallbackEl.setAttribute('data-ops', 'ndi-sync-fallback')
  fallbackEl.hidden = true
  root.appendChild(fallbackEl)

  const perfBlock = document.createElement('div')
  perfBlock.className = 'ndi-ctrl__perf'
  perfBlock.setAttribute('data-ops', 'ndi-stage-timing')
  const perfTitle = document.createElement('div')
  perfTitle.className = 'ndi-ctrl__channel-title'
  perfTitle.textContent = 'Stage timing (1 s)'
  const perfPre = document.createElement('pre')
  perfPre.className = 'ndi-ctrl__perf-pre'
  perfPre.setAttribute('data-ops', 'ndi-stage-timing-text')
  perfPre.textContent = 'waiting for studio:tick…'
  const dumpBtn = document.createElement('button')
  dumpBtn.type = 'button'
  dumpBtn.className = 'ndi-ctrl__dump-btn'
  dumpBtn.setAttribute('data-ops', 'ndi-perf-dump')
  dumpBtn.textContent = 'Copy 10 s dump'
  dumpBtn.title =
    'Copy ~10 s of per-stage timings, tick-interval histogram, and capture-tick histogram (window.__perfDump())'
  dumpBtn.addEventListener('click', () => {
    const text = formatNdiStageDump()
    const write = navigator.clipboard?.writeText
    if (typeof write === 'function') {
      void write.call(navigator.clipboard, text).catch(() => {
        window.prompt('NDI stage dump (copy):', text)
      })
    } else {
      window.prompt('NDI stage dump (copy):', text)
    }
  })
  const dumpHint = document.createElement('p')
  dumpHint.className = 'ndi-ctrl__hint'
  dumpHint.textContent =
    'Measurement only. window.__perfDump() returns the same text. Histogram is ticks between captures (healthy = cluster on 2).'
  perfBlock.append(perfTitle, perfPre, dumpBtn, dumpHint)
  root.appendChild(perfBlock)

  // Apply session wanted flags so main can sync before pumps exist.
  if (togglesLive) {
    for (const id of NDI_CHANNEL_IDS) {
      emitWanted(id, wantedState[id] !== false)
    }
  }

  options.container.appendChild(root)

  let statusAll: StudioNdiStatusAll | null = null
  let statusFetchInFlight = false
  const unsubPerf = getStudioBridge()?.ndi.onPerfSummary?.((summary) => {
    applyNdiMainPerfSummary(summary)
  })

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

      let sendAvailable = false
      let sendFps: number | null = null
      if (
        indicator !== 'unavailable' &&
        indicator !== 'idle' &&
        indicator !== 'stopped'
      ) {
        if (id === '2d') {
          sendAvailable = streamMapPump?.isEnabled() === true
          sendFps = sendAvailable ? streamMapPump!.getSendFps() : null
        } else {
          sendAvailable = channelPump != null
          sendFps = channelPump?.getSendFps?.() ?? null
        }
      }
      block.statusText.textContent = formatNdiLiveStatus(indicator, sendFps)
      block.send.value.textContent = formatNdiSendFps(sendFps, sendAvailable)

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
    // Keep hand toggles in sync with pumps (external setEnabled).
    if (togglesLive) {
      const arBlock = blocks.get(DEFAULT_NDI_CHANNEL)
      const d3Block = blocks.get('3d')
      const mapBlockUi = blocks.get('2d')
      if (arBlock && pump && document.activeElement !== arBlock.enableToggle) {
        arBlock.enableToggle.checked = pump.isEnabled()
      }
      if (
        d3Block &&
        pump3d &&
        document.activeElement !== d3Block.enableToggle
      ) {
        d3Block.enableToggle.checked = pump3d.isEnabled()
      }
      if (
        mapBlockUi &&
        streamMapPump &&
        document.activeElement !== mapBlockUi.enableToggle
      ) {
        mapBlockUi.enableToggle.checked = streamMapPump.isEnabled()
      }
    }

    const pov = options.getActivePovId()
    povRow.value.textContent =
      pov != null && String(pov).trim() !== '' ? String(pov) : '—'

    const flags = fallbackHudFlags()
    const arEnabled = pump ? pump.isEnabled() : wantedState.ar !== false
    const d3Enabled = pump3d ? pump3d.isEnabled() : wantedState['3d'] !== false
    const mapEnabled = streamMapPump
      ? streamMapPump.isEnabled()
      : wantedState['2d'] !== false
    if (!arEnabled && !d3Enabled && !mapEnabled) {
      clearNdiSyncFallbacks()
    }
    const showBanner = shouldShowNdiSyncFallbackBanner({
      syncReadback: flags.syncReadback,
      sync2dCapture: flags.sync2dCapture,
      arEnabled,
      d3Enabled,
      mapEnabled,
    })
    if (showBanner) {
      fallbackEl.hidden = false
      const parts: string[] = []
      if (flags.syncReadback) {
        parts.push('SYNC READBACK (readPixels) — UI may hitch')
      }
      if (flags.sync2dCapture) {
        parts.push('SYNC 2D getImageData — UI may hitch')
      }
      fallbackEl.textContent = parts.join(' · ')
    } else {
      fallbackEl.hidden = true
      fallbackEl.textContent = ''
    }
    perfPre.textContent = formatNdiStageHud()
  }

  ready = true
  refresh()
  const timer = window.setInterval(refresh, pollMs)

  return {
    root,
    refresh,
    dispose(): void {
      window.clearInterval(timer)
      unsubPerf?.()
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
  send: { el: HTMLElement; value: HTMLElement }
  error: { el: HTMLElement; value: HTMLElement }
  enableToggle: HTMLInputElement
  delayInput: HTMLInputElement
  delayWarn: HTMLElement
}

function channelBlock(
  id: NdiChannelId,
  initialDelayMs: number,
  onDelayChange: (ms: number) => void,
  enableOpts: {
    enabled: boolean
    togglesLive: boolean
    onEnabledChange: (on: boolean) => void
  },
): ChannelBlock {
  const el = document.createElement('div')
  el.className = 'ndi-ctrl__channel'
  el.setAttribute('data-ndi-channel', id)

  const title = document.createElement('div')
  title.className = 'ndi-ctrl__channel-title'
  title.textContent = CHANNEL_LABELS[id]
  el.appendChild(title)

  const enableRow = document.createElement('label')
  enableRow.className = 'ndi-ctrl__map-label'
  const enableToggle = document.createElement('input')
  enableToggle.type = 'checkbox'
  enableToggle.setAttribute('data-ops', `ndi-channel-toggle-${id}`)
  enableToggle.checked = enableOpts.enabled
  enableToggle.disabled = !enableOpts.togglesLive
  enableToggle.title = enableOpts.togglesLive
    ? `Hand toggle ${CHANNEL_LABELS[id]} NDI (session only)`
    : 'NDI toggles require the Electron studio bridge'
  const enableTitle = document.createElement('span')
  enableTitle.textContent = 'Send on NDI'
  enableRow.append(enableToggle, enableTitle)
  el.appendChild(enableRow)
  if (enableOpts.togglesLive) {
    enableToggle.addEventListener('change', () => {
      enableOpts.onEnabledChange(enableToggle.checked)
    })
  }

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
  const send = row('Send')
  send.value.setAttribute('data-ops', `ndi-send-fps-${id}`)
  el.appendChild(send.el)
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
    send,
    error,
    enableToggle,
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
