/**
 * Project manager sidebar UI (Phase 11.4).
 * List + rename / duplicate / archive when projectsApiBase is configured.
 */

import { promptModal } from '../ui/promptModal.ts'
import { isSafeRaceId } from './parseRaceProject.ts'
import {
  ARCHIVED_LABEL,
  duplicateRaceProject,
  isArchived,
  isProjectsApiConfigured,
  listRaceProjects,
  renameRaceProject,
  setRaceProjectArchived,
  type RaceProjectSummary,
} from './projectManager.ts'
import { loadRaceProject } from './loadRaceProject.ts'
import { getRacesBridge } from './racesBridge.ts'
import type { RaceProject } from './types.ts'

export type ProjectManagerPanelOptions = {
  container: HTMLElement
  projectsApiBase: string
  bearerToken?: string
  /** Editor writes; air → manager mutating controls disabled. */
  canWrite?: boolean
  getActiveProjectId?: () => string | undefined
  /** After rename/duplicate/archive — refresh HUD picker + optional load. */
  onProjectsChanged?: (activeId?: string) => void | Promise<void>
  /** After successful rename of the active project — apply new pack. */
  onRenamedActive?: (project: RaceProject) => void | Promise<void>
}

export type ProjectManagerPanelHandle = {
  refresh: () => Promise<void>
  dispose: () => void
}

async function promptIdName(
  title: string,
  defaults: { id: string; name: string },
): Promise<{ id: string; name: string } | null> {
  // Electron overrides window.prompt to throw — use shared DOM modal.
  const idRaw = await promptModal(`${title} — project id`, defaults.id)
  if (idRaw === null) return null
  const id = idRaw.trim()
  if (!isSafeRaceId(id)) {
    window.alert(
      'Invalid project id. Use letters, digits, dash, underscore (see RaceProject contract).',
    )
    return null
  }
  const nameRaw = await promptModal(
    `${title} — display name`,
    defaults.name || id,
  )
  if (nameRaw === null) return null
  return { id, name: nameRaw.trim() || id }
}

/**
 * Mount project list / rename / duplicate / archive into a sidebar section.
 */
