import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repoRoot = resolve(serverRoot, '..')

export type ServerConfig = {
  host: string
  port: number
  dbPath: string
  seedDir: string
  apiToken: string | undefined
  corsOrigin: string | undefined
  seedOnBoot: boolean
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const token = env.PROJECTS_API_TOKEN?.trim()
  return {
    host: env.PROJECTS_API_HOST?.trim() || '127.0.0.1',
    port: Number(env.PROJECTS_API_PORT) || 8787,
    dbPath: env.PROJECTS_DB_PATH?.trim()
      ? resolve(env.PROJECTS_DB_PATH.trim())
      : resolve(serverRoot, 'data', 'races.sqlite'),
    seedDir: env.PROJECTS_SEED_DIR?.trim()
      ? resolve(env.PROJECTS_SEED_DIR.trim())
      : resolve(repoRoot, 'public', 'races'),
    apiToken: token || undefined,
    corsOrigin: env.PROJECTS_API_CORS?.trim() || undefined,
    seedOnBoot: env.PROJECTS_SEED_ON_BOOT !== '0',
  }
}

export { serverRoot, repoRoot }
