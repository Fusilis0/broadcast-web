/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  formatProjectMetaText,
  formatRacesRootHint,
  mountLocalProjectControls,
} from './localProjectControls.ts'
import {
  formatPersistStatus,
  persistRaceProjectLocal,
} from './persistRaceProjectLocal.ts'
import type { StudioRacesBridge } from './racesBridge.ts'
import type { RaceProject } from './types.ts'

const sample: RaceProject = {
  schemaVersion: 1,
  id: 'heat-local',
  name: 'Heat Local',
  origin: { lat: 41, lon: 29, altMsl: 0 },
  fleet: { boatIds: ['1'] },
  povIds: ['1'],
}

function mockBridge(
  overrides: Partial<StudioRacesBridge> = {},
): StudioRacesBridge {
  return {
    save: vi.fn(async () => ({
      ok: true as const,
      id: 'heat-local',
      path: 'C:/repo/public/races/heat-local',
    })),
    list: vi.fn(async () => ({ ok: true as const, ids: ['demo-istanbul'] })),
    read: vi.fn(async () => ({ ok: false as const, error: 'unused' })),
    getRoot: vi.fn(async () => ({
      kind: 'public' as const,
      path: 'C:/repo/public/races',
    })),
    ...overrides,
  }
}

describe('formatProjectMetaText / formatRacesRootHint', () => {
  it('shows name and id', () => {
    expect(formatProjectMetaText('demo-istanbul', 'Demo Istanbul')).toBe(
      'Demo Istanbul (demo-istanbul)',
    )
    expect(formatProjectMetaText('solo', 'solo')).toBe('solo')
  })

  it('formats root hint', () => {
    expect(formatRacesRootHint('C:/repo/public/races')).toBe(
      'saving to: C:/repo/public/races',
    )
    expect(formatRacesRootHint(null)).toBe('')
  })
})

describe('persistRaceProjectLocal', () => {
  it('Electron save calls races.save and skips download', async () => {
    const bridge = mockBridge()
    const download = vi.fn()
    const result = await persistRaceProjectLocal({
      project: sample,
      racesBridge: bridge,
      mode: 'save',
      download,
    })
    expect(bridge.save).toHaveBeenCalledOnce()
    expect(bridge.save).toHaveBeenCalledWith(sample)
    expect(download).not.toHaveBeenCalled()
    expect(result.downloaded).toBe(false)
    expect(result.local?.ok).toBe(true)
    expect(formatPersistStatus(result)).toContain('folder:')
  })

  it('Chrome (no bridge) downloads', async () => {
    const download = vi.fn()
    const result = await persistRaceProjectLocal({
      project: sample,
      racesBridge: null,
      mode: 'save',
      download,
    })
    expect(download).toHaveBeenCalledOnce()
    expect(result.downloaded).toBe(true)
    expect(result.local).toBeNull()
  })

  it('export always downloads and skips folder write', async () => {
    const bridge = mockBridge()
    const download = vi.fn()
    const result = await persistRaceProjectLocal({
      project: sample,
      racesBridge: bridge,
      mode: 'export',
      download,
    })
    expect(bridge.save).not.toHaveBeenCalled()
    expect(download).toHaveBeenCalledOnce()
    expect(result.downloaded).toBe(true)
  })
})

