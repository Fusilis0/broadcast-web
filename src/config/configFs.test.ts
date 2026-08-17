import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const configFs = require('../../desktop/configFs.cjs') as {
  resolveConfigPath: (
    loadKind: 'url' | 'file',
    paths: { desktopDir: string; userDataPath: string },
  ) => string
  resolveConfigKind: (loadKind: 'url' | 'file') => 'public' | 'userData'
  setCesiumIonToken: (
    configPath: string,
    token: unknown,
  ) => Promise<
    { ok: true; path: string } | { ok: false; error: string }
  >
}

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

describe('desktop configFs', () => {
  it('maps Vite URL loads to repo public/config.json (git-tracked)', () => {
    expect(
      configFs.resolveConfigKind('url'),
    ).toBe('public')
    expect(
      configFs.resolveConfigPath('url', {
        desktopDir: join('repo', 'desktop'),
        userDataPath: join('appdata', 'BroadcastWeb'),
      }),
    ).toBe(join('repo', 'public', 'config.json'))
  })

  it('maps --file loads to userData (not git)', () => {
    expect(configFs.resolveConfigKind('file')).toBe('userData')
    expect(
      configFs.resolveConfigPath('file', {
        desktopDir: join('repo', 'desktop'),
        userDataPath: join('appdata', 'BroadcastWeb'),
      }),
    ).toBe(join('appdata', 'BroadcastWeb', 'config.json'))
  })

  it('patches cesiumIonToken without dropping other keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bw-config-'))
    dirs.push(dir)
    const configPath = join(dir, 'config.json')
    await writeFile(
      configPath,
      `${JSON.stringify({ telemetryMode: 'mock', cesiumIonToken: '' }, null, 2)}\n`,
      'utf8',
    )
    const result = await configFs.setCesiumIonToken(configPath, '  ion-secret  ')
    expect(result.ok).toBe(true)
    const parsed = JSON.parse(await readFile(configPath, 'utf8')) as {
      telemetryMode: string
      cesiumIonToken: string
    }
    expect(parsed.telemetryMode).toBe('mock')
    expect(parsed.cesiumIonToken).toBe('ion-secret')
  })

  it('rejects a missing file without throwing', async () => {
    const result = await configFs.setCesiumIonToken(
      join('no-such-dir', 'config.json'),
      'x',
    )
    expect(result).toEqual({ ok: false, error: 'config.json missing' })
  })
})
