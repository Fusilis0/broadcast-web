# Dispatch DSP-SCN-20260727-03-multi-pov-switch

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260727-03-multi-pov-switch)
- Priority: P0
- Phase: Phase 2.4 — multi-POV switch (SCN half; TEL sources via handoff)
- Related handoffs: `HO-SCN-TEL-20260727-01` (request multi `povIds` mock/replay)
- BW ask: multi-POV switch (SCN+TEL as needed); **no chroma**; **no 2.7** names

## Goal

Let ops switch the **active render camera** among multiple drone/cam pose sources (Unity digit-key POV spirit). SCN owns the switch UI + binding the Three `PerspectiveCamera` to the selected `poseBus` id. Cap the list with **`loadConfig().povIds`** (TEL contract). No chroma, no boat name JSON, no live multi-drone sockets in this DSP.

## Background

- Roadmap: `docs/roadmap/phases-roadmap.md` Phase 2.4 (SCN+TEL)
- Arch §5.1: drones `1–4`, cams `11–12` (same `TelemetryData` / relative+gimbal path as drones in Unity)
- Today: `createScene` applies only `droneId` default `"1"` to one `PerspectiveCamera`
- `poseBus` already keys by `id` + `kind: 'drone' | 'boat'` — cam poses are expected as **`kind: 'drone'`** (or same convert path) with ids `11`/`12` when present; do **not** invent a second pose pipeline
- Unity: digit keys switch active POV (`project-analysis.md`); web: HUD control is enough for v1 (keyboard optional nice-to-have)
- TEL must emit ≥2 POV ids on mock (see HO) before full acceptance; if TEL not green yet, implement SCN against contract and **blocker-report** if only id `1` arrives
- CAL offsets already per-device id — switching POV should pick up that device’s offsets via existing convert path (no CAL DSP)

## In scope

### 1. Active POV state (SCN)

1. Config-driven allow-list: **`povIds: string[]`** from `loadConfig()` (same pattern as `boatIds`)
   - Until TEL lands the field, SCN may read it with a safe default `["1"]` or `["1","2"]` once present — **do not** fork a parallel config schema; follow HO-locked shape
2. `activePovId` state: default `povIds[0]` (usually `"1"`)
3. Cache **last `PoseEvent`** per POV id (from `poseBus` when `kind === 'drone'` and id ∈ `povIds`)
4. Main camera `applyPose` only for **`activePovId`**; on switch, immediately apply cached pose if available (no wait for next packet)

### 2. Switch UI

5. Stub HUD (or small SCN control): select / buttons listing `povIds` (labels = id for now — **not** 2.7 names)
6. Changing selection updates `activePovId` and camera
7. Optional: digit keys `1`–`4` / `q`/`w` for cams — only if cheap; not required
8. Status line: show `pov=<activeId>` (and maybe which ids have received a pose)

### 3. Scene wiring

9. Replace hard-coded single `droneId` filter with POV registry / active id (keep `droneId` as deprecated alias of active default if needed for compat)
10. Inactive POVs: **no** requirement to draw frustum gizmos in this DSP (follow-up OK)
11. Boat tags still billboard to the **active** camera
12. Pass `povIds` from `main` after `loadConfig` (same boot order as `boatIds`)

### 4. Verify

13. With TEL mock emitting ≥2 POV ids: switch HUD → camera pose/attitude changes distinctly
14. With only one id: UI still works; document limitation
15. Update `src/scene/README.md`

## Out of scope

- TEL mock/replay emit implementation (TEL — `HO-SCN-TEL-20260727-01` / TEL DSP)
- Live multi-drone WebSocket URLs (TEL follow-up)
- Chroma / WebRTC / clear modes (OUT)
- Boat name/colour JSON (**2.7**)
- Course/buoy/sponsor/flag changes
- Second pose/math pipeline; changing GEO altitude contracts
- NDI / Unity Input System parity beyond web HUD
- Committing unless human asks

## Likely files

- `src/scene/createScene.ts` — active POV + last-pose cache
- `src/scene/stubHud.ts` — POV switcher + status
- `src/scene/povSwitcher.ts` (optional helper) + tests
- `src/main.ts` — pass `povIds`
- `src/scene/README.md`
- Config types only if TEL already added `povIds` — otherwise wait / thin read of optional field

## Inputs provided

- `HO-SCN-TEL-20260727-01` — proposed `povIds` default `["1","2"]`; bands drones `1–4`, cams `11–12`
- Existing drone camera + Unity→Three Y flip
- `poseBus` multi-id

## Acceptance criteria

- [ ] Ops can switch active POV among configured `povIds` via HUD (or equivalent)
- [ ] Render camera follows `poseBus` poses for the **active** id only; switch uses cached last pose when available
- [ ] Status shows active POV id
- [ ] Works with TEL multi-POV mock once available (≥2 distinct camera positions/attitudes observable)
- [ ] No chroma; no 2.7 boat name catalogue
- [ ] `npm test` + `npm run build` green
- [ ] README updated
- [ ] If TEL `povIds` / multi-emit missing: stop or ship UI+single-id and **report blocker** citing HO — do not invent fake second telemetry in SCN

## Report back

When done, reply with:
1. Summary
2. Files touched
3. Tests / how verified (incl. whether TEL multi-POV was available)
4. Follow-ups / blockers
5. Suggested memo bullets for SCN

## Worker bootstrap (paste into a **new** chat)

```
You are WORKER(DSP-SCN-20260727-03-multi-pov-switch).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260727-03-multi-pov-switch.md
2. docs/agentic/DISPATCH_PROTOCOL.md
3. docs/agentic/handoffs/HO-SCN-TEL-20260727-01.md
4. src/scene/createScene.ts, droneCamera.ts, stubHud.ts, README.md
5. src/config/README.md (expect povIds once TEL lands)

Implement SCN POV switch only. Bind camera to active poseBus drone/cam id.
No chroma, no 2.7 names, no TEL emit logic. Report back per the dispatch.
```
