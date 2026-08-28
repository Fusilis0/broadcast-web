import type {
  GpsToEnuAmslFn,
  SponsorEnuEndpoints,
  SponsorsData,
} from './types.ts'

/**
 * Water-plane Y for sponsor panel baselines (same as course / Unity `waterSurfaceY`).
 * AMSL→ENU `y` is ignored for graphics so Istanbul geoid offset does not lift panels.
 */
export const SPONSOR_WATER_Y = 0

/**
 * Horizontal width and midpoint from two ENU endpoints (y ignored).
 * Pure — safe to unit-test with mocked vectors.
 */
export function horizontalSpanFromEnu(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { widthM: number; midX: number; midZ: number } {
  const dx = bx - ax
  const dz = bz - az
  const widthM = Math.hypot(dx, dz)
  return {
    widthM,
    midX: (ax + bx) / 2,
    midZ: (az + bz) / 2,
  }
}

/**
 * Convert sponsor GPS pairs to water-plane ENU endpoints via injected GEO helper.
 * Pure — no Three.js.
 */
export function buildSponsorLayout(
  data: SponsorsData,
  gpsToEnuAmsl: GpsToEnuAmslFn,
): SponsorEnuEndpoints[] {
  const out: SponsorEnuEndpoints[] = []
  for (const sp of data.sponsors) {
    const a = gpsToEnuAmsl(sp.a.lat, sp.a.lon, sp.a.altMsl)
    const b = gpsToEnuAmsl(sp.b.lat, sp.b.lon, sp.b.altMsl)
    const span = horizontalSpanFromEnu(a.x, a.z, b.x, b.z)
    if (span.widthM < 0.01) continue
    const endpoints: SponsorEnuEndpoints = {
      id: sp.id,
      label: sp.label,
      heightM: sp.heightM,
      textureUrl: sp.textureUrl,
      color: sp.color,
      ax: a.x,
      az: a.z,
      bx: b.x,
      bz: b.z,
      midX: span.midX,
      midZ: span.midZ,
      widthM: span.widthM,
    }
    if (sp.panelColor !== undefined) endpoints.panelColor = sp.panelColor
    if (sp.frameColor !== undefined) endpoints.frameColor = sp.frameColor
    out.push(endpoints)
  }
  return out
}
