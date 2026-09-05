export {
  adaptCourseToFeatures,
  adaptSponsorsToFeatures,
  adaptFlagsToFeatures,
} from './adapters.ts'
export {
  geojsonToWorldFeatures,
  worldFeaturesToGeojson,
  serializeWorldFeaturesGeojson,
  downloadWorldFeaturesGeojson,
  type GeoJsonFeatureCollection,
  type GeojsonImportResult,
} from './geojson.ts'
export {
  layoutFeatures,
  pairLayoutGates,
  FEATURE_WATER_Y,
  type LayoutGatePair,
} from './layoutFeatures.ts'
export {
  featureEnuCentroid,
  filterFeaturesFor2d,
  filterFeaturesFor3d,
  filterFeaturesForStreamMap,
  isBuoyMarkerFeatureType,
  isBuoyMeshVisible,
  isBuoyTagVisible,
  isFeatureVisible2d,
  isFeatureVisible3d,
  isOnAirMapFeatureType,
} from './featureVisibility.ts'
export {
  getLayoutFeatures,
  setLayoutFeatures,
  clearLayoutFeatures,
} from './layoutStore.ts'
export {
  loadWorldExtrasFeatures,
  DEFAULT_WORLD_EXTRAS_URL,
} from './loadWorldExtras.ts'
export type {
  GpsToEnuAmslFn,
  WorldFeatureType,
  WorldGpsPoint,
  WorldFeature,
  LayoutEnuPoint,
  LayoutFeature,
  RoundingSense,
  BillboardLogo,
} from './types.ts'
export { BILLBOARD_CHAIN_MAX_POINTS } from './types.ts'
export {
  parseRounding,
  effectiveRounding,
  persistRoundingSelection,
  roundingYawRad,
  isRoundingFeatureType,
  ROUNDING_REVOLUTION_SEC,
} from './rounding.ts'
export {
  startMapFeatureEditor,
  serializeWorldFeaturesExport,
  downloadWorldFeaturesJson,
  createArrowFeature,
  createLineSignFeature,
  createPointFeature,
  createSponsorFeature,
  createGatePairFeatures,
  addFromCoordinates,
  editFromCoordinates,
  featuresToCourseData,
  featuresToSponsorsData,
  featuresToFlagsData,
  applySnap,
  validateWorldFeatures,
  formatValidationSummary,
  segmentReadout,
  formatSegmentReadout,
  type MapFeatureEditorHandle,
  type MapFeatureEditorOptions,
  type EditorTool,
  type FeatureValidationResult,
  type CoordinatePlaceDraft,
  type FleetPlaceInput,
  type PlaceKind,
} from './editor/index.ts'
