import type { AppConfig } from '../config/types.ts'
import type { ConsoleDeeplink, ConsoleDeeplinkHandle } from './types.ts'

/**
 * Mutate `config` in place with deeplink overrides (URL wins).
 * Call after `loadConfig()`, before origin / ingest boot.
 * Does not validate `token`. Does not persist to disk.
 */
export function applyDeeplinkToBoot(
  config: AppConfig,
  deeplink: ConsoleDeeplink,
): ConsoleDeeplinkHandle {
  if (deeplink.mode !== undefined) {
    config.telemetryMode = deeplink.mode
  }

  if (deeplink.originLat !== undefined) {
    config.origin.lat = deeplink.originLat
  }
  if (deeplink.originLon !== undefined) {
    config.origin.lon = deeplink.originLon
  }
  if (deeplink.originAltMsl !== undefined) {
    config.origin.altMsl = deeplink.originAltMsl
  }

  if (deeplink.outputMode !== undefined) {
    config.outputMode = deeplink.outputMode
  }

  const handle: ConsoleDeeplinkHandle = {}
  if (deeplink.race !== undefined) handle.race = deeplink.race
  if (deeplink.token !== undefined) handle.token = deeplink.token

  if (handle.race !== undefined || handle.token !== undefined) {
    console.info('[console] deeplink handoff', {
      race: handle.race,
      tokenPresent: handle.token !== undefined,
    })
  }

  return handle
}
