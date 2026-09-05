# Dispatch DSP-PLT-20260905-01-project-switch-investigate

## Meta
- From orchestrator: PLT
- Worker role: WORKER(DSP-PLT-20260905-01-project-switch-investigate)
- Priority: P0
- Phase: Phase 19.17 — Instant project switch (**investigation only**)
- Related handoffs: `docs/agentic/handoffs/HO-SCN-PLT-20260905-01.md` → reply `docs/agentic/handoffs/HO-PLT-SCN-20260905-01.md`
- **Status: DONE** — PLT accepted 2026-09-05. Owner **SCN**. Named await: `remountWorldFromFeatures`. Moved to `done/`.

## Goal

**Name the blocking await** when the operator clicks **Load** to switch race pack. Operator wants project chrome + 2D map + fleet/asset lists immediately; 3D/Cesium/glTF may fill in later. This dispatch does **not** reorder remount or rewrite the scene graph. Measure Electron `races.read` / `loadRaceProject` vs SCN `remountWorldFromFeatures` (and the other awaits in `applyLoadedRaceProject`) and classify owner: **PLT plumbing** vs **SCN remount order**.

## Background

- Design: `docs/architecture/phase19-senexus-qol.md` §19.17 (N9)
- Brief: `docs/agentic/briefs/phase19/PLT_PHASE19.md`
- SCN already documented the **current** apply order in the handoff (do not treat that as proven wall-clock cost):
  1. `switchRace` → `loadRaceProject` (API / Electron `races.read` / static fetch / venue pack)
  2. `applyLoadedRaceProject` awaits `scene.loadBoatNamesFromUrl`
  3. then `loadWorldForProject` → `scene.remountWorldFromFeatures` (and/or course+sponsors+flags URL loads)
  4. then `applyWorldFeatures` (2D layout)
  5. then HUD `setBoatIds` / `setPovIds` / fleet panel
  6. then `restartIngest`
- Load is **button-only**: `DSP-SCN-20260902-01-explicit-race-load`. Dropdown must **not** call `switchRace`. Do not undo that.
- Library 19.16 is done. Do not re-seed.
- No Cesium vendor switch, no `STUDIO_TICK_FPS`, no NDI pump rewrite.

## In scope

1. **Read** the call chain (cite functions + files):
   - `src/main.ts` — `switchRace`, `applyLoadedRaceProject`, `loadWorldForProject`
   - `src/projects/loadRaceProject.ts` — API / `bridge.read` / static / venue pack
   - `src/projects/racesBridge.ts` + `desktop/preload.cjs` + `desktop/main.cjs` `races:read` + `desktop` races fs helper
   - `src/scene/createScene.ts` — `remountWorldFromFeatures` (what it awaits: glTF, tiles, etc.) — **read only**, no scene rewrite
2. **Measure** (studio Electron or Vite — prefer Electron if that is how ops switch packs). Click **Load** on a second local pack (e.g. `30agustos` ↔ another id in the list). Record wall time for at least:
   - `loadRaceProject` (split API vs `races.read` vs static if possible)
   - `loadBoatNamesFromUrl`
   - `loadWorldForProject` / `remountWorldFromFeatures`
   - `applyWorldFeatures` (layout + map)
   - fleet HUD / `setBoatIds`
   - `restartIngest`
   Optional: `performance.now()` / `console.info('[19.17]', …)` around those awaits. **Do not reorder** awaits. Remove noisy logs before finishing **or** leave a single gated debug line if it is cheap and documented — do not leave a spammy default.
3. **Classify** one primary stall:
   - **PLT** — Electron `races.read` / JSON parse / `hydrateFeaturesUrl` / blocking fs dominates **before** lists could paint even if remount moved later
   - **SCN** — remount / glTF / tiles / `loadWorldForProject` dominates; lists+2D are already sequenced **after** that await
   - **Mixed** — both material; give ms for each
4. **Report** the named function(s). Recommend: PLT plumbing DSP **or** `HO-PLT-SCN` for “lists+2D first, 3D later.” Do **not** implement either fix in this chat.

## Out of scope

- Reordering `applyLoadedRaceProject` / splitting remount (SCN follow-up)
- Auto-load on dropdown change
- World Authoring UI
- Library seed / uploads
- Cesium vendor, NDI, calib, `STUDIO_TICK_FPS`
- Speculative caching / prefetch of glTF

## Likely files

- Read: `src/main.ts`, `src/projects/loadRaceProject.ts`, `src/projects/racesBridge.ts`, `desktop/main.cjs`, `desktop/preload.cjs`, races fs module, `src/scene/createScene.ts` (`remountWorldFromFeatures`)
- Optional small timing logs in `switchRace` / `loadRaceProject` only if needed to measure; revert if noisy
- Do **not** edit SCN remount implementation

## Inputs provided

- Handoff: `docs/agentic/handoffs/HO-SCN-PLT-20260905-01.md`
- Packs: local `public/races/` (include `30agustos` if present)
- Load-button lock: `docs/agentic/dispatches/done/DSP-SCN-20260902-01-explicit-race-load.md`

## Acceptance criteria

- [x] Report names the **dominant await** with file + function
- [x] Owner is **PLT** or **SCN** (or mixed with both named)
- [x] Load still requires the **Load** button (dropdown pick does not `switchRace`)
- [x] No remount rewrite; no library re-seed
- [x] If any timing logs remain, they are gated or removed; `npm test` + `npm run build` still green if you touched `src/`

## Worker result (2026-09-05)

- **Named await:** `scene.remountWorldFromFeatures` (`src/scene/createScene.ts`) via `loadWorldForProject` / `applyLoadedRaceProject` (`src/main.ts`).
- **Owner: SCN.** PLT `races.read` / `loadRaceProject` is 1–84 ms. Remount 579–755 ms and is sequenced **before** 2D + lists.
- Secondary (not PLT): `restartIngest` 281–1713 ms sits after `setBoatIds` but before `fleetPanel.setState`.
- Gated timings: `?debug1917=1` → `console.info('[19.17]', …)`. Default off.
- Reply handoff: `docs/agentic/handoffs/HO-PLT-SCN-20260905-01.md`

## Report back

- [ ] Report names the **dominant await** with file + function
- [ ] Owner is **PLT** or **SCN** (or mixed with both named)
- [ ] Load still requires the **Load** button (dropdown pick does not `switchRace`)
- [ ] No remount rewrite; no library re-seed
- [ ] If any timing logs remain, they are gated or removed; `npm test` + `npm run build` still green if you touched `src/`

## Report back

When done, reply with:
1. Summary — **named blocking call** + owner (PLT / SCN / mixed)
2. Files touched (or “read-only, none”)
3. How verified (Electron vs Vite; which two race ids; timings)
4. Follow-ups — exact next DSP or `HO-PLT-SCN-…` draft bullets
5. Suggested memo bullets for PLT

## Worker paste block

```
You are WORKER(DSP-PLT-20260905-01-project-switch-investigate).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-PLT-20260905-01-project-switch-investigate.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-SCN-PLT-20260905-01.md
4. src/main.ts — switchRace / applyLoadedRaceProject / loadWorldForProject
5. src/projects/loadRaceProject.ts
6. desktop races:read (preload + main)

Read-only investigation: name the blocking await on Load (Electron races.read / loadRaceProject vs remountWorldFromFeatures). Do not reorder remount. Do not auto-load on dropdown. Do not re-seed the library. Report owner PLT vs SCN.
```
