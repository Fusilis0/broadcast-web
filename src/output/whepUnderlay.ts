import { normalizeOutputMode } from './applyOutputMode.ts'
import type { ClearColorTarget, OutputMode } from './types.ts'
import {
  formatWhepStatusLabel,
  normalizeWhepUrl,
  resolveUnderlayClearAlpha,
  shouldRunWhepUnderlay,
  type WhepStatus,
} from './whepUnderlayHelpers.ts'

const RECONNECT_MS = 3000

export type WhepUnderlayOptions = {
  container: HTMLElement
  /** Full WHEP POST URL (MediaMTX). Empty → stay off. */
  whepUrl: string
  initialMode?: unknown
  /**
   * Optional WebGL clear target. When underlay is active in preview,
   * clear alpha is set to 0 so the DOM video shows through.
   */
  renderer?: ClearColorTarget
  /** Invoked on status changes (also reflected in OUT status DOM). */
  onStatus?: (status: WhepStatus) => void
}

export type WhepUnderlayHandle = {
  getStatus: () => WhepStatus
  /** Remote `<video>` for future CV; null when stopped / never started. */
  getVideoElement: () => HTMLVideoElement | null
  setMode: (mode: unknown) => void
  stop: () => void
}

/**
 * Browser WHEP underlay (native `RTCPeerConnection` + HTTP SDP POST).
 * Soft-fails on empty URL or unreachable MediaMTX — never throws from boot.
 */
