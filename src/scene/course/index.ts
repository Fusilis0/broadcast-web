export {
  normalizeCourse,
  DEFAULT_COURSE_APPEARANCE,
} from './normalizeCourse.ts'
export { gateBaseName, pairGates } from './gatePairing.ts'
export {
  buildCourseLayout,
  COURSE_WATER_Y,
  type CourseLayout,
} from './courseLayout.ts'
export {
  loadCourse,
  mountCourse,
  DEFAULT_COURSE_URL,
  type CourseHandle,
  type LoadCourseOptions,
} from './loadCourse.ts'
export {
  createRoundingArrowRing,
  DEFAULT_ROUNDING_RADIUS_M,
  ROUNDING_RING_LIFT_Y,
  type RoundingArrowsHandle,
  type RoundingArrowsOptions,
} from './roundingArrows.ts'
export {
  courseWaterCueBounds,
  createWaterShoreCue,
  WATER_CUE_DEFAULTS,
  type WaterCueBounds,
  type WaterCueOptions,
  type WaterShoreCueHandle,
} from './waterCue.ts'
export type {
  CourseAppearance,
  CourseData,
  CourseEnuPoint,
  CourseWaypoint,
  CourseWaypointType,
  GatePair,
  GpsToEnuAmslFn,
} from './types.ts'
