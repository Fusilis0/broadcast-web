import type { RaceProject, WorldFeature } from './types.ts'

/**
 * How Load should build the 3D/2D world from a RaceProject.
 *
 * Present `features` (including `[]`) is the complete world — same rule as
 * `fleet.boats`. Fixture URLs (`courseUrl` / `sponsorsUrl` / `flagsUrl` /
 * extras / default position markers) apply only when `features` is omitted.
 */
export type WorldLoadSource =
  | { kind: 'features'; features: readonly WorldFeature[] }
  | { kind: 'urls' }

export function resolveWorldLoadSource(
  project: Pick<RaceProject, 'features'> | null | undefined,
): WorldLoadSource {
  const features = project?.features
  if (Array.isArray(features)) {
    return { kind: 'features', features }
  }
  return { kind: 'urls' }
}

/**
 * Double-rAF so the browser can paint lists/2D before 3D remount starts.
 * No rAF (tests / Node): resolve on two macrotasks.
 */
export function yieldPaintFrames(): Promise<void> {
  return new Promise((resolve) => {
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) =>
            setTimeout(() => cb(performance.now()), 0) as unknown as number
    raf(() => {
      raf(() => resolve())
    })
  })
}
