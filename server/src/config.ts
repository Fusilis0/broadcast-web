import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_MAX_ASSET_BYTES } from './assets.ts'

const serverRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repoRoot = resolve(serverRoot, '..')

export type ServerConfig = {
  host: string
  port: number
  dbPath: string
  seedDir: string
  /**
   * Universal asset library root (`public/assets/library`).
   * POST /api/assets writes here; GET lists `index.json`.
   */
  assetsLibraryDir: string
  /** Max uploaded library file size in bytes (default 20 MiB). */
  maxAssetBytes: number
  /**
   * Editor bearer for POST/PUT/DELETE.
   * Prefer `PROJECTS_API_EDITOR_TOKEN`; `PROJECTS_API_TOKEN` is a legacy alias.
   */
  editorToken: string | undefined
  /** Optional air bearer — write with this → 403; reads stay open. */
  airToken: string | undefined
  corsOrigin: string | undefined
  seedOnBoot: boolean
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const editor =
    env.PROJECTS_API_EDITOR_TOKEN?.trim() ||
    env.PROJECTS_API_TOKEN?.trim() ||
    undefined
  const air = env.PROJECTS_API_AIR_TOKEN?.trim() || undefined
  const maxAssetRaw = env.PROJECTS_MAX_ASSET_BYTES?.trim()
  const maxAssetParsed = maxAssetRaw ? Number(maxAssetRaw) : NaN
  return {
    host: env.PROJECTS_API_HOST?.trim() || '127.0.0.1',
    port: Number(env.PROJECTS_API_PORT) || 8787,
    dbPath: env.PROJECTS_DB_PATH?.trim()
      ? resolve(env.PROJECTS_DB_PATH.trim())
      : resolve(serverRoot, 'data', 'races.sqlite'),
    seedDir: env.PROJECTS_SEED_DIR?.trim()
      ? resolve(env.PROJECTS_SEED_DIR.trim())
      : resolve(repoRoot, 'public', 'races'),
    assetsLibraryDir: env.PROJECTS_ASSETS_LIBRARY_DIR?.trim()
      ? resolve(env.PROJECTS_ASSETS_LIBRARY_DIR.trim())
      : resolve(repoRoot, 'public', 'assets', 'library'),
    maxAssetBytes:
      Number.isFinite(maxAssetParsed) && maxAssetParsed > 0
        ? Math.floor(maxAssetParsed)
        : DEFAULT_MAX_ASSET_BYTES,
    editorToken: editor || undefined,
    airToken: air || undefined,
    corsOrigin: env.PROJECTS_API_CORS?.trim() || undefined,
    seedOnBoot: env.PROJECTS_SEED_ON_BOOT !== '0',
  }
}

export { serverRoot, repoRoot }
