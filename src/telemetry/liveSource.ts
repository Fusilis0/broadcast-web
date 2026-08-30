import type { MockChannel, MockPacket } from './mockSource.ts'

export type LiveWsStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'retrying'

/** Per-id live socket snapshot (handshake vs data). */
export type LiveIdSocketStatus = {
  id: string
  url: string
  status: LiveWsStatus
  /** Wall-clock `Date.now()` of last text frame; null if none yet. */
  lastPacketAtMs: number | null
  /** Age in ms at snapshot time; null if no packets. */
  lastPacketAgeMs: number | null
  /**
   * Remaining backoff until the next reconnect attempt; set only while
   * `status === 'retrying'`.
   */
  retryInMs?: number | null
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

export type LiveStopOptions = {
  /**
   * Keep per-id slots as `closed` so the HUD can show "disconnected"
   * instead of idle-empty. Default false (teardown / restart).
   */
  retainSlots?: boolean
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
  /** Wall-clock when the scheduled reconnect fires; null if none. */
  retryAtMs: number | null
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
  if (statuses.some((s) => s === 'retrying')) return 'retrying'
  if (statuses.every((s) => s === 'closed')) return 'closed'
  return 'idle'
}

/** Best-effort id from `?subscribe=` / `?id=` (or `#id` fallback). */
export function idFromLiveWsUrl(url: string): string {
  try {
    const u = new URL(url)
    const subscribe = u.searchParams.get('subscribe')
    if (subscribe !== null && subscribe.trim() !== '') return subscribe.trim()
    const id = u.searchParams.get('id')
    if (id !== null && id.trim() !== '') return id.trim()
  } catch {
    const m = /[?&](?:subscribe|id)=([^&]*)/.exec(url)
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
  private readonly onPacket?: (packet: MockPacket) => void
  private readonly onStatus?: (channel: MockChannel, status: LiveWsStatus) => void
  private readonly WebSocketImpl: typeof WebSocket
  private readonly initialBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly noPacketWarnMs: number

  private running = false
  private intentionalStop = false
  /**
   * Bumped on every `start()` / `stop()`. Socket handlers capture the
   * generation at `connect()` so a late `onclose` / `onmessage` from a
   * previous socket cannot touch the current source.
   */
  private generation = 0
  private droneUrls: string[]
  private boatUrls: string[]
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
    this.generation += 1
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

  /**
   * Close every socket, cancel backoff, and refuse further connects until
   * `start()`. Generation is bumped first so in-flight / late handlers die.
   */
  stop(options?: LiveStopOptions): void {
    const retain = options?.retainSlots === true
    this.generation += 1
    this.intentionalStop = true
    if (!this.running) {
      if (!retain) this.sockets.length = 0
      return
    }
    this.running = false
    this.stopNoPacketWatch()
    for (const s of this.sockets) {
      this.clearReconnect(s)
      this.closeSocket(s)
      s.retryAtMs = null
      this.setStatus(s, 'closed')
    }
    if (!retain) this.sockets.length = 0
  }

  /**
   * Add/remove sockets to match `droneUrls` / `boatUrls`.
   * Removed ids are closed immediately (other sockets stay).
   * Added ids open only while running (not after an explicit Disconnect).
   */
  syncUrls(droneUrls: readonly string[], boatUrls: readonly string[]): void {
    this.droneUrls = resolveUrlList(droneUrls, undefined)
    this.boatUrls = resolveUrlList(boatUrls, undefined)
    const wantedDrone = new Set(this.droneUrls)
    const wantedBoat = new Set(this.boatUrls)

    for (let i = this.sockets.length - 1; i >= 0; i--) {
      const slot = this.sockets[i]!
      const wanted = slot.channel === 'drone' ? wantedDrone : wantedBoat
      if (wanted.has(slot.url)) continue
      this.clearReconnect(slot)
      this.closeSocket(slot)
      slot.retryAtMs = null
      this.sockets.splice(i, 1)
    }

    this.emitChannelStatus('drone')
    this.emitChannelStatus('boat')

    if (!this.running || this.intentionalStop) return

    for (const url of this.droneUrls) {
      if (!this.sockets.some((s) => s.channel === 'drone' && s.url === url)) {
        this.openChannel('drone', url)
      }
    }
    for (const url of this.boatUrls) {
      if (!this.sockets.some((s) => s.channel === 'boat' && s.url === url)) {
        this.openChannel('boat', url)
      }
    }
  }

  private toIdStatus(slot: ChannelSocket, now: number): LiveIdSocketStatus {
    return {
      id: slot.id,
      url: slot.url,
      status: slot.status,
      lastPacketAtMs: slot.lastPacketAtMs,
      lastPacketAgeMs:
        slot.lastPacketAtMs === null ? null : now - slot.lastPacketAtMs,
      retryInMs:
        slot.status === 'retrying' && slot.retryAtMs !== null
          ? Math.max(0, slot.retryAtMs - now)
          : null,
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
      retryAtMs: null,
    }
    this.sockets.push(slot)
    this.connect(slot)
  }

  private connect(slot: ChannelSocket): void {
    if (!this.running || this.intentionalStop) return

    this.clearReconnect(slot)
    this.closeSocket(slot)
    slot.retryAtMs = null
    this.setStatus(slot, 'connecting')

    const gen = this.generation
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
      if (gen !== this.generation || slot.ws !== ws) return
      slot.backoffMs = this.initialBackoffMs
      slot.openAtMs = Date.now()
      slot.noPacketWarned = false
      slot.retryAtMs = null
      this.setStatus(slot, 'open')
      console.info(
        `[telemetry] live: ${slot.channel}${slot.id ? ` id=${slot.id}` : ''} open (${slot.url})`,
      )
    }

    ws.onmessage = (event: MessageEvent) => {
      if (gen !== this.generation || slot.ws !== ws) return
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
      if (gen !== this.generation || slot.ws !== ws) return
      console.warn(`[telemetry] live: ${slot.channel} WebSocket error`)
    }

    ws.onclose = () => {
      if (gen !== this.generation) return
      if (slot.ws !== ws && slot.ws !== null) return
      slot.ws = null
      slot.openAtMs = null
      if (!this.running || this.intentionalStop) {
        slot.retryAtMs = null
        this.setStatus(slot, 'closed')
        return
      }
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
    slot.retryAtMs = Date.now() + delay
    this.setStatus(slot, 'retrying')
    slot.reconnectTimer = setTimeout(() => {
      slot.reconnectTimer = null
      slot.retryAtMs = null
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
    this.emitChannelStatus(slot.channel)
  }

  private emitChannelStatus(channel: MockChannel): void {
    this.onStatus?.(
      channel,
      aggregateStatus(
        this.sockets.filter((s) => s.channel === channel).map((s) => s.status),
      ),
    )
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
