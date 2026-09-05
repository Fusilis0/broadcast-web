import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { storeLibraryAsset } from '../src/assets.ts'
import { repoRoot } from '../src/config.ts'
import { openDatabase } from '../src/db.ts'

type Started = {
  baseUrl: string
  libraryDir: string
  close: () => Promise<void>
}

function buildMultipart(
  parts: Array<
    | { name: string; value: string }
    | { name: string; filename: string; contentType: string; data: Buffer }
  >,
  boundary = '----bwAssetBoundary',
): { body: Buffer; contentType: string } {
  const chunks: Buffer[] = []
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    if ('filename' in part) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.contentType}\r\n\r\n`,
        ),
      )
      chunks.push(part.data)
      chunks.push(Buffer.from('\r\n'))
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`,
        ),
      )
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

async function startServer(opts: {
  editorToken?: string
  airToken?: string
  maxAssetBytes?: number
  now?: () => Date
}): Promise<Started> {
  const libraryDir = await mkdtemp(join(tmpdir(), 'bw-assets-'))
  const db = openDatabase(':memory:')
  const handler = createApp({
    db,
    editorToken: opts.editorToken,
    airToken: opts.airToken,
    assetsLibraryDir: libraryDir,
    maxAssetBytes: opts.maxAssetBytes,
    now: opts.now,
  })
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handler(req, res)
  })
  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen())
  })
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no address')
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    libraryDir,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close(async (err) => {
          db.close()
          try {
            await rm(libraryDir, { recursive: true, force: true })
          } catch {
            /* best-effort */
          }
          if (err) reject(err)
          else resolveClose()
        })
      }),
  }
}

describe('assets API', () => {
  let started: Started | undefined

  afterEach(async () => {
    if (started) {
      await started.close()
      started = undefined
    }
  })

  it('GET /api/assets returns empty list', async () => {
    started = await startServer({})
    const res = await fetch(`${started.baseUrl}/api/assets`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('POST uploads png, stores under library, updates manifest', async () => {
    let tick = 0
    started = await startServer({
      now: () => new Date(Date.UTC(2026, 7, 11, 10, 0, tick++)),
    })

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ])
    const { body, contentType } = buildMultipart([
      { name: 'label', value: 'Demo Logo' },
      {
        name: 'file',
        filename: 'Demo Logo.png',
        contentType: 'image/png',
        data: png,
      },
    ])

    const created = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    expect(created.status).toBe(201)
    const asset = (await created.json()) as {
      id: string
      kind: string
      filename: string
      label: string
      addedAt: string
      sizeBytes: number
    }
    expect(asset.kind).toBe('image')
    expect(asset.label).toBe('Demo Logo')
    expect(asset.filename).toMatch(/^image\/demo-logo-[a-f0-9]{8}\.png$/)
    expect(asset.id).toBe(asset.filename)
    expect(asset.sizeBytes).toBe(png.length)
    expect(asset.addedAt).toBe('2026-08-11T10:00:00.000Z')

    const onDisk = await readFile(join(started.libraryDir, asset.filename))
    expect(Buffer.compare(onDisk, png)).toBe(0)

    const list = await fetch(`${started.baseUrl}/api/assets`)
    expect(list.status).toBe(200)
    const entries = (await list.json()) as unknown[]
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: asset.id, label: 'Demo Logo' })
  })

  it('rejects bad extension', async () => {
    started = await startServer({})
    const { body, contentType } = buildMultipart([
      {
        name: 'file',
        filename: 'evil.exe',
        contentType: 'application/octet-stream',
        data: Buffer.from('MZ'),
      },
    ])
    const res = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_extension' })
  })

  it('rejects oversized file', async () => {
    started = await startServer({ maxAssetBytes: 16 })
    const { body, contentType } = buildMultipart([
      {
        name: 'file',
        filename: 'big.png',
        contentType: 'image/png',
        data: Buffer.alloc(32, 1),
      },
    ])
    const res = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'file_too_large' })
  })

  it('requires editor bearer when auth configured; air → 403', async () => {
    started = await startServer({
      editorToken: 'editor-secret',
      airToken: 'air-secret',
    })
    const { body, contentType } = buildMultipart([
      {
        name: 'file',
        filename: 'ok.webp',
        contentType: 'image/webp',
        data: Buffer.from('RIFF'),
      },
    ])

    const unauth = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    expect(unauth.status).toBe(401)

    const { body: body2, contentType: ct2 } = buildMultipart([
      {
        name: 'file',
        filename: 'ok.webp',
        contentType: 'image/webp',
        data: Buffer.from('RIFF'),
      },
    ])
    const air = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': ct2,
        Authorization: 'Bearer air-secret',
      },
      body: body2,
    })
    expect(air.status).toBe(403)
    expect(await air.json()).toMatchObject({ error: 'forbidden', role: 'air' })

    const { body: body3, contentType: ct3 } = buildMultipart([
      {
        name: 'file',
        filename: 'ok.webp',
        contentType: 'image/webp',
        data: Buffer.from('RIFF'),
      },
    ])
    const ok = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': ct3,
        Authorization: 'Bearer editor-secret',
      },
      body: body3,
    })
    expect(ok.status).toBe(201)
  })

  it('stores glb as model kind', async () => {
    started = await startServer({})
    const { body, contentType } = buildMultipart([
      {
        name: 'file',
        filename: 'hull.glb',
        contentType: 'model/gltf-binary',
        data: Buffer.from('glTF'),
      },
    ])
    const res = await fetch(`${started.baseUrl}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    expect(res.status).toBe(201)
    const asset = (await res.json()) as { kind: string; filename: string }
    expect(asset.kind).toBe('model')
    expect(asset.filename).toMatch(/^model\/hull-[a-f0-9]{8}\.glb$/)
  })

  it('re-upload of seeded sponsor bytes keeps the same library id', async () => {
    const libraryDir = await mkdtemp(join(tmpdir(), 'bw-seed-collide-'))
    try {
      const seed = JSON.parse(
        await readFile(
          join(repoRoot, 'public', 'assets', 'library', 'index.json'),
          'utf8',
        ),
      ) as Array<{ label: string; id: string }>
      const sources = [
        { label: 'Rolex', file: 'rolex.png' },
        { label: 'Senexus', file: 'senexus.png' },
        { label: 'Vodafone', file: 'vodafone.png' },
      ] as const
      for (const src of sources) {
        const data = await readFile(
          join(repoRoot, 'public', 'textures', 'sponsors', src.file),
        )
        const result = await storeLibraryAsset({
          libraryDir,
          originalFilename: src.file,
          data,
          label: src.label,
          addedAt: '2026-09-01T12:00:00.000Z',
        })
        expect(result.ok).toBe(true)
        if (!result.ok) continue
        const seeded = seed.find((e) => e.label === src.label)
        expect(seeded?.id).toBe(result.asset.id)

        const again = await storeLibraryAsset({
          libraryDir,
          originalFilename: src.file,
          data,
          label: src.label,
          addedAt: '2026-09-02T00:00:00.000Z',
        })
        expect(again.ok).toBe(true)
        if (!again.ok) continue
        expect(again.asset.id).toBe(result.asset.id)
        expect(again.asset.addedAt).toBe('2026-09-01T12:00:00.000Z')
      }
    } finally {
      await rm(libraryDir, { recursive: true, force: true })
    }
  })
})
