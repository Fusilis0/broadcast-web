/**
 * Ops Fleet / Live panel — register boats & drones, paste WS URLs, switch POV.
 * Runtime-only (sessionStorage); does not write config.json.
 */

export type FleetBoatRow = {
  id: string
  name: string
  category: string
}

export type FleetLivePanelState = {
  wsUrl: string
  wsBoatUrl: string
  boatIds: string[]
  povIds: string[]
  boats: FleetBoatRow[]
  activePovId: string
}

export type FleetLivePanelOptions = {
  container: HTMLElement
  initial: FleetLivePanelState
  /** Apply fleet lists + names (no ingest restart). */
  onFleetChange: (state: {
    boatIds: string[]
    povIds: string[]
    boats: FleetBoatRow[]
  }) => void
  /** Switch active drone/POV camera. */
  onPovChange: (povId: string) => void
  /**
   * Apply WS URLs and restart live ingest (caller stops/starts TEL).
   * `goLive` true → mode live; false keeps current mode but still reconnects.
   */
  onLiveApply: (state: {
    wsUrl: string
    wsBoatUrl: string
    boatIds: string[]
    povIds: string[]
    goLive: boolean
  }) => void
}

export type FleetLivePanelHandle = {
  setState: (partial: Partial<FleetLivePanelState>) => void
  getState: () => FleetLivePanelState
  setStatus: (msg: string) => void
  stop: () => void
}

const STORAGE_KEY = 'broadcast-web.fleetLive.v1'

export function loadFleetLiveFromSession(): Partial<FleetLivePanelState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Partial<FleetLivePanelState>
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
        wsUrl: state.wsUrl,
        wsBoatUrl: state.wsBoatUrl,
        boatIds: state.boatIds,
        povIds: state.povIds,
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

/**
 * Collapsible ops panel (top-right): live WS URLs, boat registry, drone/POV list.
 */
