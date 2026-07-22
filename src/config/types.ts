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
  wsUrl: string
  origin: ConfigOrigin
  /** Drone relative→HAE bridge (Unity `WorldAnchorManager.takeoffAltitudeMSL`). Default 0. */
  takeoffAltitudeMSL: number
  outputMode: string
}

/** @deprecated Prefer `AppConfig`. */
export type AppConfigPlaceholder = AppConfig
