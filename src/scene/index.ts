export {
  startScene,
  DEFAULT_DRONE_ID,
  type FleetAllowLists,
  type OpsViewMode,
  type SceneHandle,
  type SceneOptions,
} from './createScene.ts'
export {
  createFreeCam,
  formatOpsViewStatus,
  isOpsViewMode,
  type FreeCamHandle,
} from './freeCam.ts'
export {
  boatIdAllowSet,
  formatBoatEnuStatus,
  isAllowedBoatId,
  orphanBoatIds,
} from './fleetRegistry.ts'
export {
  DEFAULT_POV_IDS,
  clampActivePovId,
  formatPovStatus,
  isAllowedPovId,
  orphanPovCacheIds,
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
  upsertBoatNameEntry,
  removeBoatNameEntry,
  DEFAULT_BOAT_NAMES_URL,
  type BoatNameEntry,
  type BoatNamesCatalogue,
  type UpsertBoatNameInput,
} from './boatNames/index.ts'
export {
  createDroneCamera,
  horizontalToVerticalFovDeg,
  TEMP_HFOV_DEG,
  type DroneCameraHandle,
} from './droneCamera.ts'
export {
  formatConnectionStatus,
  startStubHud,
  type ConnectionStatusUi,
  type HudLiveChannelStatus,
  type StubHudHandle,
  type StubHudOptions,
  type TelemetryModeSwitchable,
  type TelemetryModeUi,
} from './stubHud.ts'
export {
  loadFleetLiveFromSession,
  saveFleetLiveToSession,
  startFleetLivePanel,
  type FleetBoatRow,
  type FleetLivePanelHandle,
  type FleetLivePanelOptions,
  type FleetLivePanelState,
} from './fleetLivePanel.ts'
export {
  createMap2d,
  boundsFromPoints,
  enuToMapPx,
  mapPxToEnu,
  type Map2dHandle,
  type Map2dOptions,
  type MapBounds,
  type MapPoint,
  type MapCourseMark,
} from './map2d.ts'
export {
  adaptCourseToFeatures,
  adaptSponsorsToFeatures,
  adaptFlagsToFeatures,
  layoutFeatures,
  pairLayoutGates,
  FEATURE_WATER_Y,
  getLayoutFeatures,
  setLayoutFeatures,
  clearLayoutFeatures,
  startMapFeatureEditor,
  serializeWorldFeaturesExport,
  geojsonToWorldFeatures,
  worldFeaturesToGeojson,
  serializeWorldFeaturesGeojson,
  downloadWorldFeaturesGeojson,
  type WorldFeature,
  type WorldFeatureType,
  type LayoutFeature,
  type GpsToEnuAmslFn as FeatureGpsToEnuAmslFn,
  type MapFeatureEditorHandle,
  type MapFeatureEditorOptions,
  type EditorTool,
} from './features/index.ts'
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
