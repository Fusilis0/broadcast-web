/**
 * Console deep-link types (CON).
 * Proposed contract: `docs/contracts/console-deeplink.md`.
 */

export type DeeplinkTelemetryMode = 'mock' | 'replay' | 'live'

export type DeeplinkOutputMode = 'preview' | 'chroma' | 'transparent'

/**
 * Parsed query fields that were present and valid.
 * Absent keys mean “not in URL” — leave config alone.
 */
export type ConsoleDeeplink = {
  race?: string
  /** Opaque auth handoff — never validated in V1. */
  token?: string
  mode?: DeeplinkTelemetryMode
  originLat?: number
  originLon?: number
  originAltMsl?: number
  outputMode?: DeeplinkOutputMode
}

/** Read-only handoff fields for boot / logging (no auth). */
export type ConsoleDeeplinkHandle = {
  race?: string
  token?: string
}
