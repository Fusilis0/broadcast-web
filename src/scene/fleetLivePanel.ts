/**
 * Ops Fleet / Live panel — register/edit boats & drones; base WS URLs.
 * Live connect opens one socket per **enabled** id (`base?type=client&subscribe=<id>`).
 * SRT: per-drone SRT id (≠ telemetry id); empty template → catalog; filled `{srtId}` template is the escape hatch.
 * Video checkbox is independent of Live WS. sessionStorage is a tab cache only;
 * RaceProject `fleet.boats` + `output.srtUrlTemplate` / `srtByPovId` are persist (Save/Load).
 * Relay token in the template is session-only — Save redacts it.
 */

import {
  buildSrtCallerUrl,
  shouldUseSrtCatalog,
  SRT_WARM_POV_CAP,
} from '../output/srtCallerUrl.ts'
import { resolveSrtUrlForId } from '../output/srtStreamCatalog.ts'
import { DEFAULT_LIVE_WS_BASE, stripLiveWsId } from '../telemetry/liveWsUrl.ts'
import type { LiveStatusSnapshot } from '../telemetry/liveSource.ts'
import type { OpsViewMode } from './freeCam.ts'
import {
  DEFAULT_BOAT_VISIBILITY_MODE,
  normalizeBoatVisibilityMode,
  type BoatVisibilityMode,
} from './boatVisibility.ts'
import { parseHexColorCss } from './boatNames/categoryColor.ts'
import { BOAT_COLOR_PALETTE } from './boatNames/colorPalette.ts'

export type FleetBoatRow = {
  id: string
  name: string
  category: string
  /**
   * Explicit palette `#rrggbb`. Omit → colour from category keywords (legacy).
   */
  color?: string
  /**
   * Air/ops draw mode — session-persisted; default `solid`.
   * `ghost` = translucent hull + ring; `hidden` = no 3D hull/tag (map still tracks).
   */
  visibility?: BoatVisibilityMode
  /**
   * 2D map icon visibility (SCN 11.7). Default true when omitted.
   * Independent of `visibility` (ghost/hidden still track on map unless false).
   */
  mapVisible?: boolean
  /**
   * Map-placed approximate GPS until live telemetry overrides (session only).
   */
  plannedLat?: number
  plannedLon?: number
}

export type FleetPlannedPov = {
  id: string
  plannedLat: number
  plannedLon: number
}

export type FleetLivePanelState = {
  /** Base drone WS (no id). Ids come from POV registry. */
  wsUrl: string
  /** Base boat WS (no id). Ids come from boat registry. */
  wsBoatUrl: string
  boatIds: string[]
  povIds: string[]
  /** Subset of boatIds used for Connect live sockets. */
  enabledBoatIds: string[]
  /** Subset of povIds used for Connect live sockets. */
  enabledPovIds: string[]
  boats: FleetBoatRow[]
  activePovId: string
  /** Map-placed drone/POV GPS hints (session). */
  plannedPovs?: FleetPlannedPov[]
  /**
   * Shared SRT caller template (`{srtId}` / `{id}`). Session may hold the
   * relay token; race-pack save redacts it.
   */
  srtUrlTemplate?: string
  /** Per-POV SRT camera id — independent of telemetry `id`. */
  srtByPovId?: Record<string, string>
  /** Subset of povIds used for SRT video (independent of Live WS). */
  enabledSrtPovIds?: string[]
}

export type FleetLivePanelOptions = {
  container: HTMLElement
  initial: FleetLivePanelState
  onFleetChange: (state: {
    boatIds: string[]
    povIds: string[]
    boats: FleetBoatRow[]
  }) => void
  /** Fired when a boat visibility mode changes (immediate, no Save click). */
  onBoatVisibilityChange?: (
    id: string,
    mode: BoatVisibilityMode,
  ) => void
  onPovChange: (povId: string) => void
  /** Ops preview Free cam | Follow — does not change active POV / air. */
  onOpsViewChange?: (mode: OpsViewMode) => void
  /** Frame free cam on spawned boat meshes (ENU). */
  onFrameFleet?: () => void
  /** Initial ops view (default follow). */
  opsViewMode?: OpsViewMode
  onLiveApply: (state: {
    wsUrl: string
    wsBoatUrl: string
    /** Enabled boat ids only (Connect sockets). */
    boatIds: string[]
    /** Enabled POV ids only (Connect sockets). */
    povIds: string[]
    goLive: boolean
  }) => void
  /**
   * SRT video apply — independent of Live WS. Empty SRT id rows are omitted.
   * URLs are composed; the token stays in the URL (do not log it).
   */
  onSrtApply?: (state: {
    srtUrlTemplate: string
    streams: { povId: string; srtId: string; url: string }[]
  }) => void
}

export type FleetLivePanelHandle = {
  setState: (partial: Partial<FleetLivePanelState>) => void
  getState: () => FleetLivePanelState
  setStatus: (msg: string) => void
  /** Sync Free/Follow buttons without notifying. */
  setOpsViewMode: (mode: OpsViewMode) => void
  /** Per-id socket + last-packet ages from TEL live ingest. */
  setLiveStatus: (status: LiveStatusSnapshot | null) => void
  /**
   * Programmatic add from World Map place-boat tool.
   * Optional planned GPS seeds the 2D map until live pose arrives.
   * Returns whether the id was newly added (`created`) or already present.
   */
  addBoat: (input: {
    id: string
    name?: string
    category?: string
    plannedLat?: number
    plannedLon?: number
  }) => { ok: boolean; created: boolean }
  /** Update planned GPS (inspector lat/lon). Persists session + emits fleet change. */
  setBoatPlannedGps: (
    id: string,
    plannedLat: number,
    plannedLon: number,
  ) => boolean
  /**
   * Programmatic add from World Map place-drone tool.
   */
  addDrone: (input: {
    id: string
    plannedLat?: number
    plannedLon?: number
  }) => { ok: boolean; created: boolean }
  /** Live SRT caller / decode lines (Race ops + Fleet). Never include raw tokens. */
  setSrtSituation: (text: string) => void
  /** Expand panel and flash a boat row (Assets Details deep-link). */
  highlightBoat: (id: string) => void
  stop: () => void
}

