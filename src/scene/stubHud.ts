import type { AppConfig, ConfigOrigin } from '../config/types.ts'
import { parseConfigOriginFields, eastNorthFromScene } from '../geodesy/index.ts'
import { poseBus, type PoseEvent } from '../pose/index.ts'
import {
  mountLocalProjectControls,
  type LocalProjectControlsHandle,
} from '../projects/localProjectControls.ts'
import {
  mountWindOpsRow,
  telemetryBus,
  type LiveIdSocketStatus,
  type LiveWsStatus,
} from '../telemetry/index.ts'
import { formatBoatEnuStatus } from './fleetRegistry.ts'
import type { LayoutFeature } from './features/types.ts'
import {
  DEFAULT_OPS_VIEW_MODE,
  formatOpsViewStatus,
  isOpsViewMode,
  type OpsViewMode,
} from './freeCam.ts'
import {
  DEFAULT_ENVIRONMENT_MODE,
  DEFAULT_SEA_QUALITY,
  isEnvironmentMode,
  isSeaQuality,
  normalizeEnvironmentMode,
  normalizeSeaQuality,
  type EnvironmentMode,
  type SeaQuality,
} from './environment/index.ts'
import {
  SEA_HEIGHT_Y_DEFAULT,
  SEA_HEIGHT_Y_MAX,
  SEA_HEIGHT_Y_MIN,
  clampSeaHeightYM,
} from './waterPlanePlacement.ts'
import {
  DEFAULT_TERRAIN_ENABLED,
  DEFAULT_TERRAIN_OVERLAY,
  DEFAULT_TERRAIN_WATER_DISCARD_Y,
  TERRAIN_SESSION_LOCK_KEY,
  TERRAIN_SESSION_NUDGE_KEY,
  isTerrainOverlayKind,
  normalizeTerrainOverlay,
  readSessionTerrainOverlay,
  writeSessionTerrainOverlay,
  type TerrainOverlayKind,
} from './terrain/index.ts'
import {
  DEFAULT_BUILDINGS_ENABLED,
  readSessionBuildingsEnabled,
  writeSessionBuildingsEnabled,
} from './buildings/index.ts'
import {
  DEFAULT_HEROES_ENABLED,
  readSessionHeroesEnabled,
  writeSessionHeroesEnabled,
} from './landmarks/index.ts'
import { createMap2d, type Map2dHandle } from './map2d.ts'
import { formatPovStatus, resolvePovIdList } from './povSwitcher.ts'
import { createStreamMap2d } from './streamMap.ts'
import {
  mountCinematicsOps,
  type CinematicsOpsHandle,
  type CinematicTransport,
  type WarmTilesStatus,
} from './cinematics/index.ts'
import {
  clampStreamBoatIconScale,
  STREAM_BOAT_ICON_SCALE_MAX,
  STREAM_BOAT_ICON_SCALE_MIN,
  STREAM_BOAT_ICON_SCALE_STEP,
} from './mapChrome.ts'

export type TelemetryModeUi = AppConfig['telemetryMode']

/** Modes that can switch ingest at runtime (mock | replay | live). */
export type TelemetryModeSwitchable = TelemetryModeUi

/** Per-channel live WS statuses for the ops HUD. */
export type HudLiveChannelStatus = {
  drone: LiveWsStatus
  boat: LiveWsStatus
  /** Per-id drone sockets (optional; compact HUD when present). */
  droneIds?: readonly LiveIdSocketStatus[]
  /** Per-id boat sockets (optional). */
  boatIds?: readonly LiveIdSocketStatus[]
}

/**
 * Connection line for the stub HUD.
 * - `non_live`: mock/replay — never fake open sockets
 * - `live`: surface real drone/boat WS state from TEL
 */
export type ConnectionStatusUi =
  | { kind: 'non_live'; mode: 'mock' | 'replay' }
  | { kind: 'live'; channels: HudLiveChannelStatus }

function fmtPktAge(ageMs: number | null): string {
  if (ageMs === null) return 'nopkt'
  if (ageMs < 1000) return `${Math.round(ageMs)}ms`
  return `${(ageMs / 1000).toFixed(1)}s`
}

/** Compact per-id token: `d1=open/120ms` or `b40=open/nopkt`. */
function formatIdSocket(prefix: 'd' | 'b', s: LiveIdSocketStatus): string {
  const id = s.id !== '' ? s.id : '?'
  if (s.status === 'retrying') {
    const delay =
      s.retryInMs === undefined || s.retryInMs === null
        ? '?'
        : fmtPktAge(s.retryInMs)
    return `${prefix}${id}=retrying/${delay}`
  }
  return `${prefix}${id}=${s.status}/${fmtPktAge(s.lastPacketAgeMs)}`
}

function formatChannelCompact(
  label: 'drone' | 'boat',
  aggregate: LiveWsStatus,
  ids: readonly LiveIdSocketStatus[] | undefined,
): string {
  if (!ids || ids.length === 0) return `${label}=${aggregate}`
  const prefix = label === 'drone' ? 'd' : 'b'
  if (ids.length <= 3) {
    return ids.map((s) => formatIdSocket(prefix, s)).join(' ')
  }
  const withPkt = ids.filter((s) => s.lastPacketAgeMs !== null).length
  return `${label}=${aggregate}/${ids.length}id·${withPkt}pkt`
}

/**
 * Optional hosts when mounting into the unified ops sidebar (Phase 11.1).
 * When omitted, HUD builds a legacy freestanding `.ops-overlay` under `container`.
 */
export type StubHudMountHosts = {
  /** Race Load/Save/Pack + world-anchor origin. */
  project: HTMLElement
  /** Leftover race-ops rows: telemetry / POV / view / countdown / status. */
  ops: HTMLElement
  /** Environment + terrain + ion token (right rail). Falls back to `ops`. */
  environment?: HTMLElement
  /** Wind from-deg / hold row (right rail). Falls back to `ops`. */
  wind?: HTMLElement
  /** Cinematics transport (right rail). Omitted → no row (legacy HUD). */
  cinematics?: HTMLElement
  /** Ops 2D map root. */
  map: HTMLElement
  /** Stream / on-air map host (off-screen for 2D NDI; local 2D CSS-hosts it). */
  streamMapHost: HTMLElement
}

/** Clamp Environment water-discard threshold (m AMSL). Range −20…+5, default 0.5. */
export const TERRAIN_WATER_DISCARD_Y_MIN = -20
export const TERRAIN_WATER_DISCARD_Y_MAX = 5

export function clampTerrainWaterDiscardYM(yM: number): number {
  if (!Number.isFinite(yM)) return DEFAULT_TERRAIN_WATER_DISCARD_Y
  return Math.min(
    TERRAIN_WATER_DISCARD_Y_MAX,
    Math.max(TERRAIN_WATER_DISCARD_Y_MIN, yM),
  )
}

/** Boat-size strip under local 2D (hidden unless `html.local-focus-2d`). */
function mountStreamBoatSizeSlider(
  host: HTMLElement,
  streamMap: Map2dHandle,
): HTMLElement {
  const strip = document.createElement('div')
  strip.className = 'stream-map-boat-scale'
  strip.setAttribute('data-ops', 'stream-boat-scale')

  const label = document.createElement('label')
  label.className = 'stream-map-boat-scale__label'
  label.textContent = 'Boat size'

  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(STREAM_BOAT_ICON_SCALE_MIN)
  input.max = String(STREAM_BOAT_ICON_SCALE_MAX)
  input.step = String(STREAM_BOAT_ICON_SCALE_STEP)
  input.value = String(streamMap.getBoatIconScale())
  input.setAttribute('aria-label', 'Boat size')
  input.className = 'stream-map-boat-scale__range'

  const value = document.createElement('span')
  value.className = 'stream-map-boat-scale__value'
  value.textContent = input.value

  const sync = (raw: string) => {
    const scale = clampStreamBoatIconScale(Number(raw))
    streamMap.setBoatIconScale(scale)
    input.value = String(scale)
    value.textContent = String(scale)
  }

  input.addEventListener('input', () => {
    sync(input.value)
  })

  strip.append(label, input, value)
  host.appendChild(strip)
  return strip
}

