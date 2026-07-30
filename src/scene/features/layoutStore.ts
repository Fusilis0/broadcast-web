import type { LayoutFeature } from './types.ts'

let current: readonly LayoutFeature[] = []

/** Replace the shared post-GEO layout list (3D/2D/editor consumers). */
export function setLayoutFeatures(features: readonly LayoutFeature[]): void {
  current = features.map((f) => ({
    ...f,
    points: f.points.map((p) => ({ ...p })),
    rawPoints: f.rawPoints.map((p) => ({ ...p })),
  }))
}

/** Read-only snapshot for tests / future map editor. */
export function getLayoutFeatures(): readonly LayoutFeature[] {
  return current
}

/** Clear store (scene stop / tests). */
export function clearLayoutFeatures(): void {
  current = []
}
