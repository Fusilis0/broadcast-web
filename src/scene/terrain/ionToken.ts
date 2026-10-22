/**
 * Cesium ion token: `public/config.json` (local, never commit the JWT) wins,
 * then session (Ops paste this session), then `VITE_CESIUM_ION_TOKEN`.
 * Never log the value. Empty → terrain stays off (no throw).
 */

export const CESIUM_ION_SESSION_KEY = 'bw.cesiumIonToken'

/** Reject IPC/HUD dumps larger than a JWT-sized ion token. */
export const CESIUM_ION_TOKEN_MAX_LEN = 8192

export function trimCesiumIonToken(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

export function readSessionCesiumIonToken(): string {
  try {
    return trimCesiumIonToken(sessionStorage.getItem(CESIUM_ION_SESSION_KEY))
  } catch {
    return ''
  }
}

export function writeSessionCesiumIonToken(token: string): void {
  const trimmed = trimCesiumIonToken(token)
  try {
    if (trimmed === '') {
      sessionStorage.removeItem(CESIUM_ION_SESSION_KEY)
      return
    }
    sessionStorage.setItem(CESIUM_ION_SESSION_KEY, trimmed)
  } catch {
    // sessionStorage may be blocked
  }
}

export function resolveCesiumIonToken(
  configToken: string,
  sessionToken = '',
): string {
  const fromConfig = trimCesiumIonToken(configToken)
  if (fromConfig) return fromConfig
  const fromSession = trimCesiumIonToken(sessionToken)
  if (fromSession) return fromSession
  try {
    const env = import.meta.env as Record<string, string | undefined>
    return trimCesiumIonToken(env.VITE_CESIUM_ION_TOKEN)
  } catch {
    // Node tests / non-Vite callers
  }
  return ''
}

export function parseCesiumIonAssetId(
  raw: unknown,
  fallback: number,
): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim())
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return fallback
}
