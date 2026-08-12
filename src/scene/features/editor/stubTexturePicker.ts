/**

 * Texture choices for billboard-chain picker.

 *

 * TODO(PLT-01 wiring): prefer `listLibraryAssets()` image entries via

 * `resolveLibraryAssetUrl` when the catalogue is non-empty; fall back to this

 * hardcoded sponsor list. PLT-01 module exists (`src/assets/library/`) but the

 * committed manifest may still be empty — keep this stub until SCN-03 / picker

 * UI consumes Library selection.

 */

import { promptModal } from '../../../ui/promptModal.ts'



export const STUB_SPONSOR_TEXTURES: readonly {

  label: string

  url: string

}[] = [

  { label: 'Rolex', url: '/textures/sponsors/rolex.png' },

  { label: 'Senexus', url: '/textures/sponsors/senexus.png' },

  { label: 'Vodafone', url: '/textures/sponsors/vodafone.png' },

  { label: '(procedural)', url: '' },

]



/**

 * Prompt for a texture URL from the stub list (or free-text).

 * Returns null if cancelled; empty string → procedural (no textureUrl).

 *

 * Uses DOM `promptModal` (not `window.prompt`) — Electron throws on prompt().

 */

export async function promptStubTextureUrl(

  defaultUrl: string | null | undefined = STUB_SPONSOR_TEXTURES[0]?.url,

): Promise<string | null> {

  const lines = STUB_SPONSOR_TEXTURES.map(

    (t, i) => `${i + 1}. ${t.label}${t.url ? ` — ${t.url}` : ''}`,

  ).join('\n')

  const raw = await promptModal(

    `Billboard texture (stub until Library / PLT-01):\n${lines}\n\nEnter 1–${STUB_SPONSOR_TEXTURES.length} or a /textures/… URL`,

    defaultUrl && defaultUrl !== ''

      ? String(

          STUB_SPONSOR_TEXTURES.findIndex((t) => t.url === defaultUrl) + 1 ||

            defaultUrl,

        )

      : '1',

  )

  if (raw === null) return null

  const trimmed = raw.trim()

  if (trimmed === '') return ''

  const asIndex = Number.parseInt(trimmed, 10)

  if (

    Number.isFinite(asIndex) &&

    asIndex >= 1 &&

    asIndex <= STUB_SPONSOR_TEXTURES.length

  ) {

    return STUB_SPONSOR_TEXTURES[asIndex - 1]!.url

  }

  return trimmed

}


