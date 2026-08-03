import type { MockChannel, MockPacket } from './mockSource.ts'

export type LiveWsStatus = 'idle' | 'connecting' | 'open' | 'closed'

/** Per-id live socket snapshot (handshake vs data). */
export type LiveIdSocketStatus = {
  id: string
  url: string
  status: LiveWsStatus
  /** Wall-clock `Date.now()` of last text frame; null if none yet. */
  lastPacketAtMs: number | null
  /** Age in ms at snapshot time; null if no packets. */
  lastPacketAgeMs: number | null
}

export type LiveStatusSnapshot = {
  drone: LiveWsStatus
  boat: LiveWsStatus
  droneIds: LiveIdSocketStatus[]
  boatIds: LiveIdSocketStatus[]
}

export type LiveSourceOptions = {
  /**
   * Drone / POV WebSocket URLs (one per registered id).
   * Legacy: `droneUrl` alone still works.
   */
  droneUrls?: readonly string[]
  /** @deprecated Prefer `droneUrls`. Single drone URL. */
  droneUrl?: string
  /** Boat WebSocket URLs (one per registered boat id). */
  boatUrls?: readonly string[]
  /** @deprecated Prefer `boatUrls`. Single boat URL. */
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
  /**
   * Soft-warn when a socket stays open with no packets for this long (ms).
   * Default 8000. Set 0 to disable.
   */
  noPacketWarnMs?: number
}

type ChannelSocket = {
  channel: MockChannel
  id: string
  url: string
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  backoffMs: number
  status: LiveWsStatus
  openAtMs: number | null
  lastPacketAtMs: number | null
  noPacketWarned: boolean
}

function trimUrl(value: string | undefined): string {
  return value !== undefined ? value.trim() : ''
}

function resolveUrlList(
  list: readonly string[] | undefined,
  legacy: string | undefined,
): string[] {
  const fromList =
    list?.map((u) => u.trim()).filter((u) => u !== '') ?? []
  if (fromList.length > 0) return [...new Set(fromList)]
  const one = trimUrl(legacy)
  return one !== '' ? [one] : []
}

function decodeWsData(data: unknown): string | null {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data)
  }
  return null
}

function aggregateStatus(statuses: LiveWsStatus[]): LiveWsStatus {
  if (statuses.length === 0) return 'idle'
  if (statuses.some((s) => s === 'open')) return 'open'
  if (statuses.some((s) => s === 'connecting')) return 'connecting'
  if (statuses.every((s) => s === 'closed')) return 'closed'
  return 'idle'
}

/** Best-effort id from `?id=` (or `#id` fallback). */
export function idFromLiveWsUrl(url: string): string {
  try {
    const u = new URL(url)
    const id = u.searchParams.get('id')
    if (id !== null && id.trim() !== '') return id.trim()
  } catch {
    const m = /[?&]id=([^&]*)/.exec(url)
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1]).trim()
      } catch {
        return m[1].trim()
      }
    }
  }
  return ''
}

/**
 * Live source: one WebSocket per drone URL and per boat URL.
 * Soft-fails on missing URLs / connect errors; reconnects with capped exponential backoff.
 */
export class LiveTelemetrySource {
  private readonly droneUrls: string[]
  private readonly boatUrls: string[]
  private readonly onPacket?: (packet: MockPacket) => void
  private readonly onStatus?: (channel: MockChannel, status: LiveWsStatus) => void
  private readonly WebSocketImpl: typeof WebSocket
  private readonly initialBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly noPacketWarnMs: number

