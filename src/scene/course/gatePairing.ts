import type { CourseWaypoint, GatePair } from './types.ts'

/**
 * Unity CourseRenderer pairing: strip `-Left` / ` Left` / `-Right` / ` Right`
 * and match remaining base names.
 */
export function gateBaseName(name: string): string {
  return name
    .replace(/-Left$/i, '')
    .replace(/ Left$/i, '')
    .replace(/-Right$/i, '')
    .replace(/ Right$/i, '')
}

/**
 * Pair gateLeft + gateRight waypoints by base name. First left wins per base;
 * unmatched sides are skipped.
 */
export function pairGates(waypoints: readonly CourseWaypoint[]): GatePair[] {
  const lefts = new Map<string, CourseWaypoint>()
  const rights = new Map<string, CourseWaypoint>()

  for (const wp of waypoints) {
    if (wp.type === 'gateLeft') {
      const base = gateBaseName(wp.name)
      if (!lefts.has(base)) lefts.set(base, wp)
    } else if (wp.type === 'gateRight') {
      const base = gateBaseName(wp.name)
      if (!rights.has(base)) rights.set(base, wp)
    }
  }

  const pairs: GatePair[] = []
  for (const [baseName, left] of lefts) {
    const right = rights.get(baseName)
    if (right) pairs.push({ baseName, left, right })
  }
  return pairs
}
