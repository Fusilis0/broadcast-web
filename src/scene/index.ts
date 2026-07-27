export {
  startScene,
  DEFAULT_DRONE_ID,
  type SceneHandle,
  type SceneOptions,
} from './createScene.ts'
export {
  boatIdAllowSet,
  formatBoatEnuStatus,
  isAllowedBoatId,
} from './fleetRegistry.ts'
export {
  DEFAULT_POV_IDS,
  formatPovStatus,
  isAllowedPovId,
  povIdAllowSet,
  resolveInitialPovId,
  resolvePovIdList,
} from './povSwitcher.ts'
export {
  createBoatEntity,
  DEFAULT_BOAT_ID,
  type BoatEntityHandle,
  type BoatEntityOptions,
} from './boatEntity.ts'
export {
  createBoatTag,
  boatTagWorldHeight,
  BOAT_TAG_CANVAS_ASPECT,
  type BoatTagHandle,
  type BoatTagOptions,
  type BoatTagIdentity,
} from './boatTag.ts'
export {
  loadBoatNames,
  normalizeBoatNames,
  lookupBoatName,
  parseCategoryColor,
  DEFAULT_BOAT_NAMES_URL,
  type BoatNameEntry,
  type BoatNamesCatalogue,
} from './boatNames/index.ts'
export {
  createDroneCamera,
  horizontalToVerticalFovDeg,
  TEMP_HFOV_DEG,
  type DroneCameraHandle,
} from './droneCamera.ts'
export {
  startStubHud,
  type StubHudHandle,
  type StubHudOptions,
  type TelemetryModeSwitchable,
  type TelemetryModeUi,
} from './stubHud.ts'
export {
  createMap2d,
  boundsFromPoints,
  enuToMapPx,
  type Map2dHandle,
  type Map2dOptions,
  type MapBounds,
  type MapPoint,
  type MapCourseMark,
} from './map2d.ts'
export {
  loadCourse,
  mountCourse,
  normalizeCourse,
  pairGates,
  gateBaseName,
  buildCourseLayout,
  COURSE_WATER_Y,
  DEFAULT_COURSE_URL,
  type CourseHandle,
  type CourseData,
  type CourseEnuPoint,
} from './course/index.ts'
export {
  loadSponsors,
  mountSponsors,
  normalizeSponsors,
  buildSponsorLayout,
  horizontalSpanFromEnu,
  SPONSOR_WATER_Y,
  DEFAULT_SPONSORS_URL,
  type SponsorsHandle,
  type SponsorsData,
  type SponsorEnuEndpoints,
} from './sponsors/index.ts'
export {
  loadCountdownFlags,
  mountCountdownFlags,
  normalizeCountdownFlags,
  buildCountdownFlagsLayout,
  flagPhasesFromRemaining,
  formatCountdownMmSs,
  FLAG_WATER_Y,
  DEFAULT_FLAGS_URL,
  DEFAULT_DEMO_TIME_SCALE,
  type CountdownFlagsHandle,
  type CountdownFlagsData,
} from './flags/index.ts'
