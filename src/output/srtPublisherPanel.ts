/**
 * Ops sidebar **SRT out** rows (Phase 22). DOM-only — never NDI pack / WebGL.
 *
 * Independent AR / 3D / 2D start/stop. Enabling a channel must not start NDI.
 */

import {
  getSrtOutBridge,
  SRT_OUT_CHANNEL_IDS,
  SRT_OUT_DEFAULT_URLS,
  type SrtOutChannelId,
  type SrtOutStatus,
} from './srtPublisher.ts'

export type SrtPublisherPanelOptions = {
  container: HTMLElement
  mountAt?: 'start' | 'end'
  /** Called when the operator flips a channel. Return false to skip IPC. */
  onWantedChange?: (
    channel: SrtOutChannelId,
    enabled: boolean,
  ) => void | boolean | Promise<void | boolean>
  pollMs?: number
}

export type SrtPublisherPanelHandle = {
  readonly root: HTMLElement
  refresh: () => void
  dispose: () => void
}

const CHANNEL_LABELS: Record<SrtOutChannelId, string> = {
  ar: 'SRT AR',
  '3d': 'SRT 3D',
  '2d': 'SRT 2D',
}

const DEFAULT_POLL_MS = 500

function idleStatus(channel: SrtOutChannelId): SrtOutStatus {
  return {
    channel,
    state: 'idle',
    encoder: null,
    encoderFps: null,
    url: SRT_OUT_DEFAULT_URLS[channel],
    lastError: null,
    fallbackNote: null,
  }
}

/**
 * Ops Output section: three independent SRT caller toggles.
 * **Invariant:** DOM-only. Never readback / NDI IPC / grandi.
 */
export function startSrtPublisherPanel(
  options: SrtPublisherPanelOptions,
): SrtPublisherPanelHandle {
  const pollMs =
    typeof options.pollMs === 'number' && options.pollMs > 0
      ? options.pollMs
      : DEFAULT_POLL_MS

  const root = document.createElement('div')
  root.className = 'srt-out-ctrl'
  root.setAttribute('data-ops', 'srt-out')

  const title = document.createElement('div')
  title.className = 'ndi-ctrl__channel-title'
  title.textContent = 'SRT program out'
  root.appendChild(title)

  const hint = document.createElement('p')
  hint.className = 'ndi-ctrl__hint'
  hint.textContent =
    'OBS first: Media Source, uncheck Local File, Input Format mpegts, srt://0.0.0.0:920n?mode=listener&latency=60000. Then check a box. NDI stays off.'
  root.appendChild(hint)

  const bridge = getSrtOutBridge()
  const blocks = new Map<SrtOutChannelId, ChannelBlock>()
  /** @type {Record<SrtOutChannelId, SrtOutStatus>} */
  const statusMap: Record<SrtOutChannelId, SrtOutStatus> = {
    ar: idleStatus('ar'),
    '3d': idleStatus('3d'),
    '2d': idleStatus('2d'),
  }

  for (const id of SRT_OUT_CHANNEL_IDS) {
    const block = channelBlock(id, {
      enabled: false,
      togglesLive: bridge != null,
      url: SRT_OUT_DEFAULT_URLS[id],
      onEnabledChange: (on) => {
        void handleToggle(id, on, block)
      },
    })
    blocks.set(id, block)
    root.appendChild(block.el)
  }

  if (bridge == null) {
    const miss = document.createElement('p')
    miss.className = 'ndi-ctrl__hint'
    miss.textContent =
      'SRT out unavailable in this shell (Chrome / no studio bridge)'
    miss.setAttribute('data-ops', 'srt-out-unavailable')
    root.appendChild(miss)
  }

  if (options.mountAt === 'start') {
    options.container.insertBefore(root, options.container.firstChild)
  } else {
    options.container.appendChild(root)
  }

  const unsub = bridge?.onStatus((status) => {
    statusMap[status.channel] = status
    paint(status.channel)
  })

  async function handleToggle(
    channel: SrtOutChannelId,
    enabled: boolean,
    block: ChannelBlock,
  ): Promise<void> {
    const allowed = await options.onWantedChange?.(channel, enabled)
    if (allowed === false) {
      block.enableToggle.checked = !enabled
      return
    }
    const ipc = getSrtOutBridge()
    if (!ipc) return
    if (enabled) {
      const url = block.urlInput.value.trim() || SRT_OUT_DEFAULT_URLS[channel]
      const result = await ipc.start({ channel, url })
      if (!result.ok) {
        statusMap[channel] = {
          ...statusMap[channel],
          state: 'error',
          lastError: result.error,
        }
        paint(channel)
      }
    } else {
      await ipc.stop({ channel })
    }
  }

  function paint(channel: SrtOutChannelId): void {
    const block = blocks.get(channel)
    if (!block) return
    const st = statusMap[channel]
    block.statusDot.dataset.state = st.state
    const fps =
      st.encoderFps != null && Number.isFinite(st.encoderFps)
        ? ` · ${st.encoderFps.toFixed(0)} fps`
        : ''
    block.statusText.textContent = st.state + fps
    block.encoder.value.textContent = st.encoder ?? '—'
    if (st.fallbackNote) {
      block.encoder.value.textContent = `${st.encoder ?? 'libx264'} (CPU fallback)`
    }
    block.error.value.textContent = st.lastError ?? '—'
    block.error.el.hidden = !st.lastError
    block.note.hidden = !st.fallbackNote
    block.note.textContent = st.fallbackNote ?? ''
    if (
      document.activeElement !== block.enableToggle &&
      document.activeElement !== block.urlInput
    ) {
      block.enableToggle.checked =
        st.state === 'live' || st.state === 'connecting'
    }
  }

  function refresh(): void {
    const ipc = getSrtOutBridge()
    if (!ipc) return
    void ipc
      .getStatus()
      .then((all) => {
        for (const id of SRT_OUT_CHANNEL_IDS) {
          if (all[id]) statusMap[id] = all[id]
          paint(id)
        }
      })
      .catch(() => {
        /* ignore poll errors */
      })
  }

  refresh()
  const timer = window.setInterval(refresh, pollMs)

  return {
    root,
    refresh,
    dispose(): void {
      window.clearInterval(timer)
      unsub?.()
      root.remove()
    },
  }
}

