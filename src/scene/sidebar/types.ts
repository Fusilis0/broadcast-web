/**
 * Unified ops sidebar section contract (Phase 11.1).
 * Other dispatches register into this shell — see README.md.
 */

export type SidebarSectionMountHandle = {
  dispose: () => void
}

export type SidebarSection = {
  id: string
  label: string
  /** Sort ascending; lower = higher in the rail. */
  order: number
  /**
   * Called once when registered. Mount panel DOM into `container`.
   * Returning `dispose` cleans up when the section is unregistered or the
   * sidebar is disposed — collapsing does **not** call dispose.
   */
  mount: (container: HTMLElement) => SidebarSectionMountHandle
}

export type CreateSidebarOptions = {
  /** Host (typically `#app`). Sidebar overlays; does not reflow the canvas. */
  container: HTMLElement
  /** Start collapsed (air/show). Default false. */
  initiallyCollapsed?: boolean
}

export type SidebarHandle = {
  readonly root: HTMLElement
  registerSection: (section: SidebarSection) => void
  unregisterSection: (id: string) => void
  setCollapsed: (collapsed: boolean) => void
  isCollapsed: () => boolean
  /** Host for stream/PiP map (outside the rail; still under the overlay root). */
  getOverlayHost: () => HTMLElement
  dispose: () => void
}