export function startWhepUnderlay(
  options: WhepUnderlayOptions,
): WhepUnderlayHandle {
  const url = normalizeWhepUrl(options.whepUrl)
  let mode: OutputMode = normalizeOutputMode(options.initialMode)
  let status: WhepStatus = 'off'
  let pc: RTCPeerConnection | null = null
  let video: HTMLVideoElement | null = null
  let sessionResourceUrl: string | null = null
  let generation = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const statusEl = document.createElement('span')
  statusEl.className = 'output-mode-control__whep'
  statusEl.setAttribute('data-whep-status', 'off')
  statusEl.textContent = formatWhepStatusLabel('off')

  // Prefer attaching next to existing OUT mode control (may live in the Ops
  // sidebar, not under the video `container`); else create a thin strip.
  const existingControl =
    options.container.querySelector('.output-mode-control') ??
    document.querySelector('.output-mode-control')
  let statusRoot: HTMLElement | null = null
  if (existingControl) {
    existingControl.appendChild(statusEl)
  } else {
    statusRoot = document.createElement('div')
    statusRoot.className = 'output-mode-control output-mode-control--whep-only'
    statusRoot.appendChild(statusEl)
    options.container.appendChild(statusRoot)
  }

  function setStatus(next: WhepStatus): void {
    status = next
    statusEl.textContent = formatWhepStatusLabel(next)
    statusEl.setAttribute('data-whep-status', next)
    options.onStatus?.(next)
  }

  function applyClearForCurrent(): void {
    if (!options.renderer || mode !== 'preview') return
    const showThrough =
      shouldRunWhepUnderlay(url, mode) &&
      (status === 'connecting' || status === 'live')
    const alpha = resolveUnderlayClearAlpha({
      mode,
      underlayActive: showThrough,
    })
    // Preserve preview RGB; alpha 0 lets DOM video show under the canvas.
    options.renderer.setClearColor(0x1a1a1a, alpha)
  }

  function clearReconnect(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect(gen: number): void {
    clearReconnect()
    if (stopped || gen !== generation) return
    if (!shouldRunWhepUnderlay(url, mode)) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (stopped || gen !== generation) return
      void connect(gen)
    }, RECONNECT_MS)
  }

  function teardownPeer(): void {
    clearReconnect()
    if (pc) {
      try {
        pc.close()
      } catch {
        /* ignore */
      }
      pc = null
    }
    if (video) {
      video.srcObject = null
      video.remove()
      video = null
    }
    if (sessionResourceUrl) {
      void fetch(sessionResourceUrl, { method: 'DELETE' }).catch(() => {
        /* soft-fail cleanup */
      })
      sessionResourceUrl = null
    }
  }

  function ensureVideo(): HTMLVideoElement {
    if (video) return video
    const el = document.createElement('video')
    el.className = 'whep-underlay'
    el.muted = true
    el.autoplay = true
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.setAttribute('muted', '')
    el.setAttribute('aria-hidden', 'true')
    // Insert under WebGL canvas (first child preference).
    const canvas = options.container.querySelector('canvas')
    if (canvas?.parentElement === options.container) {
      options.container.insertBefore(el, canvas)
    } else {
      options.container.insertBefore(el, options.container.firstChild)
    }
    video = el
    return el
  }

  function hideVideo(): void {
    if (video) {
      video.hidden = true
      video.srcObject = null
    }
  }

  async function connect(gen: number): Promise<void> {
    if (stopped || gen !== generation) return
    if (!shouldRunWhepUnderlay(url, mode)) {
      setStatus('off')
      applyClearForCurrent()
      return
    }

    teardownPeer()
    if (stopped || gen !== generation) return

    setStatus('connecting')
    applyClearForCurrent()
    const el = ensureVideo()
    el.hidden = false

    try {
      const peer = new RTCPeerConnection()
      pc = peer
      peer.addTransceiver('video', { direction: 'recvonly' })

      peer.ontrack = (ev) => {
        if (stopped || gen !== generation || pc !== peer) return
        const stream = ev.streams[0] ?? new MediaStream([ev.track])
        el.srcObject = stream
        void el.play().catch(() => {
          /* autoplay policies — muted should allow */
        })
        setStatus('live')
        applyClearForCurrent()
      }

      peer.onconnectionstatechange = () => {
        if (stopped || gen !== generation || pc !== peer) return
        const state = peer.connectionState
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.warn(`[output] WHEP connection ${state}; will retry`)
          setStatus('error')
          applyClearForCurrent()
          scheduleReconnect(gen)
        }
      }

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      const localSdp = peer.localDescription?.sdp
      if (!localSdp) {
        throw new Error('missing local SDP')
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          Accept: 'application/sdp',
        },
        body: localSdp,
      })

      if (stopped || gen !== generation || pc !== peer) return

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`WHEP HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
      }

      const answerSdp = await res.text()
      const location = res.headers.get('Location')
      if (location) {
        try {
          sessionResourceUrl = new URL(location, url).href
        } catch {
          sessionResourceUrl = location
        }
      }

      await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })
      if (stopped || gen !== generation || pc !== peer) return
      // Status becomes live on first track; if already connected without track event, stay connecting.
    } catch (err) {
      if (stopped || gen !== generation) return
      console.warn('[output] WHEP underlay failed (soft-fail):', err)
      setStatus('error')
      hideVideo()
      applyClearForCurrent()
      if (pc) {
        try {
          pc.close()
        } catch {
          /* ignore */
        }
        pc = null
      }
      scheduleReconnect(gen)
    }
  }

  function syncToMode(): void {
    generation += 1
    const gen = generation
    clearReconnect()
    if (!shouldRunWhepUnderlay(url, mode)) {
      teardownPeer()
      hideVideo()
      setStatus('off')
      // Leave clear color to applyOutputMode caller for chroma/preview opaque.
      if (mode === 'preview' && options.renderer) {
        options.renderer.setClearColor(0x1a1a1a, 1)
      }
      return
    }
    void connect(gen)
  }

  // Boot: empty URL → off immediately; otherwise connect in preview.
  if (url === '') {
    setStatus('off')
  } else {
    syncToMode()
  }

  return {
    getStatus: () => status,
    getVideoElement: () => video,
    setMode(next): void {
      if (stopped) return
      const resolved = normalizeOutputMode(next)
      if (resolved === mode) return
      mode = resolved
      syncToMode()
    },
    stop(): void {
      if (stopped) return
      stopped = true
      generation += 1
      clearReconnect()
      teardownPeer()
      setStatus('off')
      statusEl.remove()
      statusRoot?.remove()
    },
  }
}
