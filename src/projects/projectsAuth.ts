/**
 * LAN projects API auth stub (Phase 9.1) — SPA side.
 * Roles: `editor` (may write) | `air` (read/load only).
 */

export type ProjectsRole = 'editor' | 'air'

export type ProjectsAuthConfig = {
  projectsRole?: string
  projectsApiToken?: string
  projectsApiBase?: string
}

/**
 * Normalize role string. Unknown / empty → `editor` (studio default).
 */
export function normalizeProjectsRole(raw: unknown): ProjectsRole {
  if (typeof raw !== 'string') return 'editor'
  const v = raw.trim().toLowerCase()
  if (v === 'air' || v === 'air-only' || v === 'aironly') return 'air'
  if (v === 'editor' || v === 'edit') return 'editor'
  return 'editor'
}

/**
 * Query override: `?projectsRole=air` or shorthand `?role=air`.
 * Returns undefined when neither param is present.
 */
export function projectsRoleFromSearch(
  search: string | URLSearchParams,
): ProjectsRole | undefined {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(
          search.startsWith('?') ? search.slice(1) : search,
        )
      : search
  const raw = params.get('projectsRole') ?? params.get('role')
  if (raw === null || raw.trim() === '') return undefined
  return normalizeProjectsRole(raw)
}

/**
 * Resolve effective role: query wins over config.
 */
export function resolveProjectsRole(
  config: ProjectsAuthConfig,
  search?: string | URLSearchParams,
): ProjectsRole {
  const fromQuery =
    search !== undefined ? projectsRoleFromSearch(search) : undefined
  if (fromQuery !== undefined) return fromQuery
  return normalizeProjectsRole(config.projectsRole)
}

/**
 * True when the SPA may attempt API POST/PUT (and show Save / Save as write UI).
 * Air role never writes — even if a token is present.
 */
export function canWriteProjectsApi(
  config: ProjectsAuthConfig,
  search?: string | URLSearchParams,
): boolean {
  return resolveProjectsRole(config, search) === 'editor'
}

/** Trimmed bearer for `Authorization`, or undefined. */
export function projectsApiBearerToken(
  config: ProjectsAuthConfig,
): string | undefined {
  const t = config.projectsApiToken?.trim()
  return t ? t : undefined
}
