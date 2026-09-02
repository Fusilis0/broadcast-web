/**
 * DIAG:srt-fps — peek AR/3D/2D send fps from the same counters the HUD reads
 * (`pump.getSendFps` / `createSendFpsCounter`). Revert after diagnosis.
 */

import type { NdiChannelId } from './studioBridge.ts'

type FpsFn = () => number

const getters: Record<NdiChannelId, FpsFn | null> = {
  ar: null,
  '3d': null,
  '2d': null,
}

export function diagRegisterNdiSendFps(
  channel: NdiChannelId,
  getFps: FpsFn,
): () => void {
  getters[channel] = getFps
  return () => {
    if (getters[channel] === getFps) getters[channel] = null
  }
}

export function diagPeekNdiSendFps(): Record<NdiChannelId, number | null> {
  return {
    ar: getters.ar ? getters.ar() : null,
    '3d': getters['3d'] ? getters['3d']() : null,
    '2d': getters['2d'] ? getters['2d']() : null,
  }
}
