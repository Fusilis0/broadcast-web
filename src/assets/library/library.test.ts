import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  isLibraryUploadConfigured,
  listLibraryAssets,
  parseLibraryManifest,
  resolveLibraryAssetUrl,
  uploadLibraryAsset,
} from './index.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const sample = {
  id: 'image/logo-a1b2c3d4.png',
  kind: 'image' as const,
  filename: 'image/logo-a1b2c3d4.png',
  label: 'Logo',
  addedAt: '2026-08-11T10:00:00.000Z',
  sizeBytes: 12,
}

describe('resolveLibraryAssetUrl', () => {
  it('builds site-relative URL', () => {
    expect(resolveLibraryAssetUrl(sample)).toBe(
      '/assets/library/image/logo-a1b2c3d4.png',
    )
  })
})

describe('parseLibraryManifest', () => {
  it('filters invalid rows', () => {
    expect(parseLibraryManifest([sample, { bad: true }, null])).toEqual([
      sample,
    ])
  })
})

describe('seeded public library catalogue', () => {
  it('lists Rolex, Senexus, Vodafone image entries on disk', () => {
    const raw = JSON.parse(
      readFileSync(join(repoRoot, 'public/assets/library/index.json'), 'utf8'),
    ) as unknown
    const entries = parseLibraryManifest(raw)
    expect(entries.map((e) => e.label).sort()).toEqual([
      'Rolex',
      'Senexus',
      'Vodafone',
    ])
    for (const e of entries) {
      expect(e.kind).toBe('image')
      expect(e.filename).toMatch(/^image\/[a-z0-9-]+-[a-f0-9]{8}\.png$/)
      expect(e.id).toBe(e.filename)
      expect(e.sizeBytes).toBeGreaterThan(0)
      expect(Number.isNaN(Date.parse(e.addedAt))).toBe(false)
      expect(
        existsSync(join(repoRoot, 'public/assets/library', e.filename)),
      ).toBe(true)
    }
    expect(
      existsSync(join(repoRoot, 'public/textures/sponsors/rolex.png')),
    ).toBe(true)
    expect(
      existsSync(join(repoRoot, 'public/textures/sponsors/senexus.png')),
    ).toBe(true)
    expect(
      existsSync(join(repoRoot, 'public/textures/sponsors/vodafone.png')),
    ).toBe(true)
  })
})

describe('isLibraryUploadConfigured', () => {
  it('requires non-empty api base', () => {
    expect(isLibraryUploadConfigured('')).toBe(false)
    expect(isLibraryUploadConfigured('  ')).toBe(false)
    expect(isLibraryUploadConfigured('/api')).toBe(true)
  })
})

describe('listLibraryAssets', () => {
  it('uses API when base set', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe('/api/assets')
      return new Response(JSON.stringify([sample]), { status: 200 })
    }) as unknown as typeof fetch
    const list = await listLibraryAssets({
      projectsApiBase: '/api',
      fetchImpl,
    })
    expect(list).toEqual([sample])
  })

  it('falls back to static when API fails', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === '/api/assets') {
        return new Response('', { status: 503 })
      }
      expect(url).toBe('/assets/library/index.json')
      return new Response(JSON.stringify([sample]), { status: 200 })
    }) as unknown as typeof fetch
    const list = await listLibraryAssets({
      projectsApiBase: '/api',
      fetchImpl,
    })
    expect(list).toEqual([sample])
  })

  it('static-only when no api base', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe('/assets/library/index.json')
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof fetch
    const list = await listLibraryAssets({ fetchImpl })
    expect(list).toEqual([])
  })
})

describe('uploadLibraryAsset', () => {
  it('POSTs multipart and returns asset', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.body).toBeInstanceOf(FormData)
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer tok')
      return new Response(JSON.stringify(sample), { status: 201 })
    }) as unknown as typeof fetch

    const asset = await uploadLibraryAsset({
      projectsApiBase: '/api',
      file: new Blob(['x']),
      filename: 'logo.png',
      bearerToken: 'tok',
      fetchImpl,
    })
    expect(asset.id).toBe(sample.id)
  })
})
