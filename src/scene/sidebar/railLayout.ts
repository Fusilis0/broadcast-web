/**
 * Phase 16.6 — BW-locked two-rail grouping.
 * Re-home existing section ids; do not invent new panel modules here.
 *
 * Deviation (documented): `library` (PLT) and leftover `ops` (telemetry / POV /
 * view / countdown / status) sit on the left rail — not named in
 * the BW table, but they are race-setup adjacent and must keep a mount.
 */

export type OpsRailId = 'left' | 'right'

export type OpsRailSectionSpec = {
  id: string
  rail: OpsRailId
  label: string
  /** Sort within the rail (ascending). */
  order: number
  defaultExpanded: boolean
}

/** BW table + pragmatic leftovers. Ids stay stable for `data-ops-section`. */
export const OPS_RAIL_SECTIONS: readonly OpsRailSectionSpec[] = [
  { id: 'project', rail: 'left', label: 'Project', order: 10, defaultExpanded: true },
  { id: 'live', rail: 'left', label: 'Fleet & Live', order: 20, defaultExpanded: true },
  { id: 'assets', rail: 'left', label: 'Assets', order: 30, defaultExpanded: false },
  { id: 'heroes', rail: 'left', label: 'Hero buildings', order: 35, defaultExpanded: false },
  { id: 'library', rail: 'left', label: 'Library', order: 50, defaultExpanded: false },
  { id: 'ops', rail: 'left', label: 'Race ops', order: 60, defaultExpanded: false },
  { id: 'ndi', rail: 'right', label: 'Output', order: 10, defaultExpanded: true },
  { id: 'flow', rail: 'right', label: 'Flow', order: 15, defaultExpanded: false },
  { id: 'calib', rail: 'right', label: 'Calibration', order: 20, defaultExpanded: false },
  { id: 'environment', rail: 'right', label: 'Environment', order: 30, defaultExpanded: false },
  { id: 'cinematics', rail: 'right', label: 'Cinematics', order: 35, defaultExpanded: true },
  { id: 'wind', rail: 'right', label: 'Wind', order: 40, defaultExpanded: false },
]

const BY_ID = new Map(OPS_RAIL_SECTIONS.map((s) => [s.id, s]))

export const SIDEBAR_LEFT_WIDTH_STORAGE_KEY = 'bw.opsSidebar.widthPx'
export const SIDEBAR_RIGHT_WIDTH_STORAGE_KEY = 'bw.opsSidebar.rightWidthPx'
export const SIDEBAR_LEFT_COLLAPSE_STORAGE_KEY = 'bw.opsSidebar.leftCollapsed'
export const SIDEBAR_RIGHT_COLLAPSE_STORAGE_KEY = 'bw.opsSidebar.rightCollapsed'
export const SIDEBAR_ACCORDION_STORAGE_KEY = 'bw.opsSidebar.accordion'

export function railForSection(id: string): OpsRailId {
  return BY_ID.get(id)?.rail ?? 'left'
}

export function specForSection(id: string): OpsRailSectionSpec | undefined {
  return BY_ID.get(id)
}

export function defaultSectionExpanded(id: string): boolean {
  return BY_ID.get(id)?.defaultExpanded ?? true
}

export function sectionsForRail(rail: OpsRailId): readonly OpsRailSectionSpec[] {
  return OPS_RAIL_SECTIONS.filter((s) => s.rail === rail)
}

/** Parse sessionStorage JSON `{ [sectionId]: boolean }`. Invalid → `{}`. */
export function parseAccordionState(raw: string | null | undefined): Record<string, boolean> {
  if (raw == null || raw === '') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const out: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean' && key !== '') out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function serializeAccordionState(state: Record<string, boolean>): string {
  return JSON.stringify(state)
}

export function resolveSectionExpanded(
  id: string,
  stored: Record<string, boolean>,
): boolean {
  if (Object.prototype.hasOwnProperty.call(stored, id)) return stored[id] === true
  return defaultSectionExpanded(id)
}

export function parseStoredCollapsedFlag(
  raw: string | null | undefined,
  fallback: boolean,
): boolean {
  if (raw === '1') return true
  if (raw === '0') return false
  return fallback
}
