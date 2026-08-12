import { PREVIEW_CLEAR_COLOR } from './types.ts'

/**
 * Snapshot of WebGL clear + SCN opaque-clear gate around a 3D NDI pass.
 * Restore after the opaque FBO so AR / screen clears stay correct.
 */
export type ClearPassSnapshot = {
  color: number
  alpha: number
  opaqueClearSafe: boolean
}

/** Opaque clear used for the 3D NDI channel (preview-dark; sea/sky fills when realistic). */
export const NDI_3D_OPAQUE_CLEAR_COLOR = PREVIEW_CLEAR_COLOR

export type ClearPassReader = {
  getClearColorHex: () => number
  getClearAlpha: () => number
  getOpaqueClearSafe: () => boolean
}

export type ClearPassWriter = {
  setClearColor: (color: number, alpha: number) => void
  setOpaqueClearSafe: (safe: boolean) => void
}

/** Capture current clear + opaque-safe gate (pure over injected getters). */
export function snapshotClearPass(reader: ClearPassReader): ClearPassSnapshot {
  return {
    color: reader.getClearColorHex(),
    alpha: reader.getClearAlpha(),
    opaqueClearSafe: reader.getOpaqueClearSafe() === true,
  }
}

/**
 * Apply opaque-clear state for a 3D NDI FBO pass.
 * Always forces `opaqueClearSafe: true` so realistic sea/sky may mount.
 */
export function applyOpaque3dPassState(
  writer: ClearPassWriter,
  clearColor: number = NDI_3D_OPAQUE_CLEAR_COLOR,
): void {
  writer.setClearColor(clearColor, 1)
  writer.setOpaqueClearSafe(true)
}

/** Restore clear + opaque-safe gate after a 3D pass. */
export function restoreClearPass(
  writer: ClearPassWriter,
  snapshot: ClearPassSnapshot,
): void {
  writer.setClearColor(snapshot.color, snapshot.alpha)
  writer.setOpaqueClearSafe(snapshot.opaqueClearSafe)
}

/**
 * Run `fn` under opaque 3D clear state, then restore — even if `fn` throws.
 * Returns the snapshot that was restored.
 */
export function withOpaque3dPass<T>(
  reader: ClearPassReader,
  writer: ClearPassWriter,
  fn: () => T,
  clearColor: number = NDI_3D_OPAQUE_CLEAR_COLOR,
): { snapshot: ClearPassSnapshot; result: T } {
  const snapshot = snapshotClearPass(reader)
  applyOpaque3dPassState(writer, clearColor)
  try {
    const result = fn()
    return { snapshot, result }
  } finally {
    restoreClearPass(writer, snapshot)
  }
}
