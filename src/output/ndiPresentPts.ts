/**
 * Last unique present() PTS for the AR freshness gate.
 * VideoStreamManager notes a PTS when it uploads a new frame; the AR pump
 * skips recapturing the same plate.
 */

let lastPresentedPts90k: number | null = null

export function notePresentedPts90k(pts90k: number | null): void {
  lastPresentedPts90k = pts90k
}

export function peekLastPresentedPts90k(): number | null {
  return lastPresentedPts90k
}

/** Test helper. */
export function resetPresentedPts90k(): void {
  lastPresentedPts90k = null
}