describe('mountLocalProjectControls (folder mode)', () => {
  it('shows project name, lists ids, Save calls save hook, Load on change', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)

    const onSave = vi.fn()
    const onLoad = vi.fn()
    const onExport = vi.fn()

    const handle = mountLocalProjectControls({
      container: root,
      folderMode: true,
      raceIds: ['demo-istanbul'],
      activeRaceId: 'demo-istanbul',
      projectName: 'Demo Istanbul',
      onSaveProject: onSave,
      onRaceLoad: onLoad,
      onExportProject: onExport,
    })

    const meta = root.querySelector('[data-ops="project-meta"]')
    expect(meta?.textContent).toBe('Demo Istanbul (demo-istanbul)')

    const hint = root.querySelector('[data-ops="race-hint"]')
    expect(hint?.textContent).toContain('Save=folder')

    handle.setRootHint('C:/repo/public/races')
    expect(root.querySelector('[data-ops="races-root"]')?.textContent).toBe(
      'saving to: C:/repo/public/races',
    )

    handle.setRaceIds(['demo-istanbul', 'heat-local'], 'heat-local')
    const select = root.querySelector(
      '[data-ops="race-select"]',
    ) as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual([
      'demo-istanbul',
      'heat-local',
    ])
    expect(select.value).toBe('heat-local')

    select.value = 'demo-istanbul'
    select.dispatchEvent(new Event('change'))
    expect(onLoad).toHaveBeenCalledWith('demo-istanbul')

    const saveBtn = root.querySelector(
      '[data-ops="race-save"]',
    ) as HTMLButtonElement
    saveBtn.click()
    expect(onSave).toHaveBeenCalledOnce()

    const exportBtn = root.querySelector(
      '[data-ops="race-export"]',
    ) as HTMLButtonElement
    expect(exportBtn).toBeTruthy()
    exportBtn.click()
    expect(onExport).toHaveBeenCalledOnce()

    handle.setSaveStatus('folder: C:/repo/public/races/heat-local')
    expect(root.querySelector('[data-ops="save-status"]')?.textContent).toBe(
      'folder: C:/repo/public/races/heat-local',
    )

    handle.dispose()
    root.remove()
  })

  it('Chrome mode has no Export and does not load on select change', () => {
    const root = document.createElement('div')
    const onLoad = vi.fn()
    const handle = mountLocalProjectControls({
      container: root,
      folderMode: false,
      raceIds: ['demo-istanbul', 'other'],
      activeRaceId: 'demo-istanbul',
      onRaceLoad: onLoad,
    })
    expect(root.querySelector('[data-ops="race-export"]')).toBeNull()
    expect(root.querySelector('[data-ops="race-hint"]')?.textContent).toContain(
      'Save=download',
    )
    const select = root.querySelector(
      '[data-ops="race-select"]',
    ) as HTMLSelectElement
    select.value = 'other'
    select.dispatchEvent(new Event('change'))
    expect(onLoad).not.toHaveBeenCalled()
    handle.dispose()
  })
})

describe('list + load via mocked races bridge (wiring contract)', () => {
  it('Save → bridge.save; list ids feed select; load uses read path caller', async () => {
    const saved: RaceProject[] = []
    const bridge = mockBridge({
      save: vi.fn(async (project) => {
        saved.push(project as RaceProject)
        return {
          ok: true as const,
          id: (project as RaceProject).id,
          path: `C:/repo/public/races/${(project as RaceProject).id}`,
        }
      }),
      list: vi.fn(async () => ({
        ok: true as const,
        ids: ['demo-istanbul', 'studio-heat'],
      })),
      read: vi.fn(async (id) => ({
        ok: true as const,
        project: { ...sample, id, name: `Loaded ${id}` },
      })),
    })

    const persist = await persistRaceProjectLocal({
      project: sample,
      racesBridge: bridge,
      mode: 'saveAs',
      download: vi.fn(),
    })
    expect(persist.local?.ok).toBe(true)
    expect(saved[0]?.id).toBe('heat-local')

    const listed = await bridge.list()
    expect(listed.ok && listed.ids).toEqual(['demo-istanbul', 'studio-heat'])

    const root = document.createElement('div')
    const onLoad = vi.fn(async (id: string) => {
      const read = await bridge.read(id)
      expect(read.ok).toBe(true)
      if (read.ok) {
        expect((read.project as RaceProject).name).toBe(`Loaded ${id}`)
      }
    })
    const handle = mountLocalProjectControls({
      container: root,
      folderMode: true,
      raceIds: listed.ok ? listed.ids : [],
      activeRaceId: 'demo-istanbul',
      projectName: 'Demo',
      onRaceLoad: (id) => {
        void onLoad(id)
      },
      onSaveProject: () => {
        void persistRaceProjectLocal({
          project: sample,
          racesBridge: bridge,
          mode: 'save',
          download: vi.fn(),
        })
      },
    })

    const select = root.querySelector(
      '[data-ops="race-select"]',
    ) as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual([
      'demo-istanbul',
      'studio-heat',
    ])
    select.value = 'studio-heat'
    select.dispatchEvent(new Event('change'))
    await vi.waitFor(() => {
      expect(onLoad).toHaveBeenCalledWith('studio-heat')
    })
    expect(bridge.read).toHaveBeenCalledWith('studio-heat')

    handle.dispose()
  })
})
