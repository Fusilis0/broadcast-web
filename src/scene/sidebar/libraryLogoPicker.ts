/**
 * Shared Library logo picker modal (Phase 19.11).
 * Thumbs from `listLibraryAssets`; never `window.prompt` (Electron throws).
 */

import {
  listLibraryAssets,
  resolveLibraryAssetUrl,
} from '../../assets/library/index.ts'
import type { LibraryAsset } from '../../assets/library/types.ts'

export type LibraryLogoPickerOptions = {
  projectsApiBase?: string
  title?: string
  /**
   * Show a "Solid plate" action that resolves to `''` (no URL).
   * Cancel / Escape still resolve `null`.
   */
  allowEmpty?: boolean
  parent?: HTMLElement
  fetchImpl?: typeof fetch
}

/**
 * Open a small modal of Library image thumbs.
 * Resolves the asset URL, `''` when Solid plate is chosen, or `null` if cancelled.
 */
export async function openLibraryLogoPicker(
  options: LibraryLogoPickerOptions = {},
): Promise<string | null> {
  const parent = options.parent ?? document.body
  const title = options.title ?? 'Pick logo from Library'

  let images: LibraryAsset[] = []
  let loadError: string | null = null
  try {
    const assets = await listLibraryAssets({
      projectsApiBase: options.projectsApiBase,
      fetchImpl: options.fetchImpl,
    })
    images = assets.filter((a) => a.kind === 'image')
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Library catalogue failed'
  }

  return new Promise((resolve) => {
    let settled = false

    const root = document.createElement('div')
    root.className = 'prompt-modal library-picker'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'true')
    root.setAttribute('data-ops', 'library-logo-picker')

    const backdrop = document.createElement('div')
    backdrop.className = 'prompt-modal__backdrop'

    const card = document.createElement('div')
    card.className = 'prompt-modal__card library-picker__card'

    const heading = document.createElement('div')
    heading.className = 'prompt-modal__message'
    heading.textContent = title
    card.appendChild(heading)

    const status = document.createElement('p')
    status.className = 'library-picker__status'
    card.appendChild(status)

    const grid = document.createElement('div')
    grid.className = 'library-picker__grid'
    card.appendChild(grid)

    const actions = document.createElement('div')
    actions.className = 'prompt-modal__actions'
    card.appendChild(actions)

    if (options.allowEmpty) {
      const emptyBtn = document.createElement('button')
      emptyBtn.type = 'button'
      emptyBtn.className = 'prompt-modal__btn'
      emptyBtn.textContent = 'Solid plate'
      emptyBtn.addEventListener('click', () => finish(''))
      actions.appendChild(emptyBtn)
    }

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'prompt-modal__btn prompt-modal__btn--cancel'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => finish(null))
    actions.appendChild(cancelBtn)

    root.append(backdrop, card)

    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      window.removeEventListener('keydown', onWindowKeyDown, true)
      root.remove()
      resolve(value)
    }

    const onWindowKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      ev.stopImmediatePropagation()
      finish(null)
    }

    backdrop.addEventListener('click', () => finish(null))
    card.addEventListener('pointerdown', (ev) => ev.stopPropagation())
    window.addEventListener('keydown', onWindowKeyDown, true)

    if (loadError) {
      status.textContent = loadError
    } else if (images.length === 0) {
      status.textContent =
        'No library images. Catalogue lives in public/assets/library/ (do not re-seed here).'
    } else {
      status.textContent = `${images.length} image(s)`
      for (const asset of images) {
        const url = resolveLibraryAssetUrl(asset)
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'library-picker__item'
        btn.title = url
        btn.setAttribute('data-library-url', url)

        const img = document.createElement('img')
        img.className = 'library-picker__thumb'
        img.src = url
        img.alt = asset.label
        img.loading = 'lazy'

        const label = document.createElement('span')
        label.className = 'library-picker__label'
        label.textContent = asset.label

        btn.append(img, label)
        btn.addEventListener('click', () => finish(url))
        grid.appendChild(btn)
      }
    }

    parent.append(root)
    requestAnimationFrame(() => {
      const first =
        grid.querySelector('button') ??
        (cancelBtn as HTMLButtonElement)
      first.focus()
    })
  })
}