  private running = false
  private intentionalStop = false
  private readonly sockets: ChannelSocket[] = []
  private noPacketTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: LiveSourceOptions = {}) {
    this.droneUrls = resolveUrlList(options.droneUrls, options.droneUrl)
    this.boatUrls = resolveUrlList(options.boatUrls, options.boatUrl)
    this.onPacket = options.onPacket
    this.onStatus = options.onStatus
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket
    this.initialBackoffMs = options.initialBackoffMs ?? 500
    this.maxBackoffMs = options.maxBackoffMs ?? 10_000
    this.noPacketWarnMs = options.noPacketWarnMs ?? 8000
  }

  get isRunning(): boolean {
    return this.running
  }

  /** Snapshot of per-channel socket status (aggregated across multi-id sockets). */
  getStatus(): LiveStatusSnapshot {
    const now = Date.now()
    const droneSlots = this.sockets.filter((s) => s.channel === 'drone')
    const boatSlots = this.sockets.filter((s) => s.channel === 'boat')
    return {
      drone: aggregateStatus(droneSlots.map((s) => s.status)),
      boat: aggregateStatus(boatSlots.map((s) => s.status)),
      droneIds: droneSlots.map((s) => this.toIdStatus(s, now)),
      boatIds: boatSlots.map((s) => this.toIdStatus(s, now)),
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.intentionalStop = false
    this.sockets.length = 0

    if (this.droneUrls.length === 0 && this.boatUrls.length === 0) {
      console.warn(
        '[telemetry] live: no WebSocket URLs (base + enabled ids); idle',
      )
      return
    }

    if (this.droneUrls.length === 0) {
      console.warn(
        '[telemetry] live: no drone URLs — boat-only live',
      )
    } else {
      for (const url of this.droneUrls) {
        this.openChannel('drone', url)
      }
    }

    if (this.boatUrls.length === 0) {
      console.info('[telemetry] live: no boat URLs — drone-only live')
    } else {
      for (const url of this.boatUrls) {
        this.openChannel('boat', url)
      }
    }

    this.startNoPacketWatch()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.intentionalStop = true
    this.stopNoPacketWatch()
    for (const s of this.sockets) {
      this.clearReconnect(s)
      this.closeSocket(s)
      this.setStatus(s, 'closed')
    }
    this.sockets.length = 0
  }

  private toIdStatus(slot: ChannelSocket, now: number): LiveIdSocketStatus {
    return {
      id: slot.id,
      url: slot.url,
      status: slot.status,
      lastPacketAtMs: slot.lastPacketAtMs,
      lastPacketAgeMs:
        slot.lastPacketAtMs === null ? null : now - slot.lastPacketAtMs,
    }
  }

  private openChannel(channel: MockChannel, url: string): void {
    const slot: ChannelSocket = {
      channel,
      id: idFromLiveWsUrl(url),
      url,
      ws: null,
      reconnectTimer: null,
      backoffMs: this.initialBackoffMs,
      status: 'idle',
      openAtMs: null,
      lastPacketAtMs: null,
      noPacketWarned: false,
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
      slot.openAtMs = Date.now()
      slot.noPacketWarned = false
      this.setStatus(slot, 'open')
      console.info(
        `[telemetry] live: ${slot.channel}${slot.id ? ` id=${slot.id}` : ''} open (${slot.url})`,
      )
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
      slot.lastPacketAtMs = Date.now()
      slot.noPacketWarned = false
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
      if (!this.running || slot.ws !== ws) return
      console.warn(`[telemetry] live: ${slot.channel} WebSocket error`)
    }

    ws.onclose = () => {
      if (slot.ws !== ws) return
      slot.ws = null
      slot.openAtMs = null
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
    this.onStatus?.(slot.channel, aggregateStatus(
      this.sockets.filter((s) => s.channel === slot.channel).map((s) => s.status),
    ))
  }

  private startNoPacketWatch(): void {
    this.stopNoPacketWatch()
    if (this.noPacketWarnMs <= 0) return
    this.noPacketTimer = setInterval(() => {
      if (!this.running) return
      const now = Date.now()
      for (const slot of this.sockets) {
        if (slot.status !== 'open' || slot.noPacketWarned) continue
        if (slot.lastPacketAtMs !== null) continue
        if (slot.openAtMs === null) continue
        if (now - slot.openAtMs < this.noPacketWarnMs) continue
        slot.noPacketWarned = true
        const label =
          slot.id !== '' ? `${slot.channel} id=${slot.id}` : slot.channel
        console.warn(
          `[telemetry] live: ${label} open but no packets yet (${this.noPacketWarnMs}ms+) — handshake ≠ telemetry`,
        )
      }
    }, Math.min(2000, Math.max(500, this.noPacketWarnMs / 4)))
  }

  private stopNoPacketWatch(): void {
    if (this.noPacketTimer !== null) {
      clearInterval(this.noPacketTimer)
      this.noPacketTimer = null
    }
  }
}
