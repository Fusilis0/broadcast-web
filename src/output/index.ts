export {
  DEFAULT_CHROMA_KEY,
  PREVIEW_CLEAR_COLOR,
  SUPPORTED_OUTPUT_MODES,
  TRANSPARENT_CLEAR_COLOR,
  type ApplyOutputModeOptions,
  type ClearAppearance,
  type ClearColorTarget,
  type OutputMode,
} from './types.ts'

export {
  applyOutputMode,
  normalizeOutputMode,
  parseChromaKey,
  resolveClearAppearance,
} from './applyOutputMode.ts'

export {
  startOutputModeControl,
  type OutputModeControlHandle,
  type OutputModeControlOptions,
} from './outputModeControl.ts'

export {
  TIMECODE_BIT_COUNT,
  TIMECODE_COLS,
  TIMECODE_ROWS,
  encodeVisualTimecodeBits,
  encodeVisualTimecodeRgba,
  toTimecodeBigInt,
  writeVisualTimecodeRgba,
} from './visualTimecodeEncode.ts'

export {
  startVisualTimecode,
  type TimecodeCorner,
  type VisualTimecodeHandle,
  type VisualTimecodeOptions,
} from './visualTimecodeOverlay.ts'

export {
  formatWhepStatusLabel,
  normalizeWhepUrl,
  resolveUnderlayClearAlpha,
  shouldRunWhepUnderlay,
  type WhepStatus,
} from './whepUnderlayHelpers.ts'

export {
  startWhepUnderlay,
  type WhepUnderlayHandle,
  type WhepUnderlayOptions,
} from './whepUnderlay.ts'

export {
  getStudioBridge,
  type BroadcastStudioBridge,
  type StudioNdiBridge,
  type StudioNdiStatus,
} from './studioBridge.ts'

export {
  startNdiFramePump,
  type NdiFramePumpHandle,
  type NdiFramePumpOptions,
} from './ndiFramePump.ts'

export {
  STUDIO_OUTPUT_FPS,
  STUDIO_OUTPUT_HEIGHT,
  STUDIO_OUTPUT_WIDTH,
} from './studioOutput.ts'
