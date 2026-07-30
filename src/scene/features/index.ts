export {
  adaptCourseToFeatures,
  adaptSponsorsToFeatures,
  adaptFlagsToFeatures,
} from './adapters.ts'
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
