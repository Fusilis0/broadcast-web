export {
  DEFAULT_CHROMA_KEY,
  PREVIEW_CLEAR_COLOR,
  SUPPORTED_OUTPUT_MODES,
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
