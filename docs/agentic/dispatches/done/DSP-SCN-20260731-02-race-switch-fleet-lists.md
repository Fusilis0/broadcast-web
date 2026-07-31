# Dispatch DSP-SCN-20260731-02-race-switch-fleet-lists

## Meta
- From orchestrator: SCN (BW: **6.2** accepted — close soft race-switch gap)
- Worker role: WORKER(DSP-SCN-20260731-02-race-switch-fleet-lists)
- Priority: P0
- Phase: Phase 6.2 follow-up — fleet/POV allow-lists on soft race switch
- Related: DSP-SCN-20260731-01 report-back follow-up
- BW ask: when Load/`?race=` applies a pack with different `boatIds`/`povIds`, scene + HUD + calib + ingest must pick up the new lists without full page reload
- **Status: DONE** (worker report accepted by BW 2026-07-31)

## Goal

On soft race switch (`loadRaceProject` → apply → remount features → restart ingest), also update **boat and POV allow-lists** everywhere they are cached at boot: scene fleet registry, HUD POV select, calib `setPovIds`, and ingest options — so packs that are not identical to `demo-istanbul` fleet work at runtime.

## Background

- Today soft switch updates config/origin/features/ingest/HUD race label, but `startScene({ boatIds, povIds })` allow-lists stay boot-time
- `SceneHandle` may need `setBoatIds` / `setPovIds` (or one `setFleetAllowLists`)
- Fleet registry should drop ids no longer allowed and accept new ids when poses arrive
- HUD `setPovIds`; calib panel `setPovIds`; active POV clamped to new list

## In scope

1. Scene API to replace boatIds + povIds allow-lists; adjust fleet registry + POV cache/active id
2. Wire soft race switch in `main.ts` (and ensure `?race=` first boot already OK)
3. Tests for allow-list update / active POV clamp
4. Short README note
5. `npm test` + `npm run build` green

## Out of scope

- DB/API, GeoJSON, NDI, stream PiP
- Destroying/recreating whole WebGL renderer
- Changing RaceProject schema

## Acceptance criteria

- [ ] Soft-loading a pack with different `boatIds`/`povIds` updates scene + HUD POV list + calib devices
- [ ] Orphan boats leave registry; new ids can spawn
- [ ] Active POV stays valid (clamp to list)
- [ ] `npm test` + `npm run build` green

## Report back

Standard five sections.

## Worker paste block

```
You are WORKER(DSP-SCN-20260731-02-race-switch-fleet-lists).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260731-02-race-switch-fleet-lists.md
2. src/main.ts soft race switch
3. src/scene/createScene.ts + fleetRegistry + stubHud + calib setPovIds

Update boat/POV allow-lists on soft race switch. No DB/NDI.
Report back per dispatch.
```
