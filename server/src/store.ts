import type { DatabaseSync } from 'node:sqlite'
import type { ListProjection, RaceProjectRow } from './db.ts'
import { rowToProjection } from './db.ts'
import type { RaceProjectBody } from './validate.ts'

export class RevisionConflictError extends Error {
  readonly currentRevision: number
  constructor(currentRevision: number) {
    super('revision_conflict')
    this.name = 'RevisionConflictError'
    this.currentRevision = currentRevision
  }
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Race project not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class DuplicateError extends Error {
  constructor(id: string) {
    super(`Race project already exists: ${id}`)
    this.name = 'DuplicateError'
  }
}

function getRow(db: DatabaseSync, id: string): RaceProjectRow | undefined {
  return db
    .prepare(
      `SELECT id, name, revision, updated_at, labels_json, body_json
       FROM race_projects WHERE id = ?`,
    )
    .get(id) as RaceProjectRow | undefined
}

/** Convention label: archived projects are hidden from the default list. */
export const ARCHIVED_LABEL = 'archived'

export type ListProjectsFilter = {
  /** Include only projects that have this label. */
  label?: string
  /** Drop projects that have this label (default list uses `archived`). */
  excludeLabel?: string
}

export function listProjects(
  db: DatabaseSync,
  filter?: string | ListProjectsFilter,
): ListProjection[] {
  const rows = db
    .prepare(
      `SELECT id, name, revision, updated_at, labels_json, body_json
       FROM race_projects ORDER BY id ASC`,
    )
    .all() as RaceProjectRow[]

  const projections = rows.map(rowToProjection)
  const opts: ListProjectsFilter =
    typeof filter === 'string' ? { label: filter } : (filter ?? {})
  let out = projections
  if (opts.label) {
    out = out.filter((p) => p.labels.includes(opts.label!))
  }
  if (opts.excludeLabel) {
    out = out.filter((p) => !p.labels.includes(opts.excludeLabel!))
  }
  return out
}

export function getProject(
  db: DatabaseSync,
  id: string,
): Record<string, unknown> | undefined {
  const row = getRow(db, id)
  if (!row) return undefined
  return JSON.parse(row.body_json) as Record<string, unknown>
}

export function createProject(
  db: DatabaseSync,
  project: RaceProjectBody,
  labels: string[],
  nowIso: string,
): Record<string, unknown> {
  const existing = getRow(db, project.id)
  if (existing) throw new DuplicateError(project.id)

  const body: Record<string, unknown> = {
    ...project,
    id: project.id,
    name: project.name,
    revision: 1,
    updatedAt: nowIso,
  }

  db.prepare(
    `INSERT INTO race_projects (id, name, revision, updated_at, labels_json, body_json)
     VALUES (?, ?, 1, ?, ?, ?)`,
  ).run(
    project.id,
    project.name,
    nowIso,
    JSON.stringify(labels),
    JSON.stringify(body),
  )

  return body
}

export function updateProject(
  db: DatabaseSync,
  id: string,
  project: RaceProjectBody,
  expectedRevision: number,
  nowIso: string,
  labels?: string[],
): Record<string, unknown> {
  const row = getRow(db, id)
  if (!row) throw new NotFoundError(id)
  if (row.revision !== expectedRevision) {
    throw new RevisionConflictError(row.revision)
  }

  const nextRevision = row.revision + 1
  const body: Record<string, unknown> = {
    ...project,
    id,
    name: project.name,
    revision: nextRevision,
    updatedAt: nowIso,
  }

  const nextLabels =
    labels !== undefined ? JSON.stringify(labels) : row.labels_json

  const result = db
    .prepare(
      `UPDATE race_projects
       SET name = ?, revision = ?, updated_at = ?, labels_json = ?, body_json = ?
       WHERE id = ? AND revision = ?`,
    )
    .run(
      project.name,
      nextRevision,
      nowIso,
      nextLabels,
      JSON.stringify(body),
      id,
      expectedRevision,
    )

  if (result.changes !== 1) {
    const again = getRow(db, id)
    throw new RevisionConflictError(again?.revision ?? expectedRevision)
  }

  return body
}

export function deleteProject(db: DatabaseSync, id: string): boolean {
  const result = db.prepare(`DELETE FROM race_projects WHERE id = ?`).run(id)
  return result.changes === 1
}

/** Insert only if missing (seed). Never overwrites existing rows. */
export function insertIfMissing(
  db: DatabaseSync,
  project: RaceProjectBody,
  labels: string[],
): boolean {
  const existing = getRow(db, project.id)
  if (existing) return false

  const revision =
    typeof project.revision === 'number' &&
    Number.isInteger(project.revision) &&
    project.revision >= 1
      ? project.revision
      : 1
  const updatedAt =
    typeof project.updatedAt === 'string' && project.updatedAt.trim() !== ''
      ? project.updatedAt.trim()
      : new Date().toISOString()

  const body: Record<string, unknown> = {
    ...project,
    id: project.id,
    name: project.name,
    revision,
    updatedAt,
  }

  db.prepare(
    `INSERT INTO race_projects (id, name, revision, updated_at, labels_json, body_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    project.id,
    project.name,
    revision,
    updatedAt,
    JSON.stringify(labels),
    JSON.stringify(body),
  )
  return true
}
