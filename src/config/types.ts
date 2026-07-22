/**
 * Thin placeholder for a future `/config.json` loader (PLT+BW).
 * No fetch or validation yet — domain modules must not depend on this.
 */
export type AppConfigPlaceholder = {
  telemetryMode: 'mock' | 'replay' | 'live'
  wsUrl: string
  origin: { lat: number; lon: number; altMsl: number }
  outputMode: string
}
