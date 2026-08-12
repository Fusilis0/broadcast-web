/**
 * Which camera drives ops billboard distance-scale for a render pass.
 * Sprites auto-face the WebGL camera; scale must match that same camera
 * when preview (free/follow) ≠ air (active POV / NDI).
 */
export type BillboardRenderPass = 'preview' | 'air'

/**
 * Pure helper: preview pass → preview cam; air/NDI pass → active POV cam.
 */
export function resolveBillboardCamera<T>(
  pass: BillboardRenderPass,
  cameras: { preview: T; air: T },
): T {
  return pass === 'air' ? cameras.air : cameras.preview
}
