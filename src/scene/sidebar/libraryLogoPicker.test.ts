/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openLibraryLogoPicker } from './libraryLogoPicker.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

const catalogue = [
  {
    id: 'image/rolex-f724a5ba.png',
    kind: 'image' as const,
    filename: 'image/rolex-f724a5ba.png',
    label: 'Rolex',
    addedAt: '2026-09-01T12:00:00.000Z',
    sizeBytes: 1,
  },
  {
    id: 'image/senexus-57797468.png',
    kind: 'image' as const,
    filename: 'image/senexus-57797468.png',
    label: 'Senexus',
    addedAt: '2026-09-01T12:00:00.000Z',
    sizeBytes: 1,
  },
  {
    id: 'image/vodafone-9e90847a.png',
    kind: 'image' as const,
    filename: 'image/vodafone-9e90847a.png',
    label: 'Vodafone',
    addedAt: '2026-09-01T12:00:00.000Z',
    sizeBytes: 1,
  },
]

async function waitForPicker(): Promise<Element> {
  for (let i = 0; i < 40; i++) {
    const el = document.querySelector('[data-ops="library-logo-picker"]')
    if (el) return el
    await Promise.resolve()
  }
  throw new Error('library picker did not open')
}

describe('openLibraryLogoPicker', () => {
  it('shows Rolex / Senexus / Vodafone thumbs and returns the library URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(catalogue), { status: 200 })),
    )
    const pending = openLibraryLogoPicker({ title: 'Pick logo from Library' })
    const root = await waitForPicker()
    const labels = [...root!.querySelectorAll('.library-picker__label')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Rolex', 'Senexus', 'Vodafone'])

    const rolex = root!.querySelector(
      '[data-library-url="/assets/library/image/rolex-f724a5ba.png"]',
    )
    expect(rolex).not.toBeNull()
    ;(rolex as HTMLButtonElement).click()

    await expect(pending).resolves.toBe(
      '/assets/library/image/rolex-f724a5ba.png',
    )
    expect(document.querySelector('[data-ops="library-logo-picker"]')).toBeNull()
  })

  it('Solid plate resolves to empty string; Cancel resolves null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(catalogue), { status: 200 })),
    )
    const solid = openLibraryLogoPicker({ allowEmpty: true })
    await waitForPicker()
    const solidBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Solid plate',
    )
    expect(solidBtn).toBeDefined()
    solidBtn!.click()
    await expect(solid).resolves.toBe('')

    const cancelP = openLibraryLogoPicker()
    await waitForPicker()
    const cancelBtn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Cancel',
    )
    cancelBtn!.click()
    await expect(cancelP).resolves.toBeNull()
  })
})
