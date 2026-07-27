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
} from './boatTag.ts'
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
} from './map2d.ts'
