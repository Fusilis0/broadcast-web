/**
 * Project section Load / Save controls (Phase 13.8 UX).
 * Electron (`folderMode`): Save writes via races bridge; Load = dropdown.
 * Chrome: Save = download; no pretend folder write.
 */

export type LocalProjectControlsOptions = {
  container: HTMLElement
  /**
   * True when Electron `broadcastStudio.races` is present.
   * Save primary = folder write; Export = download; Load on select change.
   */
  folderMode: boolean
  /** Initial pack ids for the Load dropdown. */
  raceIds?: readonly string[]
  activeRaceId?: string
  /** Display name for the active pack (shown next to Save). */
  projectName?: string
  projectWritesEnabled?: boolean
  onRaceLoad?: (raceId: string) => void
  onSaveProject?: () => void
  onSaveAsProject?: () => void
  /** Download `project.json` only (Export / Chrome Save path helper). */
  onExportProject?: () => void
}

export type LocalProjectControlsHandle = {
  setRaceIds: (raceIds: readonly string[], activeRaceId?: string) => void
  setActiveRaceId: (raceId: string) => void
  /** Show active pack name + id next to Save. */
  setProjectMeta: (id: string, name: string) => void
  /** Small hint under the row, e.g. `saving to: …/public/races`. */
  setRootHint: (path: string | null) => void
  /** Success / fail line (path or error). */
  setSaveStatus: (msg: string) => void
  setProjectWritesEnabled: (enabled: boolean) => void
  dispose: () => void
}

export function formatProjectMetaText(id: string, name: string): string {
  const safeId = id.trim() || '—'
  const safeName = name.trim() || safeId
  if (safeName === safeId) return safeId
  return `${safeName} (${safeId})`
}

export function formatRacesRootHint(path: string | null | undefined): string {
  const p = path?.trim()
  if (!p) return ''
  return `saving to: ${p}`
}

/**
 * Mount name + Load dropdown + Save / Save as (+ Export in folder mode).
 * Caller appends into the Project sidebar section (above origin row).
 */
