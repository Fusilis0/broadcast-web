import { type CalibrationOffsets, zeroOffsets } from './types.ts'

const store = new Map<string, CalibrationOffsets>()

function clone(offsets: CalibrationOffsets): CalibrationOffsets {
  return { ...offsets }
}

/**
 * Returns a copy of stored offsets, or a fresh zero+FOV default when missing.
 * Does not insert into the map on bare get.
 */
export function getOffsets(deviceId: string): CalibrationOffsets {
  const existing = store.get(deviceId)
  return existing ? clone(existing) : zeroOffsets()
}

/**
 * Merge partial (or full) offsets for a device. Missing fields keep current
 * (or zero+FOV defaults if the device was not stored yet).
 */
export function setOffsets(
  deviceId: string,
  partial: Partial<CalibrationOffsets>,
): CalibrationOffsets {
  const next: CalibrationOffsets = { ...getOffsets(deviceId), ...partial }
  store.set(deviceId, next)
  return clone(next)
}

/** Reset device to zero angles/alt + default FOV (and store that default). */
export function resetOffsets(deviceId: string): CalibrationOffsets {
  const defaults = zeroOffsets()
  store.set(deviceId, defaults)
  return clone(defaults)
}

/** Clear entire map (tests). */
export function clearAllOffsets(): void {
  store.clear()
}
