import './style.css'
import { startLibraryPanel } from './assets/library/index.ts'
import type { LibraryPanelHandle } from './assets/library/index.ts'
import {
  snapshotCalibrationByPovId,
  startOffsetSliders,
  getOffsets,
  type OffsetSlidersHandle,
} from './calibration/index.ts'
import { loadConfig } from './config/index.ts'
import type { AppConfig } from './config/types.ts'
import {
  applyDeeplinkToBoot,
  parseConsoleDeeplink,
} from './console/index.ts'
import {
  applyConfigOrigin,
  ensureEgm96Loaded,
  enuToGpsAmsl,
  gpsToEnuAmsl,
  northFromSceneZ,
  type ConfigOrigin,
} from './geodesy/index.ts'
import {
  applyRaceProjectToConfig,
  buildRaceProject,
  buildVenuePack,
  canWriteProjectsApi,
  confirmSaveWithOrphanBoatIds,
  defaultEditedRaceId,
  downloadRaceProject,
  downloadVenuePack,
  getDefaultVenuePackCache,
  formatPersistStatus,
  getRacesBridge,
  isSafeRaceId,
  listLocalRaceIds,
  loadRaceProject,
  materializeVenuePack,
  parseVenuePack,
  persistRaceProjectLocal,
  projectsApiBearerToken,
  resolveBootPanelBoats,
  resolveLoadedFleetBoats,
  resolveProjectsRole,
  retainMaterializedVenuePack,
  snapshotFleetBoats,
  startProjectManagerPanel,
  writeRaceProject,
  WriteRaceProjectError,
  type RaceProject,
  type RaceProjectOutputDefaults,
} from './projects/index.ts'
import type { ProjectManagerPanelHandle } from './projects/index.ts'
import { promptModal } from './ui/promptModal.ts'
import {
  applyOutputMode,
  getStudioBridge,
  getSrtBridge,
  bumpSrtConnect,
  bumpSrtDisconnect,
  createSrtDisconnectHold,
  srtCheckboxOpenAllowed,
  srtReopenAllowed,
  normalizeOutputMode,
  resolveClearAppearance,
  resolveLocalFocusPresentation,
  resolveOpaqueClearSafeForVideo,
  resolveScreenClearAppearance,
  startArBackgroundControl,
  startDualFrameClock,
  startLocalChannelSwitcher,
  startNdiControllerPanel,
  startNdi3dChannelPump,
  startNdiFramePump,
  startOutputModeControl,
  startStreamMapNdiPump,
  startSyncDebugPanel,
  startVideoBackground,
  startVideoStreamManager,
  createLegacyTexSubImageVideoStreamTexture,
  startVisualTimecode,
  startWhepUnderlay,
  readWebGlGpuInfo,
  STUDIO_OUTPUT_HEIGHT,
  STUDIO_OUTPUT_WIDTH,
  SRT_WARM_POV_CAP,
  normalizeOutputDelayMs,
  shouldDrawVideoBackground,
  type DualFrameClock,
  type LocalChannelFocus,
  type LocalChannelSwitcherHandle,
  type NdiControllerPanelHandle,
  type NdiFramePumpHandle,
  type OutputDelayMsConfig,
  type ArBackgroundControlHandle,
  type ArBackgroundMode,
  type OutputMode,
  type OutputModeControlHandle,
  type StreamMapNdiPumpHandle,
  type SyncDebugPanelHandle,
  type TimecodeCorner,
  type VideoBackgroundHandle,
  type VideoStreamManager,
  type VisualTimecodeHandle,
  type WhepUnderlayHandle,
  type SrtStatus,
  createVideoBackgroundTestPattern,
  isOpaque3dPassActive,
  normalizeArBackground,
  buildSyncDebugSnapshot,
  compactSrtByPovId,
  formatSrtSituation,
  HEVC_FFMPEG_H264_NOTE,
  isHevcUnsupportedMessage,
  pickSrtRowError,
  redactSrtTemplateForPack,
  redactSrtUrl,
  SRT_DECODE_STALL_MS,
  SRT_LIVE_BITRATE_FLOOR_KBPS,
  SRT_TRANSCODE_STALL_MS,
} from './output/index.ts'
import {
  diagAutoConnectIsNoop,
  parseDiagAutoConnect,
} from './output/diagAutoConnect.ts'
import { parseNdiUploadProbe } from './output/diagVideoUploadProbe.ts'
import {
  startPosePipeline,
  stopPosePipeline,
  type PosePipelineHandle,
} from './pose/index.ts'
import {
  boatColorsFromCatalogue,
  createSidebar,
  layoutFeatures,
  loadFleetLiveFromSession,
  loadWorldExtrasFeatures,
  parseEnvironmentModeQuery,
  parseSeaQualityQuery,
  resolveAssetFocusEnu,
  setLayoutFeatures,
  startAssetInspector,
  startFleetLivePanel,
  startFlowPanel,
  startMapFeatureEditor,
  startScene,
  startStubHud,
  createWorldAuthoringWorkspace,
  mountWorldMapAuthoringLauncher,
  resolveAuthoringInitiallyOpen,
  STREAM_MAP_SIZE_PX,
  WORLD_AUTHORING_MAP_SIZE,
  createTerrainAttributionOverlay,
  CESIUM_ION_TOKEN_MAX_LEN,
  readSessionCesiumIonToken,
  resolveCesiumIonToken,
  writeSessionCesiumIonToken,
  type AssetInspectorHandle,

  type AssetRowId,
  type BoatVisibilityMode,
  type FleetLivePanelHandle,
  type FlowPanelHandle,
  type MapFeatureEditorHandle,
  type SceneHandle,
  type WorldAuthoringWorkspaceHandle,
  type WorldMapAuthoringLauncherHandle,
  type WorldFeature,
} from './scene/index.ts'
import {
  DEFAULT_LIVE_WS_BASE,
  createTelemetryHistory,
  flowTap,
  getPtsNtpMap,
  startOpenMeteoWind,
  startTelemetryIngest,
  stopOpenMeteoWind,
  stripLiveWsId,
  type IngestHandle,
  type LiveStatusSnapshot,
  type TelemetryHistory,
} from './telemetry/index.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app root missing')
}

let calib: OffsetSlidersHandle | null = null

let scene: SceneHandle | null = null
let ingest: IngestHandle | null = null
let outputControl: OutputModeControlHandle | null = null
let arBackgroundControl: ArBackgroundControlHandle | null = null
let localChannelSwitcher: LocalChannelSwitcherHandle | null = null
/** Local window focus — independent of NDI pumps and of AR `outputMode`. */
let localChannelFocus: LocalChannelFocus = 'ar'
/** Remembered AR clear mode while local focus is 3D/2D. */
let arOutputMode: OutputMode = 'preview'
/** AR plate vs in-WebGL video background (L1). Default alpha = today's plate. */
let arBackgroundMode: ArBackgroundMode = 'alpha'
let videoBackground: VideoBackgroundHandle | null = null
let videoBackgroundTestPattern: ReturnType<
  typeof createVideoBackgroundTestPattern
> | null = null
let videoStreamManager: VideoStreamManager | null = null
let posePipeline: PosePipelineHandle | null = null
/** Shared matched-buffer (TEL-08). Adaptive policy + pose sampleAt. */
let telemetryHistory: TelemetryHistory = createTelemetryHistory()
/** Stream-map PiP visibility before entering local 2D focus. */
let streamMapPipBefore2d = false
/** True while local 2D focus owns stream-map size/visibility. */
let local2dMapActive = false
let visualTimecode: VisualTimecodeHandle | null = null
let whepUnderlay: WhepUnderlayHandle | null = null
let previewClock: DualFrameClock | null = null
let ndiPump: NdiFramePumpHandle | null = null
/** Desired 2D NDI enable (default on); applied when pump boots. */
let streamMapNdiWanted = true
let streamMapNdiPump: StreamMapNdiPumpHandle | null = null
/** Per-channel NDI delay (ms). Default 0 = no ring; optional `config.outputDelayMs`. */
let ndiDelayMs: OutputDelayMsConfig = normalizeOutputDelayMs(undefined)
/** 3D opaque channel (OUT-02) — do not change pump internals here. */
let ndi3dPump: NdiFramePumpHandle | null = null
let ndiController: NdiControllerPanelHandle | null = null
let syncDebugPanel: SyncDebugPanelHandle | null = null
let flowPanel: FlowPanelHandle | null = null
let mapEditor: MapFeatureEditorHandle | null = null
let worldAuthoring: WorldAuthoringWorkspaceHandle | null = null
let worldMapLauncher: WorldMapAuthoringLauncherHandle | null = null
let fleetPanel: FleetLivePanelHandle | null = null
let assetInspector: AssetInspectorHandle | null = null
/** Soft POV map-dot visibility (false = hidden). Missing → true. */
const povMapVisible = new Map<string, boolean>()
/** Soft POV 3D flag (no mesh yet). Missing → true. */
const povVisible3d = new Map<string, boolean>()
let unsubLiveStatus: (() => void) | null = null
let bootConfig: AppConfig | null = null
let raceProject: RaceProject | null = null
let currentWorldFeatures: WorldFeature[] = []
let replayUrl = '/fixtures/telemetry/spine-demo.json'
let courseUrl = '/fixtures/course/demo-istanbul.json'
let sponsorsUrl = '/fixtures/sponsors/demo-istanbul.json'
let flagsUrl = '/fixtures/flags/demo-istanbul-countdown.json'
let boatNamesUrl = '/fixtures/boats/demo-istanbul-names.json'
let boatIds: string[] = ['21', '22', '23', '24']
let povIds: string[] = ['1', '2']
/** Enabled ids for live sockets only (subset of registry; may be empty). */
let liveBoatIds: string[] = []
let livePovIds: string[] = []
/** Explicit Disconnect — `restartIngest('live')` must not reopen sockets. */
let liveExplicitlyDisconnected = false
/** Live WS bases (no id) — Fleet panel / sessionStorage; not written to config.json. */
let wsUrl = DEFAULT_LIVE_WS_BASE
let wsBoatUrl = DEFAULT_LIVE_WS_BASE
let chromaKey = ''
let switching = false
let switchingRace = false
let liveStatusPoll: ReturnType<typeof setInterval> | null = null
const lastSrtOpenByPov = new Map<string, { srtId: string; url: string }>()
const lastSrtOpenAt = new Map<string, number>()
const lastSrtTranscodeAt = new Map<string, number>()
const lastSrtDecodeError = new Map<string, string>()
const srtStatusByPov = new Map<string, SrtStatus>()
const srtTranscodeH264 = new Set<string>()
let srtSituationTimer: ReturnType<typeof setInterval> | null = null
const srtHold = createSrtDisconnectHold()

/** Push catalogue category colours onto 2D map boat dots (hull tint is via scene). */
function syncMapBoatDotColors(): void {
  if (!scene) return
  const colors = boatColorsFromCatalogue(scene.getBoatNamesCatalogue())
  hud.getMap().setBoatDotColors(colors)
  hud.getStreamMap().setBoatDotColors(colors)
}