type ChannelBlock = {
  el: HTMLElement
  enableToggle: HTMLInputElement
  urlInput: HTMLInputElement
  statusDot: HTMLElement
  statusText: HTMLElement
  encoder: { el: HTMLElement; value: HTMLElement }
  error: { el: HTMLElement; value: HTMLElement }
  note: HTMLElement
}

function channelBlock(
  id: SrtOutChannelId,
  opts: {
    enabled: boolean
    togglesLive: boolean
    url: string
    onEnabledChange: (on: boolean) => void
  },
): ChannelBlock {
  const el = document.createElement('div')
  el.className = 'ndi-ctrl__channel'
  el.setAttribute('data-srt-out-channel', id)

  const enableRow = document.createElement('label')
  enableRow.className = 'ndi-ctrl__map-label'
  const enableToggle = document.createElement('input')
  enableToggle.type = 'checkbox'
  enableToggle.setAttribute('data-ops', `srt-out-toggle-${id}`)
  enableToggle.checked = opts.enabled
  enableToggle.disabled = !opts.togglesLive
  enableToggle.title = opts.togglesLive
    ? `Publish ${CHANNEL_LABELS[id]} (ffmpeg caller)`
    : 'SRT out requires the Electron studio bridge'
  const enableTitle = document.createElement('span')
  enableTitle.textContent = CHANNEL_LABELS[id]
  enableRow.append(enableToggle, enableTitle)
  el.appendChild(enableRow)
  if (opts.togglesLive) {
    enableToggle.addEventListener('change', () => {
      opts.onEnabledChange(enableToggle.checked)
    })
  }

  const statusRow = row('Status')
  const statusDot = document.createElement('span')
  statusDot.className = 'ndi-ctrl__dot'
  statusDot.setAttribute('aria-hidden', 'true')
  const statusText = document.createElement('span')
  statusText.className = 'ndi-ctrl__status-text'
  statusText.textContent = 'idle'
  statusRow.value.append(statusDot, statusText)
  el.appendChild(statusRow.el)

  const encoder = row('Encoder')
  encoder.value.setAttribute('data-ops', `srt-out-encoder-${id}`)
  el.appendChild(encoder.el)

  const urlRow = document.createElement('div')
  urlRow.className = 'ndi-ctrl__row'
  const urlLab = document.createElement('span')
  urlLab.className = 'ndi-ctrl__label'
  urlLab.textContent = 'URL'
  const urlInput = document.createElement('input')
  urlInput.type = 'text'
  urlInput.className = 'srt-out-ctrl__url'
  urlInput.value = opts.url
  urlInput.setAttribute('data-ops', `srt-out-url-${id}`)
  urlInput.spellcheck = false
  urlInput.title = 'SRT caller URL (local 127.0.0.1 defaults)'
  urlRow.append(urlLab, urlInput)
  el.appendChild(urlRow)

  const error = row('Error')
  el.appendChild(error.el)

  const note = document.createElement('p')
  note.className = 'ndi-ctrl__hint srt-out-ctrl__fallback'
  note.setAttribute('data-ops', `srt-out-fallback-${id}`)
  note.hidden = true
  el.appendChild(note)

  return {
    el,
    enableToggle,
    urlInput,
    statusDot,
    statusText,
    encoder,
    error,
    note,
  }
}

function row(label: string): { el: HTMLElement; value: HTMLElement } {
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