export function mountLocalProjectControls(
  options: LocalProjectControlsOptions,
): LocalProjectControlsHandle {
  const root = document.createElement('div')
  root.className = 'ops-local-project'
  root.setAttribute('data-ops', 'local-project')

  const metaRow = document.createElement('div')
  metaRow.className = 'ops-hud__mode-row'
  root.appendChild(metaRow)

  const metaLabel = document.createElement('span')
  metaLabel.className = 'ops-hud__mode-label'
  metaLabel.textContent = 'project'
  metaRow.appendChild(metaLabel)

  const metaValue = document.createElement('span')
  metaValue.className = 'ops-local-project__meta'
  metaValue.setAttribute('data-ops', 'project-meta')
  metaRow.appendChild(metaValue)

  const raceRow = document.createElement('div')
  raceRow.className = 'ops-hud__mode-row'
  root.appendChild(raceRow)

  const raceLabel = document.createElement('label')
  raceLabel.className = 'ops-hud__mode-label'
  raceLabel.htmlFor = 'ops-race-id'
  raceLabel.textContent = options.folderMode ? 'Load' : 'race'
  raceRow.appendChild(raceLabel)

  const raceSelect = document.createElement('select')
  raceSelect.id = 'ops-race-id'
  raceSelect.className = 'ops-hud__mode-select'
  raceSelect.title = options.folderMode
    ? 'Projects in the local races folder'
    : 'Local RaceProject packs under /races/'
  raceSelect.setAttribute('data-ops', 'race-select')
  raceRow.appendChild(raceSelect)

  const raceCustom = document.createElement('input')
  raceCustom.className = 'ops-hud__input'
  raceCustom.type = 'text'
  raceCustom.placeholder = 'id…'
  raceCustom.title = options.folderMode
    ? 'Optional: type an id not yet listed, then Load'
    : 'Type a pack id (public/races/<id>/) then Load'
  raceCustom.spellcheck = false
  raceCustom.setAttribute('data-ops', 'race-custom')
  raceRow.appendChild(raceCustom)

  const raceLoadBtn = document.createElement('button')
  raceLoadBtn.type = 'button'
  raceLoadBtn.className = 'ops-hud__btn'
  raceLoadBtn.textContent = 'Load'
  raceLoadBtn.title = 'Load RaceProject pack'
  raceLoadBtn.setAttribute('data-ops', 'race-load')
  // In folder mode, select change loads; button still useful for typed ids.
  if (options.folderMode) {
    raceLoadBtn.title = 'Load typed id (dropdown loads on change)'
  }
  raceRow.appendChild(raceLoadBtn)

  const raceSaveBtn = document.createElement('button')
  raceSaveBtn.type = 'button'
  raceSaveBtn.className = 'ops-hud__btn'
  raceSaveBtn.textContent = 'Save'
  raceSaveBtn.setAttribute('data-ops', 'race-save')
  raceRow.appendChild(raceSaveBtn)

  const raceSaveAsBtn = document.createElement('button')
  raceSaveAsBtn.type = 'button'
  raceSaveAsBtn.className = 'ops-hud__btn'
  raceSaveAsBtn.textContent = 'Save as'
  raceSaveAsBtn.setAttribute('data-ops', 'race-save-as')
  raceRow.appendChild(raceSaveAsBtn)

  let exportBtn: HTMLButtonElement | null = null
  if (options.folderMode) {
    exportBtn = document.createElement('button')
    exportBtn.type = 'button'
    exportBtn.className = 'ops-hud__btn'
    exportBtn.textContent = 'Export…'
    exportBtn.title = 'Download project.json only (does not write the races folder)'
    exportBtn.setAttribute('data-ops', 'race-export')
    raceRow.appendChild(exportBtn)
  }

  const raceHint = document.createElement('span')
  raceHint.className = 'ops-hud__mode-hint'
  raceHint.setAttribute('data-ops', 'race-hint')
  raceRow.appendChild(raceHint)

  const statusRow = document.createElement('div')
  statusRow.className = 'ops-hud__mode-row ops-local-project__status-row'
  root.appendChild(statusRow)

  const rootHint = document.createElement('span')
  rootHint.className = 'ops-hud__mode-hint ops-local-project__root'
  rootHint.setAttribute('data-ops', 'races-root')
  statusRow.appendChild(rootHint)

  const saveStatus = document.createElement('span')
  saveStatus.className = 'ops-hud__mode-hint ops-local-project__save-status'
  saveStatus.setAttribute('aria-live', 'polite')
  saveStatus.setAttribute('data-ops', 'save-status')
  statusRow.appendChild(saveStatus)

  options.container.appendChild(root)

  let projectWritesEnabled = options.projectWritesEnabled !== false
  let raceIds = [...(options.raceIds ?? ['demo-istanbul'])]
  let activeRaceId =
    options.activeRaceId?.trim() || raceIds[0] || 'demo-istanbul'
  let projectId = activeRaceId
  let projectName = options.projectName?.trim() || activeRaceId

  function applyMeta(): void {
    metaValue.textContent = formatProjectMetaText(projectId, projectName)
  }

  function applyProjectWritesEnabled(): void {
    raceSaveBtn.disabled = !projectWritesEnabled
    raceSaveAsBtn.disabled = !projectWritesEnabled
    if (exportBtn) exportBtn.disabled = !projectWritesEnabled
    if (!projectWritesEnabled) {
      raceSaveBtn.title = 'Air-only role — Save disabled (read/load only)'
      raceSaveAsBtn.title = 'Air-only role — Save as disabled (read/load only)'
      if (exportBtn) exportBtn.title = 'Air-only role — Export disabled'
      raceHint.textContent = 'air-only · Pack ok'
      return
    }
    if (options.folderMode) {
      raceSaveBtn.title =
        'Overwrite current project id into the local races folder (+ API when configured)'
      raceSaveAsBtn.title =
        'New id + name → write into the local races folder (+ API when configured)'
      raceHint.textContent = 'Save=folder · Export=download'
    } else {
      raceSaveBtn.title =
        'Overwrite current project id: download project.json (+ API PUT when projectsApiBase is set).'
      raceSaveAsBtn.title =
        'New id + name from prompts: download project.json (+ API POST when projectsApiBase is set).'
      raceHint.textContent = 'Save=download · API optional'
    }
  }

  function rebuildRaceSelect(): void {
    raceSelect.replaceChildren()
    for (const id of raceIds) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = id
      raceSelect.appendChild(opt)
    }
    if (raceIds.includes(activeRaceId)) {
      raceSelect.value = activeRaceId
    } else if (raceIds.length > 0) {
      raceSelect.value = raceIds[0]!
    }
    raceCustom.value = activeRaceId
  }

  function resolveRacePick(): string {
    const typed = raceCustom.value.trim()
    if (typed !== '') return typed
    return raceSelect.value.trim()
  }

  function requestRaceLoad(fromSelect = false): void {
    const id = fromSelect ? raceSelect.value.trim() : resolveRacePick()
    if (!id) return
    activeRaceId = id
    raceCustom.value = id
    if (raceIds.includes(id)) raceSelect.value = id
    options.onRaceLoad?.(id)
  }

  applyMeta()
  applyProjectWritesEnabled()
  rebuildRaceSelect()

  raceSelect.addEventListener('change', () => {
    activeRaceId = raceSelect.value
    raceCustom.value = activeRaceId
    if (options.folderMode) {
      requestRaceLoad(true)
    }
  })
  raceLoadBtn.addEventListener('click', () => {
    requestRaceLoad(false)
  })
  raceCustom.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      requestRaceLoad(false)
    }
  })
  raceSaveBtn.addEventListener('click', () => {
    if (!projectWritesEnabled) return
    options.onSaveProject?.()
  })
  raceSaveAsBtn.addEventListener('click', () => {
    if (!projectWritesEnabled) return
    options.onSaveAsProject?.()
  })
  exportBtn?.addEventListener('click', () => {
    if (!projectWritesEnabled) return
    options.onExportProject?.()
  })

  return {
    setRaceIds(nextIds, nextActive): void {
      raceIds = nextIds.length > 0 ? [...nextIds] : ['demo-istanbul']
      if (nextActive !== undefined && nextActive.trim() !== '') {
        activeRaceId = nextActive.trim()
      } else if (!raceIds.includes(activeRaceId)) {
        activeRaceId = raceIds[0]!
      }
      rebuildRaceSelect()
    },
    setActiveRaceId(raceId: string): void {
      const id = raceId.trim()
      if (!id) return
      activeRaceId = id
      projectId = id
      raceCustom.value = id
      if (raceIds.includes(id)) raceSelect.value = id
      applyMeta()
    },
    setProjectMeta(id: string, name: string): void {
      projectId = id.trim() || projectId
      projectName = name.trim() || projectId
      activeRaceId = projectId
      raceCustom.value = projectId
      if (raceIds.includes(projectId)) raceSelect.value = projectId
      applyMeta()
    },
    setRootHint(path: string | null): void {
      rootHint.textContent = formatRacesRootHint(path)
    },
    setSaveStatus(msg: string): void {
      saveStatus.textContent = msg
    },
    setProjectWritesEnabled(enabled: boolean): void {
      projectWritesEnabled = enabled
      applyProjectWritesEnabled()
    },
    dispose(): void {
      root.remove()
    },
  }
}
