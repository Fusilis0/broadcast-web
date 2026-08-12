/**
 * Library sidebar section UI (Phase 11.3).
 * Browse grid + optional upload when projectsApiBase is configured.
 */

import {
  isLibraryUploadConfigured,
  listLibraryAssets,
  resolveLibraryAssetUrl,
  uploadLibraryAsset,
} from './library.ts'
import type { LibraryAsset } from './types.ts'

export type LibraryPanelOptions = {
  container: HTMLElement
  projectsApiBase: string
  /** Editor bearer; omit when server writes are open. */
  bearerToken?: string
  /** When false, hide upload even if API base is set (air role). */
  canUpload?: boolean
}

export type LibraryPanelHandle = {
  refresh: () => Promise<void>
  dispose: () => void
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Mount Library browse/upload UI into a sidebar section body.
 */
export function startLibraryPanel(
  options: LibraryPanelOptions,
): LibraryPanelHandle {
  const root = document.createElement('div')
  root.className = 'ops-library'
  root.setAttribute('data-ops', 'library')

  const hint = document.createElement('p')
  hint.className = 'ops-library__hint'
  root.appendChild(hint)

  const toolbar = document.createElement('div')
  toolbar.className = 'ops-library__toolbar'
  root.appendChild(toolbar)

  const refreshBtn = document.createElement('button')
  refreshBtn.type = 'button'
  refreshBtn.className = 'ops-library__btn'
  refreshBtn.textContent = 'Refresh'
  toolbar.appendChild(refreshBtn)

  const uploadBtn = document.createElement('button')
  uploadBtn.type = 'button'
  uploadBtn.className = 'ops-library__btn ops-library__btn--primary'
  uploadBtn.textContent = 'Upload…'
  toolbar.appendChild(uploadBtn)

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.png,.jpg,.jpeg,.webp,.glb,.gltf,image/png,image/jpeg,image/webp,model/gltf-binary,model/gltf+json'
  fileInput.hidden = true
  root.appendChild(fileInput)

  const status = document.createElement('p')
  status.className = 'ops-library__status'
  status.setAttribute('aria-live', 'polite')
  root.appendChild(status)

  const list = document.createElement('div')
  list.className = 'ops-library__list'
  root.appendChild(list)

  options.container.appendChild(root)

  const apiBase = options.projectsApiBase.trim()
  const uploadLive =
    isLibraryUploadConfigured(apiBase) && options.canUpload !== false

  if (uploadLive) {
    hint.textContent =
      'Shared library — upload writes to public/assets/library/ via API.'
    uploadBtn.hidden = false
  } else {
    hint.textContent = apiBase
      ? 'Browse-only (air role — uploads disabled).'
      : 'Browse-only (no API configured) — commit files under public/assets/library/.'
    uploadBtn.hidden = true
  }

  let disposed = false

  function setStatus(msg: string): void {
    status.textContent = msg
  }

  function renderEntries(entries: LibraryAsset[]): void {
    list.replaceChildren()
    if (entries.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'ops-library__empty'
      empty.textContent = 'No library assets yet.'
      list.appendChild(empty)
      return
    }

    for (const asset of entries) {
      const row = document.createElement('div')
      row.className = 'ops-library__item'
      row.dataset.kind = asset.kind
      row.title = resolveLibraryAssetUrl(asset)

      if (asset.kind === 'image') {
        const img = document.createElement('img')
        img.className = 'ops-library__thumb'
        img.src = resolveLibraryAssetUrl(asset)
        img.alt = asset.label
        img.loading = 'lazy'
        row.appendChild(img)
      } else {
        const badge = document.createElement('div')
        badge.className = 'ops-library__model-badge'
        badge.textContent = asset.filename.split('.').pop()?.toUpperCase() ?? 'GLB'
        row.appendChild(badge)
      }

      const meta = document.createElement('div')
      meta.className = 'ops-library__meta'
      const label = document.createElement('div')
      label.className = 'ops-library__label'
      label.textContent = asset.label
      const sub = document.createElement('div')
      sub.className = 'ops-library__sub'
      sub.textContent = `${asset.filename} · ${formatBytes(asset.sizeBytes)}`
      meta.append(label, sub)
      row.appendChild(meta)
      list.appendChild(row)
    }
  }

  async function refresh(): Promise<void> {
    if (disposed) return
    setStatus('Loading…')
    try {
      const entries = await listLibraryAssets({
        projectsApiBase: apiBase || undefined,
      })
      if (disposed) return
      renderEntries(entries)
      setStatus(`${entries.length} asset${entries.length === 1 ? '' : 's'}`)
    } catch (err) {
      if (disposed) return
      console.warn('[library] list failed', err)
      setStatus('Failed to load library')
      renderEntries([])
    }
  }

  refreshBtn.addEventListener('click', () => {
    void refresh()
  })

  uploadBtn.addEventListener('click', () => {
    fileInput.click()
  })

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file || !uploadLive) return
    void (async () => {
      setStatus(`Uploading ${file.name}…`)
      try {
        const asset = await uploadLibraryAsset({
          projectsApiBase: apiBase,
          file,
          filename: file.name,
          label: file.name.replace(/\.[^.]+$/, ''),
          bearerToken: options.bearerToken,
        })
        setStatus(`Uploaded ${asset.label}`)
        await refresh()
      } catch (err) {
        console.warn('[library] upload failed', err)
        const msg =
          err instanceof Error ? err.message : 'upload failed'
        setStatus(msg)
      }
    })()
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
