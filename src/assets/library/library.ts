/**
 * Universal asset library client (Phase 11.3 / PLT-01).
 * List from API or static manifest; upload when projectsApiBase is set.
 */

import {
  LIBRARY_MANIFEST_URL,
  LIBRARY_PUBLIC_PREFIX,
  type LibraryAsset,
} from './types.ts'

export type ListLibraryAssetsOptions = {
  /**
   * Same as RaceProject API base (e.g. `"/api"`). When set, prefer
   * `GET {base}/assets`; fall back to static manifest on failure.
   */
  projectsApiBase?: string
  fetchImpl?: typeof fetch
}

export type UploadLibraryAssetOptions = {
  projectsApiBase: string
  file: Blob
  /** Original filename (required for extension → kind). */
  filename: string
  label?: string
  /** Editor bearer when the server locks writes. */
  bearerToken?: string
  fetchImpl?: typeof fetch
}

export class LibraryApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'LibraryApiError'
    this.status = status
    this.body = body
  }
}

function trimBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/, '')
}

function assetsCollectionUrl(apiBase: string): string {
  return `${trimBase(apiBase)}/assets`
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

export function parseLibraryManifest(raw: unknown): LibraryAsset[] {
  if (!Array.isArray(raw)) {
    throw new Error('library manifest must be an array')
  }
  return raw.filter(isLibraryAsset)
}

/**
 * Site-relative URL for `WorldFeature.textureUrl` / model pickers.
 * Example: `/assets/library/image/logo-a1b2c3d4.png`
 */
export function resolveLibraryAssetUrl(
  asset: Pick<LibraryAsset, 'filename'>,
): string {
  const f = asset.filename.replace(/^\/+/, '')
  if (f.startsWith('assets/library/')) return `/${f}`
  return `${LIBRARY_PUBLIC_PREFIX}/${f}`
}

/** True when upload UI may call the API (base configured). */
export function isLibraryUploadConfigured(
  projectsApiBase: string | undefined,
): boolean {
  return Boolean(projectsApiBase?.trim())
}

async function fetchStaticManifest(
  fetchImpl: typeof fetch,
): Promise<LibraryAsset[]> {
  const res = await fetchImpl(LIBRARY_MANIFEST_URL)
  if (!res.ok) {
    throw new LibraryApiError(
      `static library manifest failed (${res.status})`,
      res.status,
      await readErrorBody(res),
    )
  }
  return parseLibraryManifest(await res.json())
}

/**
 * List catalogue. With `projectsApiBase`, try API first then static fallback.
 * Without base → static `/assets/library/index.json` only.
 */
export async function listLibraryAssets(
  options: ListLibraryAssetsOptions = {},
): Promise<LibraryAsset[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const apiBase = options.projectsApiBase?.trim()
  if (apiBase) {
    try {
      const res = await fetchImpl(assetsCollectionUrl(apiBase))
      if (res.ok) {
        return parseLibraryManifest(await res.json())
      }
    } catch {
      /* fall through to static */
    }
  }
  return fetchStaticManifest(fetchImpl)
}

/**
 * Upload multipart to `POST {projectsApiBase}/assets`.
 * Caller must only invoke when `isLibraryUploadConfigured` is true.
 */
export async function uploadLibraryAsset(
  options: UploadLibraryAssetOptions,
): Promise<LibraryAsset> {
  const apiBase = options.projectsApiBase.trim()
  if (!apiBase) {
    throw new Error('uploadLibraryAsset requires projectsApiBase')
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const form = new FormData()
  form.append('file', options.file, options.filename)
  if (options.label?.trim()) {
    form.append('label', options.label.trim())
  }

  const res = await fetchImpl(assetsCollectionUrl(apiBase), {
    method: 'POST',
    headers: authHeaders(options.bearerToken),
    body: form,
  })
  if (!res.ok) {
    throw new LibraryApiError(
      `library upload failed (${res.status})`,
      res.status,
      await readErrorBody(res),
    )
  }
  const json = (await res.json()) as unknown
  if (!isLibraryAsset(json)) {
    throw new Error('library upload returned invalid asset')
  }
  return json
}
