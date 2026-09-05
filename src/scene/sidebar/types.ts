/**
 * Unified ops sidebar section contract (Phase 11.1 + 16.6 two-rail).
 * Other dispatches register into this shell — see README.md.
 */

import type { OpsRailId } from './railLayout.ts'

export type { OpsRailId }

export type SidebarSectionMountHandle = {
  dispose: () => void
}

export type SidebarSection = {
  id: string
  label: string
  /** Sort ascending within the assigned rail; lower = higher. */
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
  /** Start left rail collapsed (air/show). Default false; sessionStorage wins. */
  initiallyCollapsed?: boolean
  /** Start right rail collapsed. Default false; sessionStorage wins. */
  initiallyRightCollapsed?: boolean
}

export type SidebarHandle = {
  readonly root: HTMLElement
  registerSection: (section: SidebarSection) => void
  unregisterSection: (id: string) => void
  /** Left rail — backward-compatible with the Phase 11 single-rail API. */
  setCollapsed: (collapsed: boolean) => void
  isCollapsed: () => boolean
  setRailCollapsed: (rail: OpsRailId, collapsed: boolean) => void
  isRailCollapsed: (rail: OpsRailId) => boolean
  /** Host for stream/PiP map (outside the rails; still under the overlay root). */
  getOverlayHost: () => HTMLElement
  /** Left/right chrome slot beside the rail title (e.g. World Authoring toggle). */
  getHeaderActionsHost: (rail: OpsRailId) => HTMLElement
  dispose: () => void
}
