/**
 * Project manager ops (Phase 11.4): list / duplicate / rename / archive.
 *
 * Rename = client-orchestrated duplicate-then-delete (ids stay immutable in the
 * schema). Create is confirmed before DELETE so a mid-op failure never drops
 * the source project.
 */

import { orphanBoatIds } from '../scene/fleetRegistry.ts'
import { loadRaceProject, raceProjectApiUrl } from './loadRaceProject.ts'
import { isSafeRaceId } from './parseRaceProject.ts'
import type { RaceProject } from './types.ts'
import {
  writeRaceProject,
  WriteRaceProjectError,
} from './writeRaceProject.ts'

/** Same convention as server `ARCHIVED_LABEL`. */
export const ARCHIVED_LABEL = 'archived'

export type RaceProjectSummary = {
  id: string
  name: string
  revision: number
  updatedAt: string
  labels: string[]
}

export type ListRaceProjectsOptions = {
  projectsApiBase: string
  /** When true, include archived; default hides them. */
  includeArchived?: boolean
  /** When set, only projects with this label (overrides default archive hide). */
  label?: string
  fetchImpl?: typeof fetch
}

export type ProjectManagerWriteOptions = {
  projectsApiBase: string
  bearerToken?: string
  fetchImpl?: typeof fetch
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

function parseSummary(raw: unknown): RaceProjectSummary | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !isSafeRaceId(o.id.trim())) return null
  const labels = Array.isArray(o.labels)
    ? o.labels.filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: o.id.trim(),
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : o.id.trim(),
    revision:
      typeof o.revision === 'number' && Number.isFinite(o.revision)
        ? o.revision
        : 1,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : '',
    labels,
  }
}

/** True when `projectsApiBase` is set (LAN / studio API path). */
export function isProjectsApiConfigured(projectsApiBase: string): boolean {
  return projectsApiBase.trim() !== ''
}

export function isArchived(labels: readonly string[]): boolean {
  return labels.includes(ARCHIVED_LABEL)
}

/**
 * Boat ids present in the fleet but missing from the boat-name catalogue.
 * Reuses `orphanBoatIds` (fleet allow-set semantics with catalogue keys).
 */
export function boatIdsMissingFromCatalogue(
  boatIds: readonly string[],
  catalogueIds: Iterable<string>,
): string[] {
  return orphanBoatIds(boatIds, new Set(catalogueIds)).sort()
}

/**
 * Non-blocking Save warning. Returns null when all boat ids are in catalogue.
 */
export function formatOrphanBoatIdWarning(
  missingIds: readonly string[],
): string | null {
  if (missingIds.length === 0) return null
  return `boat ids not in catalogue: ${missingIds.join(', ')} — Save anyway?`
}

/**
 * Confirm Save when fleet has ids absent from the boat-name catalogue.
 * Returns false if the operator cancels.
 */
export function confirmSaveWithOrphanBoatIds(
  boatIds: readonly string[],
  catalogueIds: Iterable<string>,
  confirmImpl: (message: string) => boolean = (m) => window.confirm(m),
): boolean {
  const missing = boatIdsMissingFromCatalogue(boatIds, catalogueIds)
  const warning = formatOrphanBoatIdWarning(missing)
  if (!warning) return true
  return confirmImpl(warning)
}

function buildListUrl(
  apiBase: string,
  opts: { includeArchived?: boolean; label?: string },
): string {
  const base = apiBase.trim().replace(/\/+$/, '')
  const params = new URLSearchParams()
  if (opts.label?.trim()) {
    params.set('label', opts.label.trim())
  } else if (opts.includeArchived) {
    params.set('includeArchived', '1')
  }
  const q = params.toString()
  return q ? `${base}/races?${q}` : `${base}/races`
}

