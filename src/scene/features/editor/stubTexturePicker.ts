/**
 * Billboard texture prompt — Library modal (Phase 19.11).
 * Stub `/textures/sponsors/…` list removed; catalogue is `listLibraryAssets`.
 * Electron: never `window.prompt`.
 */

import { openLibraryLogoPicker } from '../../sidebar/libraryLogoPicker.ts'

/**
 * Prompt for a Library logo URL.
 * Returns null if cancelled; empty string → solid plate (no textureUrl).
 */
export async function promptStubTextureUrl(
  _defaultUrl?: string | null,
): Promise<string | null> {
  return openLibraryLogoPicker({
    title: 'Pick logo from Library',
    allowEmpty: true,
  })
}