export function startProjectManagerPanel(
  options: ProjectManagerPanelOptions,
): ProjectManagerPanelHandle {
  const root = document.createElement('div')
  root.className = 'ops-pm'
  root.setAttribute('data-ops', 'project-manager')

  const hint = document.createElement('p')
  hint.className = 'ops-pm__hint'
  root.appendChild(hint)

  const toolbar = document.createElement('div')
  toolbar.className = 'ops-pm__toolbar'
  root.appendChild(toolbar)

  const refreshBtn = document.createElement('button')
  refreshBtn.type = 'button'
  refreshBtn.className = 'ops-pm__btn'
  refreshBtn.textContent = 'Refresh'
  toolbar.appendChild(refreshBtn)

  const showArchivedLabel = document.createElement('label')
  showArchivedLabel.className = 'ops-pm__check'
  const showArchived = document.createElement('input')
  showArchived.type = 'checkbox'
  showArchivedLabel.appendChild(showArchived)
  showArchivedLabel.appendChild(document.createTextNode(' Show archived'))
  toolbar.appendChild(showArchivedLabel)

  const status = document.createElement('p')
  status.className = 'ops-pm__status'
  status.setAttribute('aria-live', 'polite')
  root.appendChild(status)

  const list = document.createElement('div')
  list.className = 'ops-pm__list'
  root.appendChild(list)

  // Insert above existing Load/Save/origin HUD in the Project section.
  options.container.prepend(root)

  const apiBase = options.projectsApiBase.trim()
  const apiLive = isProjectsApiConfigured(apiBase)
  const canWrite = apiLive && options.canWrite !== false

  if (!apiLive) {
    const localFolder = getRacesBridge() !== null
    hint.textContent = localFolder
      ? 'No projects API — use Load dropdown + Save (local races folder) above. Rename / duplicate / archive need the API.'
      : 'Static-only (no API) — rename / duplicate / archive disabled. Use Save / Save as download.'
    showArchived.disabled = true
    refreshBtn.disabled = true
  } else if (!canWrite) {
    hint.textContent =
      'Air role — browse/load only. Rename / duplicate / archive disabled.'
  } else {
    hint.textContent =
      'API projects — rename = copy under new id then delete old (safe if create fails).'
  }

  let disposed = false
  let busy = false

  function setStatus(msg: string): void {
    status.textContent = msg
  }

  function writeOpts() {
    return {
      projectsApiBase: apiBase,
      bearerToken: options.bearerToken,
    }
  }

  async function runAction(label: string, fn: () => Promise<void>): Promise<void> {
    if (busy || disposed) return
    busy = true
    setStatus(`${label}…`)
    try {
      await fn()
    } catch (err) {
      console.warn(`[projects] ${label} failed`, err)
      setStatus(
        err instanceof Error ? `${label} failed: ${err.message}` : `${label} failed`,
      )
    } finally {
      busy = false
    }
  }

  function renderRows(entries: RaceProjectSummary[]): void {
    list.replaceChildren()
    if (entries.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'ops-pm__empty'
      empty.textContent = showArchived.checked
        ? 'No projects (including archived).'
        : 'No active projects.'
      list.appendChild(empty)
      return
    }

    const activeId = options.getActiveProjectId?.()

    for (const entry of entries) {
      const row = document.createElement('div')
      row.className = 'ops-pm__row'
      if (entry.id === activeId) row.classList.add('ops-pm__row--active')
      if (isArchived(entry.labels)) row.classList.add('ops-pm__row--archived')

      const meta = document.createElement('div')
      meta.className = 'ops-pm__meta'
      const title = document.createElement('div')
      title.className = 'ops-pm__title'
      title.textContent = entry.name
      meta.appendChild(title)
      const sub = document.createElement('div')
      sub.className = 'ops-pm__sub'
      const tags = entry.labels.length ? ` · ${entry.labels.join(',')}` : ''
      sub.textContent = `${entry.id} · r${entry.revision}${tags}`
      meta.appendChild(sub)
      row.appendChild(meta)

      const actions = document.createElement('div')
      actions.className = 'ops-pm__actions'

      const dupBtn = document.createElement('button')
      dupBtn.type = 'button'
      dupBtn.className = 'ops-pm__btn'
      dupBtn.textContent = 'Dup'
      dupBtn.title = 'Duplicate under a new id'
      dupBtn.disabled = !canWrite
      actions.appendChild(dupBtn)

      const renameBtn = document.createElement('button')
      renameBtn.type = 'button'
      renameBtn.className = 'ops-pm__btn'
      renameBtn.textContent = 'Rename'
      renameBtn.title =
        'Duplicate under new id, then delete old (only after create succeeds)'
      renameBtn.disabled = !canWrite
      actions.appendChild(renameBtn)

      const archiveBtn = document.createElement('button')
      archiveBtn.type = 'button'
      archiveBtn.className = 'ops-pm__btn'
      const archived = isArchived(entry.labels)
      archiveBtn.textContent = archived ? 'Unarchive' : 'Archive'
      archiveBtn.title = archived
        ? 'Remove archived label'
        : 'Hide from default list (label: archived)'
      archiveBtn.disabled = !canWrite
      actions.appendChild(archiveBtn)

      row.appendChild(actions)
      list.appendChild(row)

      dupBtn.addEventListener('click', () => {
        void runAction('Duplicate', async () => {
          const metaPrompt = await promptIdName('Duplicate', {
            id: `${entry.id}-copy`,
            name: `${entry.name} (copy)`,
          })
          if (!metaPrompt) {
            setStatus('duplicate cancelled')
            return
          }
          const source = await loadRaceProject(entry.id, {
            projectsApiBase: apiBase,
          })
          const labels = entry.labels.filter((l) => l !== ARCHIVED_LABEL)
          const created = await duplicateRaceProject(source, metaPrompt, {
            ...writeOpts(),
            labels: labels.length ? labels : undefined,
          })
          setStatus(`duplicated → ${created.id}`)
          await options.onProjectsChanged?.(created.id)
          await refresh()
        })
      })

      renameBtn.addEventListener('click', () => {
        void runAction('Rename', async () => {
          const metaPrompt = await promptIdName('Rename', {
            id: entry.id,
            name: entry.name,
          })
          if (!metaPrompt) {
            setStatus('rename cancelled')
            return
          }
          if (metaPrompt.id === entry.id) {
            window.alert('Choose a new project id (ids are immutable).')
            setStatus('rename needs a new id')
            return
          }
          if (
            !window.confirm(
              `Rename "${entry.id}" → "${metaPrompt.id}"?\n` +
                'Creates the new project first, then deletes the old id.',
            )
          ) {
            setStatus('rename cancelled')
            return
          }
          const labels = entry.labels.filter((l) => l !== ARCHIVED_LABEL)
          const created = await renameRaceProject(entry.id, metaPrompt, {
            ...writeOpts(),
            labels: labels.length ? labels : undefined,
          })
          setStatus(`renamed → ${created.id}`)
          if (options.getActiveProjectId?.() === entry.id) {
            await options.onRenamedActive?.(created)
          }
          await options.onProjectsChanged?.(created.id)
          await refresh()
        })
      })

      archiveBtn.addEventListener('click', () => {
        void runAction(archived ? 'Unarchive' : 'Archive', async () => {
          await setRaceProjectArchived(entry.id, !archived, {
            ...writeOpts(),
            currentLabels: entry.labels,
            expectedRevision: entry.revision,
          })
          setStatus(archived ? `unarchived ${entry.id}` : `archived ${entry.id}`)
          await options.onProjectsChanged?.(
            options.getActiveProjectId?.() ?? entry.id,
          )
          await refresh()
        })
      })
    }
  }

  async function refresh(): Promise<void> {
    if (disposed) return
    if (!apiLive) {
      list.replaceChildren()
      const empty = document.createElement('p')
      empty.className = 'ops-pm__empty'
      empty.textContent = 'Connect projectsApiBase to manage API projects.'
      list.appendChild(empty)
      return
    }
    setStatus('Loading…')
    try {
      const entries = await listRaceProjects({
        projectsApiBase: apiBase,
        includeArchived: showArchived.checked,
      })
      if (disposed) return
      renderRows(entries)
      setStatus(`${entries.length} project${entries.length === 1 ? '' : 's'}`)
    } catch (err) {
      console.warn('[projects] list failed', err)
      setStatus(err instanceof Error ? err.message : 'list failed')
    }
  }

  refreshBtn.addEventListener('click', () => {
    void refresh()
  })
  showArchived.addEventListener('change', () => {
    void refresh()
  })

  void refresh()

  return {
    refresh,
    dispose() {
      disposed = true
      root.remove()
    },
  }
}