/** List project summaries from the API (default excludes archived). */
export async function listRaceProjects(
  options: ListRaceProjectsOptions,
): Promise<RaceProjectSummary[]> {
  const apiBase = options.projectsApiBase.trim()
  if (!apiBase) return []
  const fetchImpl = options.fetchImpl ?? fetch
  const listUrl = buildListUrl(apiBase, {
    includeArchived: options.includeArchived,
    label: options.label,
  })
  const response = await fetchImpl(listUrl)
  if (!response.ok) {
    throw new WriteRaceProjectError(
      `API list failed (${response.status})`,
      response.status,
      await readErrorBody(response),
    )
  }
  const raw = await response.json()
  if (!Array.isArray(raw)) return []
  const out: RaceProjectSummary[] = []
  for (const item of raw) {
    const s = parseSummary(item)
    if (s) out.push(s)
  }
  return out
}

/** DELETE `/races/:id`. */
export async function deleteRaceProject(
  id: string,
  options: ProjectManagerWriteOptions,
): Promise<void> {
  const apiBase = options.projectsApiBase.trim()
  if (!apiBase) throw new Error('deleteRaceProject requires projectsApiBase')
  if (!isSafeRaceId(id)) {
    throw new Error(`Invalid race id: ${JSON.stringify(id)}`)
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const res = await fetchImpl(raceProjectApiUrl(apiBase, id), {
    method: 'DELETE',
    headers: { ...authHeaders(options.bearerToken) },
  })
  if (!res.ok) {
    throw new WriteRaceProjectError(
      `API delete failed (${res.status})`,
      res.status,
      await readErrorBody(res),
    )
  }
}

/**
 * POST a copy under a new id/name. Source untouched. Optional labels copied
 * (caller may strip `archived`).
 */
export async function duplicateRaceProject(
  source: RaceProject,
  meta: { id: string; name: string },
  options: ProjectManagerWriteOptions & { labels?: string[] },
): Promise<RaceProject> {
  const id = meta.id.trim()
  const name = meta.name.trim() || id
  if (!isSafeRaceId(id)) {
    throw new Error(`Invalid race id: ${JSON.stringify(id)}`)
  }
  const copy: RaceProject = {
    ...source,
    id,
    name,
    revision: undefined,
    updatedAt: undefined,
  }
  return writeRaceProject(copy, {
    projectsApiBase: options.projectsApiBase,
    bearerToken: options.bearerToken,
    fetchImpl: options.fetchImpl,
    mode: 'create',
    labels: options.labels,
  })
}

/**
 * Effective rename: create under new id, then delete old.
 * Never deletes until create succeeds.
 */
export async function renameRaceProject(
  sourceId: string,
  meta: { id: string; name: string },
  options: ProjectManagerWriteOptions & { labels?: string[] },
): Promise<RaceProject> {
  const newId = meta.id.trim()
  if (!isSafeRaceId(newId)) {
    throw new Error(`Invalid race id: ${JSON.stringify(newId)}`)
  }
  if (newId === sourceId) {
    throw new Error('rename requires a new project id')
  }
  const source = await loadRaceProject(sourceId, {
    projectsApiBase: options.projectsApiBase,
    fetchImpl: options.fetchImpl,
  })
  const created = await duplicateRaceProject(source, meta, options)
  try {
    await deleteRaceProject(sourceId, options)
  } catch (err) {
    // New copy exists; report but leave both so ops can clean up.
    console.warn(
      '[projects] rename: created new id but failed to delete old',
      { sourceId, newId, err },
    )
    throw err
  }
  return created
}

/**
 * Add or remove the `archived` label via PUT wrapper (revision bump).
 * Project body unchanged aside from server-assigned revision/updatedAt.
 */
export async function setRaceProjectArchived(
  id: string,
  archived: boolean,
  options: ProjectManagerWriteOptions & {
    /** Current labels from list projection (required to preserve other tags). */
    currentLabels: readonly string[]
    expectedRevision: number
  },
): Promise<RaceProject> {
  const project = await loadRaceProject(id, {
    projectsApiBase: options.projectsApiBase,
    fetchImpl: options.fetchImpl,
  })
  const labels = options.currentLabels.filter((l) => l !== ARCHIVED_LABEL)
  if (archived) labels.push(ARCHIVED_LABEL)
  return writeRaceProject(
    { ...project, revision: options.expectedRevision },
    {
      projectsApiBase: options.projectsApiBase,
      bearerToken: options.bearerToken,
      fetchImpl: options.fetchImpl,
      mode: 'update',
      expectedRevision: options.expectedRevision,
      labels,
    },
  )
}
