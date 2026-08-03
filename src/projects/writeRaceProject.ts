/**
 * Optional RaceProject API write (Phase 6.4).
 * Download remains the primary persist path; this POSTs/PUTs when
 * `projectsApiBase` is configured and the stub is reachable.
 */

import { raceProjectApiUrl } from './loadRaceProject.ts'
import { isSafeRaceId, parseRaceProject } from './parseRaceProject.ts'
import type { RaceProject } from './types.ts'

export type WriteRaceProjectMode = 'create' | 'update'

export type WriteRaceProjectOptions = {
  projectsApiBase: string
  /**
   * `create` → POST `/races` (409 if id exists).
   * `update` → PUT `/races/:id` with revision (If-Match or body).
   */
  mode: WriteRaceProjectMode
  /** Required for `update` when the project body has no `revision`. */
  expectedRevision?: number
  /** When set, sent as `Authorization: Bearer …` (local stub may leave writes open). */
  bearerToken?: string
  fetchImpl?: typeof fetch
}

export class WriteRaceProjectError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'WriteRaceProjectError'
    this.status = status
    this.body = body
  }
}

function apiRacesCollectionUrl(apiBase: string): string {
  const base = apiBase.trim().replace(/\/+$/, '')
  return `${base}/races`
}

function authHeaders(token: string | undefined): Record<string, string> {
  if (!token?.trim()) return {}
  return { Authorization: `Bearer ${token.trim()}` }
}

async function readErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    try {
      return await res.text()
    } catch {
      return undefined
    }
  }
}

/**
 * Persist a RaceProject to the projects API stub.
 * Caller should still download JSON for git / static drop-in.
 */
export async function writeRaceProject(
  project: RaceProject,
  options: WriteRaceProjectOptions,
): Promise<RaceProject> {
  const apiBase = options.projectsApiBase.trim()
  if (!apiBase) {
    throw new Error('writeRaceProject requires projectsApiBase')
  }
  if (!isSafeRaceId(project.id)) {
    throw new Error(`Invalid race id: ${JSON.stringify(project.id)}`)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(options.bearerToken),
  }

  if (options.mode === 'create') {
    const res = await fetchImpl(apiRacesCollectionUrl(apiBase), {
      method: 'POST',
      headers,
      body: JSON.stringify(project),
    })
    if (!res.ok) {
      throw new WriteRaceProjectError(
        `API create failed (${res.status})`,
        res.status,
        await readErrorBody(res),
      )
    }
    return parseRaceProject(await res.json())
  }

  const expected =
    options.expectedRevision ??
    (typeof project.revision === 'number' ? project.revision : undefined)
  if (expected === undefined) {
    throw new Error('writeRaceProject update requires expectedRevision')
  }

  const body = { ...project, revision: expected }
  headers['If-Match'] = `"${expected}"`

  const res = await fetchImpl(raceProjectApiUrl(apiBase, project.id), {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new WriteRaceProjectError(
      `API update failed (${res.status})`,
      res.status,
      await readErrorBody(res),
    )
  }
  return parseRaceProject(await res.json())
}
