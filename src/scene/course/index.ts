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
export type {
  CourseAppearance,
  CourseData,
  CourseEnuPoint,
  CourseWaypoint,
  CourseWaypointType,
  GatePair,
  GpsToEnuAmslFn,
} from './types.ts'
