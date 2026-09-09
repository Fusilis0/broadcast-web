import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import {
  CINEMATIC_TILE_CACHE_DIR_NAME,
  CINEMATIC_TILE_CACHE_URL_PREFIX,
  CINEMATIC_TILE_CACHE_VITE_RELATIVE,
  cinematicTileCacheFileName,
  getCinematicTileCacheDir,
  resolveCinematicTileCacheDir,
  stripCinematicTileAuthQuery,
} from './cinematicTileCache.ts'

const require = createRequire(import.meta.url)
const desktopCache = require('../../desktop/cinematicTileCache.cjs') as {
  DIR_NAME: string
  getCinematicTileCacheDir: (paths?: {
    cwd?: string
    userDataPath?: string | null
  }) => string
  resolveCinematicTileCacheDir: (paths?: {
    cwd?: string
    userDataPath?: string | null
  }) => string
}

const temps: string[] = []

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempCwd(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bw-cinematic-tiles-'))
  temps.push(dir)
  return dir
}

describe('getCinematicTileCacheDir', () => {
  it('returns an absolute Vite/node path under cwd/.cache/cinematic-tiles', () => {
    const cwd = tempCwd()
    const dir = getCinematicTileCacheDir({ cwd, userDataPath: null })
    expect(isAbsolute(dir)).toBe(true)
    expect(dir).toBe(join(cwd, '.cache', CINEMATIC_TILE_CACHE_DIR_NAME))
    expect(dir.replace(/\\/g, '/')).toMatch(/\.cache\/cinematic-tiles$/)
  })

  it('creates a missing dir and does not throw', () => {
    const cwd = tempCwd()
    const expected = join(cwd, '.cache', CINEMATIC_TILE_CACHE_DIR_NAME)
    expect(existsSync(expected)).toBe(false)
    expect(() => getCinematicTileCacheDir({ cwd, userDataPath: null })).not.toThrow()
    expect(existsSync(expected)).toBe(true)
  })

  it('resolve does not throw when the dir is missing (SCN may create)', () => {
    const cwd = tempCwd()
    const expected = join(cwd, '.cache', CINEMATIC_TILE_CACHE_DIR_NAME)
    expect(() =>
      resolveCinematicTileCacheDir({ cwd, userDataPath: null }),
    ).not.toThrow()
    expect(existsSync(expected)).toBe(false)
  })

  it('uses Electron userData/cinematic-tiles when userDataPath is set', () => {
    const dir = resolveCinematicTileCacheDir({
      cwd: join('repo'),
      userDataPath: join('appdata', 'BroadcastWeb'),
    })
    expect(isAbsolute(dir) || dir.includes('BroadcastWeb')).toBe(true)
    expect(dir).toBe(join('appdata', 'BroadcastWeb', CINEMATIC_TILE_CACHE_DIR_NAME))
  })

  it('Vitest default (no Electron) is cwd/.cache/cinematic-tiles', () => {
    const dir = getCinematicTileCacheDir({ userDataPath: null })
    expect(isAbsolute(dir)).toBe(true)
    expect(dir).toBe(join(process.cwd(), '.cache', CINEMATIC_TILE_CACHE_DIR_NAME))
  })

  it('no-arg call in node does not require Electron', () => {
    const dir = getCinematicTileCacheDir()
    expect(isAbsolute(dir)).toBe(true)
    expect(dir).toBe(join(process.cwd(), '.cache', CINEMATIC_TILE_CACHE_DIR_NAME))
  })
})

describe('gitignore', () => {
  it('lists .cache/cinematic-tiles/ and *.terrain', () => {
    const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/\.cache\/cinematic-tiles\//)
    expect(gitignore).toMatch(/\*\.terrain/)
  })

  it('does not show a dummy cache file in git status', () => {
    const dir = getCinematicTileCacheDir({ userDataPath: null })
    const dummy = join(dir, 'dsp-plt-dummy.bin')
    writeFileSync(dummy, 'not-for-git')
    try {
      try {
        execFileSync('git', ['check-ignore', '-q', '--', dummy], {
          cwd: process.cwd(),
          stdio: 'pipe',
        })
      } catch (err) {
        const code = (err as { status?: number }).status
        expect(code, 'dummy tile must be gitignored').toBe(0)
      }
      const status = execFileSync('git', ['status', '--short', '--', dummy], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
      expect(status.trim()).toBe('')
    } finally {
      rmSync(dummy, { force: true })
    }
  })
})

describe('cinematicTileCacheFileName', () => {
  it('hashes URL without access_token so SCN can share files across tokens', () => {
    const a = cinematicTileCacheFileName(
      'https://assets.ion.cesium.com/1/tile.terrain?v=1&access_token=secret-a',
    )
    const b = cinematicTileCacheFileName(
      'https://assets.ion.cesium.com/1/tile.terrain?v=1&access_token=secret-b',
    )
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(
      stripCinematicTileAuthQuery(
        'https://assets.ion.cesium.com/1/tile.terrain?access_token=x',
      ),
    ).not.toContain('access_token')
  })

  it('Web Crypto async hash matches Node cinematicTileCacheFileName', async () => {
    const { cinematicTileCacheFileNameAsync } = await import(
      './cinematicTileCacheKey.ts'
    )
    const url =
      'https://assets.ion.cesium.com/1/tile.terrain?v=1&access_token=secret-a'
    expect(await cinematicTileCacheFileNameAsync(url)).toBe(
      cinematicTileCacheFileName(url),
    )
  })
})

describe('desktop/cinematicTileCache.cjs', () => {
  it('mirrors Electron vs Vite paths', () => {
    expect(desktopCache.DIR_NAME).toBe(CINEMATIC_TILE_CACHE_DIR_NAME)
    expect(
      desktopCache.resolveCinematicTileCacheDir({
        userDataPath: join('appdata', 'BroadcastWeb'),
      }),
    ).toBe(join('appdata', 'BroadcastWeb', CINEMATIC_TILE_CACHE_DIR_NAME))
    const cwd = tempCwd()
    expect(
      desktopCache.resolveCinematicTileCacheDir({ cwd, userDataPath: null }),
    ).toBe(join(cwd, '.cache', CINEMATIC_TILE_CACHE_DIR_NAME))
  })
})

describe('URL prefix', () => {
  it('is the Vite GET mount', () => {
    expect(CINEMATIC_TILE_CACHE_URL_PREFIX).toBe('/cinematic-tiles')
    expect(CINEMATIC_TILE_CACHE_VITE_RELATIVE).toBe('.cache/cinematic-tiles')
  })
})
