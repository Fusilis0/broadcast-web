export {

  DEFAULT_CHROMA_KEY,

  PREVIEW_CLEAR_COLOR,

  SUPPORTED_AR_BACKGROUNDS,

  SUPPORTED_OUTPUT_MODES,

  TRANSPARENT_CLEAR_COLOR,

  type ApplyOutputModeOptions,

  type ArBackgroundMode,

  type ClearAppearance,

  type ClearColorTarget,

  type OutputMode,

} from './types.ts'



export {

  applyOutputMode,

  normalizeArBackground,

  normalizeOutputMode,

  parseChromaKey,

  resolveClearAppearance,

} from './applyOutputMode.ts'



export {

  startArBackgroundControl,

  startOutputModeControl,

  type ArBackgroundControlHandle,

  type ArBackgroundControlOptions,

  type OutputModeControlHandle,

  type OutputModeControlOptions,

} from './outputModeControl.ts'



export {

  DEFAULT_LOCAL_CHANNEL_FOCUS,

  LOCAL_CHANNEL_FOCI,

  LOCAL_CHANNEL_LABELS,

  isLocalChannelFocus,

  localFocusNdiInvariant,

  normalizeLocalChannelFocus,

  resolveLocalFocusPresentation,

  resolveScreenClearAppearance,

  startLocalChannelSwitcher,

  type LocalChannelFocus,

  type LocalChannelSwitcherHandle,

  type LocalChannelSwitcherOptions,

  type LocalFocusNdiInvariant,

  type LocalFocusPresentation,

} from './localChannelSwitcher.ts'



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

  DEFAULT_NDI_CHANNEL,

  NDI_CHANNEL_IDS,

  type BroadcastStudioBridge,

  type NdiChannelId,

  type StudioNdiBridge,

  type StudioNdiFrame,

  type StudioNdiStatus,

  type StudioNdiStatusAll,

  type NdiMainPerfSummary,

  type NdiMainPerfChannel,

} from './studioBridge.ts'



export {

  startDualFrameClock,

  type ClockUnsubscribe,

  type DualFrameClock,

  type DualFrameClockOptions,

  type PreviewHitchCounts,

  type SubscribeClock,

} from './previewFrameClock.ts'



export {

  PERF_WINDOW_MS,

  HITCH_DT_MS_33,

  HITCH_DT_MS_50,

  createSendFpsCounter,

  createStageAccumulator,

  createIntHistogram,

  formatIntHistogram,

  tickIntervalBucketMs,

  formatGpuHudLabel,

  formatNdiSendFps,

  readWebGlGpuInfo,

  shortenUnmaskedRenderer,

  type SendFpsCounter,

  type StageStats,

  type IntHistogram,

  type WebGlGpuInfo,

} from './perfCounters.ts'



export {

  beginStudioTickTiming,

  formatNdiStageDump,

  formatNdiStageHud,

  getNdiStageSnapshot,

  recordNdiStage,

  timeNdiStage,

  noteNdiSkip,

  recordNdiCapture,

  applyNdiMainPerfSummary,

  markNdiSyncReadback,

  markNdiSync2dCapture,

  resetNdiStageTiming,

  NDI_STAGE_NAMES,

  type NdiStageName,

  type NdiStageSnapshot,

  type NdiSkipCause,

} from './ndiStageTiming.ts'



export {

  startNdiFramePump,

  NDI_AR_DEFAULT_FPS,

  type ArAirPlateClear,

  type NdiFramePumpHandle,

  type NdiFramePumpOptions,

} from './ndiFramePump.ts'



export {

  startNdi3dChannelPump,

  NDI_3D_DEFAULT_FPS,

  type Ndi3dChannelPumpOptions,

} from './ndi3dChannelPump.ts'



export {

  createNdiCaptureGate,

  ndiCaptureGateFps,

  NDI_CAPTURE_NOMINAL_FPS,

  NDI_CAPTURE_GATE_TOLERANCE_MS,

  NDI_STUDIO_TICK_HZ,

  type NdiCaptureGate,

} from './ndiCaptureClock.ts'



export {

  createNdiDeferredSend,

  deferNdiSendOffTick,

  takeNdiArrayBuffer,

  type NdiDeferredSend,

  type NdiDeferredFrame,

} from './ndiDeferredSend.ts'



