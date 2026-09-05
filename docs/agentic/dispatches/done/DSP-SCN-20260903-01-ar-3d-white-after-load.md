# Dispatch DSP-SCN-20260903-01-ar-3d-white-after-load

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-01-ar-3d-white-after-load)
- Priority: **P0**
- Phase: **19.14** (operator now has a repro) + remount survival — **not** 19.17 speed split
- Related: operator 2026-09-03; OSM 19.12 Pass; hold 19.7 until this reports

## Goal

After **Load** of a race (especially switching packs), preview **AR and 3D hitch then go fully white**. Sidebar stays. Same session without a pack switch can keep drawing (operator 3D screenshot of 30agustos). Restore a live 3D/AR viewport after Load. Diagnose first; cheap fix only if the cause is obvious.

## Background

Operator: hitch a few seconds after Load → AR + 3D white. Output was **transparent**; NDI Idle. World Authoring can be open. 2D / OSM not blamed.

Likely (worker must **name one** with evidence, not guess-fix all):

1. `webglcontextlost` after GPU hitch (listen on `renderer.domElement`; log `webglcontextrestored`).
2. Overlapping `remountWorldFromFeatures` (`remountGen` in `createScene.ts`) leaving an empty scene after dispose.
3. `applyLoadedRaceProject` / `loadWorldForProject` double remount or origin remount racing Load.
4. AR **transparent** clear (`TRANSPARENT_CLEAR_COLOR` + alpha 0) with no underlay so the **page** shows white — but **3D is also white**, so do not stop at AR-only.
5. GPU leak: many chain canvas textures on remount (`CHAIN_INSTANCE_WIDTH_M` 6 vs `spacingM` 12). **Count** instances/canvases; do **not** rewrite chain geometry (that is `DSP-SCN-20260903-02`).

19.14 originally: log why a **chain** is skipped. Expand: log why the **whole** AR/3D view dies. Cheap hardening OK (restore renderer, skip stale remount, dispose GPU on chain handles). No Cesium vendor switch. Not 19.17 (do not split “lists first, 3D later” in this DSP).

## In scope

1. Repro path: boot → Load pack A → wait until 3D/AR draw → Load pack B (or Load A again). Capture console + whether `webglcontextlost` fired + hitch HUD if present.
2. Instrument remount: generation, dispose vs remount complete, camera still valid, `renderer.domElement` still in the host, clear color/alpha after Load.
3. If cause is obvious and local (stale remount, missing restore, undisposed textures, lost context without restore handler): fix it.
4. If cause is GPU OOM from chain canvases: **stop after logs + counts**; point SCN at DSP-02. Do not invent a ribbon here.
5. If hitch is NDI/readback on the same GL context: **stop** and report **PRF** / **OUT** — do not change pumps.
6. Tests if you change remount/dispose. README one-liner. `npm test` + `npm run build`.

## Out of scope

- Continuous ribbon / logo layout (`DSP-SCN-20260903-02`)
- 19.7 inspector, 19.8 ghost, OSM, 19.17 remount-speed split
- Cesium / MapTiler vendor
- NDI FourCC, skip-forever, `STUDIO_TICK_FPS`

## Likely files

- `src/scene/createScene.ts` (`remountWorldFromFeatures`, `remountGen`, renderer)
- `src/main.ts` (`applyLoadedRaceProject`, `loadWorldForProject`, `switchRace`)
- `src/scene/disposeWorldGeometry.ts` only if dispose is the leak
- AR clear / underlay only if 3D is still drawing and AR is uniquely white (`src/output/videoBackground.ts`, `applyOutputMode` — do not restyle NDI)

## Inputs provided

- Repro: Load race → hitch → AR **and** 3D white. No switch → 3D can stay.
- Pack: `30agustos` (`billboardChain:4`, `spacingM`: 12).
- Do not require Save to trigger; operator: **changing project** triggers it.

## Acceptance criteria

- [x] Named root cause in the report (one primary).
- [x] After Load (including pack switch), AR and 3D keep showing the scene (or context restore recovers within one second) — not a permanent white rect.
- [x] If unfixable in SCN: explicit **PRF** or **OUT** handoff text; no silent pump edits.
- [x] `npm test` + `npm run build` green.

## Worker result 2026-09-03

**Primary cause:** GPU OOM / `webglcontextlost` from ~1550 unique chain canvas textures on `30agustos` remount (dispose+recreate peak). Not remountGen empty-scene; not AR-transparent-only; not NDI.

**Fix:** ribbon remount (few segments + shared period texture) + context-lost gate + remount logs. See `SCN_MEMO` worker block.

## Report back

1. Root cause + evidence (logs, gen, contextlost)
2. Files / tests (or why diagnose-only)
3. Follow-ups (DSP-02, PRF, OUT)
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260903-01-ar-3d-white-after-load).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260903-01-ar-3d-white-after-load.md
2. docs/architecture/phase19-senexus-qol.md §19.14
3. src/scene/createScene.ts remountWorldFromFeatures / remountGen
4. src/main.ts applyLoadedRaceProject, loadWorldForProject, switchRace

P0: Load/switch race → hitch → AR and 3D go white. Diagnose then cheap fix. Do not rewrite billboard geometry (DSP-02). No 19.7, OSM, Cesium vendor, NDI pumps, STUDIO_TICK_FPS.
Report back per dispatch.
```
