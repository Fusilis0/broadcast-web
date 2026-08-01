import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { insertIfMissing } from './store.ts'
import { isSafeRaceId, parseRaceProjectBody } from './validate.ts'

export type SeedResult = {
  scanned: number
  inserted: number
  skipped: number
  errors: string[]
}

function defaultLabelsForId(id: string): string[] {
  return id.startsWith('demo') ? ['demo'] : []
}

/**
 * Idempotent seed from public/races/<id>/project.json folders.
 * Never overwrites an existing DB row.
 */
export function seedFromRacesDir(
  db: DatabaseSync,
  racesDir: string,
): SeedResult {
  const result: SeedResult = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  }

  if (!existsSync(racesDir)) {
    result.errors.push(`Seed directory missing: ${racesDir}`)
    return result
  }

  let entries: string[]
  try {
    entries = readdirSync(racesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch (err) {
    result.errors.push(
      `Failed to read seed dir: ${err instanceof Error ? err.message : String(err)}`,
    )
    return result
  }

  for (const dirName of entries) {
    if (!isSafeRaceId(dirName)) continue
    const projectPath = join(racesDir, dirName, 'project.json')
    if (!existsSync(projectPath)) continue

    result.scanned += 1
    try {
      const raw: unknown = JSON.parse(readFileSync(projectPath, 'utf8'))
      const project = parseRaceProjectBody(raw)
      if (project.id !== dirName) {
        result.errors.push(
          `${dirName}: body.id ${JSON.stringify(project.id)} !== folder name`,
        )
        continue
      }
      const inserted = insertIfMissing(db, project, defaultLabelsForId(project.id))
      if (inserted) result.inserted += 1
      else result.skipped += 1
    } catch (err) {
      result.errors.push(
        `${dirName}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return result
}