export {

  createNdiAsyncReadback,

  probeNdiPboReadback,

  NDI_ASYNC_READBACK_LATENCY_FRAMES,

  NDI_PIXEL_RING_CAPACITY,

  NDI_SYNC_READBACK_NOTE,

  type NdiAsyncReadback,

  type NdiReadbackMode,

  type NdiReadbackPixels,

} from './ndiAsyncReadback.ts'



export {

  createNdi2dAsyncCapture,

  deferOffStudioTick,

  probeNdi2dWorkerCapture,

  NDI_2D_SYNC_CAPTURE_NOTE,

  NDI_2D_LETTERBOX_FILL,

  type Ndi2dAsyncCapture,

  type Ndi2dCaptureMode,

} from './ndi2dAsyncCapture.ts'



export {

  tryClaimNdiHeavyCapture,

  releaseNdiHeavyCapture,

  resetNdiHeavyCaptureStagger,

  NDI_HEAVY_STAGGER_MS,

  type NdiHeavyCaptureChannel,

  type NdiHeavyCaptureClaimOptions,

} from './ndiCaptureStagger.ts'



export {

  applyNdiCaptureColorSpace,

} from './ndiCaptureColorSpace.ts'



export {

  createNdiCaptureFlip,

  createNdiFlipTarget,

  ndiCaptureFlipBlitRect,

  probeNdiCaptureFlipBlit,

  NDI_CAPTURE_FLIPPED_BOTTOM_UP,

} from './ndiCaptureFlip.ts'

export { flipRgbaRowsInPlace, flipOwnedRgbaFrame } from './ndiFlipRows.ts'

export {
  createNdiPackPool,
  evenPackWidth,
  packedFrameBytes,
  rgbaToUyva,
  rgbaToUyvy,
  type NdiPackPool,
  type NdiPackedFormat,
} from './ndiUyvy.ts'

export {
  createNdiGpuUyvyPack,
  ndiGpuUyvySize,
  type NdiGpuUyvyPack,
} from './ndiGpuUyvy.ts'

export { createNdiUyvyWorker, type NdiUyvyWorkerHandle } from './ndiUyvyBridge.ts'



export {

  NDI_3D_OPAQUE_CLEAR_COLOR,

  applyOpaque3dPassState,

  isOpaque3dPassActive,

  restoreClearPass,

  snapshotClearPass,

  withOpaque3dPass,

  type ClearPassReader,

  type ClearPassSnapshot,

  type ClearPassWriter,

} from './ndiOpaquePass.ts'



export {

  letterboxRect,

  startStreamMapNdiPump,

  STREAM_MAP_NDI_CHANNEL,

  STREAM_MAP_NDI_DEFAULT_NAME,

  STREAM_MAP_NDI_DEFAULT_FPS,

  type LetterboxRect,

  type StreamMapNdiPumpHandle,

  type StreamMapNdiPumpOptions,

} from './streamMapNdiPump.ts'



export {

  resolveNdiAirIndicator,

  resolveNdiChannelIndicator,

  startNdiControllerPanel,

  STREAM_MAP_NDI_BRIDGE_SUPPORTED,

  type NdiAirIndicator,

  type NdiChannelIndicator,

  type NdiControllerPanelHandle,

  type NdiControllerPanelOptions,

  type NdiStatusPumpHandle,

  type ResolveNdiAirIndicatorInput,

  type ResolveNdiChannelIndicatorInput,

} from './ndiControllerPanel.ts'



export {

  isAirCameraLocked,

  planNdiCapture,

  shouldForceFollowActivePov,

  type AirCameraLockInput,

  type NdiCapturePlan,

} from './airCameraLock.ts'



export {

  STUDIO_OUTPUT_FPS,

  STUDIO_OUTPUT_HEIGHT,

  STUDIO_OUTPUT_WIDTH,

} from './studioOutput.ts'



export {

  clampNdiDelayMs,

  DEFAULT_OUTPUT_DELAY_MS,

  estimateNdiDelayBufferBytes,

  isNdiDelayHighMemory,

  NDI_DELAY_MS_DEFAULT,

  NDI_DELAY_MS_MAX,

  NDI_DELAY_MS_MIN,

  NDI_DELAY_WARN_MS,

  NdiDelayBuffer,

  normalizeOutputDelayMs,

  type NdiDelayedFrame,

  type OutputDelayMsConfig,

} from './ndiDelayBuffer.ts'



