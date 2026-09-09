# Dispatch DSP-SCN-20260909-02-studio-boot-defaults

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260909-02-studio-boot-defaults)
- Priority: **P1**
- Operator 2026-09-09: cold-start studio should match how they actually work.
- **Do not** change NDI Send defaults here — that is OUT (`HO-SCN-OUT-20260909-01`).
- No CesiumJS, Google Photorealistic, cinematic JSON, MP4, SRT.

## Goal

Cold start (no query overrides, no leftover session where we control it):

1. Race pack **`empty`**
2. Race ops view **Free cam**
3. **World authoring** workspace **closed**
4. Terrain map overlay **aerial** (Bing ion **2**), not road

`?race=`, `?editor=1`, `?editor=0` still win.

## Background

- No `?race=` → `config.json` only; picker often **demo-istanbul**. Operator pack is `public/races/empty/project.json`.
- `createScene` / HUD / Fleet default `opsViewMode` **`follow`**.
- `resolveAuthoringInitiallyOpen`: editor/write role → World authoring **open**. Operator wants it **closed** (`?editor=1` still opens).
- `DEFAULT_TERRAIN_OVERLAY` is **`road`**. Session `bw.terrain.overlay` persists. Change the default to **aerial**; if session is `road` from older studios, **do not** fight a deliberate operator click this session — but **missing** session must be aerial. Document: first launch after this DSP is aerial; leftover `road` in sessionStorage still applies until they switch once.

## In scope

1. Boot: if `deeplink.race` is empty, `loadRaceProject('empty')` (same miss path as today — warn, continue). Picker active id `empty`.
2. Ops view: default **`free`** in `createScene`, stubHud, Fleet panel. Tests that assume follow-at-boot: update.
3. `resolveAuthoringInitiallyOpen`: no query → **false** even when `projectWritesEnabled`. `?editor=1` → open. Tests in `worldAuthoringWorkspace.test.ts`.
4. `DEFAULT_TERRAIN_OVERLAY = 'aerial'`. HUD map select + README. Tests that expect road default: flip.

## Out of scope

- NDI AR/3D/2D checkboxes (OUT)
- Cinematic sequence / pins
- Forcing aerial when session already has `road`
- Changing `empty` pack contents

## Likely files

- `src/main.ts` (boot pack)
- `src/scene/createScene.ts`, `stubHud.ts`, `fleetLivePanel.ts`
- `src/scene/worldAuthoringWorkspace.ts` + test
- `src/scene/terrain/constants.ts`, overlay tests, HUD layout tests
- READMEs one line each

## Acceptance criteria

- [x] Open studio with no query: Project = **empty**, View = **Free cam**, World authoring **closed**, Environment map = **aerial** (unless that tab’s session already stored road).
- [x] `?race=demo-istanbul` still loads demo. `?editor=1` still opens World authoring.
- [x] `npm test` scene/projects/HUD. Pre-existing library/OUT tsc not yours.

**Code-complete 2026-09-09.** NDI Send default off shipped in the same tree (`HO-SCN-OUT-20260909-01`) because the operator asked for all boot defaults together.

## Worker paste

```
Role: WORKER(DSP-SCN-20260909-02-studio-boot-defaults)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260909-02-studio-boot-defaults.md
3. src/main.ts (deeplink.race boot)
4. src/scene/worldAuthoringWorkspace.ts (resolveAuthoringInitiallyOpen)
5. src/scene/terrain/constants.ts

Boot: race empty, free cam, world authoring closed, terrain aerial default. Do not touch NDI wanted flags. Do not edit intro-bosphorus.json.

Implement that dispatch only.
```
