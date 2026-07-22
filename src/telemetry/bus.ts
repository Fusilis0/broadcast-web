import type {
  BoatTelemetry,
  StreamAnchorMessage,
  TelemetryData,
} from './types.ts'

export type TelemetryEvents = {
  drone: TelemetryData
  boat: BoatTelemetry
  stream_anchor: StreamAnchorMessage
}

export type TelemetryEventName = keyof TelemetryEvents

type Handler<K extends TelemetryEventName> = (payload: TelemetryEvents[K]) => void

/**
 * Tiny typed pub-sub for telemetry ingest.
 * Event names: `drone` | `boat` | `stream_anchor`.
 */
export class TelemetryBus {
  private readonly listeners: {
    [K in TelemetryEventName]: Set<Handler<K>>
  } = {
    drone: new Set(),
    boat: new Set(),
    stream_anchor: new Set(),
  }

  on<K extends TelemetryEventName>(event: K, handler: Handler<K>): () => void {
    this.listeners[event].add(handler)
    return () => {
      this.listeners[event].delete(handler)
    }
  }

  emit<K extends TelemetryEventName>(event: K, payload: TelemetryEvents[K]): void {
    for (const handler of this.listeners[event]) {
      handler(payload)
    }
  }

  clear(): void {
    this.listeners.drone.clear()
    this.listeners.boat.clear()
    this.listeners.stream_anchor.clear()
  }
}

/** Shared default bus used by ingest. */
export const telemetryBus = new TelemetryBus()