const STORAGE_KEY = 'broadcast-web.fleetLive.v1'

type SessionShape = Partial<FleetLivePanelState> & {
  enabledBoatIds?: string[]
  enabledPovIds?: string[]
  enabledSrtPovIds?: string[]
  srtUrlTemplate?: string
  srtByPovId?: Record<string, string>
}

export function loadFleetLiveFromSession(): SessionShape | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as SessionShape
    return o && typeof o === 'object' ? o : null
  } catch {
    return null
  }
}

export function saveFleetLiveToSession(state: FleetLivePanelState): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        wsUrl: stripLiveWsId(state.wsUrl),
        wsBoatUrl: stripLiveWsId(state.wsBoatUrl),
        boatIds: state.boatIds,
        povIds: state.povIds,
        enabledBoatIds: state.enabledBoatIds,
        enabledPovIds: state.enabledPovIds,
        boats: state.boats,
        activePovId: state.activePovId,
        plannedPovs: state.plannedPovs,
        srtUrlTemplate: state.srtUrlTemplate ?? '',
        srtByPovId: { ...(state.srtByPovId ?? {}) },
        enabledSrtPovIds: state.enabledSrtPovIds ?? [],
      }),
    )
  } catch {
    /* private mode / quota */
  }
}

function uniqIds(ids: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of ids) {
    const id = raw.trim()
    if (id !== '' && !out.includes(id)) out.push(id)
  }
  return out
}

/** Keep enabled ⊆ registry; drop orphans. */
function clampEnabled(
  enabled: readonly string[],
  registry: readonly string[],
): string[] {
  return uniqIds(enabled).filter((id) => registry.includes(id))
}

function defaultBase(url: string): string {
  const stripped = stripLiveWsId(url)
  return stripped !== '' ? stripped : DEFAULT_LIVE_WS_BASE
}

function normalizeFleetBoatRow(row: FleetBoatRow): FleetBoatRow {
  const out: FleetBoatRow = {
    id: row.id,
    name: row.name,
    category: row.category,
    visibility: normalizeBoatVisibilityMode(
      row.visibility ?? DEFAULT_BOAT_VISIBILITY_MODE,
    ),
  }
  const color = parseHexColorCss(row.color)
  if (color) out.color = color
  if (row.mapVisible === false) out.mapVisible = false
  if (
    typeof row.plannedLat === 'number' &&
    Number.isFinite(row.plannedLat) &&
    typeof row.plannedLon === 'number' &&
    Number.isFinite(row.plannedLon)
  ) {
    out.plannedLat = row.plannedLat
    out.plannedLon = row.plannedLon
  }
  return out
}

function fmtPktAge(ageMs: number | null): string {
  if (ageMs === null) return 'nopkt'
  if (ageMs < 1000) return `${Math.round(ageMs)}ms`
  return `${(ageMs / 1000).toFixed(1)}s`
}

function createColorSelect(current?: string): HTMLSelectElement {
  const sel = document.createElement('select')
  sel.className = 'fleet-live__input fleet-live__color'
  sel.title = 'Category colour (palette). Auto = parse category keywords'
  const auto = document.createElement('option')
  auto.value = ''
  auto.textContent = 'Auto'
  sel.appendChild(auto)
  for (const swatch of BOAT_COLOR_PALETTE) {
    const opt = document.createElement('option')
    opt.value = swatch.hex
    opt.textContent = swatch.label
    sel.appendChild(opt)
  }
  const hex = parseHexColorCss(current)
  if (hex && !BOAT_COLOR_PALETTE.some((s) => s.hex === hex)) {
    const custom = document.createElement('option')
    custom.value = hex
    custom.textContent = 'Custom'
    sel.appendChild(custom)
  }
  sel.value = hex ?? ''
  return sel
}

/**
 * Collapsible ops panel: base WS URLs + editable boat/drone registry
 * with per-row Live enable toggles.
 */
