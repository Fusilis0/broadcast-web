/**
 * Thin config types for `/config.json` (PLT+BW).
 * Domain modules may read via `loadConfig()` — keep this file free of domain logic.
 */

export type ConfigOrigin = {
  lat: number
  lon: number
  altMsl: number
}

export type AppConfig = {
  telemetryMode: 'mock' | 'replay' | 'live'
  /** Fixture URL for `telemetryMode: "replay"`. Empty → sample spine-demo path. */
  replayUrl: string
  /** Drone / primary live WebSocket URL. Empty → no drone socket in live mode. */
  wsUrl: string
  /** Boat live WebSocket URL. Empty → drone-only live (still OK). */
  wsBoatUrl: string
  origin: ConfigOrigin
  /** Drone relative→HAE bridge (Unity `WorldAnchorManager.takeoffAltitudeMSL`). Default 0. */
  takeoffAltitudeMSL: number
  outputMode: string
}

/** @deprecated Prefer `AppConfig`. */
export type AppConfigPlaceholder = AppConfig
