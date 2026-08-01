import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { openDatabase } from '../src/db.ts'
import { seedFromRacesDir } from '../src/seed.ts'

const racesDir = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../public/races',
)

type Started = {
  baseUrl: string
  close: () => Promise<void>
}

async function startServer(opts: {
  token?: string
  seed?: boolean
  now?: () => Date
}): Promise<Started> {
  const db = openDatabase(':memory:')
  if (opts.seed !== false) {
    seedFromRacesDir(db, racesDir)
  }
  const handler = createApp({
    db,
    apiToken: opts.token,
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
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()))
        db.close()
      }),
  }
}

const sampleProject = {
  schemaVersion: 1,
  id: 'heat-test',
  name: 'Heat Test',
  origin: { lat: 41.0, lon: 29.0, altMsl: 0 },
  fleet: { boatIds: ['21', '22'] },
  povIds: ['1', '2'],
  courseUrl: '/fixtures/course/demo-istanbul.json',
}

describe('projects API', () => {
  let started: Started | undefined

  afterEach(async () => {
    if (started) {
      await started.close()
      started = undefined
    }
  })

  it('seeds demo-istanbul and lists it', async () => {
    started = await startServer({})
    const res = await fetch(`${started.baseUrl}/api/races`)
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ id: string; labels: string[] }>
    expect(list.some((p) => p.id === 'demo-istanbul')).toBe(true)
    const demo = list.find((p) => p.id === 'demo-istanbul')
    expect(demo?.labels).toContain('demo')
  })

  it('gets a seeded project', async () => {
    started = await startServer({})
    const res = await fetch(`${started.baseUrl}/api/races/demo-istanbul`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; revision: number }
    expect(body.id).toBe('demo-istanbul')
    expect(body.revision).toBe(1)
  })

  it('creates, updates with revision, and conflicts', async () => {
    let tick = 0
    started = await startServer({
      seed: false,
      now: () => new Date(Date.UTC(2026, 7, 1, 12, 0, tick++)),
    })

    const created = await fetch(`${started.baseUrl}/api/races`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleProject),
    })
    expect(created.status).toBe(201)
    expect(created.headers.get('Location')).toBe('/api/races/heat-test')
    const doc = (await created.json()) as {
      id: string
      revision: number
      updatedAt: string
      name: string
    }
    expect(doc.revision).toBe(1)
    expect(doc.updatedAt).toBe('2026-08-01T12:00:00.000Z')

    const putOk = await fetch(`${started.baseUrl}/api/races/heat-test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': '"1"',
      },
      body: JSON.stringify({ ...sampleProject, name: 'Heat Test 2', revision: 1 }),
    })
    expect(putOk.status).toBe(200)
    const updated = (await putOk.json()) as { revision: number; name: string }
    expect(updated.revision).toBe(2)
    expect(updated.name).toBe('Heat Test 2')

    const conflict = await fetch(`${started.baseUrl}/api/races/heat-test`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sampleProject, revision: 1 }),
    })
    expect(conflict.status).toBe(409)
    const err = (await conflict.json()) as {
      error: string
      currentRevision: number
    }
    expect(err.error).toBe('revision_conflict')
    expect(err.currentRevision).toBe(2)
  })

  it('rejects create duplicate with 409', async () => {
    started = await startServer({})
    const res = await fetch(`${started.baseUrl}/api/races`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sampleProject,
        id: 'demo-istanbul',
        name: 'Demo Istanbul',
      }),
    })
    expect(res.status).toBe(409)
  })

  it('deletes and 404s missing', async () => {
    started = await startServer({ seed: false })
    await fetch(`${started.baseUrl}/api/races`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleProject),
    })
    const del = await fetch(`${started.baseUrl}/api/races/heat-test`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(204)
    const again = await fetch(`${started.baseUrl}/api/races/heat-test`, {
      method: 'DELETE',
    })
    expect(again.status).toBe(404)
  })

  it('requires bearer when PROJECTS_API_TOKEN is set', async () => {
    started = await startServer({ token: 'secret', seed: false })
    const noAuth = await fetch(`${started.baseUrl}/api/races`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleProject),
    })
    expect(noAuth.status).toBe(401)

    const withAuth = await fetch(`${started.baseUrl}/api/races`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify(sampleProject),
    })
    expect(withAuth.status).toBe(201)

    const getOpen = await fetch(`${started.baseUrl}/api/races/heat-test`)
    expect(getOpen.status).toBe(200)
  })

  it('filters list by label', async () => {
    started = await startServer({})
    const res = await fetch(`${started.baseUrl}/api/races?label=demo`)
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ id: string; labels: string[] }>
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list.every((p) => p.labels.includes('demo'))).toBe(true)
    expect(list.some((p) => p.id === 'demo-istanbul')).toBe(true)
  })

  it('seed is idempotent (never overwrites)', async () => {
    const db = openDatabase(':memory:')
    const first = seedFromRacesDir(db, racesDir)
    expect(first.inserted).toBeGreaterThanOrEqual(1)
    const second = seedFromRacesDir(db, racesDir)
    expect(second.inserted).toBe(0)
    expect(second.skipped).toBeGreaterThanOrEqual(1)
    db.close()
  })
})
