import { applyRaceProjectCalibration } from '../calibration/projectCalibration.ts'
import type { AppConfig } from '../config/types.ts'
import type { RaceProject } from './types.ts'

/**
 * Merge a loaded RaceProject into `AppConfig` in place.
 * Call after `loadConfig()`, before deeplink overrides (URL still wins).
 * Soft-hydrates CAL `offsetsStore` when `calibration` is present.
 * Does not persist to disk.
 */
export function applyRaceProjectToConfig(
  config: AppConfig,
  project: RaceProject,
): void {
  config.origin = { ...project.origin }
  config.boatIds = [...project.fleet.boatIds]
  config.povIds = [...project.povIds]

  if (project.takeoffAltitudeMSL !== undefined) {
    config.takeoffAltitudeMSL = project.takeoffAltitudeMSL
  }
  if (project.fleet.boatNamesUrl !== undefined) {
    config.boatNamesUrl = project.fleet.boatNamesUrl
  }
  if (project.replayUrl !== undefined) {
    config.replayUrl = project.replayUrl
  }
  if (project.courseUrl !== undefined) {
    config.courseUrl = project.courseUrl
  }
  if (project.sponsorsUrl !== undefined) {
    config.sponsorsUrl = project.sponsorsUrl
  }
  if (project.flagsUrl !== undefined) {
    config.flagsUrl = project.flagsUrl
  }

  applyRaceProjectCalibration(project)

  const out = project.output
  if (!out) return
  if (out.outputMode !== undefined && out.outputMode !== '') {
    config.outputMode = out.outputMode
  }
  if (out.whepUrl !== undefined) config.whepUrl = out.whepUrl
  if (out.chromaKey !== undefined) config.chromaKey = out.chromaKey
  if (out.timecodeEnabled !== undefined) {
    config.timecodeEnabled = out.timecodeEnabled
  }
  if (out.timecodeCorner !== undefined && out.timecodeCorner !== '') {
    config.timecodeCorner = out.timecodeCorner
  }
  if (out.timecodeSizePx !== undefined) {
    config.timecodeSizePx = out.timecodeSizePx
  }
}