export function startFleetLivePanel(
  options: FleetLivePanelOptions,
): FleetLivePanelHandle {
  let state: FleetLivePanelState = {
    wsUrl: options.initial.wsUrl,
    wsBoatUrl: options.initial.wsBoatUrl,
    boatIds: uniqIds(options.initial.boatIds),
    povIds: uniqIds(options.initial.povIds),
    boats: options.initial.boats.map((b) => ({ ...b })),
    activePovId: options.initial.activePovId,
  }

  const root = document.createElement('div')
  root.className = 'fleet-live'
  root.setAttribute('data-ops', 'fleet-live')

  const header = document.createElement('button')
  header.type = 'button'
  header.className = 'fleet-live__header'
  header.textContent = 'Fleet / Live ▾'
  header.title = 'Register boats & drones; paste WS URLs (not saved to config.json)'
  root.appendChild(header)

  const body = document.createElement('div')
  body.className = 'fleet-live__body'
  root.appendChild(body)

  // —— Live URLs ——
  const liveSec = document.createElement('section')
  liveSec.className = 'fleet-live__section'
  liveSec.innerHTML = `<div class="fleet-live__title">Live WebSockets</div>`
  body.appendChild(liveSec)

  const droneUrlInput = document.createElement('input')
  droneUrlInput.className = 'fleet-live__input fleet-live__input--wide'
  droneUrlInput.placeholder = 'Drone WS (wsUrl) — full TelemetryData JSON'
  droneUrlInput.spellcheck = false
  droneUrlInput.value = state.wsUrl
  liveSec.appendChild(droneUrlInput)

  const boatUrlInput = document.createElement('input')
  boatUrlInput.className = 'fleet-live__input fleet-live__input--wide'
  boatUrlInput.placeholder =
    'Boat WS (wsBoatUrl) — e.g. ws://host:8080/ws?type=drone&id=40'
  boatUrlInput.spellcheck = false
  boatUrlInput.value = state.wsBoatUrl
  liveSec.appendChild(boatUrlInput)

  const liveRow = document.createElement('div')
  liveRow.className = 'fleet-live__row'
  const applyLiveBtn = document.createElement('button')
  applyLiveBtn.type = 'button'
  applyLiveBtn.className = 'fleet-live__btn fleet-live__btn--primary'
  applyLiveBtn.textContent = 'Connect live'
  applyLiveBtn.title = 'Set mode=live and reconnect with these URLs'
  const reconnectBtn = document.createElement('button')
  reconnectBtn.type = 'button'
  reconnectBtn.className = 'fleet-live__btn'
  reconnectBtn.textContent = 'Reconnect'
  reconnectBtn.title = 'Restart ingest with current mode + these URLs'
  liveRow.appendChild(applyLiveBtn)
  liveRow.appendChild(reconnectBtn)
  liveSec.appendChild(liveRow)

  // —— Boats ——
  const boatSec = document.createElement('section')
  boatSec.className = 'fleet-live__section'
  boatSec.innerHTML = `<div class="fleet-live__title">Boats</div>`
  body.appendChild(boatSec)

  const boatList = document.createElement('div')
  boatList.className = 'fleet-live__list'
  boatSec.appendChild(boatList)

  const boatAddRow = document.createElement('div')
  boatAddRow.className = 'fleet-live__row'
  const boatIdIn = document.createElement('input')
  boatIdIn.className = 'fleet-live__input'
  boatIdIn.placeholder = 'id (40)'
  boatIdIn.style.width = '56px'
  const boatNameIn = document.createElement('input')
  boatNameIn.className = 'fleet-live__input'
  boatNameIn.placeholder = 'name'
  boatNameIn.style.width = '72px'
  const boatCatIn = document.createElement('input')
  boatCatIn.className = 'fleet-live__input'
  boatCatIn.placeholder = 'category (Mavi)'
  boatCatIn.style.width = '88px'
  const boatAddBtn = document.createElement('button')
  boatAddBtn.type = 'button'
  boatAddBtn.className = 'fleet-live__btn'
  boatAddBtn.textContent = 'Add'
  boatAddRow.append(boatIdIn, boatNameIn, boatCatIn, boatAddBtn)
  boatSec.appendChild(boatAddRow)

  // —— Drones / POV ——
  const povSec = document.createElement('section')
  povSec.className = 'fleet-live__section'
  povSec.innerHTML = `<div class="fleet-live__title">Drones / POV cameras</div>`
  body.appendChild(povSec)

  const povList = document.createElement('div')
  povList.className = 'fleet-live__list'
  povSec.appendChild(povList)

  const povAddRow = document.createElement('div')
  povAddRow.className = 'fleet-live__row'
  const povIdIn = document.createElement('input')
  povIdIn.className = 'fleet-live__input'
  povIdIn.placeholder = 'id (1)'
  povIdIn.style.width = '56px'
  const povAddBtn = document.createElement('button')
  povAddBtn.type = 'button'
  povAddBtn.className = 'fleet-live__btn'
  povAddBtn.textContent = 'Add drone'
  povAddRow.append(povIdIn, povAddBtn)
  povSec.appendChild(povAddRow)

  const statusEl = document.createElement('div')
  statusEl.className = 'fleet-live__status'
  statusEl.textContent = 'URLs stay in this browser session only'
  body.appendChild(statusEl)

  options.container.appendChild(root)

  let collapsed = false
  header.addEventListener('click', () => {
    collapsed = !collapsed
    body.hidden = collapsed
    header.textContent = collapsed ? 'Fleet / Live ▸' : 'Fleet / Live ▾'
  })

  function syncInputsFromState(): void {
    droneUrlInput.value = state.wsUrl
    boatUrlInput.value = state.wsBoatUrl
  }

  function readUrls(): void {
    state.wsUrl = droneUrlInput.value.trim()
    state.wsBoatUrl = boatUrlInput.value.trim()
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

  function renderBoats(): void {
    boatList.replaceChildren()
    for (const id of state.boatIds) {
      const row = state.boats.find((b) => b.id === id) ?? {
        id,
        name: id,
        category: '',
      }
      const el = document.createElement('div')
      el.className = 'fleet-live__item'
      const label = document.createElement('span')
      label.textContent = `${row.id} · ${row.name}${row.category ? ` (${row.category})` : ''}`
      const rm = document.createElement('button')
      rm.type = 'button'
      rm.className = 'fleet-live__btn fleet-live__btn--tiny'
      rm.textContent = '×'
      rm.title = `Remove boat ${id}`
      rm.addEventListener('click', () => {
        state.boatIds = state.boatIds.filter((x) => x !== id)
        state.boats = state.boats.filter((b) => b.id !== id)
        renderBoats()
        emitFleet()
      })
      el.append(label, rm)
      boatList.appendChild(el)
    }
  }

  function renderPovs(): void {
    povList.replaceChildren()
    for (const id of state.povIds) {
      const el = document.createElement('div')
      el.className = 'fleet-live__item'
      const sw = document.createElement('button')
      sw.type = 'button'
      sw.className =
        'fleet-live__btn fleet-live__btn--tiny' +
        (id === state.activePovId ? ' fleet-live__btn--active' : '')
      sw.textContent = id === state.activePovId ? `● ${id}` : `○ ${id}`
      sw.title = `Switch camera to POV ${id}`
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
      rm.title = `Remove POV ${id}`
      rm.addEventListener('click', () => {
        if (state.povIds.length <= 1) {
          statusEl.textContent = 'Keep at least one drone/POV id'
          return
        }
        state.povIds = state.povIds.filter((x) => x !== id)
        if (state.activePovId === id) {
          state.activePovId = state.povIds[0]!
          options.onPovChange(state.activePovId)
        }
        renderPovs()
        emitFleet()
      })
      el.append(sw, rm)
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
    boatIdIn.value = ''
    boatNameIn.value = ''
    boatCatIn.value = ''
    renderBoats()
    emitFleet()
    statusEl.textContent = `Boat ${id} registered`
  })

  povAddBtn.addEventListener('click', () => {
    const id = povIdIn.value.trim()
    if (id === '') {
      statusEl.textContent = 'Drone/POV id required'
      return
    }
    if (!state.povIds.includes(id)) state.povIds.push(id)
    povIdIn.value = ''
    renderPovs()
    emitFleet()
    statusEl.textContent = `Drone/POV ${id} registered`
  })

  function applyLive(goLive: boolean): void {
    readUrls()
    persist()
    emitFleet()
    options.onLiveApply({
      wsUrl: state.wsUrl,
      wsBoatUrl: state.wsBoatUrl,
      boatIds: [...state.boatIds],
      povIds: [...state.povIds],
      goLive,
    })
    statusEl.textContent = goLive
      ? 'Connecting live…'
      : 'Reconnecting ingest…'
  }

  applyLiveBtn.addEventListener('click', () => applyLive(true))
  reconnectBtn.addEventListener('click', () => applyLive(false))

  renderBoats()
  renderPovs()
  syncInputsFromState()

  return {
    setState(partial): void {
      if (partial.wsUrl !== undefined) state.wsUrl = partial.wsUrl
      if (partial.wsBoatUrl !== undefined) state.wsBoatUrl = partial.wsBoatUrl
      if (partial.boatIds !== undefined) state.boatIds = uniqIds(partial.boatIds)
      if (partial.povIds !== undefined) state.povIds = uniqIds(partial.povIds)
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
      boats: state.boats.map((b) => ({ ...b })),
      activePovId: state.activePovId,
    }),
    setStatus(msg): void {
      statusEl.textContent = msg
    },
    stop(): void {
      root.remove()
    },
  }
}
