import { featuresToSponsorsData } from '../features/editor/reverseAdapters.ts'
import type { GpsToEnuAmslFn, WorldFeature } from '../features/types.ts'
import {
  LINE_SIGN_BAND_DEPTH_M,
  buildLineSignLayout,
} from '../lineSigns/lineSignLayout.ts'
import { buildSponsorLayout } from '../sponsors/sponsorLayout.ts'

/**
 * Phase 19.15 / 19.15 Fail — local Gerstner flatten under flat-on-water platforms.
 *
 * Boards sit at GEO Y + `WATER_PLANE_Y_OFFSET`. Peak Gerstner amplitude was
 * ~0.66 m, so displacement buried them. Product lock (DSP-04-01): vertex
 * displacement scale is **0** (flat shaded plane), so flatten is optional.
 * Fragment `discard` holes are **retired** — they punched through
 * `depthWrite: false` boards to sky/terrain.
 *
 * Cap is a uniform-array limit, not a gameplay cap — extras are skipped
 * (start/finish first, then sponsors).
 */
export const OCEAN_SUPPRESS_CAP = 16 as const

/** Vertex flatten falloff beyond the board edge (covers ~one inner clipmap cell). */
export const OCEAN_SUPPRESS_FLATTEN_PAD_M = 2.5 as const

/**
 * @deprecated Fragment discard retired (19.15 Fail). Kept for footprint tests.
 */
export const OCEAN_SUPPRESS_DISCARD_PAD_M = 0.4 as const

/**
 * @deprecated Fragment discard retired — no longer used in the Gerstner shader.
 */
export const OCEAN_SUPPRESS_DISCARD_THRESHOLD = 0.92 as const

/** Oriented XZ rectangle matching `applyFlatOnWaterPlacement` (A→B along). */
export type OceanSuppressFootprint = {
  cx: number
  cz: number
  halfAlong: number
  halfAcross: number
  dirX: number
  dirZ: number
}

export function footprintFromWaterSpan(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  acrossM: number,
): OceanSuppressFootprint | null {
  const dx = bx - ax
  const dz = bz - az
  const alongM = Math.hypot(dx, dz)
  if (!(alongM > 1e-4) || !Number.isFinite(alongM)) return null
  const across = Number.isFinite(acrossM) && acrossM > 0 ? acrossM : 0
  if (across < 1e-4) return null
  return {
    cx: (ax + bx) * 0.5,
    cz: (az + bz) * 0.5,
    halfAlong: alongM * 0.5,
    halfAcross: across * 0.5,
    dirX: dx / alongM,
    dirZ: dz / alongM,
  }
}

/**
 * Signed distance to the footprint OBB in XZ (negative inside).
 * Same formula as the Gerstner suppress shader.
 */
export function oceanBoxSignedDistanceM(
  x: number,
  z: number,
  fp: OceanSuppressFootprint,
): number {
  const dx = x - fp.cx
  const dz = z - fp.cz
  const along = dx * fp.dirX + dz * fp.dirZ
  const across = -dx * fp.dirZ + dz * fp.dirX
  const qx = Math.abs(along) - fp.halfAlong
  const qz = Math.abs(across) - fp.halfAcross
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0))
  const inside = Math.min(Math.max(qx, qz), 0)
  return outside + inside
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0
  if (!(span > 1e-8)) return x >= edge1 ? 1 : 0
  const t = Math.min(1, Math.max(0, (x - edge0) / span))
  return t * t * (3 - 2 * t)
}

export function oceanFlattenAmount(signedDistM: number): number {
  return 1 - smoothstep(0, OCEAN_SUPPRESS_FLATTEN_PAD_M, signedDistM)
}

export function oceanDiscardAmount(signedDistM: number): number {
  return 1 - smoothstep(0, OCEAN_SUPPRESS_DISCARD_PAD_M, signedDistM)
}

