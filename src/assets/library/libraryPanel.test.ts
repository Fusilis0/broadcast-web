/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startLibraryPanel } from './libraryPanel.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('startLibraryPanel', () => {
  it('tells the operator to commit uploads so other PCs get them', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const handle = startLibraryPanel({
      container,
      projectsApiBase: '/api',
      canUpload: true,
    })
    const hint = container.querySelector('.ops-library__hint')
    expect(hint?.textContent).toMatch(/commit/i)
    expect(hint?.textContent).toMatch(/public\/assets\/library/)
    handle.dispose()
  })
})
