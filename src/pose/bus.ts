import type { PoseEvent, PoseEvents } from './types.ts'

export type PoseEventName = keyof PoseEvents

type Handler<K extends PoseEventName> = (payload: PoseEvents[K]) => void

/**
 * Typed pub-sub for smoothed ENU poses.
 * Event: `pose` — SCN should subscribe here (not raw telemetryBus for positions).
 */
export class PoseBus {
  private readonly listeners: {
    [K in PoseEventName]: Set<Handler<K>>
  } = {
    pose: new Set(),
  }

  on<K extends PoseEventName>(event: K, handler: Handler<K>): () => void {
    this.listeners[event].add(handler)
    return () => {
      this.listeners[event].delete(handler)
    }
  }

  emit<K extends PoseEventName>(event: K, payload: PoseEvents[K]): void {
    for (const handler of this.listeners[event]) {
      handler(payload)
    }
  }

  clear(): void {
    this.listeners.pose.clear()
  }
}

/** Shared default bus used by the pose pipeline. */
export const poseBus = new PoseBus()

// Re-export for consumers that only import the bus module.
export type { PoseEvent }
