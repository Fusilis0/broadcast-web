import { DEFAULT_COURSE_APPEARANCE } from '../../course/normalizeCourse.ts'
import type {
  CourseAppearance,
  CourseData,
  CourseWaypoint,
  CourseWaypointType,
} from '../../course/types.ts'
import {
  DEFAULT_BLUE_WHITE_EXTRA_OFFSET_M,
  DEFAULT_BLUE_WHITE_LOWER_MINUTES,
  DEFAULT_BLUE_WHITE_RAISE_MINUTES,
  DEFAULT_CANVAS_VERTICAL_OFFSET_M,
  DEFAULT_DEMO_TIME_SCALE,
  DEFAULT_ORANGE_RAISE_MINUTES,
  DEFAULT_POLE_HEIGHT_M,
  DEFAULT_START_MINUTES,
  DEFAULT_WHITE_RAISE_MINUTES,
} from '../../flags/normalizeCountdownFlags.ts'
import type { CountdownFlagsData } from '../../flags/types.ts'
import {
  DEFAULT_SPONSOR_COLOR,
  DEFAULT_SPONSOR_HEIGHT_M,
} from '../../sponsors/normalizeSponsors.ts'
import type { SponsorEntry, SponsorsData } from '../../sponsors/types.ts'
import type { WorldFeature } from '../types.ts'

const COURSE_TYPES = new Set<CourseWaypointType>([
  'mark',
  'gateLeft',
  'gateRight',
])

/**
 * WorldFeature[] → CourseData for remount.
 * Appearance defaults or last-known from boot.
 */
export function featuresToCourseData(
  features: readonly WorldFeature[],
  appearance: CourseAppearance = DEFAULT_COURSE_APPEARANCE,
  name = 'edited',
): CourseData {
  const waypoints = features
    .filter((f) => COURSE_TYPES.has(f.type as CourseWaypointType))
    .map((f) => {
      const p = f.points[0]!
      const wp: CourseWaypoint = {
        name: f.name,
        type: f.type as CourseWaypointType,
        lat: p.lat,
        lon: p.lon,
        altMsl: p.altMsl,
      }
      if (f.rounding !== undefined) wp.rounding = f.rounding
      if (f.visibleBuoyMesh !== undefined) wp.visibleBuoyMesh = f.visibleBuoyMesh
      if (f.visibleTag !== undefined) wp.visibleTag = f.visibleTag
      return wp
    })

  let buoyHeightM = appearance.buoyHeightM
  let buoyColor = appearance.buoyColor
  let gateColor = appearance.gateColor
  for (const f of features) {
    if (f.type === 'mark' && f.heightM !== undefined) buoyHeightM = f.heightM
    if (f.type === 'mark' && f.color !== undefined) buoyColor = f.color
    if (
      (f.type === 'gateLeft' || f.type === 'gateRight') &&
      f.color !== undefined
    ) {
      gateColor = f.color
    }
  }

  return {
    name,
    waypoints,
    appearance: {
      ...appearance,
      buoyHeightM,
      buoyColor,
      gateColor,
    },
  }
}

/** WorldFeature sponsors → SponsorsData. */
export function featuresToSponsorsData(
  features: readonly WorldFeature[],
  name = 'edited',
): SponsorsData {
  const sponsors = features
    .filter((f) => f.type === 'sponsor' && f.points.length >= 2)
    .map((f) => {
      const a = f.points[0]!
      const b = f.points[1]!
      const id = f.name || f.id.replace(/^sponsor:/, '')
      const entry: SponsorEntry = {
        id,
        label: f.label ?? id,
        a: { lat: a.lat, lon: a.lon, altMsl: a.altMsl },
        b: { lat: b.lat, lon: b.lon, altMsl: b.altMsl },
        heightM: f.heightM ?? DEFAULT_SPONSOR_HEIGHT_M,
        textureUrl:
          typeof f.textureUrl === 'string' && f.textureUrl.trim() !== ''
            ? f.textureUrl.trim()
            : null,
        color: f.color ?? DEFAULT_SPONSOR_COLOR,
      }
      if (f.panelColor !== undefined) entry.panelColor = f.panelColor
      if (f.frameColor !== undefined) entry.frameColor = f.frameColor
      if (f.panelAlpha !== undefined) entry.panelAlpha = f.panelAlpha
      if (f.boardAspect !== undefined) entry.boardAspect = f.boardAspect
      return entry
    })
  return { name, sponsors }
}

export type FlagsRemountMeta = Partial<
  Omit<CountdownFlagsData, 'point1' | 'point2' | 'name'>
>

/**
 * flagP1 + flagP2 → CountdownFlagsData.
 * Returns null if either pole missing (remount disposes leftover flags).
 */
export function featuresToFlagsData(
  features: readonly WorldFeature[],
  meta: FlagsRemountMeta = {},
): CountdownFlagsData | null {
  const p1 = features.find((f) => f.type === 'flagP1')
  const p2 = features.find((f) => f.type === 'flagP2')
  if (!p1?.points[0] || !p2?.points[0]) return null

  const a = p1.points[0]
  const b = p2.points[0]
  const poleHeightM =
    p1.heightM ?? p2.heightM ?? meta.poleHeightM ?? DEFAULT_POLE_HEIGHT_M

  return {
    name: 'edited',
    point1: { lat: a.lat, lon: a.lon, altMsl: a.altMsl },
    point2: { lat: b.lat, lon: b.lon, altMsl: b.altMsl },
    startMinutes: meta.startMinutes ?? DEFAULT_START_MINUTES,
    whiteRaiseMinutes: meta.whiteRaiseMinutes ?? DEFAULT_WHITE_RAISE_MINUTES,
    orangeRaiseMinutes: meta.orangeRaiseMinutes ?? DEFAULT_ORANGE_RAISE_MINUTES,
    blueWhiteRaiseMinutes:
      meta.blueWhiteRaiseMinutes ?? DEFAULT_BLUE_WHITE_RAISE_MINUTES,
    blueWhiteLowerMinutes:
      meta.blueWhiteLowerMinutes ?? DEFAULT_BLUE_WHITE_LOWER_MINUTES,
    point1FlagVerticalOffset: meta.point1FlagVerticalOffset ?? 0,
    point2FlagVerticalOffset: meta.point2FlagVerticalOffset ?? 0,
    blueWhiteExtraOffsetM:
      meta.blueWhiteExtraOffsetM ?? DEFAULT_BLUE_WHITE_EXTRA_OFFSET_M,
    canvasVerticalOffset:
      meta.canvasVerticalOffset ?? DEFAULT_CANVAS_VERTICAL_OFFSET_M,
    poleHeightM,
    autoStart: meta.autoStart === false ? false : true,
    demoTimeScale: meta.demoTimeScale ?? DEFAULT_DEMO_TIME_SCALE,
  }
}
