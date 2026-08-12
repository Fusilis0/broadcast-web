import { isSafeRaceId, parseRaceProject } from '../parseRaceProject.ts'
import {
  VENUE_PACK_KIND,
  type VenuePack,
  type VenuePackFile,
  type VenuePackFileEncoding,
} from './types.ts'

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  return t === '' ? undefined : t
}

function parseFile(raw: unknown, path: string): VenuePackFile {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`VenuePack.files[${JSON.stringify(path)}] must be an object`)
  }
  const o = raw as Record<string, unknown>
  const contentType = nonEmptyString(o.contentType)
  if (!contentType) {
    throw new Error(
      `VenuePack.files[${JSON.stringify(path)}].contentType is required`,
    )
  }
  const encoding = nonEmptyString(o.encoding) as VenuePackFileEncoding | undefined
  if (encoding !== 'utf-8' && encoding !== 'base64') {
    throw new Error(
      `VenuePack.files[${JSON.stringify(path)}].encoding must be utf-8|base64`,
    )
  }
  if (typeof o.body !== 'string') {
    throw new Error(
      `VenuePack.files[${JSON.stringify(path)}].body must be a string`,
    )
  }
  return { contentType, encoding, body: o.body }
}

/**
 * Light-validate unknown JSON into a VenuePack.
 * Validates nested `project` via parseRaceProject.
 */
export function parseVenuePack(raw: unknown): VenuePack {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('VenuePack must be a JSON object')
  }
  const o = raw as Record<string, unknown>

  if (typeof o.schemaVersion !== 'number' || !Number.isFinite(o.schemaVersion) || o.schemaVersion < 1) {
    throw new Error('VenuePack.schemaVersion must be a number >= 1')
  }
  if (o.kind !== VENUE_PACK_KIND) {
    throw new Error(
      `VenuePack.kind must be ${JSON.stringify(VENUE_PACK_KIND)}`,
    )
  }

  const id = nonEmptyString(o.id)
  const name = nonEmptyString(o.name)
  if (!id) throw new Error('VenuePack.id is required')
  if (!isSafeRaceId(id)) {
    throw new Error(`VenuePack.id is not a safe race id: ${JSON.stringify(id)}`)
  }
  if (!name) throw new Error('VenuePack.name is required')

  const createdAt = nonEmptyString(o.createdAt) ?? new Date().toISOString()
  const project = parseRaceProject(o.project)
  if (project.id !== id) {
    // Soft: prefer pack id for cache key consistency.
    project.id = id
  }

  if (o.files === null || typeof o.files !== 'object' || Array.isArray(o.files)) {
    throw new Error('VenuePack.files must be an object')
  }
  const files: Record<string, VenuePackFile> = {}
  for (const [path, value] of Object.entries(
    o.files as Record<string, unknown>,
  )) {
    const key = path.trim()
    if (!key.startsWith('/')) {
      throw new Error(
        `VenuePack.files key must be an absolute path: ${JSON.stringify(path)}`,
      )
    }
    files[key] = parseFile(value, key)
  }

  return {
    schemaVersion: o.schemaVersion,
    kind: VENUE_PACK_KIND,
    id,
    name,
    createdAt,
    project,
    files,
  }
}
