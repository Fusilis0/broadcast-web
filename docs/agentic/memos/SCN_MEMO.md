# SCN_MEMO

**Last updated:** 2026-08-03  
**Status:** Idle — free cam + world-anchor **accepted**

## Latest
- **Free cam** (`freeCam.ts`): OrbitControls; HUD/Fleet Follow vs Free; does not mutate `activePovId`; `getActivePovCamera()` for OUT NDI.
- **World anchor HUD:** origin lat/lon/altMsl + Apply → `applyConfigOrigin` + remount; Save embeds origin; deeplink still wins at boot.
- Archived:
  - `done/DSP-SCN-20260803-01-free-cam-ops-view.md`
  - `done/DSP-SCN-20260803-02-world-anchor-ui.md`

## Follow-up (optional)
- Boat tags billboard toward preview cam during free look (NDI may still show free-facing tags until polish).
