import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type RaceProjectRow = {
  id: string
  name: string
  revision: number
  updated_at: string
  labels_json: string
  body_json: string
}

export type ListProjection = {
  id: string
  name: string
  revision: number
  updatedAt: string
  labels: string[]
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS race_projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL,
  labels_json TEXT NOT NULL DEFAULT '[]',
  body_json TEXT NOT NULL
);
`

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA)
  return db
}

export function rowToProjection(row: RaceProjectRow): ListProjection {
  let labels: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.labels_json)
    if (Array.isArray(parsed)) {
      labels = parsed.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    labels = []
  }
  return {
    id: row.id,
    name: row.name,
    revision: row.revision,
    updatedAt: row.updated_at,
    labels,
  }
}
