/**
 * Collapse hotkey for the ops sidebar.
 * Backtick / grave — avoids digit POV keys (1–4) and Tab focus trapping.
 */
export const SIDEBAR_COLLAPSE_HOTKEY = '`'

export function isSidebarCollapseHotkey(ev: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}): boolean {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return false
  return ev.key === SIDEBAR_COLLAPSE_HOTKEY || ev.key === 'Backquote'
}

/** Stable sort by order, then id. */
export function compareSidebarSectionOrder(
  a: { order: number; id: string },
  b: { order: number; id: string },
): number {
  if (a.order !== b.order) return a.order - b.order
  return a.id.localeCompare(b.id)
}
