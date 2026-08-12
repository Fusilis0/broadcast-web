/**
 * Texture URL picker for asset Details (sponsor / billboard chain).
 * Prefers Library catalogue (`listLibraryAssets`); falls back to stub list
 * when the catalogue is empty or fetch fails.
 */

import {
  listLibraryAssets,
  resolveLibraryAssetUrl,
} from '../../assets/library/index.ts'
import { promptModal } from '../../ui/promptModal.ts'
import {
  STUB_SPONSOR_TEXTURES,
  promptStubTextureUrl,
} from '../features/editor/stubTexturePicker.ts'

export type TexturePickerOptions = {
  projectsApiBase?: string
  defaultUrl?: string | null
}

/**
 * Prompt for a texture URL. Returns null if cancelled; '' → procedural.
 */
export async function promptTextureUrl(
  options: TexturePickerOptions = {},
): Promise<string | null> {
  const defaultUrl = options.defaultUrl ?? ''
  try {
    const assets = await listLibraryAssets({
      projectsApiBase: options.projectsApiBase,
    })
    const images = assets.filter((a) => a.kind === 'image')
    if (images.length > 0) {
      const lines = [
        ...images.map(
          (a, i) =>
            `${i + 1}. ${a.label} — ${resolveLibraryAssetUrl(a)}`,
        ),
        `${images.length + 1}. (procedural)`,
        ...STUB_SPONSOR_TEXTURES.filter((t) => t.url !== '').map(
          (t, i) =>
            `${images.length + 2 + i}. ${t.label} (stub) — ${t.url}`,
        ),
      ]
      const raw = await promptModal(
        `Billboard texture (Library + stubs):\n${lines.join('\n')}\n\nEnter number or a /textures/… / /assets/… URL`,
        defaultUrl && defaultUrl !== '' ? defaultUrl : '1',
      )
      if (raw === null) return null
      const trimmed = raw.trim()
      if (trimmed === '') return ''
      const asIndex = Number.parseInt(trimmed, 10)
      if (Number.isFinite(asIndex) && asIndex >= 1) {
        if (asIndex <= images.length) {
          return resolveLibraryAssetUrl(images[asIndex - 1]!)
        }
        if (asIndex === images.length + 1) return ''
        const stubIdx = asIndex - images.length - 2
        if (stubIdx >= 0 && stubIdx < STUB_SPONSOR_TEXTURES.length) {
          const stub = STUB_SPONSOR_TEXTURES[stubIdx]!
          if (stub.url === '') return ''
          return stub.url
        }
      }
      return trimmed
    }
  } catch {
    /* fall through to stub */
  }
  return promptStubTextureUrl(defaultUrl)
}