export {
  SEA_HEIGHT_Y_DEFAULT,
  SEA_HEIGHT_Y_MAX,
  SEA_HEIGHT_Y_MIN,
  clampSeaHeightYM,
}

export type StubHudOptions = {
  container: HTMLElement
  /**
   * Sidebar section hosts. Splits Project / Ops / Map DOM without changing
   * handle/callback contracts. Stream map stays on `streamMapHost` (off-screen
   * for NDI; local 2D focus CSS-hosts the same element).
   */
  hosts?: StubHudMountHosts
  initialMode?: TelemetryModeUi
  /** Invoked for mock | replay | live; caller restarts TEL ingest. */
  onModeChange?: (mode: TelemetryModeSwitchable) => void
  /**
   * Initial POV allow-list (from `loadConfig().povIds` after boot).
   * May be empty until `setPovIds` after config loads.
   */
  povIds?: readonly string[]
  /**
   * Initial boat allow-list for ops/stream map pose icons.
   * Until `setBoatIds` runs, boat poses are still accepted (boot gap).
   */
  boatIds?: readonly string[]
  /**
   * Live poseBus boat (not planned seed). 2D program cam centroid / follow.
   */
  onLiveBoatPose?: (id: string, east: number, north: number) => void
  /** Invoked when ops picks a POV id in the HUD select. */
  onPovChange?: (povId: string) => void
  /**
   * Ops preview: free orbit vs follow active POV.
   * Free cam does not change air / active POV selection.
   */
  onOpsViewChange?: (mode: OpsViewMode) => void
  /** Initial ops view mode (default `follow`). */
  opsViewMode?: OpsViewMode
  /** Scene sea/sky dressing (`simple` | `realistic`). Temporary Ops control
   * until the Phase 13.5 channel switcher owns it.
   */
  onEnvironmentModeChange?: (mode: EnvironmentMode) => void
  /** Initial environment mode (default `simple`). */
  environmentMode?: EnvironmentMode
  /** Gerstner sea LOD (`high` | `low`). */
  onSeaQualityChange?: (quality: SeaQuality) => void
  seaQuality?: SeaQuality
  /** Cesium ion terrain (default off). */
  onTerrainEnabledChange?: (enabled: boolean) => void
  terrainEnabled?: boolean
  /** Cesium OSM Buildings (default on). Independent of terrain on/off. */
  onBuildingsEnabledChange?: (enabled: boolean) => void
  buildingsEnabled?: boolean
  /** Hero landmarks (default on). Independent of buildings on/off. */
  onHeroesEnabledChange?: (enabled: boolean) => void
  heroesEnabled?: boolean
  onTerrainAltitudeNudgeChange?: (nudgeM: number) => void
  terrainAltitudeNudgeM?: number
  onTerrainTilesLockedChange?: (locked: boolean) => void
  terrainTilesLocked?: boolean
  /**
   * Terrain map overlay (`road` | `aerial`). Default **aerial** (Bing Aerial ion 2).
   * Session `bw.terrain.overlay`. Switching remounts terrain, not OSM Buildings.
   * Leftover `bw.terrain.imageryLook` is ignored.
   */
  onTerrainOverlayChange?: (kind: TerrainOverlayKind) => void
  terrainOverlay?: TerrainOverlayKind
  /** Height-fallback AMSL (m) for hiding Cesium water. Default 0.5. */
  onTerrainWaterDiscardYChange?: (yM: number) => void
  terrainWaterDiscardYM?: number
  /**
   * Environment **sea m** (−20…+20, default 0). Moves Gerstner rest Y.
   * Separate from Cesium hide.
   */
  onSeaHeightYChange?: (yM: number) => void
  seaHeightYM?: number
  /** Initial status line (token missing, etc.). */
  terrainStatus?: string
  /**
   * Ion access token already resolved at boot (config / session / env).
   * Shown in the Ops password field; Apply remounts terrain.
   */
  cesiumIonToken?: string
  /** Persist + remount terrain. Empty string clears the token. */
  onCesiumIonTokenApply?: (token: string) => void
  /** Countdown flag controls (Phase 2.6). */
  onCountdownControl?: (
    action: 'start' | 'pause' | 'reset' | 'restart',
  ) => void
  /**
   * Start with World Authoring open (`?editor=1` or editor-role default).
   * Ops checkbox mirrors workspace open/close; notifies `onEditorToggle`.
   */
  editorInitiallyOpen?: boolean
  /** Invoked when ops toggles the authoring mirror checkbox (same state as workspace). */
  onEditorToggle?: (open: boolean) => void
  /**
   * Local RaceProject pack ids for the race picker (Phase 6.2).
   * Always includes at least `demo-istanbul` after boot fills from manifest.
   */
  raceIds?: readonly string[]
  /** Active / last-loaded pack id (select + custom field). */
  activeRaceId?: string
  /** Load a local pack by id (manifest pick or typed). */
  onRaceLoad?: (raceId: string) => void
  /**
   * Save = overwrite current pack id.
   * Electron folder mode → races folder; Chrome → download (+ optional API).
   */
  onSaveProject?: () => void
  /**
   * Save as = prompt for new id + name.
   * Electron folder mode → races folder; Chrome → download (+ optional API).
   */
  onSaveAsProject?: () => void
  /**
   * Download `project.json` only (Export… in Electron; unused in Chrome where
   * Save already downloads).
   */
  onExportProject?: () => void
  /** Download offline venue pack (project + linked fixtures/assets). */
  onDownloadVenuePack?: () => void
  /** Load a previously downloaded `*-venue-pack.json` file. */
  onLoadVenuePackFile?: (file: File) => void
  /**
   * When false (air-only LAN role), Save / Save as are disabled.
   * Default true (editor).
   */
  projectWritesEnabled?: boolean
  /**
   * Electron `broadcastStudio.races` present → folder Save + Load-on-change.
   * Chrome → download Save; no pretend folder write.
   */
  localRacesFolder?: boolean
  /** Initial display name for the active pack. */
  projectName?: string
  /**
   * Initial world anchor (WGS84 lat/lon + altMsl).
   * Usually empty until boot fills via `setOrigin` after config/deeplink.
   */
  initialOrigin?: ConfigOrigin
  /** Apply edited world anchor → GEO origin + ENU remount (caller). */
  onOriginApply?: (origin: ConfigOrigin) => void
  /** Cinematic sequence selected (url from catalogue). Empty id = Off. */
  onCinematicSequenceChange?: (id: string, url: string) => void
  onCinematicPlay?: () => void
  onCinematicPause?: () => void
  onCinematicSeek?: (tSec: number) => void
  onCinematicStop?: () => void
  onCinematicDumpWarmUrls?: () => void
  onCinematicRecord?: () => void
}

