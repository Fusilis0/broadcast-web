import type { MockChannel, MockPacket } from './mockSource.ts'

export type LiveWsStatus = 'idle' | 'connecting' | 'open' | 'closed'

export type LiveSourceOptions = {
  /** Drone (primary) WebSocket URL. Empty → no drone socket. */
  droneUrl?: string
  /** Boat WebSocket URL. Empty → no boat socket. */
  boatUrl?: string
  onPacket?: (packet: MockPacket) => void
  /** Optional status transitions (connecting|open|closed). */
  onStatus?: (channel: MockChannel, status: LiveWsStatus) => void
  /** Injectable WebSocket (tests). Defaults to global `WebSocket`. */
  WebSocketImpl?: typeof WebSocket
  /** Initial reconnect delay (ms). Default 500. */
  initialBackoffMs?: number
  /** Cap reconnect delay (ms). Default 10_000. */
  maxBackoffMs?: number
}

type ChannelSocket = {
  channel: MockChannel
  url: string
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  backoffMs: number
  status: LiveWsStatus
}

function trimUrl(value: string | undefined): string {
  return value !== undefined ? value.trim() : ''
}

function decodeWsData(data: unknown): string | null {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data)
  }
  return null
}

/**
 * Spine live source: one drone + optional boat WebSocket.
 * Soft-fails on missing URLs / connect errors; reconnects with capped exponential backoff.
 */
export class LiveTelemetrySource {
  private readonly droneUrl: string
  private readonly boatUrl: string
  private readonly onPacket?: (packet: MockPacket) => void
  private readonly onStatus?: (channel: MockChannel, status: LiveWsStatus) => void
  private readonly WebSocketImpl: typeof WebSocket
  private readonly initialBackoffMs: number
  private readonly maxBackoffMs: number

  private running = false
  private intentionalStop = false
  private readonly sockets: ChannelSocket[] = []

  constructor(options: LiveSourceOptions = {}) {
    this.droneUrl = trimUrl(options.droneUrl)
    this.boatUrl = trimUrl(options.boatUrl)
    this.onPacket = options.onPacket
    this.onStatus = options.onStatus
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket
    this.initialBackoffMs = options.initialBackoffMs ?? 500
    this.maxBackoffMs = options.maxBackoffMs ?? 10_000
  }

  get isRunning(): boolean {
    return this.running
  }

  /** Snapshot of per-channel socket status. */
  getStatus(): Record<MockChannel, LiveWsStatus> {
    const out: Record<MockChannel, LiveWsStatus> = {
      drone: 'idle',
      boat: 'idle',
    }
    for (const s of this.sockets) {
      out[s.channel] = s.status
    }
    if (this.droneUrl === '' && out.drone === 'idle') {
      /* keep idle — no socket */
    }
    if (this.boatUrl === '' && out.boat === 'idle') {
      /* keep idle — no socket */
    }
    return out
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.intentionalStop = false
    this.sockets.length = 0

    if (this.droneUrl === '' && this.boatUrl === '') {
      console.warn(
        '[telemetry] live: no WebSocket URL configured (wsUrl / VITE_WS_URL); idle',
      )
      return
    }

    if (this.droneUrl === '') {
      console.warn(
        '[telemetry] live: drone URL empty — boat-only live (unusual for spine)',
      )
    } else {
      this.openChannel('drone', this.droneUrl)
    }

    if (this.boatUrl !== '') {
      this.openChannel('boat', this.boatUrl)
    } else {
      console.info('[telemetry] live: wsBoatUrl empty — drone-only live')
    }
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.intentionalStop = true
    for (const s of this.sockets) {
      this.clearReconnect(s)
      this.closeSocket(s)
      this.setStatus(s, 'closed')
    }
    this.sockets.length = 0
  }

  private openChannel(channel: MockChannel, url: string): void {
    const slot: ChannelSocket = {
      channel,
      url,
      ws: null,
      reconnectTimer: null,
      backoffMs: this.initialBackoffMs,
      status: 'idle',
    }
    this.sockets.push(slot)
    this.connect(slot)
  }

  private connect(slot: ChannelSocket): void {
    if (!this.running || this.intentionalStop) return

    this.clearReconnect(slot)
    this.closeSocket(slot)
    this.setStatus(slot, 'connecting')

    let ws: WebSocket
    try {
      ws = new this.WebSocketImpl(slot.url)
    } catch (err) {
      console.warn(
        `[telemetry] live: failed to open ${slot.channel} WebSocket:`,
        err,
      )
      this.setStatus(slot, 'closed')
      this.scheduleReconnect(slot)
      return
    }

    slot.ws = ws

    ws.onopen = () => {
      if (!this.running || slot.ws !== ws) return
      slot.backoffMs = this.initialBackoffMs
      this.setStatus(slot, 'open')
      console.info(`[telemetry] live: ${slot.channel} open`)
    }

    ws.onmessage = (event: MessageEvent) => {
      if (!this.running || slot.ws !== ws) return
      const jsonText = decodeWsData(event.data)
      if (jsonText === null) {
        console.warn(
          `[telemetry] live: ${slot.channel} non-text frame ignored`,
        )
        return
      }
      try {
        this.onPacket?.({ channel: slot.channel, jsonText })
      } catch (err) {
        console.warn(
          `[telemetry] live: ${slot.channel} packet handler error:`,
          err,
        )
      }
    }

    ws.onerror = () => {
      // Browsers often follow with onclose; avoid double-scheduling here.
      if (!this.running || slot.ws !== ws) return
      console.warn(`[telemetry] live: ${slot.channel} WebSocket error`)
    }

    ws.onclose = () => {
      if (slot.ws !== ws) return
      slot.ws = null
      this.setStatus(slot, 'closed')
      if (!this.running || this.intentionalStop) return
      console.warn(
        `[telemetry] live: ${slot.channel} closed — reconnect in ${slot.backoffMs}ms`,
      )
      this.scheduleReconnect(slot)
    }
  }

  private scheduleReconnect(slot: ChannelSocket): void {
    if (!this.running || this.intentionalStop) return
    this.clearReconnect(slot)
    const delay = slot.backoffMs
    slot.backoffMs = Math.min(slot.backoffMs * 2, this.maxBackoffMs)
    slot.reconnectTimer = setTimeout(() => {
      slot.reconnectTimer = null
      this.connect(slot)
    }, delay)
  }

  private clearReconnect(slot: ChannelSocket): void {
    if (slot.reconnectTimer !== null) {
      clearTimeout(slot.reconnectTimer)
      slot.reconnectTimer = null
    }
  }

  private closeSocket(slot: ChannelSocket): void {
    const ws = slot.ws
    if (ws === null) return
    slot.ws = null
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    try {
      ws.close()
    } catch {
      // ignore
    }
  }

  private setStatus(slot: ChannelSocket, status: LiveWsStatus): void {
    slot.status = status
    this.onStatus?.(slot.channel, status)
  }
}
