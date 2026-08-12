/**
 * Universal asset library storage (Phase 11.3 / PLT-01).
 * Files live under public/assets/library/<kind>/<slug>-<shortHash>.<ext>
 * Manifest: public/assets/library/index.json (pretty-printed, stable keys).
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const LIBRARY_KINDS = ['image', 'model'] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]

export const LIBRARY_EXTENSIONS = {
  image: ['png', 'jpg', 'jpeg', 'webp'] as const,
  model: ['glb', 'gltf'] as const,
} as const

export const ALL_LIBRARY_EXTENSIONS = [
  ...LIBRARY_EXTENSIONS.image,
  ...LIBRARY_EXTENSIONS.model,
] as const

/** Default upload size cap (file bytes). Documented in server README. */
export const DEFAULT_MAX_ASSET_BYTES = 20 * 1024 * 1024

export type LibraryAsset = {
  id: string
  kind: LibraryKind
  /** Relative path under library root, e.g. `image/logo-a1b2c3d4.png`. */
  filename: string
  label: string
  addedAt: string
  sizeBytes: number
}

export type LibraryManifest = LibraryAsset[]

export type StoreAssetInput = {
  libraryDir: string
  originalFilename: string
  data: Buffer
  label?: string
  addedAt: string
}

export type StoreAssetResult =
  | { ok: true; asset: LibraryAsset }
  | { ok: false; status: number; error: string }

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.')
  if (i <= 0 || i === filename.length - 1) return ''
  return filename.slice(i + 1).toLowerCase()
}

export function kindForExtension(ext: string): LibraryKind | undefined {
  const e = ext.toLowerCase()
  if ((LIBRARY_EXTENSIONS.image as readonly string[]).includes(e)) return 'image'
  if ((LIBRARY_EXTENSIONS.model as readonly string[]).includes(e)) return 'model'
  return undefined
}

/** Sanitize original basename into a URL-safe slug (no extension). */
export function slugifyFilename(originalFilename: string): string {
  const base = originalFilename.replace(/\\/g, '/').split('/').pop() ?? 'asset'
  const withoutExt = base.includes('.')
    ? base.slice(0, base.lastIndexOf('.'))
    : base
  const slug = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'asset'
}

function shortHash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 8)
}

function manifestPath(libraryDir: string): string {
  return join(libraryDir, 'index.json')
}

/** Stable key order for human-diffable JSON. */
export function serializeManifest(entries: LibraryManifest): string {
  const ordered = entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    filename: e.filename,
    label: e.label,
    addedAt: e.addedAt,
    sizeBytes: e.sizeBytes,
  }))
  return `${JSON.stringify(ordered, null, 2)}\n`
}

export async function readManifest(
  libraryDir: string,
): Promise<LibraryManifest> {
  const path = manifestPath(libraryDir)
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isLibraryAsset)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return []
    throw err
  }
}

function isLibraryAsset(value: unknown): value is LibraryAsset {
  if (value === null || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    (o.kind === 'image' || o.kind === 'model') &&
    typeof o.filename === 'string' &&
    typeof o.label === 'string' &&
    typeof o.addedAt === 'string' &&
    typeof o.sizeBytes === 'number'
  )
}

export async function writeManifest(
  libraryDir: string,
  entries: LibraryManifest,
): Promise<void> {
  await mkdir(libraryDir, { recursive: true })
  await writeFile(manifestPath(libraryDir), serializeManifest(entries), 'utf8')
}

/**
 * Validate, write file under libraryDir, append manifest. Append-only (no
 * overwrite of existing id — hash collision with same content is fine/idempotent
 * by returning the existing entry).
 */
export async function storeLibraryAsset(
  input: StoreAssetInput,
): Promise<StoreAssetResult> {
  const ext = extOf(input.originalFilename)
  const kind = kindForExtension(ext)
  if (!kind) {
    return { ok: false, status: 400, error: 'invalid_extension' }
  }

  const slug = slugifyFilename(input.originalFilename)
  const hash = shortHash(input.data)
  const storedName = `${slug}-${hash}.${ext === 'jpeg' ? 'jpg' : ext}`
  const relative = `${kind}/${storedName}`
  const id = relative
  const absPath = join(input.libraryDir, kind, storedName)

  const existing = await readManifest(input.libraryDir)
  const prior = existing.find((e) => e.id === id)
  if (prior) {
    return { ok: true, asset: prior }
  }

  await mkdir(dirname(absPath), { recursive: true })
  await writeFile(absPath, input.data)

  const label =
    input.label?.trim() ||
    slugifyFilename(input.originalFilename).replace(/-/g, ' ') ||
    storedName

  const asset: LibraryAsset = {
    id,
    kind,
    filename: relative,
    label,
    addedAt: input.addedAt,
    sizeBytes: input.data.length,
  }

  const next = [...existing, asset]
  await writeManifest(input.libraryDir, next)
  return { ok: true, asset }
}

/** Site-relative URL for a library entry (Vite / static). */
export function libraryAssetPublicUrl(asset: Pick<LibraryAsset, 'filename'>): string {
  const f = asset.filename.replace(/^\/+/, '')
  return `/assets/library/${f}`
}
