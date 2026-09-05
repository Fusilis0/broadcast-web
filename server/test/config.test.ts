import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { loadServerConfig, repoRoot } from '../src/config.ts'

describe('loadServerConfig assets library', () => {
  it('defaults to git-tracked public/assets/library', () => {
    const cfg = loadServerConfig({})
    expect(cfg.assetsLibraryDir).toBe(
      resolve(repoRoot, 'public', 'assets', 'library'),
    )
    expect(cfg.assetsLibraryDir).not.toMatch(/server[/\\]data/)
    expect(cfg.assetsLibraryDir.toLowerCase()).not.toContain('userdata')
  })

  it('honours PROJECTS_ASSETS_LIBRARY_DIR override', () => {
    const override = resolve(tmpdir(), 'library-override')
    const cfg = loadServerConfig({
      PROJECTS_ASSETS_LIBRARY_DIR: override,
    })
    expect(cfg.assetsLibraryDir).toBe(override)
  })
})