export {

  getSrtBridge,

  idleSrtStatus,

  mergeSrtUrlOptions,

  normalizeSrtStatus,

  serializeSrtHref,

  validatePovId,

  validateSrtUrl,

  SRT_STATES,

  type SrtBridge,

  type SrtCloseRequest,

  type SrtDataPayload,

  type SrtOpenRequest,

  type SrtOpenResult,

  type SrtState,

  type SrtStatus,

} from './srtBridge.ts'



export {

  bumpSrtConnect,

  bumpSrtDisconnect,

  createSrtDisconnectHold,

  srtCheckboxOpenAllowed,

  srtReopenAllowed,

  type SrtDisconnectHold,

} from './srtDisconnect.ts'



export {

  createVideoBackgroundTestPattern,

  normalizeTextureFit,

  opaque3dPassBlocksBackground,

  resolveTextureFit,

  resolveTextureSourceSize,

  shouldDrawVideoBackground,

  startVideoBackground,

  type TextureFitRect,

  type VideoBackgroundDrawInput,

  type VideoBackgroundFit,

  type VideoBackgroundHandle,

  type VideoBackgroundOptions,

} from './videoBackground.ts'



export {

  SRT_WARM_POV_CAP,

  buildSrtCallerUrl,

  compactSrtByPovId,

  formatSrtSituation,
  pickSrtRowError,
  srtDecodeStallHint,
  SRT_DECODE_STALL_MS,
  SRT_TRANSCODE_STALL_MS,
  SRT_LIVE_BITRATE_FLOOR_KBPS,

  parseSrtByPovId,

  promotePublishPathToStreamId,

  redactSrtTemplateForPack,

  redactSrtUrl,

  redactStreamIdParam,

  shouldUseSrtCatalog,

  type SrtCallerUrlErr,

  type SrtCallerUrlOk,

  type SrtCallerUrlResult,

  type SrtSituationRow,

} from './srtCallerUrl.ts'



export {

  SRT_RELAY_HOST,

  SRT_RELAY_PORT,

  SRT_STREAM_CATALOG,

  normalizeSrtCatalogId,

  resolveSrtUrlForId,

} from './srtStreamCatalog.ts'



export {

  resolveOpaqueClearSafeForVideo,

  videoForcesEnvironmentOff,

} from './videoEnvironmentGate.ts'



export {

  PRESENTATION_LATENCY_MAX_MS,

  PRESENTATION_LATENCY_MIN_MS,

  buildSyncDebugSnapshot,

  clampAdaptiveLatencyMs,

  emptyPtsNtpHealth,

  formatHealthLine,

  isFreeRun,

  startSyncDebugPanel,

  syncDebugBadges,

  type LatencyClampPin,

  type SyncDebugBoatRow,

  type SyncDebugDecoderCounters,

  type SyncDebugPanelHandle,

  type SyncDebugPanelOptions,

  type SyncDebugStreamSnapshot,

} from './syncDebugPanel.ts'



export {

  createPtsUnwrapper,

  createTsDemuxer,

  pts90kToTimestampUs,

  resolveCodecString,

  type DemuxedAccessUnit,

  type TsDemuxer,

  type VideoCodec,

} from './tsDemux.ts'



export {

  DEFAULT_QUEUE_CAP,

  HEVC_UNSUPPORTED_MESSAGE,

  HEVC_FFMPEG_H264_NOTE,

  isHevcUnsupportedMessage,

  MAX_PRESENT_LATENCY_MS,

  MIN_PRESENT_LATENCY_MS,

  PTS_TIMESTAMP_MATCH_US,

  createNativeDecoderFactory,

  createVideoDecodePipeline,

  lookupPts90k,

  pickPresentationPts,

  type DecodeCounters,

  type PresentResult,

  type PresentationMode,

  type PresentationPick,

  type VideoDecodePipeline,

  type VideoDecoderFactory,

  type VideoFrameLike,

} from './videoDecodePipeline.ts'



export {

  WARM_STREAM_CAP,

  createVideoStreamTexture,

  startVideoStreamManager,

  uploadVideoFrameToTexture,

  type VideoStreamCounters,

  type VideoStreamManager,

  type VideoStreamManagerOptions,

} from './videoStreamManager.ts'


