import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import {
  createProject,
  deleteProject,
  DuplicateError,
  getProject,
  listProjects,
  NotFoundError,
  RevisionConflictError,
  updateProject,
} from './store.ts'
import {
  isSafeRaceId,
  parseExpectedRevision,
  parseLabels,
  parseRaceProjectBody,
} from './validate.ts'

const MAX_BODY_BYTES = 2 * 1024 * 1024

export type AppOptions = {
  db: DatabaseSync
  /** When set, mutating methods require `Authorization: Bearer <token>`. */
  apiToken?: string
  /** Override clock for tests. */
  now?: () => Date
  /** Comma-separated origins, or `*` for reflect-request. Empty → no CORS. */
  corsOrigin?: string
}

type JsonBody =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string }

async function readJsonBody(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: 'body_too_large' }
    }
    chunks.push(buf)
  }
  if (chunks.length === 0) {
    return { ok: false, status: 400, error: 'empty_body' }
  }
  try {
    const text = Buffer.concat(chunks).toString('utf8')
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' }
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  })
  res.end(payload)
}

function sendEmpty(res: ServerResponse, status: number): void {
  res.writeHead(status)
  res.end()
}

function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  corsOrigin: string | undefined,
): void {
  if (!corsOrigin) return
  const requestOrigin = req.headers.origin
  if (corsOrigin === '*') {
    if (requestOrigin) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin)
      res.setHeader('Vary', 'Origin')
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
  } else {
    const allowed = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean)
    if (requestOrigin && allowed.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin)
      res.setHeader('Vary', 'Origin')
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, If-Match',
  )
}

function requireWriteAuth(
  req: IncomingMessage,
  apiToken: string | undefined,
): boolean {
  if (!apiToken) return true
  const header = req.headers.authorization
  if (typeof header !== 'string') return false
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match !== null && match[1] === apiToken
}

function matchRaceId(pathname: string): string | undefined {
  const m = /^\/api\/races\/([^/]+)$/.exec(pathname)
  if (!m) return undefined
  try {
    return decodeURIComponent(m[1]!)
  } catch {
    return m[1]
  }
}

export function createApp(options: AppOptions) {
  const { db, apiToken, corsOrigin } = options
  const now = options.now ?? (() => new Date())

  return async function handler(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    applyCors(req, res, corsOrigin)

    const method = req.method ?? 'GET'
    const host = req.headers.host ?? '127.0.0.1'
    const url = new URL(req.url ?? '/', `http://${host}`)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    if (method === 'OPTIONS') {
      sendEmpty(res, 204)
      return
    }

    try {
      if (method === 'GET' && pathname === '/api/races') {
        const label = url.searchParams.get('label') ?? undefined
        sendJson(res, 200, listProjects(db, label || undefined))
        return
      }

      if (method === 'GET' && pathname.startsWith('/api/races/')) {
        const id = matchRaceId(pathname)
        if (!id || !isSafeRaceId(id)) {
          sendJson(res, 400, { error: 'invalid_id' })
          return
        }
        const project = getProject(db, id)
        if (!project) {
          sendJson(res, 404, { error: 'not_found' })
          return
        }
        sendJson(res, 200, project)
        return
      }

      if (method === 'POST' && pathname === '/api/races') {
        if (!requireWriteAuth(req, apiToken)) {
          sendJson(res, 401, { error: 'unauthorized' })
          return
        }
        const body = await readJsonBody(req)
        if (!body.ok) {
          sendJson(res, body.status, { error: body.error })
          return
        }

        let projectRaw: unknown
        let labels: string[] = []
        const raw = body.value
        if (
          raw !== null &&
          typeof raw === 'object' &&
          'project' in (raw as object)
        ) {
          const wrapper = raw as Record<string, unknown>
          projectRaw = wrapper.project
          try {
            labels = parseLabels(wrapper.labels)
          } catch (err) {
            sendJson(res, 400, {
              error: err instanceof Error ? err.message : 'invalid_labels',
            })
            return
          }
        } else {
          projectRaw = raw
        }

        let project
        try {
          project = parseRaceProjectBody(projectRaw)
        } catch (err) {
          sendJson(res, 400, {
            error: err instanceof Error ? err.message : 'invalid_project',
          })
          return
        }

        try {
          const stored = createProject(db, project, labels, now().toISOString())
          sendJson(res, 201, stored, {
            Location: `/api/races/${encodeURIComponent(project.id)}`,
          })
        } catch (err) {
          if (err instanceof DuplicateError) {
            sendJson(res, 409, { error: 'already_exists' })
            return
          }
          throw err
        }
        return
      }

      if (method === 'PUT' && pathname.startsWith('/api/races/')) {
        if (!requireWriteAuth(req, apiToken)) {
          sendJson(res, 401, { error: 'unauthorized' })
          return
        }
        const id = matchRaceId(pathname)
        if (!id || !isSafeRaceId(id)) {
          sendJson(res, 400, { error: 'invalid_id' })
          return
        }

        const body = await readJsonBody(req)
        if (!body.ok) {
          sendJson(res, body.status, { error: body.error })
          return
        }

        let project
        try {
          project = parseRaceProjectBody(body.value)
        } catch (err) {
          sendJson(res, 400, {
            error: err instanceof Error ? err.message : 'invalid_project',
          })
          return
        }

        if (project.id !== id) {
          sendJson(res, 400, { error: 'id_mismatch' })
          return
        }

        const ifMatch =
          typeof req.headers['if-match'] === 'string'
            ? req.headers['if-match']
            : undefined
        const expected = parseExpectedRevision(ifMatch, project.revision)
        if (expected === null) {
          sendJson(res, 400, { error: 'revision_required' })
          return
        }

        try {
          const stored = updateProject(
            db,
            id,
            project,
            expected,
            now().toISOString(),
          )
          sendJson(res, 200, stored)
        } catch (err) {
          if (err instanceof NotFoundError) {
            sendJson(res, 404, { error: 'not_found' })
            return
          }
          if (err instanceof RevisionConflictError) {
            sendJson(res, 409, {
              error: 'revision_conflict',
              currentRevision: err.currentRevision,
            })
            return
          }
          throw err
        }
        return
      }

      if (method === 'DELETE' && pathname.startsWith('/api/races/')) {
        if (!requireWriteAuth(req, apiToken)) {
          sendJson(res, 401, { error: 'unauthorized' })
          return
        }
        const id = matchRaceId(pathname)
        if (!id || !isSafeRaceId(id)) {
          sendJson(res, 400, { error: 'invalid_id' })
          return
        }
        const removed = deleteProject(db, id)
        if (!removed) {
          sendJson(res, 404, { error: 'not_found' })
          return
        }
        sendEmpty(res, 204)
        return
      }

      sendJson(res, 404, { error: 'not_found' })
    } catch (err) {
      console.error('[projects-api]', err)
      sendJson(res, 500, { error: 'internal_error' })
    }
  }
}
