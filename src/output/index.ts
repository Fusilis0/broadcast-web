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