export type StubHudHandle = {
  /** Set mode control + status label (does not change TEL ingest). */
  setMode: (mode: TelemetryModeUi) => void
  setBootMessage: (msg: string) => void
  /** Replace POV select options; keeps active if still listed. */
  setPovIds: (povIds: readonly string[], activePovId?: string) => void
  /**
   * Boat ids allowed on ops/stream map icons (and HUD boat ENU line).
   * After the first call, boat poses outside the list are ignored by the maps.
   */
  setBoatIds: (boatIds: readonly string[]) => void
  /** Sync active POV label without firing `onPovChange`. */
  setActivePovId: (povId: string) => void
  /** Sync ops view select without firing `onOpsViewChange`. */
  setOpsViewMode: (mode: OpsViewMode) => void
  /** Sync environment select without firing `onEnvironmentModeChange`. */
  setEnvironmentMode: (mode: EnvironmentMode) => void
  setSeaQuality: (quality: SeaQuality) => void
  setTerrainEnabled: (enabled: boolean) => void
  setBuildingsEnabled: (enabled: boolean) => void
  getBuildingsEnabled: () => boolean
  setHeroesEnabled: (enabled: boolean) => void
  getHeroesEnabled: () => boolean
  setTerrainAltitudeNudgeM: (nudgeM: number) => void
  setTerrainTilesLocked: (locked: boolean) => void
  setTerrainOverlay: (kind: TerrainOverlayKind) => void
  getTerrainOverlay: () => TerrainOverlayKind
  setTerrainWaterDiscardYM: (yM: number) => void
  setSeaHeightYM: (yM: number) => void
  setTerrainStatus: (msg: string) => void
  /** Smoothed on-screen WebGL preview fps (1 s window). */
  setPreviewFps: (fps: number) => void
  /** WebGL unmasked renderer short string (`GPU · NVIDIA …` / `GPU · unknown`). */
  setGpuLabel: (label: string) => void
  /** Preview hitch counts in the same 1 s window (does not replace average fps). */
  setHitchCounts: (counts: { over33: number; over50: number }) => void
  /** Fill the Ops ion token field (does not Apply). */
  setCesiumIonToken: (token: string) => void
  /** Live SRT caller / decode (ops-only). Never include raw tokens. */
  setSrtSituation: (text: string) => void
  getTerrainAltitudeNudgeM: () => number
  getTerrainTilesLocked: () => boolean
  getTerrainWaterDiscardYM: () => number
  getSeaHeightYM: () => number
  /** Static course mark dots on the 2D map (ENU east/north). Legacy. */
  setCourseMarks: (
    marks: readonly { name: string; x: number; z: number }[],
  ) => void
  /** Shared ENU world features for ops + stream 2D maps. */
  setLayoutFeatures: (features: readonly LayoutFeature[]) => void
  /** Ops 2D map handle (editor attaches click tools). */
  getMap: () => Map2dHandle
  /** Stream / on-air 2D map (off-screen canvas; local 2D host). */
  getStreamMap: () => Map2dHandle
  /** Show/hide the stream map root (no ops checkbox — PiP card removed). */
  setStreamMapVisible: (visible: boolean) => void
  /** Sync authoring mirror checkbox without notifying (or with notify=true). */
  setEditorOpen: (open: boolean, notify?: boolean) => void
  /** Telemetry WS / non-live connection line (Phase 3.4). */
  setConnectionStatus: (status: ConnectionStatusUi) => void
  /** Replace race picker options; optionally set active id. */
  setRaceIds: (raceIds: readonly string[], activeRaceId?: string) => void
  /** Sync active race id in select + custom field (no load). */
  setActiveRaceId: (raceId: string) => void
  /** Show active pack name + id in the Project section. */
  setProjectMeta: (id: string, name: string) => void
  /** Electron races root path hint (`saving to: …`). */
  setRacesRootHint: (path: string | null) => void
  /** Last Save/Load action under the controls (`loading`/`loaded`, `saving`/`saved`, or error). */
  setSaveStatus: (msg: string) => void
  /** Sync world-anchor fields (boot / race switch / after Apply). */
  setOrigin: (origin: ConfigOrigin) => void
  /** Enable/disable Save + Save as (air-only → false). */
  setProjectWritesEnabled: (enabled: boolean) => void
  /** Cinematic transport readout / scrub (authoring). */
  setCinematicTransport: (transport: CinematicTransport) => void
  setCinematicWarmStatus: (status: WarmTilesStatus) => void
  setCinematicRecordStatus: (msg: string) => void
  setCinematicRecordBusy: (busy: boolean) => void
  /**
   * Hide 2D maps while a cinematic is active (race chrome). Sidebar stays.
   */
  setCinematicChromeHidden: (hidden: boolean) => void
  stop: () => void
}

