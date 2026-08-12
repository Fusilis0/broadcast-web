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
  isFeatureVisible2d,
  isFeatureVisible3d,
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
} from './types.ts'
export {
  startMapFeatureEditor,
  serializeWorldFeaturesExport,
  downloadWorldFeaturesJson,
  createArrowFeature,
  createLineSignFeature,
  createPointFeature,
  createSponsorFeature,
  createGatePairFeatures,
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
} from './editor/index.ts'
