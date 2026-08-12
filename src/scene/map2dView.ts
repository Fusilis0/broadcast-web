export type MapBounds = {
  minE: number
  maxE: number
  minN: number
  maxN: number
}

/** Viewport over ENU East/North — layered on top of `enuToMapPx` / `mapPxToEnu`. */
export type MapViewState = {
  /** Viewport center (ENU meters). */
  centerE: number
  centerN: number
  /**
   * Half-height of the viewport in meters (North span / 2).
   * East span follows canvas aspect. Smaller → zoomed in.
   */
  halfExtentN: number
  /** When true, each redraw re-fits to data bounds (until user pans/zooms). */
  autoFit: boolean
}

export const DEFAULT_HALF_EXTENT_N = 25
export const MIN_HALF_EXTENT_N = 5
export const MAX_HALF_EXTENT_N = 50_000
export const ZOOM_WHEEL_FACTOR = 1.12

export function createDefaultMapView(): MapViewState {
  return {
    centerE: 0,
    centerN: 0,
    halfExtentN: DEFAULT_HALF_EXTENT_N,
    autoFit: true,
  }
}

/** Fit view to data AABB (square-ish: uses max of padded half-spans). */
export function fitMapViewToBounds(bounds: MapBounds): MapViewState {
  const centerE = (bounds.minE + bounds.maxE) / 2
  const centerN = (bounds.minN + bounds.maxN) / 2
  const halfE = Math.max((bounds.maxE - bounds.minE) / 2, 1)
  const halfN = Math.max((bounds.maxN - bounds.minN) / 2, 1)
  return {
    centerE,
    centerN,
    halfExtentN: Math.max(halfN, halfE, DEFAULT_HALF_EXTENT_N * 0.4),
    autoFit: true,
  }
}

/**
 * ENU bounds covering the current viewport for a canvas size.
 * North span = 2 * halfExtentN; East span scales with width/height.
 */
export function viewToMapBounds(
  view: MapViewState,
  width: number,
  height: number,
): MapBounds {
  const aspect = Math.max(width, 1) / Math.max(height, 1)
  const halfN = Math.max(view.halfExtentN, MIN_HALF_EXTENT_N)
  const halfE = halfN * aspect
  return {
    minE: view.centerE - halfE,
    maxE: view.centerE + halfE,
    minN: view.centerN - halfN,
    maxN: view.centerN + halfN,
  }
}

/** Pan by ENU delta (drag: screen Δ → ENU via current view bounds). */
export function panMapView(
  view: MapViewState,
  deltaEast: number,
  deltaNorth: number,
): MapViewState {
  return {
    ...view,
    centerE: view.centerE + deltaEast,
    centerN: view.centerN + deltaNorth,
    autoFit: false,
  }
}

/**
 * Zoom about an ENU anchor (typically the cursor).
 * `factor` > 1 zooms out; < 1 zooms in.
 */
export function zoomMapViewAt(
  view: MapViewState,
  factor: number,
  anchorE: number,
  anchorN: number,
): MapViewState {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1
  const nextHalf = Math.min(
    MAX_HALF_EXTENT_N,
    Math.max(MIN_HALF_EXTENT_N, view.halfExtentN * f),
  )
  const t = nextHalf / view.halfExtentN
  // Keep anchor fixed in screen space: center moves toward/away from anchor.
  return {
    centerE: anchorE + (view.centerE - anchorE) * t,
    centerN: anchorN + (view.centerN - anchorN) * t,
    halfExtentN: nextHalf,
    autoFit: false,
  }
}

/** Wheel deltaY → zoom factor (positive deltaY = zoom out). */
export function wheelZoomFactor(deltaY: number): number {
  if (deltaY === 0) return 1
  return deltaY > 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR
}
