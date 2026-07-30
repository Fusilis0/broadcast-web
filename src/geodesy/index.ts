export {
  load as loadEgm96,
  ensureLoaded as ensureEgm96Loaded,
  loadFromBuffer as loadEgm96FromBuffer,
  getIsLoaded as isEgm96Loaded,
  getUndulation,
  amslToHae,
  haeToAmsl,
  relativeToHae,
  resetForTests as resetEgm96ForTests,
} from './egm96.ts'

export {
  isValid as isOriginValid,
  latitudeDeg,
  longitudeDeg,
  altitudeHAE,
  setOriginHAE,
  setOriginAMSL,
  onChanged as onOriginChanged,
  resetForTests as resetOriginForTests,
  WGS84,
} from './geoOrigin.ts'

export {
  gpsToEnu,
  gpsToEnuAmsl,
  gpsToEnuRelative,
  gpsToEnuBatch,
  enuToGps,
  enuToGpsAmsl,
  type GpsPoint,
} from './geoUtils.ts'

export { applyConfigOrigin, type ConfigOrigin } from './applyConfigOrigin.ts'
