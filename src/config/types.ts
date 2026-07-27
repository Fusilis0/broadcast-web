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
  /** Static course JSON for SCN (boundary/gates/buoys). Empty → demo Istanbul fixture. */
  courseUrl: string
  /** Static sponsor billboards JSON for SCN. Empty → demo Istanbul fixture. */
  sponsorsUrl: string
  /** Drone / primary live WebSocket URL. Empty → no drone socket in live mode. */
  wsUrl: string
  /** Boat live WebSocket URL. Empty → drone-only live (still OK). Single socket only — multi-URL is a follow-up. */
  wsBoatUrl: string
  /**
   * Boat channel ids for mock (and SCN fleet registry). Arch band `21–52`.
   * Default `["21","22","23","24"]`. Pilots `81–84` are not included.
   */
  boatIds: string[]
  /**
   * POV / drone+cam channel ids for mock multi-emit (SCN camera switch).
   * Arch bands `1–4` (drones) ∪ `11–12` (cams). Default `["1","2"]`.
   * Wire remains `channel: "drone"` + `TelemetryData.id` ∈ this list.
   */
  povIds: string[]
  origin: ConfigOrigin
  /** Drone relative→HAE bridge (Unity `WorldAnchorManager.takeoffAltitudeMSL`). Default 0. */
  takeoffAltitudeMSL: number
  outputMode: string
}

/** @deprecated Prefer `AppConfig`. */
export type AppConfigPlaceholder = AppConfig