/** Build soft RaceProject fleet.boatVisibility from Fleet rows (skip pure solid). */
function fleetBoatVisibilityRecord(
  boats:
    | ReadonlyArray<{ id: string; visibility?: BoatVisibilityMode }>
    | undefined,
): Record<string, BoatVisibilityMode> | undefined {
  if (!boats?.length) return undefined
  const out: Record<string, BoatVisibilityMode> = {}
  for (const b of boats) {
    const id = b.id.trim()
    if (id === '') continue
    const mode = b.visibility ?? 'solid'
    if (mode === 'solid') continue
    out[id] = mode
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Soft fleet.boatMapVisible — only persist explicit `false` entries. */
function fleetBoatMapVisibleRecord(
  boats:
    | ReadonlyArray<{ id: string; mapVisible?: boolean }>
    | undefined,
): Record<string, boolean> | undefined {
  if (!boats?.length) return undefined
  const out: Record<string, boolean> = {}
  for (const b of boats) {
    const id = b.id.trim()
    if (id === '' || b.mapVisible !== false) continue
    out[id] = false
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Soft fleet.povMapVisible — only persist explicit `false` entries. */
function fleetPovMapVisibleRecord(
  ids: readonly string[],
): Record<string, boolean> | undefined {
  const out: Record<string, boolean> = {}
  for (const raw of ids) {
    const id = raw.trim()
    if (id === '') continue
    if (povMapVisible.get(id) === false) out[id] = false
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Push hidden boat/POV ids to ops + stream maps. */
function syncMapHiddenPoseIds(): void {
  const hidden: string[] = []
  const boats = fleetPanel?.getState().boats ?? []
  for (const b of boats) {
    if (b.mapVisible === false) hidden.push(b.id)
  }
  for (const [id, visible] of povMapVisible) {
    if (visible === false) hidden.push(id)
  }
  hud.getMap().setHiddenPoseIds(hidden)
  hud.getStreamMap().setHiddenPoseIds(hidden)
}

/** Apply Fleet / pack visibility modes onto live boat entities. */
function syncBoatVisibilityToScene(
  boats: ReadonlyArray<{ id: string; visibility?: BoatVisibilityMode }>,
): void {
  if (!scene) return
  const modes: Record<string, BoatVisibilityMode> = {}
  for (const b of boats) {
    const id = b.id.trim()
    if (id === '') continue
    modes[id] = b.visibility ?? 'solid'
  }
  scene.setBoatVisibilityModes(modes)
}

async function patchWorldFeature(
  id: string,
  patch: Partial<WorldFeature>,
): Promise<void> {
  const src = mapEditor?.getFeatures() ?? currentWorldFeatures
  const next = src.map((f) => {
    if (f.id !== id) {
      return { ...f, points: f.points.map((p) => ({ ...p })) }
    }
    const merged: WorldFeature = {
      ...f,
      ...patch,
      points: (patch.points ?? f.points).map((p) => ({ ...p })),
    }
    return merged
  })
  currentWorldFeatures = cloneWorldFeatures(next)
  mapEditor?.replaceFeatures(currentWorldFeatures, true)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  scene?.refreshCalibrationOverlay()
  assetInspector?.refresh()
}

function focusAssetRow(target: AssetRowId): void {
  if (!scene) return
  const fleet = fleetPanel?.getState()
  const enu = resolveAssetFocusEnu(target, {
    getBoatEnu: (id) => scene?.getBoatEnuPosition(id) ?? null,
    getPovEnu: (id) => scene?.getPovEnuPosition(id) ?? null,
    getBoatPlanned: (id) => {
      const b = fleet?.boats.find((row) => row.id === id)
      if (
        typeof b?.plannedLat === 'number' &&
        typeof b?.plannedLon === 'number'
      ) {
        return { lat: b.plannedLat, lon: b.plannedLon }
      }
      return null
    },
    getPovPlanned: (id) => {
      const p = fleet?.plannedPovs?.find((row) => row.id === id)
      return p ? { lat: p.plannedLat, lon: p.plannedLon } : null
    },
    features: mapEditor?.getFeatures() ?? currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
  })
  if (!enu) {
    console.warn('[assets] Focus: no position for', target)
    return
  }
  scene.frameEnuPoint(enu, 80)
  hud.getMap().focusEnu(enu.x, northFromSceneZ(enu.z), 80)
  hud.setOpsViewMode('free')
  fleetPanel?.setOpsViewMode('free')
}

/** Transparent NDI plate: clear page chrome so only WebGL alpha matters for ops view. */
function applyOutputModeChrome(mode: string): void {
  // Page transparency only when local focus is AR (3D/2D use opaque ops chrome).
  const on = mode === 'transparent' && localChannelFocus === 'ar'
  document.documentElement.classList.toggle('output-transparent', on)
  document.body.classList.toggle('output-transparent', on)
  document.getElementById('app')?.classList.toggle('output-transparent', on)
}

/** CSS hook for local 2D/3D/AR presentation (stream-map size, canvas hide). */
function applyLocalFocusDocumentClass(focus: LocalChannelFocus): void {
  const root = document.documentElement
  const body = document.body
  const appEl = document.getElementById('app')
  for (const id of ['2d', '3d', 'ar'] as const) {
    const cls = `local-focus-${id}`
    root.classList.toggle(cls, id === focus)
    body.classList.toggle(cls, id === focus)
    appEl?.classList.toggle(cls, id === focus)
  }
}

/** Large stream-map canvas for local 2D focus (still letterboxed for 2D NDI). */
function resolveLocal2dMapSizePx(): number {
  const sidebar = 360
  const pad = 48
  const avail = Math.min(
    window.innerWidth - sidebar - pad,
    window.innerHeight - pad,
  )
  return Math.max(520, Math.min(960, Math.floor(avail)))
}

/**
 * Apply local channel focus to screen only — never starts/stops NDI pumps.
 * `outputMode` still governs AR clear when focus is AR (and AR air capture).
 */
function applyLocalChannelFocus(focus: LocalChannelFocus): void {
  localChannelFocus = focus
  applyLocalFocusDocumentClass(focus)

  const presentation = resolveLocalFocusPresentation(focus, arOutputMode, {
    chromaKey: chromaKey || undefined,
  })
  const screenClear = resolveScreenClearAppearance(presentation, arOutputMode, {
    chromaKey: chromaKey || undefined,
  })

  if (scene) {
    scene.renderer.setClearColor(screenClear.color, screenClear.alpha)
    scene.setEnvironmentOpaqueClearSafe(
      resolveOpaqueClearSafeForVideo({
        arBackground: arBackgroundMode,
        localFocus: focus,
        opaqueClearSafe: presentation.opaqueClearSafe,
      }),
    )
  }

  applyOutputModeChrome(arOutputMode)

  // Stream map: enlarge for 2D local view; restore PiP size/visibility otherwise.
  const stream = hud.getStreamMap()
  if (presentation.streamMapPrimary) {
    if (!local2dMapActive) {
      streamMapPipBefore2d = stream.isVisible()
      local2dMapActive = true
    }
    stream.setSizePx(resolveLocal2dMapSizePx())
    hud.setStreamMapVisible(true)
  } else if (local2dMapActive) {
    local2dMapActive = false
    stream.setSizePx(STREAM_MAP_SIZE_PX)
    hud.setStreamMapVisible(streamMapPipBefore2d)
  }

  // WebGL canvas visibility for local 2D (NDI still renders offscreen).
  const canvas = scene?.renderer.domElement
  if (canvas) {
    canvas.classList.toggle('local-channel-webgl--hidden', !presentation.showWebgl)
  }

  syncTerrainAttribution()
}

function clearLiveStatusSub(): void {
  unsubLiveStatus?.()
  unsubLiveStatus = null
  if (liveStatusPoll !== null) {
    clearInterval(liveStatusPoll)
    liveStatusPoll = null
  }
}

function pruneFlowTapToFleet(): void {
  flowTap.retain([...boatIds, ...povIds, ...(bootConfig?.buoyIds ?? [])])
}

function applyFleetToScene(): void {
  if (!scene) return
  pruneFlowTapToFleet()
  const active = scene.setFleetAllowLists({ boatIds, povIds })
  hud.setPovIds(povIds, active)
  hud.setBoatIds(boatIds)
  calib?.setPovIds(povIds, active)
  fleetPanel?.setState({ boatIds, povIds, activePovId: active })
  syncFleetMapPosesToAllowList()
  syncFleetHullsFromPanel()
}

/**
 * Drop ops/stream map icons for boats/drones no longer in the Live fleet.
 * Buoy poses stay. Re-seed planned GPS so map-placed craft remain visible
 * without live telemetry.
 */
function syncFleetMapPosesToAllowList(): void {
  const allow = [...boatIds, ...povIds]
  hud.getMap().retainPoseIds(allow)
  hud.getStreamMap().retainPoseIds(allow)
  const boats = fleetPanel?.getState().boats ?? []
  const plannedPovs = fleetPanel?.getState().plannedPovs ?? []
  seedPlannedFleetOnMap(hud.getMap(), boats, plannedPovs)
  seedPlannedFleetOnMap(hud.getStreamMap(), boats, plannedPovs)
}

async function restartIngest(
  mode?: 'mock' | 'replay' | 'live',
  opts?: { fromLiveApply?: boolean },
): Promise<void> {
  clearLiveStatusSub()
  const nextMode = mode ?? ingest?.mode ?? bootConfig?.telemetryMode ?? 'mock'
  ingest?.stop()
  // Live uses enabled-id lists only; mock/replay keep full registry.
  const useBoatIds = nextMode === 'live' ? liveBoatIds : boatIds
  const usePovIds = nextMode === 'live' ? livePovIds : povIds
  const holdDisconnect =
    liveExplicitlyDisconnected &&
    nextMode === 'live' &&
    opts?.fromLiveApply !== true
  ingest = await startTelemetryIngest({
    mode: nextMode,
    replayUrl,
    boatIds: useBoatIds,
    povIds: usePovIds,
    wsUrl,
    wsBoatUrl,
    liveConnect: !holdDisconnect,
  })
  applyIngestConnectionStatus(ingest)
  hud.setMode(ingest.mode)
}

function cloneWorldFeatures(
  features: readonly WorldFeature[],
): WorldFeature[] {
  return features.map((f) => ({
    ...f,
    points: f.points.map((p) => ({ ...p })),
  }))
}

function gpsToEnu(lat: number, lon: number, alt: number) {
  const v = gpsToEnuAmsl(lat, lon, alt)
  return { x: v.x, y: v.y, z: v.z }
}

/** Keep ops (+ stream) maps able to draw OSM + convert click-to-anchor. */
function syncMapGeoBridge(maps: {
  ops: { setGeoBridge: (b: {
    enuToLatLon: (east: number, north: number) => { lat: number; lon: number }
    latLonToEnu: (lat: number, lon: number) => { east: number; north: number }
  } | null) => void }
  stream: { setGeoBridge: (b: {
    enuToLatLon: (east: number, north: number) => { lat: number; lon: number }
    latLonToEnu: (lat: number, lon: number) => { east: number; north: number }
  } | null) => void }
}): void {
  const bridge = {
    enuToLatLon: (east: number, north: number) => {
      const g = enuToGpsAmsl(east, 0, north)
      return { lat: g.lat, lon: g.lon }
    },
    latLonToEnu: (lat: number, lon: number) => {
      const v = gpsToEnuAmsl(lat, lon, 0)
      return { east: v.x, north: northFromSceneZ(v.z) }
    },
  }
  maps.ops.setGeoBridge(bridge)
  maps.stream.setGeoBridge(bridge)
}

function syncFleetHullsFromPanel(): void {
  if (!scene) return
  const state = fleetPanel?.getState()
  const ids = state?.boatIds ?? boatIds
  const rows = state?.boats ?? []
  const byId = new Map(rows.map((b) => [b.id, b] as const))
  const seeds = ids.map((id) => {
    const row = byId.get(id)
    if (
      typeof row?.plannedLat === 'number' &&
      typeof row?.plannedLon === 'number'
    ) {
      const enu = gpsToEnu(row.plannedLat, row.plannedLon, 0)
      return { id, position: { x: enu.x, y: 0, z: enu.z } }
    }
    return { id }
  })
  scene.syncFleetHulls(seeds)
}

/** Seed 2D map dots for map-placed fleet until live pose arrives. */
function seedPlannedFleetOnMap(
  map: {
    updatePose: (pose: {
      id: string
      kind: 'boat' | 'drone' | 'buoy'
      position: { x: number; y: number; z: number }
      rotation: { yawDeg: number; pitchDeg: number; rollDeg: number }
      fovHDeg: number
      ts: number
    }) => void
  },
  boats: readonly {
    id: string
    plannedLat?: number
    plannedLon?: number
  }[],
  plannedPovs: readonly {
    id: string
    plannedLat: number
    plannedLon: number
  }[] = [],
): void {
  const now = Date.now()
  for (const b of boats) {
    if (
      typeof b.plannedLat !== 'number' ||
      typeof b.plannedLon !== 'number'
    ) {
      continue
    }
    const enu = gpsToEnu(b.plannedLat, b.plannedLon, 0)
    map.updatePose({
      id: b.id,
      kind: 'boat',
      position: { x: enu.x, y: 0, z: enu.z },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: now,
    })
  }
  for (const p of plannedPovs) {
    const enu = gpsToEnu(p.plannedLat, p.plannedLon, 0)
    map.updatePose({
      id: p.id,
      kind: 'drone',
      position: { x: enu.x, y: 10, z: enu.z },
      rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
      fovHDeg: 66.8832,
      ts: now,
    })
  }
}

/** Place-tool seed at click ENU (authoritative; no GPS round-trip drift). */
function seedFleetPoseAtEnu(
  id: string,
  kind: 'boat' | 'drone',
  east: number,
  north: number,
): void {
  const pose = {
    id,
    kind,
    position: { x: east, y: kind === 'drone' ? 10 : 0, z: north },
    rotation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 },
    fovHDeg: 66.8832,
    ts: Date.now(),
  }
  hud.getMap().updatePose(pose)
  hud.getStreamMap().updatePose(pose)
  hud.getMap().redraw()
  hud.getStreamMap().redraw()
}

function syncRaceQuery(id: string): void {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('race', id)
    window.history.replaceState(null, '', url)
  } catch {
    /* ignore */
  }
}

type SaveRaceProjectOptions = {
  /** Explicit id/name (Save as / editor fields). */
  meta?: { id?: string; name?: string }
  /**
   * `save` = overwrite current id (API PUT when configured).
   * `saveAs` = new id (API POST when configured).
   */
  mode?: 'save' | 'saveAs'
}

function syncFleetIntoConfig(config: AppConfig): void {
  config.boatIds = [...boatIds]
  config.povIds = [...povIds]
  config.boatNamesUrl = boatNamesUrl
  config.courseUrl = courseUrl
  config.sponsorsUrl = sponsorsUrl
  config.flagsUrl = flagsUrl
  config.replayUrl = replayUrl
}

async function promptSaveAsMeta(defaults: {
  id: string
  name: string
}): Promise<{ id: string; name: string } | null> {
  // Electron overrides window.prompt to throw — use shared DOM modal.
  const idRaw = await promptModal('Save as — project id', defaults.id)
  if (idRaw === null) return null
  const id = idRaw.trim()
  if (!isSafeRaceId(id)) {
    window.alert(
      'Invalid project id. Use letters, digits, dash, underscore (see RaceProject contract).',
    )
    return null
  }
  const nameRaw = await promptModal(
    'Save as — display name',
    defaults.name || id,
  )
  if (nameRaw === null) return null
  const name = nameRaw.trim() || id
  return { id, name }
}

async function refreshRacePicker(activeId?: string): Promise<void> {
  const config = bootConfig
  if (!config) return
  try {
    const ids = await listLocalRaceIds({
      projectsApiBase: config.projectsApiBase,
    })
    let cached: string[] = []
    try {
      cached = await getDefaultVenuePackCache().listIds()
    } catch {
      /* ignore */
    }
    const merged = [...ids]
    for (const id of cached) {
      if (!merged.includes(id)) merged.push(id)
    }
    hud.setRaceIds(merged, activeId ?? raceProject?.id ?? merged[0])
    void projectManagerPanel?.refresh()
  } catch {
    /* keep existing picker */
  }
}

/** Race-pack `output` defaults. SRT template is redacted (no relay token). */
function raceOutputFromRuntime(config: AppConfig): RaceProjectOutputDefaults {
  const fleet = fleetPanel?.getState()
  const out: RaceProjectOutputDefaults = {
    outputMode: config.outputMode,
    whepUrl: config.whepUrl || undefined,
    chromaKey: config.chromaKey || undefined,
    timecodeEnabled: config.timecodeEnabled,
    timecodeCorner: config.timecodeCorner,
    timecodeSizePx: config.timecodeSizePx,
  }
  const packedTemplate = redactSrtTemplateForPack(fleet?.srtUrlTemplate ?? '')
  if (packedTemplate) out.srtUrlTemplate = packedTemplate
  const byPov = compactSrtByPovId(fleet?.srtByPovId)
  if (byPov) out.srtByPovId = byPov
  return out
}

/** LUT key is SRT id (L9). Fallback `povId` only when the operator has not set one. */
function lutStreamIdForPov(povId: string): string {
  const srtId = fleetPanel?.getState().srtByPovId?.[povId]
  return typeof srtId === 'string' && srtId.trim() ? srtId.trim() : povId
}

function srtIdForTelemId(telemId: string): string | null {
  const srtId = fleetPanel?.getState().srtByPovId?.[telemId]
  return typeof srtId === 'string' && srtId.trim() ? srtId.trim() : null
}

function telemIdForSrtId(srtId: string): string | null {
  const map = fleetPanel?.getState().srtByPovId
  if (!map) return null
  const want = srtId.trim()
  if (!want) return null
  for (const [telem, srt] of Object.entries(map)) {
    if (typeof srt === 'string' && srt.trim() === want) return telem
  }
  return null
}

function srtLiveAnchorMs(povId: string): number {
  return lastSrtTranscodeAt.get(povId) ?? lastSrtOpenAt.get(povId) ?? 0
}

function restoreSrtUnderlayPlaceholder(): void {
  videoStreamManager?.dropPresented()
  if (videoBackgroundTestPattern) {
    videoBackground?.setTexture(videoBackgroundTestPattern)
  }
}

function pushSrtPanelStatus(): void {
  const fleet = fleetPanel?.getState()
  if (!fleet) return
  const povs = fleet.povIds.map((povId) => {
    if (srtHold.explicitlyDisconnected) {
      return { povId, state: 'closed' as const, bitrateKbps: 0 }
    }
    const st = srtStatusByPov.get(povId)
    const opened = lastSrtOpenByPov.has(povId)
    if (st?.state === 'live') {
      return { povId, state: 'live' as const, bitrateKbps: st.bitrateKbps }
    }
    if (st?.state === 'connecting' || (opened && !st)) {
      return {
        povId,
        state: 'connecting' as const,
        bitrateKbps: st?.bitrateKbps ?? 0,
      }
    }
    if (st?.state === 'error') {
      return {
        povId,
        state: 'retrying' as const,
        bitrateKbps: st.bitrateKbps,
      }
    }
    if ((fleet.enabledSrtPovIds ?? []).includes(povId)) {
      return { povId, state: 'idle' as const, bitrateKbps: 0 }
    }
    return { povId, state: 'closed' as const, bitrateKbps: 0 }
  })
  fleetPanel?.setSrtStatus({ povs })
}

function forgetSrtPov(povId: string): void {
  lastSrtOpenByPov.delete(povId)
  lastSrtOpenAt.delete(povId)
  lastSrtTranscodeAt.delete(povId)
  lastSrtDecodeError.delete(povId)
  srtTranscodeH264.delete(povId)
  srtStatusByPov.delete(povId)
  const stillBound = videoStreamManager?.dropPov(povId) ?? false
  if (!stillBound && videoBackgroundTestPattern) {
    videoBackground?.setTexture(videoBackgroundTestPattern)
  }
}

function beginFfmpegH264Fallback(povId: string, note: string): void {
  const gen = srtHold.generation
  if (!srtReopenAllowed(srtHold, gen)) return
  if (srtTranscodeH264.has(povId)) return
  const opened = lastSrtOpenByPov.get(povId)
  const bridge = getSrtBridge()
  if (!opened || !bridge) return
  srtTranscodeH264.add(povId)
  lastSrtTranscodeAt.set(povId, Date.now())
  lastSrtDecodeError.set(povId, note)
  videoStreamManager?.resetForH264Fallback(povId)
  const lutId = lutStreamIdForPov(povId)
  getPtsNtpMap(lutId).reset()
  if (lutId !== povId) getPtsNtpMap(povId).reset()
  publishSrtSituation()
  void bridge
    .open({
      povId,
      url: opened.url,
      transcodeToH264: true,
    })
    .then((result) => {
      if (!srtReopenAllowed(srtHold, gen)) return
      lastSrtDecodeError.set(
        povId,
        result.ok ? HEVC_FFMPEG_H264_NOTE : result.error,
      )
      publishSrtSituation()
      pushSrtPanelStatus()
    })
}

function maybeFallbackSrtDecodeStall(): void {
  pushSrtPanelStatus()
  const gen = srtHold.generation
  if (!srtReopenAllowed(srtHold, gen)) return
  const now = Date.now()
  const fleet = fleetPanel?.getState()
  for (const povId of fleet?.enabledSrtPovIds ?? []) {
    if (srtTranscodeH264.has(povId)) continue
    const openedAt = lastSrtOpenAt.get(povId)
    const st = srtStatusByPov.get(povId)
    if (!openedAt || !st || st.state !== 'live') continue
    if (st.bitrateKbps < SRT_LIVE_BITRATE_FLOOR_KBPS) continue
    if (now - openedAt < SRT_DECODE_STALL_MS) continue
    const ctr = videoStreamManager?.getCounters(povId)
    if ((ctr?.framesDecoded ?? 0) > 0) continue
    if (ctr && ctr.bytesPushed === 0) continue
    beginFfmpegH264Fallback(
      povId,
      'no decoded frame after live SRT — ffmpeg HEVC→H.264 (same as OBS)',
    )
  }
}

function maybeNoteTranscodeStall(): void {
  const now = Date.now()
  const msg =
    'ffmpeg HEVC→H.264 is running but decoded=0 — need ffmpeg with libx264 (gyan full_build), then full Electron quit/restart'
  for (const povId of srtTranscodeH264) {
    const started = lastSrtTranscodeAt.get(povId)
    if (!started || now - started < SRT_TRANSCODE_STALL_MS) continue
    const ctr = videoStreamManager?.getCounters(povId)
    if ((ctr?.framesDecoded ?? 0) > 0) continue
    if (lastSrtDecodeError.get(povId) === msg) continue
    lastSrtDecodeError.set(povId, msg)
    publishSrtSituation()
  }
}

function publishSrtSituation(): void {
  const studio = getSrtBridge() != null
  const fleet = fleetPanel?.getState()
  const enabled = fleet?.enabledSrtPovIds ?? []
  const now = Date.now()
  const rows = []
  for (const povId of enabled) {
    const srtId = (fleet?.srtByPovId?.[povId] ?? '').trim()
    const opened = lastSrtOpenByPov.get(povId)
    const st = srtStatusByPov.get(povId)
    const ctr = videoStreamManager?.getCounters(povId)
    const framesDecoded = ctr?.framesDecoded ?? null
    const hasPicture = (framesDecoded ?? 0) > 0
    const state = !studio
      ? 'no-electron'
      : (st?.state ?? (opened ? 'opening' : 'not-opened'))
    const bitrateKbps = st?.bitrateKbps ?? 0
    const lastError = pickSrtRowError({
      decodeError: ctr?.decodeError ?? null,
      decodeNote: lastSrtDecodeError.get(povId) ?? null,
      srtLastError: st?.lastError ?? null,
      liveLongEnough: now - srtLiveAnchorMs(povId) >= SRT_DECODE_STALL_MS,
      state,
      bitrateKbps,
      framesDecoded,
      accessUnits: ctr ? ctr.accessUnits : null,
      bytesPushed: ctr ? ctr.bytesPushed : null,
      waitingForKeyframe: ctr?.waitingForKeyframe,
    })
    rows.push({
      povId,
      srtId: srtId || opened?.srtId || '—',
      state,
      bitrateKbps,
      lastError,
      redactedUrl: opened ? redactSrtUrl(opened.url) : '—',
      framesDecoded,
      hasPicture,
      codec: ctr?.codec ?? null,
      accessUnits: ctr?.accessUnits ?? null,
      bytesPushed: ctr?.bytesPushed ?? null,
      waitingForKeyframe: ctr?.waitingForKeyframe ?? false,
      transcoding: srtTranscodeH264.has(povId),
    })
  }
  const text = formatSrtSituation({
    studio,
    arBackground: arBackgroundMode,
    hasPicture: rows.some((r) => r.hasPicture),
    rows,
  })
  hud.setSrtSituation(text)
  fleetPanel?.setSrtSituation(text)
}

function startSrtSituationWatch(): void {
  if (srtSituationTimer != null) return
  const bridge = getSrtBridge()
  if (bridge) {
    bridge.onSrtStatus((status) => {
      srtStatusByPov.set(status.povId, status)
      publishSrtSituation()
    })
    void bridge.getStatus().then((all) => {
      for (const [id, st] of Object.entries(all)) srtStatusByPov.set(id, st)
      publishSrtSituation()
    })
  }
  srtSituationTimer = setInterval(() => {
    maybeFallbackSrtDecodeStall()
    maybeNoteTranscodeStall()
    const b = getSrtBridge()
    if (!b) {
      publishSrtSituation()
      return
    }
    void b.getStatus().then((all) => {
      srtStatusByPov.clear()
      for (const [id, st] of Object.entries(all)) srtStatusByPov.set(id, st)
      maybeFallbackSrtDecodeStall()
      maybeNoteTranscodeStall()
      publishSrtSituation()
    })
  }, 500)
  publishSrtSituation()
}

function collectSyncDebugSnapshots() {
  const fleet = fleetPanel?.getState()
  if (!fleet) return []
  const rows = []
  for (const povId of fleet.enabledSrtPovIds ?? []) {
    const srtId = (fleet.srtByPovId?.[povId] ?? '').trim()
    if (!srtId) continue
    const lutStreamId = srtId
    const healthSrt = getPtsNtpMap(lutStreamId).health()
    const healthTelem = getPtsNtpMap(povId).health()
    const health = healthSrt.pacingCount > 0 ? healthSrt : healthTelem
    const ctr = videoStreamManager?.getCounters(povId)
    const presentedPts90k = ctr?.presentedPts90k ?? null
    const mapped =
      presentedPts90k !== null
        ? healthSrt.pacingCount > 0
          ? getPtsNtpMap(lutStreamId).toNtp(presentedPts90k)
          : getPtsNtpMap(povId).toNtp(presentedPts90k)
        : null
    const trim = getOffsets(povId).syncTrimMs
    const resolvedNtpMs =
      mapped?.ntpMs != null ? mapped.ntpMs + trim : (ctr?.presentedNtpMs ?? null)
    const poseDebug = posePipeline?.getSyncPoseDebug(povId)
    rows.push(
      buildSyncDebugSnapshot({
        povId,
        srtId,
        lutStreamId,
        health,
        syncTrimMs: trim,
        presentedPts90k,
        resolvedNtpMs,
        ptsMode: mapped?.mode,
        extrapolatedByMs: mapped?.extrapolatedByMs,
        presentationLatencyMs: ctr?.latencyMs ?? null,
        poseAgeMs: poseDebug?.poseAgeMs,
        poseMode: poseDebug?.poseMode,
        boats: poseDebug?.boats,
        freeRun: poseDebug?.held ? false : poseDebug?.freeRun ? true : undefined,
        tNtpMs: poseDebug?.tNtpMs,
        newestPoseNtpMs: poseDebug?.newestPoseNtpMs,
        poseMinusVideoMs: poseDebug?.poseMinusVideoMs,
        pacingCount: poseDebug?.pacingCount,
        decoder: ctr
          ? {
              framesDecoded: ctr.framesDecoded,
              framesDropped: ctr.framesDropped,
              queueDepth: ctr.queueDepth,
            }
          : undefined,
      }),
    )
  }
  return rows
}

/** Throttled SRT clock JSON for Flow (SCN-10). Tokens already redacted. */
function pushSrtFlowSnapshots(): void {
  const fleet = fleetPanel?.getState()
  if (!fleet) return
  for (const povId of fleet.enabledSrtPovIds ?? []) {
    const srtId = (fleet.srtByPovId?.[povId] ?? '').trim()
    const lutStreamId = lutStreamIdForPov(povId)
    const health = getPtsNtpMap(lutStreamId).health()
    const ctr = videoStreamManager?.getCounters(povId)
    const opened = lastSrtOpenByPov.get(povId)
    flowTap.push({
      kind: 'srt',
      id: povId,
      body: {
        srtId,
        presentedPts90k: ctr?.presentedPts90k ?? null,
        presentedNtpMs: ctr?.presentedNtpMs ?? null,
        framesDecoded: ctr?.framesDecoded ?? null,
        codec: ctr?.codec ?? null,
        accessUnits: ctr?.accessUnits ?? null,
        decodeError: ctr?.decodeError ?? null,
        redactedUrl: opened ? redactSrtUrl(opened.url) : null,
        lutStreamId,
        pacingCount: health.pacingCount,
      },
    })
  }
}

/** Build RaceProject from current editor/config (shared by Save + Pack ↓). */
function buildCurrentRaceProject(meta?: {
  id?: string
  name?: string
  revision?: number
}): RaceProject | null {
  const config = bootConfig
  if (!config) return null
  const fleet = fleetPanel?.getState()
  if (fleet) {
    boatIds = [...fleet.boatIds]
    povIds = [...fleet.povIds]
  }
  syncFleetIntoConfig(config)
  const features = mapEditor?.getFeatures() ?? currentWorldFeatures
  const id =
    meta?.id?.trim() || raceProject?.id || defaultEditedRaceId()
  if (!isSafeRaceId(id)) return null
  const name = meta?.name?.trim() || raceProject?.name || id
  const boatVisibility = fleetBoatVisibilityRecord(fleet?.boats)
  const boatMapVisible = fleetBoatMapVisibleRecord(fleet?.boats)
  const povMapVisibleRecord = fleetPovMapVisibleRecord(povIds)
  const calibration = snapshotCalibrationByPovId(povIds)
  return buildRaceProject({
    id,
    name,
    origin: { ...config.origin },
    boatIds,
    boats: snapshotFleetBoats(boatIds, fleet?.boats),
    povIds,
    features,
    takeoffAltitudeMSL: config.takeoffAltitudeMSL,
    boatNamesUrl: boatNamesUrl || config.boatNamesUrl,
    boatVisibility,
    boatMapVisible,
    povMapVisible: povMapVisibleRecord,
    courseUrl: courseUrl || config.courseUrl,
    sponsorsUrl: sponsorsUrl || config.sponsorsUrl,
    flagsUrl: flagsUrl || config.flagsUrl,
    replayUrl: replayUrl || config.replayUrl,
    calibration,
    revision: meta?.revision,
    output: raceOutputFromRuntime(config),
  })
}

function projectsWriteOpts(apiBase: string) {
  const config = bootConfig
  return {
    projectsApiBase: apiBase,
    bearerToken: config ? projectsApiBearerToken(config) : undefined,
  }
}

async function maybeWriteRaceProjectApi(
  project: RaceProject,
  mode: 'save' | 'saveAs',
): Promise<RaceProject | null> {
  const config = bootConfig
  if (!config) return null
  const apiBase = config.projectsApiBase.trim()
  if (!apiBase) return null
  // Air-only LAN role: never POST/PUT (UI also disables Save).
  if (!canWriteProjectsApi(config, window.location.search)) {
    return null
  }

  const auth = projectsWriteOpts(apiBase)

  try {
    if (mode === 'saveAs') {
      try {
        return await writeRaceProject(project, {
          ...auth,
          mode: 'create',
        })
      } catch (err) {
        // Editor Save project may reuse an existing id → fall back to PUT.
        if (!(err instanceof WriteRaceProjectError) || err.status !== 409) {
          throw err
        }
        let expectedRevision =
          typeof project.revision === 'number'
            ? project.revision
            : typeof raceProject?.revision === 'number'
              ? raceProject.revision
              : undefined
        if (expectedRevision === undefined) {
          const existing = await loadRaceProject(project.id, {
            projectsApiBase: apiBase,
          })
          expectedRevision = existing.revision
        }
        if (expectedRevision === undefined) throw err
        return await writeRaceProject(project, {
          ...auth,
          mode: 'update',
          expectedRevision,
        })
      }
    }

    let expectedRevision =
      typeof project.revision === 'number'
        ? project.revision
        : typeof raceProject?.revision === 'number'
          ? raceProject.revision
          : undefined

    if (expectedRevision === undefined) {
      try {
        const existing = await loadRaceProject(project.id, {
          projectsApiBase: apiBase,
        })
        expectedRevision = existing.revision
      } catch {
        return await writeRaceProject(project, {
          ...auth,
          mode: 'create',
        })
      }
    }

    if (expectedRevision === undefined) {
      return await writeRaceProject(project, {
        ...auth,
        mode: 'create',
      })
    }

    try {
      return await writeRaceProject(project, {
        ...auth,
        mode: 'update',
        expectedRevision,
      })
    } catch (err) {
      if (err instanceof WriteRaceProjectError && err.status === 404) {
        return await writeRaceProject(project, {
          ...auth,
          mode: 'create',
        })
      }
      throw err
    }
  } catch (err) {
    console.warn('[projects] API write failed (download kept)', err)
    const detail =
      err instanceof WriteRaceProjectError
        ? `API ${err.status}`
        : 'API write failed'
    hud.setBootMessage(`saved download · ${detail}`)
    return null
  }
}

async function saveCurrentRaceProject(
  options: SaveRaceProjectOptions = {},
): Promise<void> {
  const config = bootConfig
  if (!config) {
    console.warn('[projects] save skipped; config not ready')
    return
  }
  if (!canWriteProjectsApi(config, window.location.search)) {
    console.warn('[projects] save skipped; air-only role')
    hud.setBootMessage('air-only · Save disabled')
    return
  }

  const mode = options.mode ?? 'save'
  const fleet = fleetPanel?.getState()
  if (fleet) {
    boatIds = [...fleet.boatIds]
    povIds = [...fleet.povIds]
  }
  syncFleetIntoConfig(config)

  const features = mapEditor?.getFeatures() ?? currentWorldFeatures
  const id =
    options.meta?.id?.trim() ||
    raceProject?.id ||
    defaultEditedRaceId()
  if (!isSafeRaceId(id)) {
    console.warn('[projects] save skipped; invalid race id', id)
    hud.setBootMessage(`save failed: invalid id`)
    return
  }
  const name =
    options.meta?.name?.trim() ||
    raceProject?.name ||
    id

  const catalogueIds = scene
    ? [...scene.getBoatNamesCatalogue().keys()]
    : []
  if (!confirmSaveWithOrphanBoatIds(boatIds, catalogueIds)) {
    hud.setBootMessage('save cancelled')
    return
  }

  try {
    const boatVisibility = fleetBoatVisibilityRecord(fleet?.boats)
    const boatMapVisible = fleetBoatMapVisibleRecord(fleet?.boats)
    const povMapVisibleRecord = fleetPovMapVisibleRecord(povIds)
    const calibration = snapshotCalibrationByPovId(povIds)
    const project = buildRaceProject({
      id,
      name,
      origin: { ...config.origin },
      boatIds,
      boats: snapshotFleetBoats(boatIds, fleet?.boats),
      povIds,
      features,
      takeoffAltitudeMSL: config.takeoffAltitudeMSL,
      boatNamesUrl: boatNamesUrl || config.boatNamesUrl,
      boatVisibility,
      boatMapVisible,
      povMapVisible: povMapVisibleRecord,
      courseUrl: courseUrl || config.courseUrl,
      sponsorsUrl: sponsorsUrl || config.sponsorsUrl,
      flagsUrl: flagsUrl || config.flagsUrl,
      replayUrl: replayUrl || config.replayUrl,
      calibration,
      revision: mode === 'save' ? raceProject?.revision : undefined,
      output: raceOutputFromRuntime(config),
    })

    // Electron: folder write is primary. Chrome: download. Export… = download only.
    const races = getRacesBridge()
    const persist = await persistRaceProjectLocal({
      project,
      racesBridge: races,
      mode,
      download: downloadRaceProject,
    })
    if (persist.local && !persist.local.ok) {
      console.warn('[projects] Electron races.save failed', persist.local.error)
    }

    const stored = await maybeWriteRaceProjectApi(project, mode)
    const finalProject = stored ?? project
    raceProject = finalProject
    mapEditor?.setProjectMeta(finalProject.id, finalProject.name)
    hud.setProjectMeta(finalProject.id, finalProject.name)
    hud.setActiveRaceId(finalProject.id)
    syncRaceQuery(finalProject.id)
    const localSaved = Boolean(persist.local?.ok)
    if (localSaved || stored) {
      await refreshRacePicker(finalProject.id)
    }
    const status = formatPersistStatus(persist, { api: Boolean(stored) })
    hud.setSaveStatus(status)
    hud.setBootMessage(`saved: ${finalProject.id} · ${status}`)
    console.info('[projects] saved RaceProject', {
      id: finalProject.id,
      mode,
      origin: finalProject.origin,
      boatIds: finalProject.fleet.boatIds,
      povIds: finalProject.povIds,
      features: finalProject.features?.length ?? 0,
      local: localSaved,
      localPath: persist.local?.ok ? persist.local.path : undefined,
      downloaded: persist.downloaded,
      api: Boolean(stored),
    })
  } catch (err) {
    console.warn('[projects] save/download failed', err)
    hud.setSaveStatus('save failed')
    hud.setBootMessage('save failed')
  }
}

async function exportCurrentRaceProject(): Promise<void> {
  const project = buildCurrentRaceProject()
  if (!project) {
    hud.setBootMessage('export failed: no project')
    return
  }
  const catalogueIds = scene
    ? [...scene.getBoatNamesCatalogue().keys()]
    : []
  if (!confirmSaveWithOrphanBoatIds(boatIds, catalogueIds)) {
    hud.setBootMessage('export cancelled')
    return
  }
  downloadRaceProject(project)
  hud.setSaveStatus('download')
  hud.setBootMessage(`exported: ${project.id}`)
}

async function saveAsRaceProject(): Promise<void> {
  const defaults = {
    id: defaultEditedRaceId(),
    name: raceProject?.name ? `${raceProject.name} (copy)` : 'Edited race',
  }
  const meta = await promptSaveAsMeta(defaults)
  if (!meta) return
  void saveCurrentRaceProject({ meta, mode: 'saveAs' })
}

async function loadWorldForProject(
  project: RaceProject | null,
): Promise<WorldFeature[]> {
  if (!scene) return []
  const packFeatures = project?.features
  if (packFeatures && packFeatures.length > 0) {
    const world = cloneWorldFeatures(packFeatures)
    await scene.remountWorldFromFeatures(world)
    await scene.loadPositionMarkersFromUrl()
    return world
  }
  const course = await scene.loadCourseFromUrl(courseUrl)
  const sponsors = await scene.loadSponsorsFromUrl(sponsorsUrl)
  const flags = await scene.loadCountdownFlagsFromUrl(flagsUrl)
  const extras = await loadWorldExtrasFeatures()
  const world = [
    ...(course?.worldFeatures ?? []),
    ...(sponsors?.worldFeatures ?? []),
    ...(flags?.worldFeatures ?? []),
    ...extras,
  ]
  scene.syncLineSignsFromFeatures(world)
  await scene.loadPositionMarkersFromUrl()
  return world
}

async function applyWorldFeatures(world: WorldFeature[]): Promise<void> {
  currentWorldFeatures = cloneWorldFeatures(world)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  scene?.refreshCalibrationOverlay()
  // 3D already mounted by loadWorldForProject — sync editor/map only.
  mapEditor?.replaceFeatures(currentWorldFeatures, false)
}

/**
 * Ops world-anchor Apply: update runtime config.origin, GEO cache, remount ENU.
 * GPS feature points stay; boats/features shift consistently in ENU.
 */
async function applyWorldOrigin(origin: ConfigOrigin): Promise<void> {
  const config = bootConfig
  if (!config || !scene) {
    console.warn('[geo] origin apply skipped; boot not ready')
    return
  }
  config.origin = { ...origin }
  applyConfigOrigin(config.origin)
  hud.setOrigin(config.origin)
  startOpenMeteoWind({ origin: config.origin })

  syncMapGeoBridge({ ops: hud.getMap(), stream: hud.getStreamMap() })

  const features = mapEditor?.getFeatures() ?? currentWorldFeatures
  currentWorldFeatures = cloneWorldFeatures(features)
  await scene.remountWorldFromFeatures(currentWorldFeatures)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  scene.refreshCalibrationOverlay()
  mapEditor?.replaceFeatures(currentWorldFeatures, false)

  hud.setBootMessage(
    `origin: ${config.origin.lat}, ${config.origin.lon}, altMsl=${config.origin.altMsl}`,
  )
  console.info('[geo] world anchor applied', config.origin)
}

async function applyLoadedRaceProject(project: RaceProject): Promise<void> {
  const config = bootConfig
  if (!scene || !config) return

  applyRaceProjectToConfig(config, project)
  raceProject = project
  replayUrl = config.replayUrl
  courseUrl = config.courseUrl
  sponsorsUrl = config.sponsorsUrl
  flagsUrl = config.flagsUrl
  boatNamesUrl = config.boatNamesUrl
  boatIds = config.boatIds
  povIds = config.povIds
  pruneFlowTapToFleet()

  applyConfigOrigin(config.origin)
  hud.setOrigin(config.origin)
  startOpenMeteoWind({ origin: config.origin })
  await scene.loadBoatNamesFromUrl(boatNamesUrl)
  const packVis = project.fleet.boatVisibility ?? {}
  const packBoatMap = project.fleet.boatMapVisible ?? {}
  const loadedBoats = resolveLoadedFleetBoats({
    boatIds: config.boatIds,
    boats: project.fleet.boats,
    catalogue: scene.getBoatNamesCatalogue(),
  }).map((b) => ({
    ...b,
    visibility: b.visibility ?? packVis[b.id] ?? 'solid',
    mapVisible:
      b.mapVisible === false || packBoatMap[b.id] === false
        ? false
        : undefined,
  }))
  for (const b of loadedBoats) {
    scene.upsertBoatName({
      id: b.id,
      name: b.name,
      category: b.category,
      color: b.color,
    })
  }
  syncMapBoatDotColors()

  const world = await loadWorldForProject(project)
  await applyWorldFeatures(world)

  mapEditor?.setProjectMeta(project.id, project.name)
  hud.setProjectMeta(project.id, project.name)
  const streamTitle = project.name.trim()
  hud.getStreamMap().setTitle(streamTitle || 'Race map')
  hud.setActiveRaceId(project.id)
  const activePov = scene.setFleetAllowLists({
    boatIds: config.boatIds,
    povIds: config.povIds,
  })
  hud.setPovIds(config.povIds, activePov)
  hud.setBoatIds(config.boatIds)
  calib?.setPovIds(config.povIds, activePov)
  syncRaceQuery(project.id)

  liveBoatIds = liveBoatIds.filter((id) => boatIds.includes(id))
  livePovIds = livePovIds.filter((id) => povIds.includes(id))

  await restartIngest(ingest?.mode ?? config.telemetryMode)
  povMapVisible.clear()
  povVisible3d.clear()
  if (project.fleet.povMapVisible) {
    for (const [id, v] of Object.entries(project.fleet.povMapVisible)) {
      if (typeof v === 'boolean') povMapVisible.set(id, v)
    }
  }
  fleetPanel?.setState({
    boatIds: config.boatIds,
    povIds: config.povIds,
    enabledBoatIds: [...liveBoatIds],
    enabledPovIds: [...livePovIds],
    activePovId: activePov,
    boats: loadedBoats,
    srtUrlTemplate: project.output?.srtUrlTemplate ?? '',
    srtByPovId: { ...(project.output?.srtByPovId ?? {}) },
  })
  syncBoatVisibilityToScene(
    fleetPanel?.getState().boats ?? loadedBoats,
  )
  syncMapHiddenPoseIds()
  syncFleetMapPosesToAllowList()
  syncFleetHullsFromPanel()
  assetInspector?.refresh()
  hud.setBootMessage(`project: ${project.id}`)
  console.info('[projects] switched race pack', { id: project.id })
}

async function switchRace(id: string): Promise<void> {
  const config = bootConfig
  if (!scene || !config || switchingRace) return
  const trimmed = id.trim()
  if (!isSafeRaceId(trimmed)) {
    console.warn('[projects] invalid race id', id)
    hud.setBootMessage(`invalid race id`)
    return
  }
  switchingRace = true
  try {
    hud.setBootMessage(`project: loading ${trimmed}…`)
    const project = await loadRaceProject(trimmed, {
      projectsApiBase: config.projectsApiBase,
    })
    await applyLoadedRaceProject(project)
  } catch (err) {
    console.warn('[projects] race pack switch failed', err)
    hud.setBootMessage(`project load failed: ${trimmed}`)
  } finally {
    switchingRace = false
  }
}

async function downloadCurrentVenuePack(): Promise<void> {
  const project = buildCurrentRaceProject({
    id: raceProject?.id,
    name: raceProject?.name,
    revision: raceProject?.revision,
  })
  if (!project) {
    hud.setBootMessage('venue pack: no project')
    return
  }
  try {
    hud.setBootMessage(`venue pack: building ${project.id}…`)
    const pack = await buildVenuePack(project)
    downloadVenuePack(pack)
    await getDefaultVenuePackCache().put(pack)
    await refreshRacePicker(project.id)
    const n = Object.keys(pack.files).length
    hud.setBootMessage(`venue pack: ${pack.id} (${n} files)`)
    console.info('[venuePack] downloaded', { id: pack.id, files: n })
  } catch (err) {
    console.warn('[venuePack] download failed', err)
    hud.setBootMessage('venue pack download failed')
  }
}

async function loadVenuePackFromFile(file: File): Promise<void> {
  if (switchingRace) return
  switchingRace = true
  try {
    hud.setBootMessage(`venue pack: reading ${file.name}…`)
    const raw = JSON.parse(await file.text()) as unknown
    const pack = parseVenuePack(raw)
    await getDefaultVenuePackCache().put(pack)
    const mat = retainMaterializedVenuePack(materializeVenuePack(pack))
    await applyLoadedRaceProject(mat.project)
    await refreshRacePicker(pack.id)
    const n = Object.keys(pack.files).length
    hud.setBootMessage(`venue pack loaded: ${pack.id} (${n} files)`)
    console.info('[venuePack] loaded file', { id: pack.id, files: n })
  } catch (err) {
    console.warn('[venuePack] load file failed', err)
    hud.setBootMessage('venue pack load failed')
  } finally {
    switchingRace = false
  }
}

const opsSidebar = createSidebar({ container: app })

const terrainAttrib = createTerrainAttributionOverlay()
opsSidebar.getOverlayHost().appendChild(terrainAttrib.el)

function syncTerrainAttribution(): void {
  const lines = scene?.getTerrainCredits() ?? []
  const show =
    localChannelFocus === '3d' &&
    (scene?.getTerrainEnabled() ?? false) &&
    lines.length > 0
  terrainAttrib.setLines(lines)
  terrainAttrib.setVisible(show)
}

const authoringShell = createWorldAuthoringWorkspace({
  container: opsSidebar.getOverlayHost(),
  initiallyOpen: false,
})
worldAuthoring = authoringShell

/** Section body hosts — filled synchronously by registerSection mount. */
let projectSectionEl!: HTMLElement
let assetsSectionEl!: HTMLElement
let calibSectionEl!: HTMLElement
let librarySectionEl!: HTMLElement
let liveSectionEl!: HTMLElement
let ndiSectionEl!: HTMLElement
let flowSectionEl!: HTMLElement
let opsSectionEl!: HTMLElement
let environmentSectionEl!: HTMLElement
let windSectionEl!: HTMLElement
let libraryPanel: LibraryPanelHandle | null = null
let projectManagerPanel: ProjectManagerPanelHandle | null = null

opsSidebar.registerSection({
  id: 'project',
  label: 'Project',
  order: 10,
  mount(container) {
    projectSectionEl = container
    return {
      dispose() {
        projectManagerPanel?.dispose()
        projectManagerPanel = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'live',
  label: 'Fleet & Live',
  order: 20,
  mount(container) {
    liveSectionEl = container
    return { dispose: () => {} }
  },
})
opsSidebar.registerSection({
  id: 'assets',
  label: 'Assets',
  order: 30,
  mount(container) {
    assetsSectionEl = container
    return {
      dispose() {
        assetInspector?.dispose()
        assetInspector = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'world-map',
  label: 'World',
  order: 40,
  mount(container) {
    worldMapLauncher = mountWorldMapAuthoringLauncher(container, authoringShell)
    return {
      dispose() {
        worldMapLauncher?.dispose()
        worldMapLauncher = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'library',
  label: 'Library',
  order: 50,
  mount(container) {
    librarySectionEl = container
    return {
      dispose() {
        libraryPanel?.dispose()
        libraryPanel = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'ops',
  label: 'Race ops',
  order: 60,
  mount(container) {
    opsSectionEl = container
    return { dispose: () => {} }
  },
})
opsSidebar.registerSection({
  id: 'ndi',
  label: 'Output',
  order: 10,
  mount(container) {
    ndiSectionEl = container
    return { dispose: () => {} }
  },
})
opsSidebar.registerSection({
  id: 'flow',
  label: 'Flow',
  order: 15,
  mount(container) {
    flowSectionEl = container
    return {
      dispose() {
        flowPanel?.dispose()
        flowPanel = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'calib',
  label: 'Calibration',
  order: 20,
  mount(container) {
    calibSectionEl = container
    return {
      dispose() {
        calib?.stop()
        calib = null
      },
    }
  },
})
opsSidebar.registerSection({
  id: 'environment',
  label: 'Environment',
  order: 30,
  mount(container) {
    environmentSectionEl = container
    return { dispose: () => {} }
  },
})
opsSidebar.registerSection({
  id: 'wind',
  label: 'Wind',
  order: 40,
  mount(container) {
    windSectionEl = container
    return { dispose: () => {} }
  },
})

// CAL offset sliders — sidebar Calib section (no fixed top-left chrome).
calib = startOffsetSliders({ container: calibSectionEl })

// SCN calibration overlay toggle (v1 mounts next to CAL sliders).
{
  const row = document.createElement('label')
  row.className = 'calib-overlay-toggle'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.className = 'calib-overlay-toggle__input'
  input.checked = false
  input.title =
    'ENU grid + force-visible marks through the active POV camera (read-only)'
  input.addEventListener('change', () => {
    scene?.setCalibrationOverlayEnabled(input.checked)
  })
  const text = document.createElement('span')
  text.className = 'calib-overlay-toggle__label'
  text.textContent = 'Calibration overlay'
  row.append(input, text)
  calibSectionEl.appendChild(row)
}

// NDI status tab (OUT). Polls pumps + POV; never feeds the WebGL render loop.
// 2D stream-map toggle enables/disables channel `'2d'` only (default on).
// Per-channel delay knobs (0–30000 ms); live change, no restart.
ndiController = startNdiControllerPanel({
  container: ndiSectionEl,
  getPump: () => ndiPump,
  get3dPump: () => ndi3dPump,
  getStreamMapPump: () => streamMapNdiPump,
  getActivePovId: () => scene?.getActivePovId() ?? null,
  getDelayMs: (channel) => {
    if (channel === 'ar') return ndiPump?.getDelayMs() ?? ndiDelayMs.ar
    if (channel === '3d') return ndi3dPump?.getDelayMs() ?? ndiDelayMs['3d']
    return streamMapNdiPump?.getDelayMs() ?? ndiDelayMs['2d']
  },
  onDelayMsChange: (channel, delayMs) => {
    ndiDelayMs[channel] = delayMs
    if (channel === 'ar') ndiPump?.setDelayMs(delayMs)
    else if (channel === '3d') ndi3dPump?.setDelayMs(delayMs)
    else streamMapNdiPump?.setDelayMs(delayMs)
  },
  initialDelayMs: ndiDelayMs,
  onStreamMapNdiEnabledChange: (enabled) => {
    streamMapNdiWanted = enabled
    streamMapNdiPump?.setEnabled(enabled)
  },
})

syncDebugPanel = startSyncDebugPanel({
  container: ndiSectionEl,
  getSnapshot: collectSyncDebugSnapshots,
})

flowPanel = startFlowPanel({
  container: flowSectionEl,
  overlayHost: opsSidebar.getOverlayHost(),
  getSnapshot: () => flowTap.snapshot(),
  getRegistryIds: () => ({
    boats: fleetPanel?.getState().boatIds ?? boatIds,
    povs: fleetPanel?.getState().povIds ?? povIds,
    buoys: bootConfig?.buoyIds ?? [],
  }),
  beforePoll: pushSrtFlowSnapshots,
})

const hud = startStubHud({
  container: app,
  hosts: {
    project: projectSectionEl,
    ops: opsSectionEl,
    environment: environmentSectionEl,
    wind: windSectionEl,
    map: authoringShell.getMapHost(),
    streamMapHost: opsSidebar.getOverlayHost(),
  },
  editorInitiallyOpen: false,
  onModeChange: (mode) => {
    void (async () => {
      if (switching) return
      switching = true
      try {
        await restartIngest(mode)
      } finally {
        switching = false
      }
    })()
  },
  onPovChange: (id) => {
    scene?.setActivePovId(id)
    calib?.setDeviceId(id)
    fleetPanel?.setState({ activePovId: id })
  },
  onOpsViewChange: (mode) => {
    scene?.setOpsViewMode(mode)
    fleetPanel?.setOpsViewMode(mode)
  },
  onEnvironmentModeChange: (mode) => {
    scene?.setEnvironmentMode(mode)
  },
  onSeaQualityChange: (quality) => {
    scene?.setSeaQuality(quality)
  },
  onTerrainEnabledChange: (enabled) => {
    scene?.setTerrainEnabled(enabled)
    syncTerrainAttribution()
  },
  onTerrainAltitudeNudgeChange: (nudgeM) => {
    scene?.setTerrainAltitudeNudgeM(nudgeM)
  },
  onTerrainTilesLockedChange: (locked) => {
    scene?.setTerrainTilesLocked(locked)
  },
  onTerrainWaterDiscardYChange: (yM) => {
    scene?.setTerrainWaterDiscardYM(yM)
  },
  onCesiumIonTokenApply: (token) => {
    void persistAndApplyIonToken(token)
  },
  onCountdownControl: (action) => {
    scene?.controlCountdown(action)
  },
  onEditorToggle: (open) => {
    authoringShell.setOpen(open)
  },
  onRaceLoad: (id) => {
    void switchRace(id)
  },
  onSaveProject: () => {
    void saveCurrentRaceProject({ mode: 'save' })
  },
  onSaveAsProject: () => {
    void saveAsRaceProject()
  },
  onExportProject: () => {
    void exportCurrentRaceProject()
  },
  localRacesFolder: getRacesBridge() !== null,
  onDownloadVenuePack: () => {
    void downloadCurrentVenuePack()
  },
  onLoadVenuePackFile: (file) => {
    void loadVenuePackFromFile(file)
  },
  onOriginApply: (origin) => {
    void applyWorldOrigin(origin)
  },
})

async function persistAndApplyIonToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (trimmed.length > CESIUM_ION_TOKEN_MAX_LEN) {
    hud.setTerrainStatus('Terrain: ion token too long')
    return
  }
  writeSessionCesiumIonToken(trimmed)
  if (bootConfig) bootConfig.cesiumIonToken = trimmed
  scene?.setCesiumIonToken(trimmed)
  const status = scene?.getTerrainStatusMessage() ?? ''
  const setter = getStudioBridge()?.config?.setCesiumIonToken
  if (typeof setter !== 'function') {
    hud.setTerrainStatus(
      trimmed === ''
        ? `${status} · session cleared — also clear public/config.json to git-share`
        : `${status} · session only — studio app saves public/config.json for git`,
    )
    syncTerrainAttribution()
    return
  }
  const result = await setter(trimmed)
  if (result.ok) {
    const share =
      result.kind === 'public'
        ? 'saved public/config.json — commit to share with git'
        : 'saved userData/config.json (packaged app, not git)'
    hud.setTerrainStatus(`${status} · ${share}`)
  } else {
    hud.setTerrainStatus(
      `${status} · save failed: ${result.error ?? 'unknown'}`,
    )
  }
  syncTerrainAttribution()
}

authoringShell.onOpenChange((open) => {
  mapEditor?.setOpen(open)
  hud.setEditorOpen(open, false)
  if (open) mapEditor?.resyncChrome()
})

function pushLiveStatus(snapshot: LiveStatusSnapshot): void {
  hud.setConnectionStatus({ kind: 'live', channels: snapshot })
  fleetPanel?.setLiveStatus(snapshot)
}

function applyIngestConnectionStatus(handle: IngestHandle): void {
  clearLiveStatusSub()
  if (handle.mode === 'live' && handle.getLiveStatus && handle.onLiveStatus) {
    const push = (): void => {
      const snap = handle.getLiveStatus?.()
      if (snap) pushLiveStatus(snap)
    }
    push()
    unsubLiveStatus = handle.onLiveStatus(() => {
      push()
    })
    // Refresh last-packet ages while live (status events alone miss packets).
    liveStatusPoll = setInterval(push, 250)
    return
  }
  fleetPanel?.setLiveStatus(null)
  hud.setConnectionStatus({
    kind: 'non_live',
    mode: handle.mode === 'replay' ? 'replay' : 'mock',
  })
}
void (async () => {
  const config = await loadConfig()
  bootConfig = config
  ndiDelayMs = normalizeOutputDelayMs(
    (config as unknown as Record<string, unknown>).outputDelayMs,
  )
  ndiController?.refresh()
  const deeplink = parseConsoleDeeplink(window.location.search)
  libraryPanel = startLibraryPanel({
    container: librarySectionEl,
    projectsApiBase: config.projectsApiBase,
    bearerToken: projectsApiBearerToken(config),
    canUpload: canWriteProjectsApi(config, window.location.search),
  })
  projectManagerPanel = startProjectManagerPanel({
    container: projectSectionEl,
    projectsApiBase: config.projectsApiBase,
    bearerToken: projectsApiBearerToken(config),
    canWrite: canWriteProjectsApi(config, window.location.search),
    getActiveProjectId: () => raceProject?.id,
    onProjectsChanged: async (activeId) => {
      await refreshRacePicker(activeId)
    },
    onRenamedActive: async (project) => {
      await applyLoadedRaceProject(project)
    },
  })
  const projectWritesEnabled = canWriteProjectsApi(
    config,
    window.location.search,
  )
  hud.setProjectWritesEnabled(projectWritesEnabled)
  const racesBridge = getRacesBridge()
  if (racesBridge?.getRoot) {
    void racesBridge.getRoot().then((root) => {
      hud.setRacesRootHint(root.path)
    }).catch(() => {
      /* ignore */
    })
  }
  console.info('[projects] LAN role', {
    role: resolveProjectsRole(config, window.location.search),
    writes: projectWritesEnabled,
    apiBase: config.projectsApiBase || '(static)',
    localRaces: Boolean(racesBridge),
  })

  // PLT+CON: ?race=<id> → local pack under /races/<id>/; miss → config.json (warn).
  if (deeplink.race) {
    try {
      raceProject = await loadRaceProject(deeplink.race, {
        projectsApiBase: config.projectsApiBase,
      })
      applyRaceProjectToConfig(config, raceProject)
      console.info('[projects] loaded race pack', { id: raceProject.id })
      hud.setBootMessage(`project: ${raceProject.id}`)
      hud.setProjectMeta(raceProject.id, raceProject.name)
      hud.setActiveRaceId(raceProject.id)
    } catch (err) {
      console.warn(
        '[projects] race pack load failed; continuing with config.json',
        err,
      )
      raceProject = null
    }
  }

  // CON: query overrides after config + pack; before origin / ingest (token not validated).
  applyDeeplinkToBoot(config, deeplink)
  replayUrl = config.replayUrl
  courseUrl = config.courseUrl
  sponsorsUrl = config.sponsorsUrl
  flagsUrl = config.flagsUrl
  boatNamesUrl = config.boatNamesUrl
  boatIds = config.boatIds
  povIds = config.povIds
  // Bases only — strip any id/type from config; default to VPS if empty.
  wsUrl = stripLiveWsId(config.wsUrl) || DEFAULT_LIVE_WS_BASE
  wsBoatUrl = stripLiveWsId(config.wsBoatUrl) || DEFAULT_LIVE_WS_BASE

  // Ops Fleet panel session overlays config (URLs / ids) without editing files.
  // A loaded pack's fleet always wins; session boats/ids apply only with no pack.
  const sessionFleet = loadFleetLiveFromSession()
  const packLoaded = raceProject !== null
  if (sessionFleet) {
    if (typeof sessionFleet.wsUrl === 'string') {
      wsUrl = stripLiveWsId(sessionFleet.wsUrl) || DEFAULT_LIVE_WS_BASE
    }
    if (typeof sessionFleet.wsBoatUrl === 'string') {
      wsBoatUrl =
        stripLiveWsId(sessionFleet.wsBoatUrl) || DEFAULT_LIVE_WS_BASE
    }
    if (!packLoaded && sessionFleet.boatIds?.length) {
      boatIds = [...sessionFleet.boatIds]
    }
    if (sessionFleet.povIds?.length) povIds = [...sessionFleet.povIds]
    // Enabled-for-live subset (may be empty — do not reopen full default fleet).
    if (!packLoaded && Array.isArray(sessionFleet.enabledBoatIds)) {
      liveBoatIds = sessionFleet.enabledBoatIds.filter((id) =>
        boatIds.includes(id),
      )
    }
    if (Array.isArray(sessionFleet.enabledPovIds)) {
      livePovIds = sessionFleet.enabledPovIds.filter((id) =>
        povIds.includes(id),
      )
    }
  }

  chromaKey = config.chromaKey
  const outputMode = normalizeOutputMode(config.outputMode)
  arOutputMode = outputMode
  arBackgroundMode = normalizeArBackground(config.arBackground)
  /* DIAG:auto-connect — query wins over config.json; default URL is a no-op. */
  const diagAutoConnect = parseDiagAutoConnect(window.location.search)
  const ndiUploadProbe = parseNdiUploadProbe(window.location.search)
  if (diagAutoConnect.arBackground) {
    arBackgroundMode = diagAutoConnect.arBackground
  }
  const clear = resolveClearAppearance(outputMode, {
    chromaKey: chromaKey || undefined,
  })
  applyOutputModeChrome(outputMode)

  // Scene after config so boatIds / povIds allow-lists are known before first poses.
  // Clear color from OUT (preview / chroma / transparent).
  // Electron studio: lock WebGL/NDI to 1920×1080. Preview = rAF when visible;
  // studio:tick ~30 drives NDI + minimized preview (DSP-OUT-20260818-01).
  const studioBridge = getStudioBridge()
  const cesiumIonToken = resolveCesiumIonToken(
    config.cesiumIonToken,
    readSessionCesiumIonToken(),
  )
  previewClock = startDualFrameClock({
    subscribeStudioTick: studioBridge
      ? (onTick) => studioBridge.onStudioTick(onTick)
      : () => () => {},
  })
  scene = startScene({
    container: app,
    boatIds,
    povIds,
    clearColor: clear.color,
    cesiumIonToken,
    cesiumIonAssetId: config.cesiumIonAssetId,
    cesiumIonImageryAssetId: config.cesiumIonImageryAssetId,
    frameClock: {
      subscribe: (onTick) =>
        previewClock!.subscribePreview(() => {
          onTick()
          hud.setPreviewFps(previewClock!.getPreviewFps())
          hud.setHitchCounts(previewClock!.getHitchCounts())
        }),
    },
    onActivePovChange: (id) => {
      videoStreamManager?.setActivePov(id)
      posePipeline?.tick(0)
    },
    ...(studioBridge
      ? {
          outputSize: {
            width: STUDIO_OUTPUT_WIDTH,
            height: STUDIO_OUTPUT_HEIGHT,
          },
        }
      : {}),
  })
  const gpuInfo = readWebGlGpuInfo(scene.renderer.getContext())
  console.info(`[perf] WebGL renderer: ${gpuInfo.raw ?? 'unknown'}`)
  try {
    const gl = scene.renderer.getContext() as WebGLRenderingContext
    const attributes = gl?.getContextAttributes?.() ?? null
    let unmaskedVendor: string | null = null
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info') as {
      UNMASKED_VENDOR_WEBGL: number
      UNMASKED_RENDERER_WEBGL: number
    } | null
    if (gl && ext) {
      const v = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
      unmaskedVendor = typeof v === 'string' ? v : null
    }
    console.info(
      `[diag:srt-fps] ${JSON.stringify({
        stage: 'webgl-context',
        attributes,
        unmaskedVendor,
        unmaskedRenderer: gpuInfo.raw,
        three: {
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          desynchronized: 'omitted (WebGL default false)',
          preserveDrawingBuffer: 'omitted (WebGL default false)',
        },
      })}`,
    )
  } catch {
    /* ignore */
  }
  hud.setGpuLabel(gpuInfo.display)
  if (studioBridge) {
    console.info(
      `[boot] studio shell: output locked ${STUDIO_OUTPUT_WIDTH}×${STUDIO_OUTPUT_HEIGHT}; rAF preview when visible, studio tick ~30 for NDI / minimized`,
    )
  }
  applyOutputMode(scene.renderer, outputMode, {
    chromaKey: chromaKey || undefined,
  })
  // Realistic sea/sky only when clear is opaque-safe (preview today).
  scene.setEnvironmentOpaqueClearSafe(outputMode === 'preview')
  scene.setTerrainAltitudeNudgeM(hud.getTerrainAltitudeNudgeM())
  scene.setTerrainTilesLocked(hud.getTerrainTilesLocked())
  scene.setTerrainWaterDiscardYM(hud.getTerrainWaterDiscardYM())
  scene.setTerrainCreditsListener(() => {
    hud.setTerrainStatus(scene?.getTerrainStatusMessage() ?? '')
    syncTerrainAttribution()
  })
  hud.setTerrainStatus(scene.getTerrainStatusMessage())
  hud.setCesiumIonToken(cesiumIonToken)
  const envFromQuery = parseEnvironmentModeQuery(window.location.search)
  if (envFromQuery) {
    scene.setEnvironmentMode(envFromQuery)
    hud.setEnvironmentMode(envFromQuery)
  }
  const seaFromQuery = parseSeaQualityQuery(window.location.search)
  if (seaFromQuery) {
    scene.setSeaQuality(seaFromQuery)
    hud.setSeaQuality(seaFromQuery)
  }
  const activePov = scene.getActivePovId()
  hud.setPovIds(povIds, activePov)
  hud.setBoatIds(boatIds)
  calib?.setPovIds(povIds, activePov)

  // Ops sidebar (above mode/POV) — not fixed canvas chrome.
  // Local 2D/3D/AR switcher (strip on overlay) + AR clear dropdown compose:
  // switcher = which channel fills the window; outputMode = AR clear only.
  arBackgroundControl = startArBackgroundControl({
    container: ndiSectionEl,
    mountAt: 'start',
    initialMode: arBackgroundMode,
    onChange: (mode) => {
      arBackgroundMode = mode
      applyLocalChannelFocus(localChannelFocus)
      publishSrtSituation()
    },
  })
  outputControl = startOutputModeControl({
    container: ndiSectionEl,
    mountAt: 'start',
    initialMode: outputMode,
    onChange: (mode) => {
      arOutputMode = mode
      if (!scene) return
      // Re-apply through local focus so 3D opaque screen stays opaque.
      applyLocalChannelFocus(localChannelFocus)
      whepUnderlay?.setMode(mode)
    },
  })

  {
    const strip = document.createElement('div')
    strip.className = 'local-channel-switcher-strip'
    strip.setAttribute('data-ops', 'local-channel-strip')
    opsSidebar.getOverlayHost().appendChild(strip)
    localChannelSwitcher = startLocalChannelSwitcher({
      container: strip,
      mountAt: 'start',
      initialFocus: localChannelFocus,
      onChange: (focus) => {
        // Presentation only — never ndi.stop / pump disable.
        applyLocalChannelFocus(focus)
      },
    })
    applyLocalChannelFocus(localChannelFocus)
  }

  // Video still under the WebGL canvas on `app`; WHEP status attaches to the
  // sidebar output-mode control (looked up after mount above).
  whepUnderlay = startWhepUnderlay({
    container: app,
    whepUrl: config.whepUrl,
    initialMode: outputMode,
    renderer: scene.renderer,
  })

  // In-WebGL AR background (DSP-OUT-04). Wrap MUST install before visual
  // timecode: videoBackground innermost (draws BEFORE the scene), timecode
  // outermost (draws AFTER). NDI pumps bind renderer.render last.
  if (scene) {
    const sceneHandle = scene
    videoBackgroundTestPattern = createVideoBackgroundTestPattern()
    videoBackground = startVideoBackground({
      renderer: sceneHandle.renderer,
      shouldDraw: () => {
        const tex = videoBackground?.getTexture() ?? videoBackgroundTestPattern
        return shouldDrawVideoBackground({
          arBackground: arBackgroundMode,
          hasTexture: tex != null,
          opaque3dPass: isOpaque3dPassActive(),
          isScreenPass: sceneHandle.renderer.getRenderTarget() === null,
          localFocus: localChannelFocus,
          previewIsAirCamera:
            sceneHandle.getPreviewCamera() ===
            sceneHandle.getActivePovCamera(),
        })
      },
    })
    videoBackground.setTexture(videoBackgroundTestPattern)

    // DSP-OUT-06: TS demux + WebCodecs decode. OUT-07 opens SRT; we consume
    // srt:data and swap textures. Do not touch Fleet UI / opaqueClearSafe.
    if (ndiUploadProbe === 'texSubImage') {
      console.info(
        `[diag:srt-fps] ${JSON.stringify({
          stage: 'upload-probe',
          mode: ndiUploadProbe,
        })}`,
      )
    }
    videoStreamManager = startVideoStreamManager({
      setTexture: (tex) => {
        if (!videoBackground || !tex) return
        videoBackground.setTexture(
          tex as Exclude<
            ReturnType<VideoBackgroundHandle['getTexture']>,
            null
          >,
        )
      },
      createTexture:
        ndiUploadProbe === 'texSubImage'
          ? createLegacyTexSubImageVideoStreamTexture
          : undefined,
      getActivePovId: () => sceneHandle.getActivePovId(),
      getLutStreamId: lutStreamIdForPov,
      getNewestPoseNtp: (povId) =>
        telemetryHistory.stats().drones[povId]?.newestNtpMs ?? null,
      subscribeTick: studioBridge
        ? (cb) => studioBridge.onStudioTick(cb)
        : (cb) => previewClock!.subscribePreview(cb),
      onOpsError: (povId, message) => {
        console.error(`[video-decode] ${povId}: ${message}`)
        lastSrtDecodeError.set(povId, message)
        publishSrtSituation()
        if (isHevcUnsupportedMessage(message)) {
          beginFfmpegH264Fallback(povId, HEVC_FFMPEG_H264_NOTE)
        }
      },
    })
    videoStreamManager.setActivePov(sceneHandle.getActivePovId())
  }

  if (config.timecodeEnabled && scene) {
    const sceneHandle = scene
    visualTimecode = startVisualTimecode({
      renderer: sceneHandle.renderer,
      getActivePovId: () => sceneHandle.getActivePovId(),
      enabled: true,
      corner: config.timecodeCorner as TimecodeCorner,
      sizePx: config.timecodeSizePx,
    })
  }

  // Electron studio only — after timecode wrap so barcode is in readback.
  // AR pump first, then 3D, then 2D (DSP-OUT-20260828-04: one FBO per tick).
  // Air lock: AR/3D FBO-capture active POV on studio:tick. Preview rAF does not
  // drive NDI. 2D default on @ 30; toggle stops only 2D.
  ndiPump = startNdiFramePump({
    renderer: scene.renderer,
    scene: scene.scene,
    getAirCamera: () => scene?.getActivePovCamera() ?? null,
    prepareCameraPass: (camera) => {
      scene?.orientOpsBillboards(camera)
    },
    getAirPlateClear: () => {
      const appearance = resolveClearAppearance(arOutputMode, {
        chromaKey: chromaKey || undefined,
      })
      return {
        color: appearance.color,
        alpha: appearance.alpha,
        opaqueClearSafe: resolveOpaqueClearSafeForVideo({
          arBackground: arBackgroundMode,
          opaqueClearSafe: appearance.alpha >= 1,
        }),
      }
    },
    setEnvironmentOpaqueClearSafe: (safe) => {
      scene?.setEnvironmentOpaqueClearSafe(safe)
    },
    getEnvironmentOpaqueClearSafe: () =>
      scene?.getEnvironmentOpaqueClearSafe() ?? false,
    fps: 30,
    delayMs: ndiDelayMs.ar,
  })
  ndi3dPump = startNdi3dChannelPump({
    renderer: scene.renderer,
    scene: scene.scene,
    getAirCamera: () => scene?.getActivePovCamera() ?? null,
    prepareCameraPass: (camera) => {
      scene?.orientOpsBillboards(camera)
    },
    setEnvironmentOpaqueClearSafe: (safe) => {
      scene?.setEnvironmentOpaqueClearSafe(safe)
    },
    getEnvironmentOpaqueClearSafe: () =>
      scene?.getEnvironmentOpaqueClearSafe() ?? false,
    fps: 30,
    delayMs: ndiDelayMs['3d'],
  })

  // 2D stream-map NDI (channel `'2d'`) — letterbox into 1920×1080; independent
  // of PiP visibility / sidebar. Default on @ 30; NDI tab toggle starts/stops
  // only this sender (does not affect AR/3D).
  streamMapNdiPump = startStreamMapNdiPump({
    getSourceCanvas: () => hud.getStreamMap().getCanvas(),
    ensureDrawn: () => {
      hud.getStreamMap().redraw()
    },
    enabled: streamMapNdiWanted,
    fps: 30,
    delayMs: ndiDelayMs['2d'],
  })

  hud.setBootMessage(
    raceProject ? `project: ${raceProject.id} · EGM96…` : 'boot: EGM96…',
  )
  await ensureEgm96Loaded()
  applyConfigOrigin(config.origin)
  hud.setOrigin(config.origin)
  startOpenMeteoWind({ origin: config.origin })

  // Shared GPS→ENU layout: one list for 2D map + editor.
  const world = await loadWorldForProject(raceProject)
  currentWorldFeatures = cloneWorldFeatures(world)
  const layout = layoutFeatures(currentWorldFeatures, gpsToEnu)
  setLayoutFeatures(layout)
  hud.setLayoutFeatures(layout)
  scene.refreshCalibrationOverlay()

  const projectIdDefault = raceProject?.id ?? defaultEditedRaceId()
  const projectNameDefault = raceProject?.name ?? 'Edited race'
  if (raceProject) {
    hud.setBootMessage(`project: ${raceProject.id}`)
    hud.setProjectMeta(raceProject.id, raceProject.name)
    const streamTitle = raceProject.name.trim()
    hud.getStreamMap().setTitle(streamTitle || 'Race map')
  } else {
    hud.setProjectMeta(projectIdDefault, projectNameDefault)
  }

  // World Authoring workspace — large map + tool palette (SCN-04).
  // Editor role defaults open; air closed; ?editor=1|0 overrides.
  const authoringOpen = resolveAuthoringInitiallyOpen(projectWritesEnabled)
  syncMapGeoBridge({ ops: hud.getMap(), stream: hud.getStreamMap() })
  mapEditor = startMapFeatureEditor({
    container: authoringShell.getToolsHost(),
    map: hud.getMap(),
    initialFeatures: currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
    enuToGpsAmsl: (east, up, north) => {
      const g = enuToGpsAmsl(east, up, north)
      return { lat: g.lat, lon: g.lon, alt: g.alt }
    },
    initiallyOpen: false,
    mapSizeOpen: WORLD_AUTHORING_MAP_SIZE,
    getMapSizeOpen: () => authoringShell.getMapSizePx(),
    showPanelTitle: false,

    groupedTools: true,
    initialProjectId: projectIdDefault,
    initialProjectName: projectNameDefault,
    projectWritesEnabled,
    knownBuoyIds: bootConfig?.buoyIds ?? [],
    onApply: async (features) => {
      currentWorldFeatures = cloneWorldFeatures(features)
      await scene?.remountWorldFromFeatures(features)
      assetInspector?.refresh()
      authoringShell.setStatus(
        `Authoring: open · ${features.length} feature(s)`,
      )
    },
    onSaveProject: (meta) => {
      // Editor id/name fields → Save as semantics (explicit pack identity).
      void saveCurrentRaceProject({ meta, mode: 'saveAs' })
    },
    onSetAnchor: (lat, lon, altMsl) => {
      void applyWorldOrigin({ lat, lon, altMsl })
    },
    onPlaceFleet: (kind, east, north, id) => {
      const g = enuToGpsAmsl(east, 0, north)
      let created = true
      if (kind === 'boat') {
        const result = fleetPanel?.addBoat({
          id,
          plannedLat: g.lat,
          plannedLon: g.lon,
        })
        if (result && !result.ok) {
          authoringShell.setStatus('Place boat: id required')
          return
        }
        created = result?.created ?? true
      } else {
        const result = fleetPanel?.addDrone({
          id,
          plannedLat: g.lat,
          plannedLon: g.lon,
        })
        if (result && !result.ok) {
          authoringShell.setStatus('Place drone: id required')
          return
        }
        created = result?.created ?? true
      }
      // Click ENU is authoritative — show icon + 3D hull immediately (no telemetry needed).
      seedFleetPoseAtEnu(id, kind, east, north)
      if (kind === 'boat') {
        scene?.upsertStaticBoat(id, { x: east, y: 0, z: north })
      }
      authoringShell.setStatus(
        created
          ? `Placed ${kind} ${id} on map`
          : `${kind} ${id} already in fleet — position updated on map`,
      )
    },
  })
  // Maximize / map-resize should re-layout the canvas backing store while open.
  authoringShell.onMapSizeChange(() => {
    if (authoringShell.isOpen()) mapEditor?.resyncChrome()
  })
  const maxBtn = authoringShell.root.querySelector(
    '.world-authoring__max-btn',
  )
  maxBtn?.addEventListener('click', () => {
    mapEditor?.resyncChrome()
  })

  authoringShell.setOpen(authoringOpen)
  hud.setEditorOpen(authoringOpen, false)
  if (authoringOpen) {
    authoringShell.setStatus(
      `Authoring: open · ${currentWorldFeatures.length} feature(s)`,
    )
  }

  // Local pack picker — static/API index + cached venue packs
  try {
    await refreshRacePicker(raceProject?.id)
  } catch {
    hud.setRaceIds(['demo-istanbul'], raceProject?.id ?? 'demo-istanbul')
  }

  // Name/colour catalogue — before TEL so first boat spawn can resolve tags.
  await scene.loadBoatNamesFromUrl(boatNamesUrl)
  const packBoatMap = raceProject?.fleet.boatMapVisible ?? {}
  const packVis = raceProject?.fleet.boatVisibility ?? {}
  const packPanelBoats = resolveLoadedFleetBoats({
    boatIds,
    boats: raceProject?.fleet.boats,
    catalogue: scene.getBoatNamesCatalogue(),
  }).map((b) => ({
    ...b,
    visibility: b.visibility ?? packVis[b.id] ?? 'solid',
    mapVisible:
      b.mapVisible === false || packBoatMap[b.id] === false
        ? false
        : undefined,
  }))
  const bootBoats = resolveBootPanelBoats({
    packLoaded,
    packBoats: packPanelBoats,
    sessionBoats: sessionFleet?.boats,
  }).map((b) => ({
    ...b,
    mapVisible:
      b.mapVisible === false || packBoatMap[b.id] === false
        ? false
        : b.mapVisible,
  }))
  for (const b of bootBoats) {
    scene.upsertBoatName({
      id: b.id,
      name: b.name,
      category: b.category,
      color: b.color,
    })
  }
  // Soft pack field (if boot race had boatVisibility). Pack fleet wins over session.
  if (raceProject?.fleet.boatVisibility) {
    scene.setBoatVisibilityModes(raceProject.fleet.boatVisibility)
  }
  if (raceProject?.fleet.povMapVisible) {
    for (const [id, v] of Object.entries(raceProject.fleet.povMapVisible)) {
      if (typeof v === 'boolean') povMapVisible.set(id, v)
    }
  }
  syncMapBoatDotColors()

  fleetPanel = startFleetLivePanel({
    container: liveSectionEl,
    initial: {
      wsUrl,
      wsBoatUrl,
      boatIds: [...boatIds],
      povIds: [...povIds],
      enabledBoatIds: [...liveBoatIds],
      enabledPovIds: [...livePovIds],
      boats: bootBoats,
      activePovId: scene.getActivePovId(),
      plannedPovs: sessionFleet?.plannedPovs?.map((p) => ({ ...p })) ?? [],
      srtUrlTemplate:
        sessionFleet?.srtUrlTemplate ||
        raceProject?.output?.srtUrlTemplate ||
        '',
      srtByPovId: {
        ...(raceProject?.output?.srtByPovId ?? {}),
        ...(sessionFleet?.srtByPovId ?? {}),
      },
      enabledSrtPovIds: sessionFleet?.enabledSrtPovIds ?? [],
    },
    onFleetChange: ({ boatIds: nextBoats, povIds: nextPovs, boats }) => {
      boatIds = nextBoats
      povIds = nextPovs
      liveBoatIds = liveBoatIds.filter((id) => boatIds.includes(id))
      livePovIds = livePovIds.filter((id) => povIds.includes(id))
      if (bootConfig) {
        bootConfig.boatIds = [...nextBoats]
        bootConfig.povIds = [...nextPovs]
      }
      for (const b of boats) {
        scene?.upsertBoatName({
          id: b.id,
          name: b.name,
          category: b.category,
          color: b.color,
        })
      }
      syncMapBoatDotColors()
      syncBoatVisibilityToScene(boats)
      syncMapHiddenPoseIds()
      applyFleetToScene()
      assetInspector?.refresh()
    },
    onBoatVisibilityChange: (id, mode) => {
      scene?.setBoatVisibilityMode(id, mode)
      assetInspector?.refresh()
    },
    onPovChange: (id) => {
      scene?.setActivePovId(id)
      calib?.setDeviceId(id)
      hud.setActivePovId(id)
    },
    onOpsViewChange: (mode) => {
      scene?.setOpsViewMode(mode)
      hud.setOpsViewMode(mode)
    },
    onFrameFleet: () => {
      const n = scene?.frameFleet() ?? 0
      hud.setOpsViewMode('free')
      fleetPanel?.setOpsViewMode('free')
      fleetPanel?.setStatus(
        n > 0
          ? `framed ${n} boat(s) — orbit with free cam`
          : 'no boat meshes yet — add a boat in Fleet or check HUD ENU',
      )
    },
    onLiveApply: ({
      wsUrl: nextWs,
      wsBoatUrl: nextBoatWs,
      boatIds: enabledBoats,
      povIds: enabledPovs,
      goLive,
    }) => {
      void (async () => {
        if (switching) return
        switching = true
        try {
          wsUrl = nextWs
          wsBoatUrl = nextBoatWs
          // Connect uses enabled ids only — do not replace scene registry.
          liveBoatIds = [...enabledBoats]
          livePovIds = [...enabledPovs]
          liveExplicitlyDisconnected = false
          await restartIngest(goLive ? 'live' : undefined, {
            fromLiveApply: true,
          })
          fleetPanel?.setStatus(
            goLive
              ? `live · ${liveBoatIds.length} boat + ${livePovIds.length} drone socket(s) · open ≠ packets`
              : `reconnected · mode=${ingest?.mode ?? '?'}`,
          )
        } finally {
          switching = false
        }
      })()
    },
    onLiveDisconnect: () => {
      liveExplicitlyDisconnected = true
      ingest?.disconnectLive?.()
      const snap = ingest?.getLiveStatus?.()
      if (snap) pushLiveStatus(snap)
      else fleetPanel?.setLiveStatus(null)
      fleetPanel?.setStatus(
        'disconnected · all live telemetry sockets closed — Connect or Reconnect to resume',
      )
    },
    onLiveEnabledChange: ({
      boatIds: enabledBoats,
      povIds: enabledPovs,
    }) => {
      liveBoatIds = [...enabledBoats]
      livePovIds = [...enabledPovs]
      ingest?.syncLiveIds?.({
        boatIds: liveBoatIds,
        povIds: livePovIds,
      })
      const snap = ingest?.getLiveStatus?.()
      if (snap) pushLiveStatus(snap)
    },
    onSrtApply: ({ streams }) => {
      void (async () => {
        const gen = bumpSrtConnect(srtHold)
        videoStreamManager?.resumeIngest()
        lastSrtOpenByPov.clear()
        lastSrtOpenAt.clear()
        lastSrtTranscodeAt.clear()
        lastSrtDecodeError.clear()
        srtTranscodeH264.clear()
        const bridge = getSrtBridge()
        if (!bridge) {
          fleetPanel?.setStatus(
            'SRT needs Electron studio — template stored, no caller here',
          )
          pushSrtPanelStatus()
          publishSrtSituation()
          return
        }
        await bridge.close('all')
        if (!srtReopenAllowed(srtHold, gen)) return
        srtStatusByPov.clear()
        let opened = 0
        for (const s of streams.slice(0, SRT_WARM_POV_CAP)) {
          if (!srtReopenAllowed(srtHold, gen)) return
          lastSrtOpenByPov.set(s.povId, { srtId: s.srtId, url: s.url })
          lastSrtOpenAt.set(s.povId, Date.now())
          const result = await bridge.open({ povId: s.povId, url: s.url })
          if (!srtReopenAllowed(srtHold, gen)) return
          if (result.ok) opened += 1
          else {
            lastSrtDecodeError.set(s.povId, result.error)
            console.warn('[srt] open failed', s.povId)
          }
        }
        fleetPanel?.setStatus(
          `SRT · ${opened}/${streams.length} caller(s) · cap ${SRT_WARM_POV_CAP}`,
        )
        const all = await bridge.getStatus()
        if (!srtReopenAllowed(srtHold, gen)) return
        srtStatusByPov.clear()
        for (const [id, st] of Object.entries(all)) srtStatusByPov.set(id, st)
        pushSrtPanelStatus()
        publishSrtSituation()
      })()
    },
    onSrtDisconnect: () => {
      bumpSrtDisconnect(srtHold)
      lastSrtOpenByPov.clear()
      lastSrtOpenAt.clear()
      lastSrtTranscodeAt.clear()
      lastSrtDecodeError.clear()
      srtTranscodeH264.clear()
      srtStatusByPov.clear()
      restoreSrtUnderlayPlaceholder()
      const bridge = getSrtBridge()
      if (bridge) void bridge.close('all')
      pushSrtPanelStatus()
      publishSrtSituation()
      fleetPanel?.setStatus(
        'SRT disconnected · all callers closed — Connect SRT to resume',
      )
    },
    onSrtEnabledChange: ({ streams }) => {
      void (async () => {
        const gen = srtHold.generation
        const wanted = new Set(streams.map((s) => s.povId))
        const bridge = getSrtBridge()
        for (const povId of [...lastSrtOpenByPov.keys()]) {
          if (wanted.has(povId)) continue
          forgetSrtPov(povId)
          if (bridge) void bridge.close({ povId })
        }
        if (!srtCheckboxOpenAllowed(srtHold) || !srtReopenAllowed(srtHold, gen)) {
          pushSrtPanelStatus()
          publishSrtSituation()
          return
        }
        if (!bridge) {
          pushSrtPanelStatus()
          publishSrtSituation()
          return
        }
        for (const s of streams.slice(0, SRT_WARM_POV_CAP)) {
          if (!srtReopenAllowed(srtHold, gen)) return
          if (lastSrtOpenByPov.has(s.povId)) continue
          lastSrtOpenByPov.set(s.povId, { srtId: s.srtId, url: s.url })
          lastSrtOpenAt.set(s.povId, Date.now())
          const result = await bridge.open({ povId: s.povId, url: s.url })
          if (!srtReopenAllowed(srtHold, gen)) return
          if (!result.ok) {
            lastSrtDecodeError.set(s.povId, result.error)
            console.warn('[srt] open failed', s.povId)
          }
        }
        const all = await bridge.getStatus()
        if (!srtReopenAllowed(srtHold, gen)) return
        srtStatusByPov.clear()
        for (const [id, st] of Object.entries(all)) srtStatusByPov.set(id, st)
        pushSrtPanelStatus()
        publishSrtSituation()
      })()
    },
  })
  // Session / pack visibility → scene; hulls spawn from planned GPS without telem.
  syncBoatVisibilityToScene(fleetPanel.getState().boats)
  syncMapHiddenPoseIds()
  syncFleetMapPosesToAllowList()
  syncFleetHullsFromPanel()
  startSrtSituationWatch()

  /* DIAG:auto-connect — checkboxes then Connect live then Connect SRT. */
  if (!diagAutoConnectIsNoop(diagAutoConnect)) {
    if (diagAutoConnect.livePovIds.length > 0) {
      fleetPanel.setState({ enabledPovIds: diagAutoConnect.livePovIds })
    }
    if (diagAutoConnect.srtPovIds.length > 0) {
      fleetPanel.setState({ enabledSrtPovIds: diagAutoConnect.srtPovIds })
    }
    console.info(
      `[diag:auto-connect] ${JSON.stringify({
        arBackground: arBackgroundMode,
        livePovIds: diagAutoConnect.livePovIds,
        srtPovIds: diagAutoConnect.srtPovIds,
        autoConnectLive: diagAutoConnect.autoConnectLive,
        autoConnectSrt: diagAutoConnect.autoConnectSrt,
      })}`,
    )
    if (diagAutoConnect.autoConnectLive) {
      if (diagAutoConnect.livePovIds.length === 0) {
        console.warn(
          '[diag:auto-connect] autoConnectLive=1 but livePov is empty — not guessing a POV',
        )
      } else {
        fleetPanel.connectLive()
      }
    }
    if (diagAutoConnect.autoConnectSrt) {
      if (diagAutoConnect.srtPovIds.length === 0) {
        console.warn(
          '[diag:auto-connect] autoConnectSrt=1 but srtPov is empty — not guessing a POV',
        )
      } else {
        fleetPanel.connectSrt()
      }
    }
  }

  assetInspector = startAssetInspector({
    container: assetsSectionEl,
    projectsApiBase: config.projectsApiBase,
    getBoats: () => fleetPanel?.getState().boats ?? [],
    getBoatIds: () => fleetPanel?.getState().boatIds ?? boatIds,
    getPovIds: () => fleetPanel?.getState().povIds ?? povIds,
    getFeatures: () => mapEditor?.getFeatures() ?? currentWorldFeatures,
    gpsToEnuAmsl: gpsToEnu,
    getBoatMapVisible: (id) => {
      const row = fleetPanel?.getState().boats.find((b) => b.id === id)
      return row?.mapVisible !== false
    },
    getPovMapVisible: (id) => povMapVisible.get(id) !== false,
    getPovVisible3d: (id) => povVisible3d.get(id) !== false,
    onFocus: focusAssetRow,
    onBoatVisibilityChange: (id, mode) => {
      scene?.setBoatVisibilityMode(id, mode)
      const state = fleetPanel?.getState()
      if (!state) return
      const boats = state.boats.map((b) =>
        b.id === id ? { ...b, visibility: mode } : b,
      )
      // Ensure row exists
      if (!boats.some((b) => b.id === id)) {
        boats.push({
          id,
          name: id,
          category: '',
          visibility: mode,
        })
      }
      fleetPanel?.setState({ boats })
      assetInspector?.refresh()
    },
    onBoatMapVisibleChange: (id, visible) => {
      const state = fleetPanel?.getState()
      if (!state) return
      const boats = state.boats.map((b) =>
        b.id === id
          ? { ...b, mapVisible: visible ? undefined : false }
          : b,
      )
      if (!boats.some((b) => b.id === id)) {
        boats.push({
          id,
          name: id,
          category: '',
          mapVisible: visible ? undefined : false,
        })
      }
      fleetPanel?.setState({ boats })
      syncMapHiddenPoseIds()
      assetInspector?.refresh()
    },
    onPovMapVisibleChange: (id, visible) => {
      if (visible) povMapVisible.delete(id)
      else povMapVisible.set(id, false)
      syncMapHiddenPoseIds()
      assetInspector?.refresh()
    },
    onPovVisible3dChange: (id, visible) => {
      if (visible) povVisible3d.delete(id)
      else povVisible3d.set(id, false)
      assetInspector?.refresh()
    },
    onFeaturePatch: patchWorldFeature,
    onOpenBoatDetails: (id) => {
      fleetPanel?.highlightBoat(id)
    },
    onBoatPlannedGpsChange: (id, plannedLat, plannedLon) => {
      fleetPanel?.setBoatPlannedGps(id, plannedLat, plannedLon)
      assetInspector?.refresh()
    },
  })

  // Boot live uses enabled lists (often empty until Connect); mock/replay use registry.
  const bootLive = config.telemetryMode === 'live'
  ingest = await startTelemetryIngest({
    mode: config.telemetryMode,
    replayUrl: config.replayUrl,
    boatIds: bootLive ? liveBoatIds : boatIds,
    povIds: bootLive ? livePovIds : povIds,
    wsUrl,
    wsBoatUrl,
  })
  startOpenMeteoWind({ origin: config.origin })
  posePipeline = startPosePipeline({
    takeoffAltitudeMSL: config.takeoffAltitudeMSL,
    history: telemetryHistory,
    matchClock: {
      enabled: () => arBackgroundMode === 'video',
      getActivePovId: () => scene?.getActivePovId() ?? null,
      getLutStreamId: lutStreamIdForPov,
      getPresentedPts90k: (povId) =>
        videoStreamManager?.getCounters(povId)?.presentedPts90k ?? null,
      getSyncTrimMs: (povId) => getOffsets(povId).syncTrimMs,
      hasPicture: (povId) =>
        (videoStreamManager?.getCounters(povId)?.framesDecoded ?? 0) > 0,
      getSrtIdForTelemId: srtIdForTelemId,
      getTelemIdForSrtId: telemIdForSrtId,
    },
  })
  applyIngestConnectionStatus(ingest)
  hud.setMode(config.telemetryMode)

  window.addEventListener('beforeunload', () => {
    stopPosePipeline()
    posePipeline = null
    clearLiveStatusSub()
    if (srtSituationTimer != null) {
      clearInterval(srtSituationTimer)
      srtSituationTimer = null
    }
    const srtBridge = getSrtBridge()
    if (srtBridge) void srtBridge.close('all')
    ingest?.stop()
    stopOpenMeteoWind()
    ndiController?.dispose()
    ndiController = null
    syncDebugPanel?.dispose()
    syncDebugPanel = null
    flowPanel?.dispose()
    flowPanel = null
    ndiPump?.stop()
    ndiPump = null
    streamMapNdiPump?.stop()
    streamMapNdiPump = null
    ndi3dPump?.stop()
    ndi3dPump = null
    previewClock?.stop()
    previewClock = null
    visualTimecode?.stop()
    visualTimecode = null
    videoStreamManager?.dispose()
    videoStreamManager = null
    videoBackground?.stop()
    videoBackground = null
    videoBackgroundTestPattern?.dispose()
    videoBackgroundTestPattern = null
    whepUnderlay?.stop()
    whepUnderlay = null
    calib?.stop()
    calib = null
    arBackgroundControl?.stop()
    arBackgroundControl = null
    outputControl?.stop()
    outputControl = null
    localChannelSwitcher?.stop()
    localChannelSwitcher = null
    mapEditor?.dispose()
    mapEditor = null
    worldAuthoring?.dispose()
    worldAuthoring = null
    fleetPanel?.stop()
    fleetPanel = null
    hud.stop()
    terrainAttrib.dispose()
    opsSidebar.dispose()
    scene?.stop()
  })
})()
