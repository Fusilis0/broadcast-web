export { parseRaceProject, isSafeRaceId } from './parseRaceProject.ts'
export {
  resolveWorldLoadSource,
  yieldPaintFrames,
  type WorldLoadSource,
} from './worldLoadSource.ts'
export {
  parseProjectFleetIds,
  resolveBootPanelBoats,
  resolveLoadedFleetBoats,
  serializeFleetBoat,
  snapshotFleetBoats,
  type FleetBoatNameEntry,
  type FleetBoatSnapshotInput,
} from './fleetBoats.ts'
export {
  DEFAULT_BOOT_RACE_ID,
  loadRaceProject,
  raceProjectApiUrl,
  raceProjectUrl,
  type LoadRaceProjectOptions,
} from './loadRaceProject.ts'
export { applyRaceProjectToConfig } from './applyRaceProjectToConfig.ts'
export {
  buildRaceProject,
  defaultEditedRaceId,
  downloadRaceProject,
  serializeRaceProject,
  type BuildRaceProjectInput,
} from './buildRaceProject.ts'
export {
  writeRaceProject,
  WriteRaceProjectError,
  type WriteRaceProjectMode,
  type WriteRaceProjectOptions,
} from './writeRaceProject.ts'
export {
  ARCHIVED_LABEL,
  boatIdsMissingFromCatalogue,
  confirmSaveWithOrphanBoatIds,
  deleteRaceProject,
  duplicateRaceProject,
  formatOrphanBoatIdWarning,
  isArchived,
  isProjectsApiConfigured,
  listRaceProjects,
  renameRaceProject,
  setRaceProjectArchived,
  type ListRaceProjectsOptions,
  type ProjectManagerWriteOptions,
  type RaceProjectSummary,
} from './projectManager.ts'
export {
  startProjectManagerPanel,
  type ProjectManagerPanelHandle,
  type ProjectManagerPanelOptions,
} from './projectManagerPanel.ts'
export {
  canWriteProjectsApi,
  normalizeProjectsRole,
  projectsApiBearerToken,
  projectsRoleFromSearch,
  resolveProjectsRole,
  type ProjectsAuthConfig,
  type ProjectsRole,
} from './projectsAuth.ts'
export {
  DEFAULT_LOCAL_RACE_IDS,
  LOCAL_RACES_INDEX_URL,
  listLocalRaceIds,
  type ListLocalRaceIdsOptions,
} from './listLocalRaces.ts'
export {
  getRacesBridge,
  type StudioRacesBridge,
  type StudioRacesListResult,
  type StudioRacesReadResult,
  type StudioRacesRootKind,
  type StudioRacesRootResult,
  type StudioRacesSaveResult,
} from './racesBridge.ts'
export {
  formatProjectMetaText,
  formatRacesRootHint,
  formatSaveLoadStatus,
  mountLocalProjectControls,
  type LocalProjectControlsHandle,
  type LocalProjectControlsOptions,
  type SaveLoadStatusKind,
} from './localProjectControls.ts'
export {
  formatPersistStatus,
  persistRaceProjectLocal,
  canPersistRaceProjectWithoutDownload,
  type PersistRaceProjectMode,
  type PersistRaceProjectOptions,
  type PersistRaceProjectResult,
} from './persistRaceProjectLocal.ts'
export {
  mergeLocalRaceIds,
  resolveRacesKind,
  upsertRaceIndexIds,
} from './racesIndex.ts'
export {
  VENUE_PACK_KIND,
  DEFAULT_VENUE_EXTRA_URLS,
  buildVenuePack,
  downloadVenuePack,
  serializeVenuePack,
  parseVenuePack,
  materializeVenuePack,
  retainMaterializedVenuePack,
  collectProjectAssetUrls,
  seedVenuePackUrls,
  getDefaultVenuePackCache,
  createMemoryVenuePackCache,
  type VenuePack,
  type VenuePackCache,
  type MaterializedVenuePack,
  type BuildVenuePackOptions,
} from './venuePack/index.ts'
export type {
  RaceProject,
  RaceProjectCalibration,
  RaceProjectLandmarks,
  RaceProjectLandmarkPose,
  RaceProjectOrigin,
  RaceProjectFleet,
  RaceProjectFleetBoat,
  RaceProjectOutputDefaults,
  WorldFeature,
} from './types.ts'
