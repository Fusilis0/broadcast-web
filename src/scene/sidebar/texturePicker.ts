/**
 * Texture URL picker — Library modal (Phase 19.11).
 * Replaces the numbered stub list. Electron: never `window.prompt`.
 */

import { openLibraryLogoPicker } from './libraryLogoPicker.ts'

export type TexturePickerOptions = {
  projectsApiBase?: string
  /** Unused (modal has thumbs); kept for call-site compat. */
  defaultUrl?: string | null
  parent?: HTMLElement
}

/**
 * Prompt for a texture URL. Returns null if cancelled; '' → solid / procedural.
 */
export async function promptTextureUrl(
  options: TexturePickerOptions = {},
): Promise<string | null> {
  return openLibraryLogoPicker({
    projectsApiBase: options.projectsApiBase,
    title: 'Pick logo from Library',
    allowEmpty: true,
    parent: options.parent,
  })
}
