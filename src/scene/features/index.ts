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
  getLayoutFeatures,
  setLayoutFeatures,
  clearLayoutFeatures,
} from './layoutStore.ts'
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
  createPointFeature,
  createSponsorFeature,
  createGatePairFeatures,
  featuresToCourseData,
  featuresToSponsorsData,
  featuresToFlagsData,
  type MapFeatureEditorHandle,
  type MapFeatureEditorOptions,
  type EditorTool,
} from './editor/index.ts'