function nearestSignedDistM(
  x: number,
  z: number,
  footprints: readonly OceanSuppressFootprint[],
): number {
  let nearest = Number.POSITIVE_INFINITY
  const n = Math.min(OCEAN_SUPPRESS_CAP, footprints.length)
  for (let i = 0; i < n; i++) {
    const fp = footprints[i]
    if (!fp) continue
    nearest = Math.min(nearest, oceanBoxSignedDistanceM(x, z, fp))
  }
  return nearest
}

/**
 * Fragment discard retired — always false. Prefer `oceanIsFlattenedAt` if
 * testing local flatten (also no-op while displacement scale is 0).
 */
export function oceanIsSuppressedAt(
  _x: number,
  _z: number,
  _footprints: readonly OceanSuppressFootprint[],
): boolean {
  return false
}

/** True when Gerstner displacement is fully (or nearly) flattened. */
export function oceanIsFlattenedAt(
  x: number,
  z: number,
  footprints: readonly OceanSuppressFootprint[],
): boolean {
  if (footprints.length === 0) return false
  return oceanFlattenAmount(nearestSignedDistM(x, z, footprints)) >= 0.92
}

function pushCapped(
  out: OceanSuppressFootprint[],
  fp: OceanSuppressFootprint | null,
  cap: number,
): boolean {
  if (!fp) return out.length >= cap
  if (out.length >= cap) return true
  out.push(fp)
  return out.length >= cap
}

/**
 * Start/finish first, then sponsors. Truncates at `OCEAN_SUPPRESS_CAP`.
 */
export function collectOceanSuppressFootprints(
  features: readonly WorldFeature[],
  gpsToEnuAmsl: GpsToEnuAmslFn,
  cap: number = OCEAN_SUPPRESS_CAP,
): OceanSuppressFootprint[] {
  const limit = Math.max(0, Math.min(OCEAN_SUPPRESS_CAP, cap | 0))
  const out: OceanSuppressFootprint[] = []
  if (limit === 0) return out

  for (const sign of buildLineSignLayout(features, gpsToEnuAmsl)) {
    const fp = footprintFromWaterSpan(
      sign.ax,
      sign.az,
      sign.bx,
      sign.bz,
      LINE_SIGN_BAND_DEPTH_M,
    )
    if (pushCapped(out, fp, limit)) return out
  }

  const sponsors = buildSponsorLayout(
    featuresToSponsorsData(features),
    gpsToEnuAmsl,
  )
  for (const sp of sponsors) {
    const fp = footprintFromWaterSpan(sp.ax, sp.az, sp.bx, sp.bz, sp.heightM)
    if (pushCapped(out, fp, limit)) return out
  }
  return out
}

/**
 * Shared by Gerstner vertex (flatten only). Punch/discard uniforms remain
 * wired for ABI but the fragment no longer holes the mesh.
 */
export function oceanSuppressShaderChunk(): string {
  return /* glsl */ `
#define OCEAN_SUPPRESS_CAP ${OCEAN_SUPPRESS_CAP}
uniform vec4 uSuppressRect[OCEAN_SUPPRESS_CAP];
uniform vec2 uSuppressDir[OCEAN_SUPPRESS_CAP];
uniform float uSuppressCount;

float oceanSuppressDist(vec2 xz) {
  float nearest = 1.0e6;
  for (int i = 0; i < OCEAN_SUPPRESS_CAP; i++) {
    float live = step(0.5, uSuppressCount - float(i));
    vec4 r = uSuppressRect[i];
    vec2 dir = uSuppressDir[i];
    vec2 d = xz - r.xy;
    vec2 local = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x)));
    vec2 q = abs(local) - r.zw;
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    nearest = min(nearest, mix(1.0e6, dist, live));
  }
  return nearest;
}

vec2 oceanSuppressAmounts(vec2 xz) {
  float dist = oceanSuppressDist(xz);
  float flatten = 1.0 - smoothstep(0.0, ${OCEAN_SUPPRESS_FLATTEN_PAD_M.toFixed(2)}, dist);
  float punch = 0.0;
  return vec2(flatten, punch);
}
`
}
