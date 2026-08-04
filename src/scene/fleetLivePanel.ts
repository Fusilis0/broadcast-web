/**
 * Ops Fleet / Live panel — register/edit boats & drones; base WS URLs.
 * Live connect opens one socket per **enabled** id (`base?type=client&subscribe=<id>`).
 * Runtime-only (sessionStorage); does not write config.json.
 */

import { DEFAULT_LIVE_WS_BASE, stripLiveWsId } from '../telemetry/liveWsUrl.ts'
import type { LiveStatusSnapshot } from '../telemetry/liveSource.ts'
import type { OpsViewMode } from './freeCam.ts'

export type FleetBoatRow = {
  id: string
  name: string
  category: string
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
}

export type FleetLivePanelOptions = {
  container: HTMLElement
  initial: FleetLivePanelState
  onFleetChange: (state: {
    boatIds: string[]
    povIds: string[]
    boats: FleetBoatRow[]
  }) => void
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
}

export type FleetLivePanelHandle = {
  setState: (partial: Partial<FleetLivePanelState>) => void
  getState: () => FleetLivePanelState
  setStatus: (msg: string) => void
  /** Sync Free/Follow buttons without notifying. */
  setOpsViewMode: (mode: OpsViewMode) => void
  /** Per-id socket + last-packet ages from TEL live ingest. */
  setLiveStatus: (status: LiveStatusSnapshot | null) => void
  stop: () => void
}

const STORAGE_KEY = 'broadcast-web.fleetLive.v1'

type SessionShape = Partial<FleetLivePanelState> & {
  enabledBoatIds?: string[]
  enabledPovIds?: string[]
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

function fmtPktAge(ageMs: number | null): string {
  if (ageMs === null) return 'nopkt'
  if (ageMs < 1000) return `${Math.round(ageMs)}ms`
  return `${(ageMs / 1000).toFixed(1)}s`
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
    boats: options.initial.boats.map((b) => ({ ...b })),
    activePovId: options.initial.activePovId,
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
  liveRow.append(applyLiveBtn, reconnectBtn)
  liveSec.appendChild(liveRow)

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
  const boatAddBtn = document.createElement('button')
  boatAddBtn.type = 'button'
  boatAddBtn.className = 'fleet-live__btn'
  boatAddBtn.textContent = 'Add'
  boatAddRow.append(boatIdIn, boatNameIn, boatCatIn, boatAddBtn)
  boatSec.appendChild(boatAddRow)

  // —— Ops view (preview vs air) ——
  let opsViewMode: OpsViewMode = options.opsViewMode ?? 'follow'
  const viewSec = document.createElement('section')
  viewSec.className = 'fleet-live__section'
  viewSec.appendChild(sectionTitle('Ops view (preview)'))
  body.appendChild(viewSec)

  const viewRow = document.createElement('div')
  viewRow.className = 'fleet-live__row'
  const followBtn = document.createElement('button')
  followBtn.type = 'button'
  followBtn.className = 'fleet-live__btn'
  followBtn.textContent = 'Follow POV'
  followBtn.title = 'On-screen preview follows active air POV'
  const freeBtn = document.createElement('button')
  freeBtn.type = 'button'
  freeBtn.className = 'fleet-live__btn'
  freeBtn.textContent = 'Free cam'
  freeBtn.title =
    'Orbit/pan/zoom the world. Does not change active POV / NDI air cam.'
  const frameBtn = document.createElement('button')
  frameBtn.type = 'button'
  frameBtn.className = 'fleet-live__btn fleet-live__btn--primary'
  frameBtn.textContent = 'Frame boats'
  frameBtn.title =
    'Free cam → look at live boat meshes. If empty, wait for packets or Apply origin near the boat GPS.'
  viewRow.append(followBtn, freeBtn, frameBtn)
  viewSec.appendChild(viewRow)

  const viewHint = document.createElement('div')
  viewHint.className = 'fleet-live__hint'
  viewHint.textContent =
    'Air/NDI = active POV. Distant boats: Frame boats, or Apply origin near their GPS.'
  viewSec.appendChild(viewHint)

  frameBtn.addEventListener('click', () => {
    options.onFrameFleet?.()
  })

  function syncOpsViewButtons(): void {
    followBtn.classList.toggle(
      'fleet-live__btn--active',
      opsViewMode === 'follow',
    )
    freeBtn.classList.toggle('fleet-live__btn--active', opsViewMode === 'free')
  }

  function applyOpsView(mode: OpsViewMode, notify: boolean): void {
    if (mode === opsViewMode) {
      syncOpsViewButtons()
      return
    }
    opsViewMode = mode
    syncOpsViewButtons()
    if (notify) options.onOpsViewChange?.(mode)
  }

  followBtn.addEventListener('click', () => {
    applyOpsView('follow', true)
  })
  freeBtn.addEventListener('click', () => {
    applyOpsView('free', true)
  })
  syncOpsViewButtons()

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
  }

  function readUrls(): void {
    state.wsUrl = stripLiveWsId(droneUrlInput.value) || DEFAULT_LIVE_WS_BASE
    state.wsBoatUrl = stripLiveWsId(boatUrlInput.value) || DEFAULT_LIVE_WS_BASE
    droneUrlInput.value = state.wsUrl
    boatUrlInput.value = state.wsBoatUrl
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
      row = { id, name: id, category: '' }
      state.boats.push(row)
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
      catIn.title = 'Category (colour keyword)'

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
        const next = {
          id: newId,
          name: nameIn.value.trim() || newId,
          category: catIn.value.trim(),
        }
        const idx = state.boats.findIndex((b) => b.id === newId)
        if (idx >= 0) state.boats[idx] = next
        else state.boats.push(next)
        // Last-edited → prefer live-enabled.
        setEnabledBoat(newId, true)
        renderBoats()
        emitFleet()
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
      })

      el.append(en, idIn, nameIn, catIn, sock, saveBtn, rm)
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
        if (state.activePovId === id) {
          state.activePovId = state.povIds[0]!
          options.onPovChange(state.activePovId)
        }
        renderPovs()
        emitFleet()
      })

      el.append(en, idIn, sock, saveBtn, sw, rm)
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
    const existing = state.boats.findIndex((b) => b.id === id)
    const row = { id, name, category }
    if (existing >= 0) state.boats[existing] = row
    else state.boats.push(row)
    setEnabledBoat(id, true)
    boatIdIn.value = ''
    boatNameIn.value = ''
    boatCatIn.value = ''
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
        state.boats = partial.boats.map((b) => ({ ...b }))
      }
      if (partial.activePovId !== undefined) {
        state.activePovId = partial.activePovId
      }
      syncInputsFromState()
      renderBoats()
      renderPovs()
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
    stop(): void {
      root.remove()
    },
  }
}