export function startFleetLivePanel(
  options: FleetLivePanelOptions,
): FleetLivePanelHandle {
  const initBoats = uniqIds(options.initial.boatIds)
  const initPovs = uniqIds(options.initial.povIds)
  let state: FleetLivePanelState = {
    wsUrl: defaultBase(options.initial.wsUrl),
    wsBoatUrl: defaultBase(options.initial.wsBoatUrl),
    boatIds: initBoats,
    povIds: initPovs,
    // Prefer empty enabled set — Connect must not open unused default sockets.
    enabledBoatIds: clampEnabled(
      options.initial.enabledBoatIds ?? [],
      initBoats,
    ),
    enabledPovIds: clampEnabled(options.initial.enabledPovIds ?? [], initPovs),
    boats: options.initial.boats.map((b) => normalizeFleetBoatRow(b)),
    activePovId: options.initial.activePovId,
    plannedPovs: (options.initial.plannedPovs ?? []).map((p) => ({ ...p })),
    srtUrlTemplate: options.initial.srtUrlTemplate ?? '',
    srtByPovId: { ...(options.initial.srtByPovId ?? {}) },
    enabledSrtPovIds: clampEnabled(
      options.initial.enabledSrtPovIds ?? [],
      initPovs,
    ),
  }

  let liveStatus: LiveStatusSnapshot | null = null

  const root = document.createElement('div')
  root.className = 'fleet-live'
  root.setAttribute('data-ops', 'fleet-live')

  const header = document.createElement('button')
  header.type = 'button'
  header.className = 'fleet-live__header'
  header.textContent = 'Fleet / Live ▾'
  header.title =
    'Base WS URLs + register ids. Connect opens sockets only for Live-checked ids.'
  root.appendChild(header)

  const body = document.createElement('div')
  body.className = 'fleet-live__body'
  root.appendChild(body)

  // —— Base URLs ——
  const liveSec = document.createElement('section')
  liveSec.className = 'fleet-live__section'
  const liveTitle = document.createElement('div')
  liveTitle.className = 'fleet-live__title'
  liveTitle.textContent = 'Base WebSocket (no id)'
  liveSec.appendChild(liveTitle)
  body.appendChild(liveSec)

  const hint = document.createElement('div')
  hint.className = 'fleet-live__hint'
  hint.textContent =
    'Check Live on rows below → Connect opens only those ids (…/ws?type=client&subscribe=<id>). open ≠ packets.'
  liveSec.appendChild(hint)

  const droneUrlInput = document.createElement('input')
  droneUrlInput.className = 'fleet-live__input fleet-live__input--wide'
  droneUrlInput.placeholder = 'Drone base WS'
  droneUrlInput.spellcheck = false
  droneUrlInput.value = state.wsUrl
  liveSec.appendChild(labelWrap('Drone base', droneUrlInput))

  const boatUrlInput = document.createElement('input')
  boatUrlInput.className = 'fleet-live__input fleet-live__input--wide'
  boatUrlInput.placeholder = 'Boat base WS'
  boatUrlInput.spellcheck = false
  boatUrlInput.value = state.wsBoatUrl
  liveSec.appendChild(labelWrap('Boat base', boatUrlInput))

  const srtTemplateInput = document.createElement('input')
  srtTemplateInput.className = 'fleet-live__input fleet-live__input--wide'
  srtTemplateInput.placeholder = 'leave empty for catalog (cams 1–27)'
  srtTemplateInput.spellcheck = false
  srtTemplateInput.autocomplete = 'off'
  srtTemplateInput.value = state.srtUrlTemplate ?? ''
  srtTemplateInput.title =
    'Leave empty to look up SRT id in the cam 1–27 catalog. A filled {srtId} template on a real host is an escape hatch. Do not paste srt://host:… — that hostname is a placeholder.'
  liveSec.appendChild(labelWrap('SRT template', srtTemplateInput))

  const srtHint = document.createElement('div')
  srtHint.className = 'fleet-live__hint'
  srtHint.textContent =
    'Empty template + SRT id (e.g. 18) uses the catalog. Vid is independent of Live WS. Dummy srt://host:… is ignored. Token stays in this tab only.'
  liveSec.appendChild(srtHint)

  const liveRow = document.createElement('div')
  liveRow.className = 'fleet-live__row'
  const applyLiveBtn = document.createElement('button')
  applyLiveBtn.type = 'button'
  applyLiveBtn.className = 'fleet-live__btn fleet-live__btn--primary'
  applyLiveBtn.textContent = 'Connect live'
  const reconnectBtn = document.createElement('button')
  reconnectBtn.type = 'button'
  reconnectBtn.className = 'fleet-live__btn'
  reconnectBtn.textContent = 'Reconnect'
  const applySrtBtn = document.createElement('button')
  applySrtBtn.type = 'button'
  applySrtBtn.className = 'fleet-live__btn fleet-live__btn--primary'
  applySrtBtn.textContent = 'Connect SRT'
  applySrtBtn.title =
    'Open SRT caller for Video-checked POVs with an SRT id (cap 4). Independent of Connect live.'
  liveRow.append(applyLiveBtn, reconnectBtn, applySrtBtn)
  liveSec.appendChild(liveRow)

  const srtSitEl = document.createElement('pre')
  srtSitEl.className = 'fleet-live__srt-sit'
  srtSitEl.setAttribute('data-ops', 'srt-situation')
  srtSitEl.textContent =
    'SRT  click Connect SRT after Vid + SRT id. Colour bars mean no decoded frame yet.'
  liveSec.appendChild(srtSitEl)

  // —— Boats ——
  const boatSec = document.createElement('section')
  boatSec.className = 'fleet-live__section'
  boatSec.appendChild(sectionTitle('Boats (editable)'))
  body.appendChild(boatSec)

  const boatList = document.createElement('div')
  boatList.className = 'fleet-live__list'
  boatSec.appendChild(boatList)

  const boatAddRow = document.createElement('div')
  boatAddRow.className = 'fleet-live__row'
  const boatIdIn = document.createElement('input')
  boatIdIn.className = 'fleet-live__input'
  boatIdIn.placeholder = 'id'
  boatIdIn.style.width = '48px'
  const boatNameIn = document.createElement('input')
  boatNameIn.className = 'fleet-live__input'
  boatNameIn.placeholder = 'name'
  boatNameIn.style.width = '70px'
  const boatCatIn = document.createElement('input')
  boatCatIn.className = 'fleet-live__input'
  boatCatIn.placeholder = 'category'
  boatCatIn.style.width = '80px'
  const boatColorIn = createColorSelect()
  const boatAddBtn = document.createElement('button')
  boatAddBtn.type = 'button'
  boatAddBtn.className = 'fleet-live__btn'
  boatAddBtn.textContent = 'Add'
  boatAddRow.append(boatIdIn, boatNameIn, boatCatIn, boatColorIn, boatAddBtn)
  boatSec.appendChild(boatAddRow)

  // —— Ops preview helpers (Free/Follow live in Ops sidebar section — 11.1) ——
  let opsViewMode: OpsViewMode = options.opsViewMode ?? 'follow'
  const viewSec = document.createElement('section')
  viewSec.className = 'fleet-live__section'
  viewSec.appendChild(sectionTitle('Ops preview'))
  body.appendChild(viewSec)

  const viewRow = document.createElement('div')
  viewRow.className = 'fleet-live__row'
  const frameBtn = document.createElement('button')
  frameBtn.type = 'button'
  frameBtn.className = 'fleet-live__btn fleet-live__btn--primary'
  frameBtn.textContent = 'Frame boats'
  frameBtn.title =
    'Free cam → look at live boat meshes. If empty, wait for packets or Apply origin near the boat GPS.'
  viewRow.append(frameBtn)
  viewSec.appendChild(viewRow)

  const viewHint = document.createElement('div')
  viewHint.className = 'fleet-live__hint'
  viewHint.textContent =
    'Free/Follow: Ops section. Air/NDI = active POV. Distant boats: Frame boats, or Apply origin near their GPS.'
  viewSec.appendChild(viewHint)

  frameBtn.addEventListener('click', () => {
    options.onFrameFleet?.()
  })

  function applyOpsView(mode: OpsViewMode, notify: boolean): void {
    if (mode === opsViewMode) return
    opsViewMode = mode
    if (notify) options.onOpsViewChange?.(mode)
  }

  // —— Drones ——
  const povSec = document.createElement('section')
  povSec.className = 'fleet-live__section'
  povSec.appendChild(sectionTitle('Drones / POV (editable)'))
  body.appendChild(povSec)

  const povList = document.createElement('div')
  povList.className = 'fleet-live__list'
  povSec.appendChild(povList)

  const povAddRow = document.createElement('div')
  povAddRow.className = 'fleet-live__row'
  const povIdIn = document.createElement('input')
  povIdIn.className = 'fleet-live__input'
  povIdIn.placeholder = 'id'
  povIdIn.style.width = '48px'
  const povAddBtn = document.createElement('button')
  povAddBtn.type = 'button'
  povAddBtn.className = 'fleet-live__btn'
  povAddBtn.textContent = 'Add'
  povAddRow.append(povIdIn, povAddBtn)
  povSec.appendChild(povAddRow)

  const statusEl = document.createElement('div')
  statusEl.className = 'fleet-live__status'
  statusEl.textContent =
    'Session-only · enable Live on ids, then Connect (defaults start unchecked)'
  body.appendChild(statusEl)

  options.container.appendChild(root)

  let collapsed = false
  header.addEventListener('click', () => {
    collapsed = !collapsed
    body.hidden = collapsed
    header.textContent = collapsed ? 'Fleet / Live ▸' : 'Fleet / Live ▾'
  })

  function sectionTitle(text: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'fleet-live__title'
    el.textContent = text
    return el
  }

  function labelWrap(label: string, input: HTMLElement): HTMLElement {
    const wrap = document.createElement('label')
    wrap.className = 'fleet-live__field'
    const span = document.createElement('span')
    span.textContent = label
    wrap.append(span, input)
    return wrap
  }

  function syncInputsFromState(): void {
    droneUrlInput.value = state.wsUrl
    boatUrlInput.value = state.wsBoatUrl
    srtTemplateInput.value = state.srtUrlTemplate ?? ''
  }

  function readUrls(): void {
    state.wsUrl = stripLiveWsId(droneUrlInput.value) || DEFAULT_LIVE_WS_BASE
    state.wsBoatUrl = stripLiveWsId(boatUrlInput.value) || DEFAULT_LIVE_WS_BASE
    state.srtUrlTemplate = srtTemplateInput.value.trim()
    droneUrlInput.value = state.wsUrl
    boatUrlInput.value = state.wsBoatUrl
    srtTemplateInput.value = state.srtUrlTemplate
  }

  function persist(): void {
    saveFleetLiveToSession(state)
  }

  function emitFleet(): void {
    persist()
    options.onFleetChange({
      boatIds: [...state.boatIds],
      povIds: [...state.povIds],
      boats: state.boats.map((b) => ({ ...b })),
    })
  }

  function ensureBoatRow(id: string): FleetBoatRow {
    let row = state.boats.find((b) => b.id === id)
    if (!row) {
      row = {
        id,
        name: id,
        category: '',
        visibility: DEFAULT_BOAT_VISIBILITY_MODE,
      }
      state.boats.push(row)
    } else if (row.visibility === undefined) {
      row.visibility = DEFAULT_BOAT_VISIBILITY_MODE
    }
    return row
  }

  function setEnabledBoat(id: string, on: boolean): void {
    if (on) {
      if (!state.enabledBoatIds.includes(id)) state.enabledBoatIds.push(id)
    } else {
      state.enabledBoatIds = state.enabledBoatIds.filter((x) => x !== id)
    }
    persist()
  }

  function setEnabledPov(id: string, on: boolean): void {
    if (on) {
      if (!state.enabledPovIds.includes(id)) state.enabledPovIds.push(id)
    } else {
      state.enabledPovIds = state.enabledPovIds.filter((x) => x !== id)
    }
    persist()
  }

  function setEnabledSrtPov(id: string, on: boolean): void {
    const list = state.enabledSrtPovIds ?? []
    if (on) {
      if (!list.includes(id)) list.push(id)
      state.enabledSrtPovIds = list
    } else {
      state.enabledSrtPovIds = list.filter((x) => x !== id)
    }
    persist()
  }

  function setSrtId(povId: string, srtId: string): void {
    const map = { ...(state.srtByPovId ?? {}) }
    const trimmed = srtId.trim()
    if (trimmed === '') delete map[povId]
    else map[povId] = trimmed
    state.srtByPovId = map
    persist()
  }

  function remapPovKey(
    map: Record<string, string> | undefined,
    oldId: string,
    newId: string,
  ): Record<string, string> {
    const next = { ...(map ?? {}) }
    if (oldId !== newId && Object.prototype.hasOwnProperty.call(next, oldId)) {
      next[newId] = next[oldId]!
      delete next[oldId]
    }
    return next
  }

  function liveHintFor(
    channel: 'boat' | 'drone',
    id: string,
  ): string {
    if (!liveStatus) return ''
    const list =
      channel === 'boat' ? liveStatus.boatIds : liveStatus.droneIds
    const row = list.find((s) => s.id === id)
    if (!row) {
      const enabled =
        channel === 'boat'
          ? state.enabledBoatIds.includes(id)
          : state.enabledPovIds.includes(id)
      return enabled ? ' · —' : ''
    }
    return ` · ${row.status}/${fmtPktAge(row.lastPacketAgeMs)}`
  }

  function renderBoats(): void {
    boatList.replaceChildren()
    for (const id of state.boatIds) {
      const row = ensureBoatRow(id)
      const el = document.createElement('div')
      el.className = 'fleet-live__edit-row'
      el.dataset.fleetBoatId = id

      const en = document.createElement('input')
      en.type = 'checkbox'
      en.className = 'fleet-live__enable'
      en.title = 'Enable for Connect live'
      en.checked = state.enabledBoatIds.includes(id)
      en.addEventListener('change', () => {
        setEnabledBoat(id, en.checked)
        renderBoats()
      })

      const idIn = document.createElement('input')
      idIn.className = 'fleet-live__input'
      idIn.style.width = '48px'
      idIn.value = row.id
      idIn.title = 'Boat id'

      const nameIn = document.createElement('input')
      nameIn.className = 'fleet-live__input'
      nameIn.style.width = '70px'
      nameIn.value = row.name
      nameIn.title = 'Display name'

      const catIn = document.createElement('input')
      catIn.className = 'fleet-live__input'
      catIn.style.width = '72px'
      catIn.value = row.category
      catIn.title = 'Category (colour keyword fallback)'

      const colorSel = createColorSelect(row.color)
      colorSel.addEventListener('change', () => {
        const hex = parseHexColorCss(colorSel.value)
        if (hex) row.color = hex
        else delete row.color
        persist()
        emitFleet()
        statusEl.textContent = hex
          ? `Boat ${id} colour ${hex}`
          : `Boat ${id} colour auto (category)`
      })

      const visSel = document.createElement('select')
      visSel.className = 'fleet-live__input fleet-live__vis'
      visSel.title =
        'solid = full hull · ghost = translucent + ring · hidden = no 3D (map still tracks)'
      for (const mode of ['solid', 'ghost', 'hidden'] as const) {
        const opt = document.createElement('option')
        opt.value = mode
        opt.textContent = mode
        visSel.appendChild(opt)
      }
      visSel.value = normalizeBoatVisibilityMode(row.visibility)
      visSel.addEventListener('change', () => {
        const mode = normalizeBoatVisibilityMode(visSel.value)
        row.visibility = mode
        persist()
        options.onBoatVisibilityChange?.(id, mode)
        emitFleet()
        statusEl.textContent = `Boat ${id} → ${mode}`
      })

      const sock = document.createElement('span')
      sock.className = 'fleet-live__sock'
      sock.textContent = liveHintFor('boat', id)

      const saveBtn = document.createElement('button')
      saveBtn.type = 'button'
      saveBtn.className = 'fleet-live__btn fleet-live__btn--tiny'
      saveBtn.textContent = 'Save'
      saveBtn.addEventListener('click', () => {
        const newId = idIn.value.trim()
        if (newId === '') {
          statusEl.textContent = 'Boat id required'
          return
        }
        const oldId = row.id
        const visibility = normalizeBoatVisibilityMode(visSel.value)
        if (newId !== oldId) {
          if (state.boatIds.includes(newId)) {
            statusEl.textContent = `Boat ${newId} already exists`
            return
          }
          state.boatIds = state.boatIds.map((x) => (x === oldId ? newId : x))
          state.enabledBoatIds = state.enabledBoatIds.map((x) =>
            x === oldId ? newId : x,
          )
          state.boats = state.boats.filter((b) => b.id !== oldId)
        }
        const next = normalizeFleetBoatRow({
          id: newId,
          name: nameIn.value.trim() || newId,
          category: catIn.value.trim(),
          color: parseHexColorCss(colorSel.value) ?? undefined,
          visibility,
          plannedLat: row.plannedLat,
          plannedLon: row.plannedLon,
        })
        const idx = state.boats.findIndex((b) => b.id === newId)
        if (idx >= 0) state.boats[idx] = next
        else state.boats.push(next)
        // Last-edited → prefer live-enabled.
        setEnabledBoat(newId, true)
        renderBoats()
        emitFleet()
        options.onBoatVisibilityChange?.(newId, visibility)
        statusEl.textContent = `Boat ${newId} updated (Live on)`
      })

      const rm = document.createElement('button')
      rm.type = 'button'
      rm.className = 'fleet-live__btn fleet-live__btn--tiny'
      rm.textContent = '×'
      rm.addEventListener('click', () => {
        state.boatIds = state.boatIds.filter((x) => x !== id)
        state.enabledBoatIds = state.enabledBoatIds.filter((x) => x !== id)
        state.boats = state.boats.filter((b) => b.id !== id)
        renderBoats()
        emitFleet()
        statusEl.textContent = `Boat ${id} removed`
      })

      el.append(en, idIn, nameIn, catIn, colorSel, visSel, sock, saveBtn, rm)
      boatList.appendChild(el)
    }
  }

  function renderPovs(): void {
    povList.replaceChildren()
    for (const id of state.povIds) {
      const el = document.createElement('div')
      el.className = 'fleet-live__edit-row'

      const en = document.createElement('input')
      en.type = 'checkbox'
      en.className = 'fleet-live__enable'
      en.title = 'Enable for Connect live'
      en.checked = state.enabledPovIds.includes(id)
      en.addEventListener('change', () => {
        setEnabledPov(id, en.checked)
        renderPovs()
      })

      const idIn = document.createElement('input')
      idIn.className = 'fleet-live__input'
      idIn.style.width = '48px'
      idIn.value = id
      idIn.title = 'Telemetry / POV id (not the SRT camera id)'

      const srtIn = document.createElement('input')
      srtIn.className = 'fleet-live__input fleet-live__srt'
      srtIn.style.width = '48px'
      srtIn.value = state.srtByPovId?.[id] ?? ''
      srtIn.placeholder = 'srt'
      srtIn.title = 'SRT camera id on the wire (e.g. 30). Independent of telemetry id.'
      srtIn.addEventListener('change', () => {
        setSrtId(id, srtIn.value)
      })

      const vid = document.createElement('input')
      vid.type = 'checkbox'
      vid.className = 'fleet-live__enable'
      vid.title = 'Enable SRT video (independent of Live WS)'
      vid.checked = (state.enabledSrtPovIds ?? []).includes(id)
      vid.addEventListener('change', () => {
        setEnabledSrtPov(id, vid.checked)
        renderPovs()
      })
      const vidLab = document.createElement('span')
      vidLab.className = 'fleet-live__srt-lab'
      vidLab.textContent = 'Vid'
      vidLab.title = 'SRT video enable — independent of Live WS'

      const sock = document.createElement('span')
      sock.className = 'fleet-live__sock'
      sock.textContent = liveHintFor('drone', id)

      const saveBtn = document.createElement('button')
      saveBtn.type = 'button'
      saveBtn.className = 'fleet-live__btn fleet-live__btn--tiny'
      saveBtn.textContent = 'Save'
      saveBtn.addEventListener('click', () => {
        const newId = idIn.value.trim()
        if (newId === '') {
          statusEl.textContent = 'Drone id required'
          return
        }
        if (newId !== id && state.povIds.includes(newId)) {
          statusEl.textContent = `Drone ${newId} already exists`
          return
        }
        state.povIds = state.povIds.map((x) => (x === id ? newId : x))
        state.enabledPovIds = state.enabledPovIds.map((x) =>
          x === id ? newId : x,
        )
        state.enabledSrtPovIds = (state.enabledSrtPovIds ?? []).map((x) =>
          x === id ? newId : x,
        )
        state.srtByPovId = remapPovKey(state.srtByPovId, id, newId)
        setSrtId(newId, srtIn.value)
        if (state.plannedPovs?.length) {
          state.plannedPovs = state.plannedPovs.map((p) =>
            p.id === id ? { ...p, id: newId } : p,
          )
        }
        if (state.activePovId === id) {
          state.activePovId = newId
          options.onPovChange(newId)
        }
        setEnabledPov(newId, true)
        renderPovs()
        emitFleet()
        statusEl.textContent = `Drone ${newId} updated (Live on)`
      })

      const sw = document.createElement('button')
      sw.type = 'button'
      sw.className =
        'fleet-live__btn fleet-live__btn--tiny' +
        (id === state.activePovId ? ' fleet-live__btn--active' : '')
      sw.textContent = id === state.activePovId ? 'Cam' : 'Switch'
      sw.title = `Active camera → ${id}`
      sw.addEventListener('click', () => {
        state.activePovId = id
        persist()
        options.onPovChange(id)
        renderPovs()
      })

      const rm = document.createElement('button')
      rm.type = 'button'
      rm.className = 'fleet-live__btn fleet-live__btn--tiny'
      rm.textContent = '×'
      rm.addEventListener('click', () => {
        if (state.povIds.length <= 1) {
          statusEl.textContent = 'Keep at least one drone id'
          return
        }
        state.povIds = state.povIds.filter((x) => x !== id)
        state.enabledPovIds = state.enabledPovIds.filter((x) => x !== id)
        state.enabledSrtPovIds = (state.enabledSrtPovIds ?? []).filter(
          (x) => x !== id,
        )
        if (state.srtByPovId) {
          const next = { ...state.srtByPovId }
          delete next[id]
          state.srtByPovId = next
        }
        if (state.plannedPovs?.length) {
          state.plannedPovs = state.plannedPovs.filter((p) => p.id !== id)
        }
        if (state.activePovId === id) {
          state.activePovId = state.povIds[0]!
          options.onPovChange(state.activePovId)
        }
        renderPovs()
        emitFleet()
        statusEl.textContent = `Drone ${id} removed`
      })

      el.append(en, idIn, srtIn, vid, vidLab, sock, saveBtn, sw, rm)
      povList.appendChild(el)
    }
  }

  boatAddBtn.addEventListener('click', () => {
    const id = boatIdIn.value.trim()
    if (id === '') {
      statusEl.textContent = 'Boat id required'
      return
    }
    if (!state.boatIds.includes(id)) state.boatIds.push(id)
    const name = boatNameIn.value.trim() || id
    const category = boatCatIn.value.trim()
    const color = parseHexColorCss(boatColorIn.value) ?? undefined
    const existing = state.boats.findIndex((b) => b.id === id)
    const row = normalizeFleetBoatRow({
      id,
      name,
      category,
      color,
      visibility: state.boats[existing]?.visibility,
    })
    if (existing >= 0) state.boats[existing] = row
    else state.boats.push(row)
    setEnabledBoat(id, true)
    boatIdIn.value = ''
    boatNameIn.value = ''
    boatCatIn.value = ''
    boatColorIn.value = ''
    renderBoats()
    emitFleet()
    statusEl.textContent = `Boat ${id} added (Live on) — Connect to open id=${id}`
  })

  povAddBtn.addEventListener('click', () => {
    const id = povIdIn.value.trim()
    if (id === '') {
      statusEl.textContent = 'Drone id required'
      return
    }
    if (!state.povIds.includes(id)) state.povIds.push(id)
    setEnabledPov(id, true)
    povIdIn.value = ''
    renderPovs()
    emitFleet()
    statusEl.textContent = `Drone ${id} added (Live on) — Connect to open id=${id}`
  })

  function applyLive(goLive: boolean): void {
    readUrls()
    const enabledBoats = [...state.enabledBoatIds]
    const enabledPovs = [...state.enabledPovIds]
    if (goLive && enabledBoats.length === 0 && enabledPovs.length === 0) {
      statusEl.textContent =
        'Enable Live on at least one boat or drone id first'
      return
    }
    persist()
    emitFleet()
    options.onLiveApply({
      wsUrl: state.wsUrl,
      wsBoatUrl: state.wsBoatUrl,
      boatIds: enabledBoats,
      povIds: enabledPovs,
      goLive,
    })
    const nBoat = enabledBoats.length
    const nDrone = enabledPovs.length
    statusEl.textContent = goLive
      ? `live · ${nBoat} boat socket(s) · ${nDrone} drone socket(s) · open ≠ packets`
      : `reconnecting · ${nBoat}+${nDrone} enabled sockets`
  }

  applyLiveBtn.addEventListener('click', () => applyLive(true))
  reconnectBtn.addEventListener('click', () => applyLive(false))

  function applySrt(): void {
    readUrls()
    persist()
    const enabled = [...(state.enabledSrtPovIds ?? [])]
    if (enabled.length === 0) {
      statusEl.textContent = 'Enable Video on at least one drone and set its SRT id'
      return
    }
    const streams: { povId: string; srtId: string; url: string }[] = []
    const skipped: string[] = []
    const template = (state.srtUrlTemplate ?? '').trim()
    const useCatalog = shouldUseSrtCatalog(template)
    if (useCatalog && template) {
      state.srtUrlTemplate = ''
      srtTemplateInput.value = ''
      persist()
    }
    for (const povId of enabled) {
      if (streams.length >= SRT_WARM_POV_CAP) break
      const srtId = (state.srtByPovId?.[povId] ?? '').trim()
      if (!srtId) {
        skipped.push(povId)
        continue
      }
      const composed = useCatalog
        ? resolveSrtUrlForId(srtId)
        : buildSrtCallerUrl(template, srtId)
      if (!composed.ok) {
        skipped.push(`${povId} (${composed.error})`)
        continue
      }
      streams.push({ povId, srtId, url: composed.href })
    }
    if (streams.length === 0) {
      statusEl.textContent =
        skipped.length > 0
          ? `SRT skipped: ${skipped.join(', ')}`
          : 'No SRT streams to open (empty SRT id)'
      return
    }
    options.onSrtApply?.({
      srtUrlTemplate: state.srtUrlTemplate ?? '',
      streams,
    })
    statusEl.textContent = `SRT · ${streams.length} caller(s)${
      skipped.length ? ` · skipped ${skipped.length}` : ''
    } · cap ${SRT_WARM_POV_CAP}${
      shouldUseSrtCatalog(state.srtUrlTemplate) ? ' · catalog' : ''
    }`
  }

  applySrtBtn.addEventListener('click', () => applySrt())

  srtTemplateInput.addEventListener('change', () => {
    state.srtUrlTemplate = srtTemplateInput.value.trim()
    persist()
  })

  renderBoats()
  renderPovs()
  syncInputsFromState()

  return {
    setState(partial): void {
      if (partial.wsUrl !== undefined) {
        state.wsUrl = defaultBase(partial.wsUrl)
      }
      if (partial.wsBoatUrl !== undefined) {
        state.wsBoatUrl = defaultBase(partial.wsBoatUrl)
      }
      if (partial.boatIds !== undefined) {
        state.boatIds = uniqIds(partial.boatIds)
        state.enabledBoatIds = clampEnabled(
          partial.enabledBoatIds ?? state.enabledBoatIds,
          state.boatIds,
        )
      } else if (partial.enabledBoatIds !== undefined) {
        state.enabledBoatIds = clampEnabled(
          partial.enabledBoatIds,
          state.boatIds,
        )
      }
      if (partial.povIds !== undefined) {
        state.povIds = uniqIds(partial.povIds)
        state.enabledPovIds = clampEnabled(
          partial.enabledPovIds ?? state.enabledPovIds,
          state.povIds,
        )
      } else if (partial.enabledPovIds !== undefined) {
        state.enabledPovIds = clampEnabled(
          partial.enabledPovIds,
          state.povIds,
        )
      }
      if (partial.boats !== undefined) {
        state.boats = partial.boats.map((b) => normalizeFleetBoatRow(b))
      }
      if (partial.activePovId !== undefined) {
        state.activePovId = partial.activePovId
      }
      if (partial.plannedPovs !== undefined) {
        state.plannedPovs = partial.plannedPovs.map((p) => ({ ...p }))
      }
      if (partial.srtUrlTemplate !== undefined) {
        state.srtUrlTemplate = partial.srtUrlTemplate
      }
      if (partial.srtByPovId !== undefined) {
        state.srtByPovId = { ...partial.srtByPovId }
      }
      if (partial.enabledSrtPovIds !== undefined) {
        state.enabledSrtPovIds = clampEnabled(
          partial.enabledSrtPovIds,
          state.povIds,
        )
      } else if (partial.povIds !== undefined) {
        state.enabledSrtPovIds = clampEnabled(
          state.enabledSrtPovIds ?? [],
          state.povIds,
        )
      }
      syncInputsFromState()
      renderBoats()
      renderPovs()
      persist()
    },
    getState: () => ({
      wsUrl: state.wsUrl,
      wsBoatUrl: state.wsBoatUrl,
      boatIds: [...state.boatIds],
      povIds: [...state.povIds],
      enabledBoatIds: [...state.enabledBoatIds],
      enabledPovIds: [...state.enabledPovIds],
      boats: state.boats.map((b) => ({ ...b })),
      activePovId: state.activePovId,
      plannedPovs: (state.plannedPovs ?? []).map((p) => ({ ...p })),
      srtUrlTemplate: state.srtUrlTemplate ?? '',
      srtByPovId: { ...(state.srtByPovId ?? {}) },
      enabledSrtPovIds: [...(state.enabledSrtPovIds ?? [])],
    }),
    setStatus(msg): void {
      statusEl.textContent = msg
    },
    setOpsViewMode(mode: OpsViewMode): void {
      applyOpsView(mode, false)
    },
    setLiveStatus(status): void {
      liveStatus = status
      renderBoats()
      renderPovs()
    },
    setSrtSituation(text): void {
      srtSitEl.textContent = text
    },
    addBoat(input): { ok: boolean; created: boolean } {
      const id = input.id.trim()
      if (id === '') {
        statusEl.textContent = 'Boat id required'
        return { ok: false, created: false }
      }
      const created = !state.boatIds.includes(id)
      if (created) state.boatIds.push(id)
      const existing = state.boats.findIndex((b) => b.id === id)
      const row = normalizeFleetBoatRow({
        id,
        name: input.name?.trim() || state.boats[existing]?.name || id,
        category:
          input.category?.trim() || state.boats[existing]?.category || '',
        color: state.boats[existing]?.color,
        visibility: state.boats[existing]?.visibility,
        plannedLat: input.plannedLat ?? state.boats[existing]?.plannedLat,
        plannedLon: input.plannedLon ?? state.boats[existing]?.plannedLon,
      })
      if (existing >= 0) state.boats[existing] = row
      else state.boats.push(row)
      setEnabledBoat(id, true)
      renderBoats()
      emitFleet()
      persist()
      statusEl.textContent = created
        ? `Boat ${id} added from map`
        : `Boat ${id} already in fleet — planned position updated`
      return { ok: true, created }
    },
    setBoatPlannedGps(id, plannedLat, plannedLon): boolean {
      const trimmed = id.trim()
      if (trimmed === '') return false
      if (!Number.isFinite(plannedLat) || !Number.isFinite(plannedLon)) {
        return false
      }
      if (!state.boatIds.includes(trimmed)) state.boatIds.push(trimmed)
      const row = ensureBoatRow(trimmed)
      row.plannedLat = plannedLat
      row.plannedLon = plannedLon
      renderBoats()
      emitFleet()
      persist()
      statusEl.textContent = `Boat ${trimmed} planned GPS updated`
      return true
    },
    addDrone(input): { ok: boolean; created: boolean } {
      const id = input.id.trim()
      if (id === '') {
        statusEl.textContent = 'Drone id required'
        return { ok: false, created: false }
      }
      const created = !state.povIds.includes(id)
      if (created) state.povIds.push(id)
      setEnabledPov(id, true)
      if (
        typeof input.plannedLat === 'number' &&
        typeof input.plannedLon === 'number'
      ) {
        const list = state.plannedPovs ?? []
        const idx = list.findIndex((p) => p.id === id)
        const entry = {
          id,
          plannedLat: input.plannedLat,
          plannedLon: input.plannedLon,
        }
        if (idx >= 0) list[idx] = entry
        else list.push(entry)
        state.plannedPovs = list
      }
      renderPovs()
      emitFleet()
      persist()
      statusEl.textContent = created
        ? `Drone ${id} added from map`
        : `Drone ${id} already in fleet — planned position updated`
      return { ok: true, created }
    },
    highlightBoat(id): void {
      const trimmed = id.trim()
      if (collapsed) {
        collapsed = false
        body.hidden = false
        header.textContent = 'Fleet / Live ▾'
      }
      renderBoats()
      const row = boatList.querySelector(
        `[data-fleet-boat-id="${CSS.escape(trimmed)}"]`,
      ) as HTMLElement | null
      if (row) {
        row.classList.add('fleet-live__edit-row--flash')
        row.scrollIntoView({ block: 'nearest' })
        window.setTimeout(() => {
          row.classList.remove('fleet-live__edit-row--flash')
        }, 1600)
      }
      statusEl.textContent = `Boat ${trimmed} — edit name/category here`
    },
    stop(): void {
      root.remove()
    },
  }
}