function fmtEnu(p: { x: number; y: number; z: number }): string {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`
}

function modeHintText(mode: TelemetryModeUi): string {
  if (mode === 'live') return 'live WS'
  if (mode === 'replay') return 'fixture replay'
  return 'mock source'
}

/** Compact connection status for the HUD status block. */
export function formatConnectionStatus(status: ConnectionStatusUi): string {
  if (status.kind === 'non_live') {
    return `ws=n/a (${status.mode})`
  }
  const { drone, boat, droneIds, boatIds } = status.channels
  const d = formatChannelCompact('drone', drone, droneIds)
  const b = formatChannelCompact('boat', boat, boatIds)
  return `ws ${d} ${b}`
}

/** Hitch row: `2 / 1s (>50ms)` or `0`. Average preview fps stays on the row above. */
export function formatHitchLabel(over50: number): string {
  const n50 = Number.isFinite(over50) ? Math.max(0, Math.floor(over50)) : 0
  if (n50 <= 0) return '0'
  return `${n50} / 1s (>50ms)`
}

/**
 * Ops overlay: stub HUD (mode + POV + TEL counts + last ENU) and 2D fleet map.
 * Positions from poseBus only. Mode select restarts ingest via `onModeChange`.
 * With `hosts`, Project / Ops / Map mount into sidebar sections (11.1).
 */
export function startStubHud(options: StubHudOptions): StubHudHandle {
  const initialMode = options.initialMode ?? 'mock'
  let povIds = resolvePovIdList(options.povIds)
  let activePovId = povIds[0] ?? '1'
  /** null = boot gap (accept all boat poses until first `setBoatIds`). */
  let boatIds: string[] | null =
    options.boatIds !== undefined
      ? [...options.boatIds].map((id) => id.trim()).filter((id) => id !== '')
      : null
  const hosts = options.hosts

  /** Legacy freestanding overlay; unused when sidebar hosts are provided. */
  let legacyRoot: HTMLElement | null = null
  const disposableRoots: HTMLElement[] = []

  const opsHud = document.createElement('div')
  opsHud.className = 'ops-hud ops-hud--ops'

  let projectHud: HTMLElement
  if (hosts) {
    projectHud = document.createElement('div')
    projectHud.className = 'ops-hud ops-hud--project'
    hosts.project.appendChild(projectHud)
    hosts.ops.appendChild(opsHud)
    disposableRoots.push(projectHud, opsHud)
  } else {
    // Legacy: one HUD stack under `.ops-overlay` (original order preserved).
    projectHud = opsHud
    legacyRoot = document.createElement('div')
    legacyRoot.className = 'ops-overlay'
    options.container.appendChild(legacyRoot)
    legacyRoot.appendChild(opsHud)
    disposableRoots.push(legacyRoot)
  }

  let envHud: HTMLElement
  if (hosts?.environment) {
    envHud = document.createElement('div')
    envHud.className = 'ops-hud ops-hud--environment'
    hosts.environment.appendChild(envHud)
    disposableRoots.push(envHud)
  } else {
    envHud = opsHud
  }

  const windHost = hosts?.wind ?? opsHud
  const cinematicsOps: CinematicsOpsHandle | null = hosts?.cinematics
    ? mountCinematicsOps(hosts.cinematics, {
        onSequenceChange: options.onCinematicSequenceChange,
        onPlay: options.onCinematicPlay,
        onPause: options.onCinematicPause,
        onSeek: options.onCinematicSeek,
        onStop: options.onCinematicStop,
        onDumpWarmUrls: options.onCinematicDumpWarmUrls,
        onRecord: options.onCinematicRecord,
      })
    : null

  const modeRow = document.createElement('div')
  modeRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(modeRow)

  const modeLabel = document.createElement('label')
  modeLabel.className = 'ops-hud__mode-label'
  modeLabel.htmlFor = 'ops-telemetry-mode'
  modeLabel.textContent = 'telemetry'
  modeRow.appendChild(modeLabel)

  const modeSelect = document.createElement('select')
  modeSelect.id = 'ops-telemetry-mode'
  modeSelect.className = 'ops-hud__mode-select'
  modeSelect.title = 'mock | replay | live — switches ingest (live needs wsUrl)'
  for (const m of ['mock', 'replay', 'live'] as const) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = m
    modeSelect.appendChild(opt)
  }
  modeSelect.value = initialMode
  modeRow.appendChild(modeSelect)

  const modeHint = document.createElement('span')
  modeHint.className = 'ops-hud__mode-hint'
  modeHint.textContent = modeHintText(initialMode)
  modeRow.appendChild(modeHint)

  const povRow = document.createElement('div')
  povRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(povRow)

  const povLabel = document.createElement('label')
  povLabel.className = 'ops-hud__mode-label'
  povLabel.htmlFor = 'ops-pov-id'
  povLabel.textContent = 'pov'
  povRow.appendChild(povLabel)

  const povSelect = document.createElement('select')
  povSelect.id = 'ops-pov-id'
  povSelect.className = 'ops-hud__mode-select'
  povSelect.title =
    'Active air POV (drone/cam id). Free cam preview does not change this.'
  povRow.appendChild(povSelect)

  const povHint = document.createElement('span')
  povHint.className = 'ops-hud__mode-hint'
  povHint.textContent = 'digit keys 1–4'
  povRow.appendChild(povHint)

  const viewRow = document.createElement('div')
  viewRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(viewRow)

  const viewLabel = document.createElement('label')
  viewLabel.className = 'ops-hud__mode-label'
  viewLabel.htmlFor = 'ops-view-mode'
  viewLabel.textContent = 'view'
  viewRow.appendChild(viewLabel)

  const viewSelect = document.createElement('select')
  viewSelect.id = 'ops-view-mode'
  viewSelect.className = 'ops-hud__mode-select'
  viewSelect.title =
    'Ops preview: Free cam pans the world (WASD, left-drag); Follow uses active POV. Air/NDI stays on active POV.'
  for (const [value, label] of [
    ['follow', 'Follow active POV'],
    ['free', 'Free cam'],
  ] as const) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    viewSelect.appendChild(opt)
  }
  let opsViewMode: OpsViewMode = options.opsViewMode ?? DEFAULT_OPS_VIEW_MODE
  viewSelect.value = opsViewMode
  viewRow.appendChild(viewSelect)

  const viewHint = document.createElement('span')
  viewHint.className = 'ops-hud__mode-hint'
  viewHint.textContent = 'WASD · left pan · right orbit'
  viewRow.appendChild(viewHint)

  const fpsRow = document.createElement('div')
  fpsRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(fpsRow)

  const fpsLabel = document.createElement('span')
  fpsLabel.className = 'ops-hud__mode-label'
  fpsLabel.textContent = 'preview'
  fpsRow.appendChild(fpsLabel)

  const fpsHint = document.createElement('span')
  fpsHint.className = 'ops-hud__mode-hint'
  fpsHint.setAttribute('data-ops', 'preview-fps')
  fpsHint.title =
    'On-screen WebGL present rate (rAF when visible). NDI AR ~30 / 3D ~10 stay on studio tick.'
  fpsHint.textContent = '— fps'
  fpsRow.appendChild(fpsHint)

  const gpuHint = document.createElement('span')
  gpuHint.className = 'ops-hud__mode-hint'
  gpuHint.setAttribute('data-ops', 'gpu-renderer')
  gpuHint.title =
    'WebGL unmasked renderer (WEBGL_debug_renderer_info). Intel here on a NVIDIA/AMD machine means the iGPU.'
  gpuHint.textContent = 'GPU · —'
  fpsRow.appendChild(gpuHint)

  const hitchRow = document.createElement('div')
  hitchRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(hitchRow)

  const hitchLabel = document.createElement('span')
  hitchLabel.className = 'ops-hud__mode-label'
  hitchLabel.textContent = 'hitch'
  hitchRow.appendChild(hitchLabel)

  const hitchHint = document.createElement('span')
  hitchHint.className = 'ops-hud__mode-hint'
  hitchHint.setAttribute('data-ops', 'preview-hitch')
  hitchHint.title =
    'Preview frames with dt > 50 ms in the last 1 s (tile compile hitch-then-recover). Average fps is the row above.'
  hitchHint.textContent = '0'
  hitchRow.appendChild(hitchHint)

  const countdownRow = document.createElement('div')
  countdownRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(countdownRow)

  const countdownLabel = document.createElement('span')
  countdownLabel.className = 'ops-hud__mode-label'
  countdownLabel.textContent = 'countdown'
  countdownRow.appendChild(countdownLabel)

  for (const action of ['start', 'pause', 'reset', 'restart'] as const) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ops-hud__btn'
    btn.textContent = action
    btn.title = `Countdown ${action}`
    btn.addEventListener('click', () => {
      options.onCountdownControl?.(action)
    })
    countdownRow.appendChild(btn)
  }

  const editorRow = document.createElement('div')
  editorRow.className = 'ops-hud__mode-row'
  opsHud.appendChild(editorRow)

  const editorLabel = document.createElement('label')
  editorLabel.className = 'ops-hud__mode-label'
  editorLabel.htmlFor = 'ops-world-authoring'
  editorLabel.textContent = 'authoring'
  editorRow.appendChild(editorLabel)

  const editorCheck = document.createElement('input')
  editorCheck.id = 'ops-world-authoring'
  editorCheck.type = 'checkbox'
  editorCheck.className = 'ops-hud__checkbox'
  editorCheck.title =
    'Mirror of World Authoring workspace (primary control: Race setup header World toggle)'
  editorCheck.checked = options.editorInitiallyOpen ?? false
  editorRow.appendChild(editorCheck)

  const editorHint = document.createElement('span')
  editorHint.className = 'ops-hud__mode-hint'
  editorHint.textContent = 'header'
  editorRow.appendChild(editorHint)

  const envRow = document.createElement('div')
  envRow.className = 'ops-hud__mode-row'
  envHud.appendChild(envRow)

  const envLabel = document.createElement('label')
  envLabel.className = 'ops-hud__mode-label'
  envLabel.htmlFor = 'ops-environment-mode'
  envLabel.textContent = 'environment'
  envRow.appendChild(envLabel)

  const envSelect = document.createElement('select')
  envSelect.id = 'ops-environment-mode'
  envSelect.className = 'ops-hud__mode-select'
  envSelect.title =
    'simple = clear + waterCue pad; realistic = sea+sky model (preview/opaque only — forced off for transparent/chroma AR)'
  for (const m of ['simple', 'realistic'] as const) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = m
    envSelect.appendChild(opt)
  }
  let environmentMode: EnvironmentMode = normalizeEnvironmentMode(
    options.environmentMode ?? DEFAULT_ENVIRONMENT_MODE,
  )
  envSelect.value = environmentMode
  envRow.appendChild(envSelect)

  const seaLabel = document.createElement('label')
  seaLabel.className = 'ops-hud__mode-label'
  seaLabel.htmlFor = 'ops-sea-quality'
  seaLabel.textContent = 'sea'
  envRow.appendChild(seaLabel)

  const seaSelect = document.createElement('select')
  seaSelect.id = 'ops-sea-quality'
  seaSelect.className = 'ops-hud__mode-select'
  seaSelect.title =
    'high = 7-ring clipmap + half-res foam (rim past fog); low = 5 rings + quarter-res foam (`?sea=low`)'
  for (const q of ['high', 'low'] as const) {
    const opt = document.createElement('option')
    opt.value = q
    opt.textContent = q
    seaSelect.appendChild(opt)
  }
  let seaQuality: SeaQuality = normalizeSeaQuality(
    options.seaQuality ?? DEFAULT_SEA_QUALITY,
  )
  seaSelect.value = seaQuality
  envRow.appendChild(seaSelect)

  const envHint = document.createElement('span')
  envHint.className = 'ops-hud__mode-hint'
  envHint.textContent =
    environmentMode === 'realistic' ? '3D dress · AR-gated' : 'AR-safe'
  envRow.appendChild(envHint)

  const terrainRow = document.createElement('div')
  terrainRow.className = 'ops-hud__mode-row'
  envHud.appendChild(terrainRow)

  const terrainLabel = document.createElement('label')
  terrainLabel.className = 'ops-hud__mode-label'
  terrainLabel.htmlFor = 'ops-terrain-mode'
  terrainLabel.textContent = 'terrain'
  terrainRow.appendChild(terrainLabel)

  const terrainSelect = document.createElement('select')
  terrainSelect.id = 'ops-terrain-mode'
  terrainSelect.className = 'ops-hud__mode-select'
  terrainSelect.title =
    'Cesium ion World Terrain. Default on. Opaque/3D only — forced off for transparent/chroma AR. Needs an ion token (Ops field or public/config.json).'
  for (const m of ['off', 'on'] as const) {
    const opt = document.createElement('option')
    opt.value = m
    opt.textContent = m
    terrainSelect.appendChild(opt)
  }
  let terrainEnabled = options.terrainEnabled ?? DEFAULT_TERRAIN_ENABLED
  terrainSelect.value = terrainEnabled ? 'on' : 'off'
  terrainRow.appendChild(terrainSelect)

  const overlayLabel = document.createElement('label')
  overlayLabel.className = 'ops-hud__mode-label'
  overlayLabel.htmlFor = 'ops-terrain-overlay'
  overlayLabel.textContent = 'map'
  terrainRow.appendChild(overlayLabel)

  const overlaySelect = document.createElement('select')
  overlaySelect.id = 'ops-terrain-overlay'
  overlaySelect.className = 'ops-hud__mode-select'
  overlaySelect.title =
    'World Terrain overlay. aerial = Bing Aerial (ion 2) satellite (default); road = Bing Maps Road (ion 4) streets/labels on hills. Switching remounts terrain tiles, not OSM Buildings.'
  for (const kind of ['road', 'aerial'] as const) {
    const opt = document.createElement('option')
    opt.value = kind
    opt.textContent = kind
    overlaySelect.appendChild(opt)
  }
  let terrainOverlay: TerrainOverlayKind =
    options.terrainOverlay !== undefined
      ? normalizeTerrainOverlay(options.terrainOverlay)
      : DEFAULT_TERRAIN_OVERLAY
  try {
    if (options.terrainOverlay === undefined) {
      terrainOverlay = readSessionTerrainOverlay(DEFAULT_TERRAIN_OVERLAY)
    }
  } catch {
    // sessionStorage may be blocked
  }
  overlaySelect.value = terrainOverlay
  terrainRow.appendChild(overlaySelect)

  const lockTilesLabel = document.createElement('label')
  lockTilesLabel.className = 'ops-hud__mode-label'
  lockTilesLabel.htmlFor = 'ops-terrain-lock-tiles'
  lockTilesLabel.textContent = 'lock tiles'
  terrainRow.appendChild(lockTilesLabel)

  const lockTilesCheck = document.createElement('input')
  lockTilesCheck.id = 'ops-terrain-lock-tiles'
  lockTilesCheck.type = 'checkbox'
  lockTilesCheck.className = 'ops-hud__checkbox'
  lockTilesCheck.title =
    'Freeze terrain and OSM Buildings LOD once the shot is framed (broadcast air mode).'
  let terrainTilesLocked = options.terrainTilesLocked === true
  try {
    if (options.terrainTilesLocked === undefined) {
      terrainTilesLocked = sessionStorage.getItem(TERRAIN_SESSION_LOCK_KEY) === '1'
    }
  } catch {
    // sessionStorage may be blocked
  }
  lockTilesCheck.checked = terrainTilesLocked
  terrainRow.appendChild(lockTilesCheck)

  const buildingsLabel = document.createElement('label')
  buildingsLabel.className = 'ops-hud__mode-label'
  buildingsLabel.htmlFor = 'ops-buildings-enabled'
  buildingsLabel.textContent = 'buildings'
  terrainRow.appendChild(buildingsLabel)

  const buildingsCheck = document.createElement('input')
  buildingsCheck.id = 'ops-buildings-enabled'
  buildingsCheck.type = 'checkbox'
  buildingsCheck.className = 'ops-hud__checkbox'
  buildingsCheck.title =
    'Cesium OSM Buildings (ion 96188). City massing, 3D/opaque only — forced off for transparent/chroma AR. Needs an ion token (Ops field or public/config.json). Independent of terrain on/off.'
  let buildingsEnabled =
    options.buildingsEnabled !== undefined
      ? options.buildingsEnabled === true
      : DEFAULT_BUILDINGS_ENABLED
  try {
    if (options.buildingsEnabled === undefined) {
      buildingsEnabled = readSessionBuildingsEnabled(DEFAULT_BUILDINGS_ENABLED)
    }
  } catch {
    // sessionStorage may be blocked
  }
  buildingsCheck.checked = buildingsEnabled
  terrainRow.appendChild(buildingsCheck)

  const heroesLabel = document.createElement('label')
  heroesLabel.className = 'ops-hud__mode-label'
  heroesLabel.htmlFor = 'ops-heroes-enabled'
  heroesLabel.textContent = 'heroes'
  terrainRow.appendChild(heroesLabel)

  const heroesCheck = document.createElement('input')
  heroesCheck.id = 'ops-heroes-enabled'
  heroesCheck.type = 'checkbox'
  heroesCheck.className = 'ops-hud__checkbox'
  heroesCheck.title =
    'Named historic landmarks (glTF or labelled proxy). 3D/opaque only — forced off for transparent/chroma AR. Off hides the mesh and fills the OSM occupancy hole.'
  let heroesEnabled =
    options.heroesEnabled !== undefined
      ? options.heroesEnabled === true
      : DEFAULT_HEROES_ENABLED
  try {
    if (options.heroesEnabled === undefined) {
      heroesEnabled = readSessionHeroesEnabled(DEFAULT_HEROES_ENABLED)
    }
  } catch {
    // sessionStorage may be blocked
  }
  heroesCheck.checked = heroesEnabled
  terrainRow.appendChild(heroesCheck)

  const nudgeLabel = document.createElement('label')
  nudgeLabel.className = 'ops-hud__mode-label'
  nudgeLabel.htmlFor = 'ops-terrain-nudge'
  nudgeLabel.textContent = 'nudge m'
  terrainRow.appendChild(nudgeLabel)

  const nudgeInput = document.createElement('input')
  nudgeInput.id = 'ops-terrain-nudge'
  nudgeInput.className = 'ops-hud__input ops-hud__input--nudge'
  nudgeInput.type = 'number'
  nudgeInput.step = '0.1'
  nudgeInput.title =
    'Terrain altitude nudge (metres, +Y). Residual ion/geoid offset; session-only this slice.'
  let terrainNudgeM =
    typeof options.terrainAltitudeNudgeM === 'number' &&
    Number.isFinite(options.terrainAltitudeNudgeM)
      ? options.terrainAltitudeNudgeM
      : 0
  try {
    if (options.terrainAltitudeNudgeM === undefined) {
      const raw = sessionStorage.getItem(TERRAIN_SESSION_NUDGE_KEY)
      if (raw != null && raw !== '') {
        const n = Number(raw)
        if (Number.isFinite(n)) terrainNudgeM = n
      }
    }
  } catch {
    // sessionStorage may be blocked
  }
  nudgeInput.value = String(terrainNudgeM)
  terrainRow.appendChild(nudgeInput)

  const waterYLabel = document.createElement('label')
  waterYLabel.className = 'ops-hud__mode-label'
  waterYLabel.htmlFor = 'ops-terrain-water-y'
  waterYLabel.textContent = 'Cesium hide m'
  terrainRow.appendChild(waterYLabel)

  const waterYInput = document.createElement('input')
  waterYInput.id = 'ops-terrain-water-y'
  waterYInput.className = 'ops-hud__input ops-hud__input--nudge'
  waterYInput.type = 'number'
  waterYInput.min = String(TERRAIN_WATER_DISCARD_Y_MIN)
  waterYInput.max = String(TERRAIN_WATER_DISCARD_Y_MAX)
  waterYInput.step = '0.1'
  waterYInput.setAttribute('data-ops', 'terrain-water-discard')
  waterYInput.title =
    'Cesium tile water height-discard (metres AMSL). Does NOT move the Gerstner sea — use sea m for that. Fallback when a tile has no water mask. Default 0.5. Range −20…+5.'
  let terrainWaterDiscardYM = clampTerrainWaterDiscardYM(
    typeof options.terrainWaterDiscardYM === 'number'
      ? options.terrainWaterDiscardYM
      : DEFAULT_TERRAIN_WATER_DISCARD_Y,
  )
  waterYInput.value = String(terrainWaterDiscardYM)
  terrainRow.appendChild(waterYInput)

  const seaYLabel = document.createElement('label')
  seaYLabel.className = 'ops-hud__mode-label'
  seaYLabel.htmlFor = 'ops-sea-height-y'
  seaYLabel.textContent = 'sea m'
  terrainRow.appendChild(seaYLabel)

  const seaYInput = document.createElement('input')
  seaYInput.id = 'ops-sea-height-y'
  seaYInput.className = 'ops-hud__input ops-hud__input--nudge'
  seaYInput.type = 'number'
  seaYInput.min = String(SEA_HEIGHT_Y_MIN)
  seaYInput.max = String(SEA_HEIGHT_Y_MAX)
  seaYInput.step = '0.1'
  seaYInput.setAttribute('data-ops', 'sea-height')
  seaYInput.title =
    'Visible ocean rest height (metres). Lowers/raises the Gerstner plane + water-plane wakes. Assets with Alt MSL stay put. Default 0. Range −20…+20.'
  let seaHeightYM = clampSeaHeightYM(
    typeof options.seaHeightYM === 'number'
      ? options.seaHeightYM
      : SEA_HEIGHT_Y_DEFAULT,
  )
  seaYInput.value = String(seaHeightYM)
  terrainRow.appendChild(seaYInput)

  const terrainHint = document.createElement('span')
  terrainHint.className = 'ops-hud__mode-hint'
  terrainHint.textContent = options.terrainStatus ?? 'AR-gated · default off'
  terrainRow.appendChild(terrainHint)

  const ionRow = document.createElement('div')
  ionRow.className = 'ops-hud__mode-row'
  envHud.appendChild(ionRow)

  const ionLabel = document.createElement('label')
  ionLabel.className = 'ops-hud__mode-label'
  ionLabel.htmlFor = 'ops-ion-token'
  ionLabel.textContent = 'ion token'
  ionRow.appendChild(ionLabel)

  const ionInput = document.createElement('input')
  ionInput.id = 'ops-ion-token'
  ionInput.className = 'ops-hud__input ops-hud__input--ion'
  ionInput.type = 'password'
  ionInput.autocomplete = 'off'
  ionInput.spellcheck = false
  ionInput.placeholder = 'paste Cesium ion token'
  ionInput.title =
    'Same Unity ion account. Apply writes public/config.json in the studio app so git can share it. Empty Apply clears.'
  ionInput.value = options.cesiumIonToken ?? ''
  ionRow.appendChild(ionInput)

  const ionApply = document.createElement('button')
  ionApply.type = 'button'
  ionApply.className = 'ops-hud__btn'
  ionApply.textContent = 'Apply'
  ionApply.title =
    'Remount terrain and OSM buildings with this token and save to config.json (Electron).'
  ionRow.appendChild(ionApply)

  const applyIonToken = (): void => {
    options.onCesiumIonTokenApply?.(ionInput.value)
  }
  ionApply.addEventListener('click', applyIonToken)
  ionInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      applyIonToken()
    }
  })

  terrainSelect.addEventListener('change', () => {
    const next = terrainSelect.value === 'on'
    if (next === terrainEnabled) return
    terrainEnabled = next
    options.onTerrainEnabledChange?.(next)
  })
  overlaySelect.addEventListener('change', () => {
    const next = overlaySelect.value
    if (!isTerrainOverlayKind(next) || next === terrainOverlay) return
    terrainOverlay = next
    writeSessionTerrainOverlay(terrainOverlay)
    options.onTerrainOverlayChange?.(terrainOverlay)
  })
  buildingsCheck.addEventListener('change', () => {
    buildingsEnabled = buildingsCheck.checked
    writeSessionBuildingsEnabled(buildingsEnabled)
    options.onBuildingsEnabledChange?.(buildingsEnabled)
  })
  heroesCheck.addEventListener('change', () => {
    heroesEnabled = heroesCheck.checked
    writeSessionHeroesEnabled(heroesEnabled)
    options.onHeroesEnabledChange?.(heroesEnabled)
  })
  lockTilesCheck.addEventListener('change', () => {
    terrainTilesLocked = lockTilesCheck.checked
    try {
      sessionStorage.setItem(
        TERRAIN_SESSION_LOCK_KEY,
        terrainTilesLocked ? '1' : '0',
      )
    } catch {
      // ignore
    }
    options.onTerrainTilesLockedChange?.(terrainTilesLocked)
  })
  nudgeInput.addEventListener('change', () => {
    const n = Number(nudgeInput.value)
    if (!Number.isFinite(n)) return
    terrainNudgeM = n
    try {
      sessionStorage.setItem(TERRAIN_SESSION_NUDGE_KEY, String(n))
    } catch {
      // ignore
    }
    options.onTerrainAltitudeNudgeChange?.(n)
  })
  waterYInput.addEventListener('change', () => {
    const n = clampTerrainWaterDiscardYM(Number(waterYInput.value))
    terrainWaterDiscardYM = n
    waterYInput.value = String(n)
    options.onTerrainWaterDiscardYChange?.(n)
  })
  seaYInput.addEventListener('change', () => {
    const n = clampSeaHeightYM(Number(seaYInput.value))
    seaHeightYM = n
    seaYInput.value = String(n)
    options.onSeaHeightYChange?.(n)
  })

  const windOps = mountWindOpsRow({ container: windHost })

  const localProject: LocalProjectControlsHandle = mountLocalProjectControls({
    container: projectHud,
    folderMode: options.localRacesFolder === true,
    raceIds: options.raceIds,
    activeRaceId: options.activeRaceId,
    projectName: options.projectName,
    projectWritesEnabled: options.projectWritesEnabled,
    onRaceLoad: options.onRaceLoad,
    onSaveProject: options.onSaveProject,
    onSaveAsProject: options.onSaveAsProject,
    onExportProject: options.onExportProject,
  })

  const packRow = document.createElement('div')
  packRow.className = 'ops-hud__mode-row'
  projectHud.appendChild(packRow)

  const packLabel = document.createElement('span')
  packLabel.className = 'ops-hud__mode-label'
  packLabel.textContent = 'pack'
  packRow.appendChild(packLabel)

  const venuePackDownloadBtn = document.createElement('button')
  venuePackDownloadBtn.type = 'button'
  venuePackDownloadBtn.className = 'ops-hud__btn'
  venuePackDownloadBtn.textContent = 'Pack ↓'
  venuePackDownloadBtn.title =
    'Download venue pack (project.json + linked fixtures/textures) for offline / air PC'
  packRow.appendChild(venuePackDownloadBtn)

  const venuePackFileInput = document.createElement('input')
  venuePackFileInput.type = 'file'
  venuePackFileInput.accept = 'application/json,.json'
  venuePackFileInput.hidden = true
  packRow.appendChild(venuePackFileInput)

  const venuePackLoadBtn = document.createElement('button')
  venuePackLoadBtn.type = 'button'
  venuePackLoadBtn.className = 'ops-hud__btn'
  venuePackLoadBtn.textContent = 'Pack ↑'
  venuePackLoadBtn.title =
    'Load venue pack file (caches offline; works when /races/ or WAN is down)'
  packRow.appendChild(venuePackLoadBtn)

  const packHint = document.createElement('span')
  packHint.className = 'ops-hud__mode-hint'
  packHint.textContent = 'offline venue'
  packRow.appendChild(packHint)

  // World anchor = Unity GeoOrigin → ENU (0,0,0).
  const originRow = document.createElement('div')
  originRow.className = 'ops-hud__mode-row'
  projectHud.appendChild(originRow)

  const originLabel = document.createElement('span')
  originLabel.className = 'ops-hud__mode-label'
  originLabel.textContent = 'origin'
  originRow.appendChild(originLabel)

  const originLat = document.createElement('input')
  originLat.className = 'ops-hud__input ops-hud__input--origin'
  originLat.type = 'text'
  originLat.inputMode = 'decimal'
  originLat.spellcheck = false
  originLat.placeholder = 'lat'
  originLat.title = 'World anchor latitude (WGS84). ENU 0,0,0 = Unity GeoOrigin.'
  originLat.setAttribute('aria-label', 'Origin latitude')
  originRow.appendChild(originLat)

  const originLon = document.createElement('input')
  originLon.className = 'ops-hud__input ops-hud__input--origin'
  originLon.type = 'text'
  originLon.inputMode = 'decimal'
  originLon.spellcheck = false
  originLon.placeholder = 'lon'
  originLon.title = 'World anchor longitude (WGS84)'
  originLon.setAttribute('aria-label', 'Origin longitude')
  originRow.appendChild(originLon)

  const originAlt = document.createElement('input')
  originAlt.className = 'ops-hud__input ops-hud__input--origin-alt'
  originAlt.type = 'text'
  originAlt.inputMode = 'decimal'
  originAlt.spellcheck = false
  originAlt.placeholder = 'altMsl'
  originAlt.title = 'World anchor altitude MSL (meters)'
  originAlt.setAttribute('aria-label', 'Origin altitude MSL')
  originRow.appendChild(originAlt)

  const originApplyBtn = document.createElement('button')
  originApplyBtn.type = 'button'
  originApplyBtn.className = 'ops-hud__btn'
  originApplyBtn.textContent = 'Apply'
  originApplyBtn.title =
    'Apply world anchor → GEO origin (ENU 0,0,0). Remounts course/features.'
  originRow.appendChild(originApplyBtn)

  const originHint = document.createElement('span')
  originHint.className = 'ops-hud__mode-hint'
  originHint.textContent = 'ENU 0,0,0'
  originRow.appendChild(originHint)

  function fillOriginFields(origin: ConfigOrigin): void {
    originLat.value = String(origin.lat)
    originLon.value = String(origin.lon)
    originAlt.value = String(origin.altMsl)
  }

  if (options.initialOrigin) {
    fillOriginFields(options.initialOrigin)
  }

  function requestOriginApply(): void {
    const parsed = parseConfigOriginFields(
      originLat.value,
      originLon.value,
      originAlt.value,
    )
    if (!parsed) {
      originHint.textContent = 'invalid'
      return
    }
    originHint.textContent = 'ENU 0,0,0'
    fillOriginFields(parsed)
    options.onOriginApply?.(parsed)
  }

  originApplyBtn.addEventListener('click', () => {
    requestOriginApply()
  })
  for (const el of [originLat, originLon, originAlt]) {
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        requestOriginApply()
      }
    })
  }

  const srtSitEl = document.createElement('pre')
  srtSitEl.className = 'ops-hud__status ops-hud__srt-sit'
  srtSitEl.setAttribute('data-ops', 'srt-situation')
  srtSitEl.textContent =
    'SRT  click Connect SRT in Fleet / Live. Colour bars mean no decoded frame yet.'
  opsHud.appendChild(srtSitEl)

  const statusEl = document.createElement('pre')
  statusEl.className = 'ops-hud__status'
  opsHud.appendChild(statusEl)

  const map: Map2dHandle = createMap2d({ sizePx: 240 })
  const streamMap: Map2dHandle = createStreamMap2d()
  if (hosts) {
    hosts.map.appendChild(map.root)
    hosts.streamMapHost.appendChild(streamMap.root)
    mountStreamBoatSizeSlider(hosts.streamMapHost, streamMap)
  } else {
    legacyRoot!.appendChild(map.root)
    legacyRoot!.appendChild(streamMap.root)
    mountStreamBoatSizeSlider(legacyRoot!, streamMap)
  }

  editorCheck.addEventListener('change', () => {
    options.onEditorToggle?.(editorCheck.checked)
  })

  venuePackDownloadBtn.addEventListener('click', () => {
    options.onDownloadVenuePack?.()
  })
  venuePackLoadBtn.addEventListener('click', () => {
    venuePackFileInput.value = ''
    venuePackFileInput.click()
  })
  venuePackFileInput.addEventListener('change', () => {
    const file = venuePackFileInput.files?.[0]
    if (!file) return
    options.onLoadVenuePackFile?.(file)
  })

  const counts = { drone: 0, boat: 0, stream_anchor: 0 }
  let lastDroneEnu = '—'
  const lastBoatEnuById = new Map<string, string>()
  const seenPovIds = new Set<string>()
  let uiMode: TelemetryModeUi = initialMode
  let bootMessage: string | null = 'boot: loading config…'
  let connectionStatus: ConnectionStatusUi =
    initialMode === 'live'
      ? { kind: 'live', channels: { drone: 'idle', boat: 'idle' } }
      : { kind: 'non_live', mode: initialMode }

  function rebuildPovSelect(): void {
    povSelect.replaceChildren()
    for (const id of povIds) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = id
      povSelect.appendChild(opt)
    }
    if (!povIds.includes(activePovId)) {
      activePovId = povIds[0] ?? '1'
    }
    povSelect.value = activePovId
    povSelect.disabled = povIds.length <= 1
  }

  function renderStatus(): void {
    if (bootMessage) {
      statusEl.textContent = bootMessage
      return
    }
    statusEl.textContent =
      `mode=${uiMode}  drone=${counts.drone}  boat=${counts.boat}  stream_anchor=${counts.stream_anchor}\n` +
      `${formatConnectionStatus(connectionStatus)}\n` +
      `${formatPovStatus(activePovId, seenPovIds)}  ${formatOpsViewStatus(opsViewMode)}\n` +
      `ENU m  drone=${lastDroneEnu}  ${formatBoatEnuStatus(lastBoatEnuById)}`
  }

  function applyPovSelection(id: string, notify: boolean): void {
    if (!povIds.includes(id)) return
    const changed = id !== activePovId
    activePovId = id
    povSelect.value = id
    if (changed) renderStatus()
    if (notify && changed) options.onPovChange?.(id)
  }

  function boatAllowedOnMap(id: string): boolean {
    // Boot gap: accept until main wires the Live fleet list.
    if (boatIds === null) return true
    return boatIds.includes(id)
  }

  function onPose(pose: PoseEvent): void {
    const s = fmtEnu(pose.position)
    if (pose.kind === 'drone') {
      if (!povIds.includes(pose.id)) {
        // Counts still tick via telemetryBus; maps must not re-add ghosts.
        renderStatus()
        return
      }
      seenPovIds.add(pose.id)
      if (pose.id === activePovId) {
        lastDroneEnu = s
      }
    } else if (pose.kind === 'boat') {
      if (!boatAllowedOnMap(pose.id)) {
        renderStatus()
        return
      }
      lastBoatEnuById.set(pose.id, s)
      const en = eastNorthFromScene(pose.position)
      options.onLiveBoatPose?.(pose.id, en.east, en.north)
    }
    // Buoy (+ allowed boat/drone): keep ops + stream icons in sync.
    map.updatePose(pose)
    streamMap.updatePose(pose)
    renderStatus()
  }

  modeSelect.addEventListener('change', () => {
    const next = modeSelect.value as TelemetryModeUi
    uiMode = next
    modeHint.textContent = modeHintText(next)
    options.onModeChange?.(next)
    renderStatus()
  })

  povSelect.addEventListener('change', () => {
    applyPovSelection(povSelect.value, true)
  })

  viewSelect.addEventListener('change', () => {
    const next = viewSelect.value
    if (!isOpsViewMode(next) || next === opsViewMode) return
    opsViewMode = next
    renderStatus()
    options.onOpsViewChange?.(next)
  })

  envSelect.addEventListener('change', () => {
    const next = envSelect.value
    if (!isEnvironmentMode(next) || next === environmentMode) return
    environmentMode = next
    envHint.textContent =
      next === 'realistic' ? '3D dress · AR-gated' : 'AR-safe'
    options.onEnvironmentModeChange?.(next)
  })

  seaSelect.addEventListener('change', () => {
    const next = seaSelect.value
    if (!isSeaQuality(next) || next === seaQuality) return
    seaQuality = next
    options.onSeaQualityChange?.(next)
  })

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return
    const target = ev.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return
    }
    // Digit keys 1–4 → POV id string when listed (Unity spirit; cams later).
    if (ev.key >= '1' && ev.key <= '4' && povIds.includes(ev.key)) {
      ev.preventDefault()
      applyPovSelection(ev.key, true)
    }
  }

  const unsubTel = [
    telemetryBus.on('drone', () => {
      counts.drone += 1
    }),
    telemetryBus.on('boat', () => {
      counts.boat += 1
    }),
    telemetryBus.on('stream_anchor', () => {
      counts.stream_anchor += 1
    }),
  ]
  const unsubPose = poseBus.on('pose', onPose)
  window.addEventListener('keydown', onKeyDown)

  const refreshId = window.setInterval(() => {
    if (!bootMessage) renderStatus()
  }, 200)

  rebuildPovSelect()
  renderStatus()

  return {
    setMode(mode: TelemetryModeUi): void {
      uiMode = mode
      modeSelect.value = mode
      modeHint.textContent = modeHintText(mode)
      bootMessage = null
      renderStatus()
    },
    setBootMessage(msg: string): void {
      bootMessage = msg
      renderStatus()
    },
    setPovIds(nextIds, nextActive): void {
      povIds = resolvePovIdList(nextIds)
      if (nextActive !== undefined && povIds.includes(nextActive)) {
        activePovId = nextActive
      }
      // Drop seen ids outside the new allow-list.
      for (const id of [...seenPovIds]) {
        if (!povIds.includes(id)) seenPovIds.delete(id)
      }
      rebuildPovSelect()
      renderStatus()
    },
    setBoatIds(nextIds): void {
      boatIds = [...nextIds].map((id) => id.trim()).filter((id) => id !== '')
      for (const id of [...lastBoatEnuById.keys()]) {
        if (!boatIds.includes(id)) lastBoatEnuById.delete(id)
      }
      renderStatus()
    },
    setActivePovId(povId: string): void {
      applyPovSelection(povId, false)
    },
    setOpsViewMode(mode: OpsViewMode): void {
      opsViewMode = mode
      viewSelect.value = mode
      renderStatus()
    },
    setEnvironmentMode(mode: EnvironmentMode): void {
      environmentMode = normalizeEnvironmentMode(mode)
      envSelect.value = environmentMode
      envHint.textContent =
        environmentMode === 'realistic' ? '3D dress · AR-gated' : 'AR-safe'
    },
    setSeaQuality(quality: SeaQuality): void {
      seaQuality = normalizeSeaQuality(quality)
      seaSelect.value = seaQuality
    },
    setTerrainEnabled(enabled: boolean): void {
      terrainEnabled = enabled === true
      terrainSelect.value = terrainEnabled ? 'on' : 'off'
    },
    setBuildingsEnabled(enabled: boolean): void {
      buildingsEnabled = enabled === true
      buildingsCheck.checked = buildingsEnabled
    },
    getBuildingsEnabled: () => buildingsEnabled,
    setHeroesEnabled(enabled: boolean): void {
      heroesEnabled = enabled === true
      heroesCheck.checked = heroesEnabled
    },
    getHeroesEnabled: () => heroesEnabled,
    setTerrainAltitudeNudgeM(nudgeM: number): void {
      terrainNudgeM = Number.isFinite(nudgeM) ? nudgeM : 0
      nudgeInput.value = String(terrainNudgeM)
    },
    setTerrainTilesLocked(locked: boolean): void {
      terrainTilesLocked = locked === true
      lockTilesCheck.checked = terrainTilesLocked
    },
    setTerrainOverlay(kind: TerrainOverlayKind): void {
      terrainOverlay = normalizeTerrainOverlay(kind)
      overlaySelect.value = terrainOverlay
    },
    setTerrainWaterDiscardYM(yM: number): void {
      terrainWaterDiscardYM = clampTerrainWaterDiscardYM(yM)
      waterYInput.value = String(terrainWaterDiscardYM)
    },
    setSeaHeightYM(yM: number): void {
      seaHeightYM = clampSeaHeightYM(yM)
      seaYInput.value = String(seaHeightYM)
    },
    setTerrainStatus(msg: string): void {
      terrainHint.textContent = msg
    },
    setPreviewFps(fps: number): void {
      const next =
        !Number.isFinite(fps) || fps <= 0
          ? '— fps'
          : `${Math.round(fps)} fps`
      if (fpsHint.textContent === next) return
      fpsHint.textContent = next
    },
    setGpuLabel(label: string): void {
      const next = label.trim() === '' ? 'GPU · unknown' : label
      if (gpuHint.textContent === next) return
      gpuHint.textContent = next
    },
    setHitchCounts(counts): void {
      const over33 = Number.isFinite(counts.over33)
        ? Math.max(0, Math.floor(counts.over33))
        : 0
      const over50 = Number.isFinite(counts.over50)
        ? Math.max(0, Math.floor(counts.over50))
        : 0
      const next = formatHitchLabel(over50)
      hitchHint.title =
        `dt>33ms: ${over33} · dt>50ms: ${over50} (1 s window). Average preview fps is the row above.`
      if (hitchHint.textContent !== next) hitchHint.textContent = next
    },
    setCesiumIonToken(token: string): void {
      ionInput.value = token
    },
    setSrtSituation(text: string): void {
      srtSitEl.textContent = text
    },
    getTerrainAltitudeNudgeM: () => terrainNudgeM,
    getTerrainTilesLocked: () => terrainTilesLocked,
    getTerrainOverlay: () => terrainOverlay,
    getTerrainWaterDiscardYM: () => terrainWaterDiscardYM,
    getSeaHeightYM: () => seaHeightYM,
    setCourseMarks(marks): void {
      const mapped = marks.map((m) => ({
        name: m.name,
        ...eastNorthFromScene(m),
      }))
      map.setCourseMarks(mapped)
      streamMap.setCourseMarks(mapped)
    },
    setLayoutFeatures(features): void {
      map.setLayoutFeatures(features)
      streamMap.setLayoutFeatures(features)
    },
    getMap: () => map,
    getStreamMap: () => streamMap,
    setStreamMapVisible(visible: boolean): void {
      streamMap.setVisible(visible)
    },
    setEditorOpen(open, notify = false): void {
      editorCheck.checked = open
      if (notify) options.onEditorToggle?.(open)
    },
    setConnectionStatus(status: ConnectionStatusUi): void {
      connectionStatus = status
      renderStatus()
    },
    setRaceIds(nextIds, nextActive): void {
      localProject.setRaceIds(nextIds, nextActive)
    },
    setActiveRaceId(raceId: string): void {
      localProject.setActiveRaceId(raceId)
    },
    setProjectMeta(id: string, name: string): void {
      localProject.setProjectMeta(id, name)
    },
    setRacesRootHint(path: string | null): void {
      localProject.setRootHint(path)
    },
    setSaveStatus(msg: string): void {
      localProject.setSaveStatus(msg)
    },
    setOrigin(origin: ConfigOrigin): void {
      fillOriginFields(origin)
      originHint.textContent = 'ENU 0,0,0'
    },
    setProjectWritesEnabled(enabled: boolean): void {
      localProject.setProjectWritesEnabled(enabled)
    },
    setCinematicTransport(transport: CinematicTransport): void {
      cinematicsOps?.setTransport(transport)
    },
    setCinematicWarmStatus(status: WarmTilesStatus): void {
      cinematicsOps?.setWarmStatus(status)
    },
    setCinematicRecordStatus(msg: string): void {
      cinematicsOps?.setRecordStatus(msg)
    },
    setCinematicRecordBusy(busy: boolean): void {
      cinematicsOps?.setRecordBusy(busy)
    },
    setCinematicChromeHidden(hidden: boolean): void {
      const hide = hidden === true
      if (hosts) {
        hosts.map.hidden = hide
        hosts.streamMapHost.hidden = hide
      } else {
        map.root.hidden = hide
        streamMap.root.hidden = hide
      }
    },
    stop(): void {
      window.clearInterval(refreshId)
      window.removeEventListener('keydown', onKeyDown)
      unsubPose()
      for (const u of unsubTel) u()
      windOps.dispose()
      cinematicsOps?.dispose()
      map.dispose()
      streamMap.dispose()
      localProject.dispose()
      for (const el of disposableRoots) el.remove()
    },
  }
}
