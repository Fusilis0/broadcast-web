export {
  normalizeSponsors,
  DEFAULT_SPONSOR_HEIGHT_M,
  DEFAULT_SPONSOR_COLOR,
} from './normalizeSponsors.ts'
export {
  buildSponsorLayout,
  horizontalSpanFromEnu,
  SPONSOR_WATER_Y,
} from './sponsorLayout.ts'
export {
  createSponsorBillboard,
  createProceduralSponsorTexture,
  createSponsorBoardTexture,
  facingBasisFromSpan,
  type SponsorBillboardHandle,
} from './sponsorBillboard.ts'
export {
  containFitRect,
  DEFAULT_FRAME_COLOR,
  DEFAULT_PANEL_COLOR,
  hexToCss,
  parseOptionalHexColor,
  planSponsorBoard,
  recordSponsorBoardDraws,
  type ComposeSponsorBoardInput,
  type SponsorBoardDrawCall,
  type SponsorBoardPlan,
} from './boardCompose.ts'
export {
  loadSponsors,
  mountSponsors,
  DEFAULT_SPONSORS_URL,
  type SponsorsHandle,
  type LoadSponsorsOptions,
} from './loadSponsors.ts'
export type {
  GpsToEnuAmslFn,
  SponsorEntry,
  SponsorEnuEndpoints,
  SponsorGpsPoint,
  SponsorsData,
} from './types.ts'
