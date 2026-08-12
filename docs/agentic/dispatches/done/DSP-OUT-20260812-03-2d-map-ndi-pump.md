# Dispatch DSP-OUT-20260812-03-2d-map-ndi-pump

## Meta
- From orchestrator: BW → OUT (Phase 13.4)
- Worker role: WORKER(DSP-OUT-20260812-03-2d-map-ndi-pump)
- Priority: P0
- Phase: Phase 13 — Multi-channel output
- Prerequisite: `done/DSP-OUT-20260812-01` (multi-sender bridge)
- Parallel-safe with: `DSP-OUT-20260812-02` (3D pump), `DSP-SCN-20260812-02` (rebase `main.ts` if both wire)
- Design: `docs/architecture/multi-output-streaming.md` §2; Phase 11 stub in `ndiControllerPanel.ts`
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 439+23; 2D = 1920×1080 letterbox)

## Goal

Wire the viewer **stream 2D map** (`createStreamMap2d` / ops map canvas path as designed) to NDI
channel **`2d`** (`broadcast-web-2d`), always sending while Electron studio is up, and flip
`STREAM_MAP_NDI_BRIDGE_SUPPORTED` to **`true`** so the NDI tab’s 2D control is no longer a dead stub.

## Background

- Bridge ready: `ndi.start` / `sendFrame` / `getStatus` with `channel: '2d'`.
- Today: `STREAM_MAP_NDI_BRIDGE_SUPPORTED === false` — “bridge ready; pump in 13.4”.
- Stream map is DOM canvas (`src/scene/streamMap.ts`) — not in the WebGL framebuffer. Pump must
  read **map canvas pixels** (or an offscreen canvas that mirrors the same draw), never sidebar DOM.
- **BW lock:** 1920×1080 studio lock stays for 3D/AR. For 2D NDI, prefer sending at a fixed
  broadcast size: either letterbox/scale the map into **1920×1080**, or send native map resolution
  if the bridge already accepts arbitrary sizes — **document the choice**. Do not change AR/3D
  resolution.
- Primary air AR must remain map-free (existing invariant from `HO-SCN-OUT-20260804-01`).

## In scope

1. Frame pump for channel `'2d'`: start sender, sample stream-map (or dedicated offscreen twin)
   each tick, `sendFrame({ channel: '2d', ... })`.
2. Set `STREAM_MAP_NDI_BRIDGE_SUPPORTED = true` and wire the NDI tab toggle to actually
   enable/disable the **2D** pump (AR/3D stay independent). Default: **on** in studio (always-on
   ask) unless a clear reason to default off — document.
3. If stream map DOM is hidden, still produce frames (offscreen draw) so NDI does not depend on
   PiP visibility — same spirit as “NDI independent of sidebar”.
4. Docs: `src/output/README.md`, `docs/ops/air-runbook.md`, update any stub comments.
5. Tests: flag true; pump does not import sidebar DOM; enable/disable behavior unit-tested where
   practical.

## Out of scope

- 3D opaque pump (`DSP-OUT-20260812-02`).
- Delay buffer / screen switcher (13.5 / 13.6).
- Redesigning stream map chrome (SCN already did Phase 8/11).
- Burning the map into the AR WebGL plate.

## Likely files

- New or extend: `src/output/streamMapNdiPump.ts` (name flexible), `ndiControllerPanel.ts`,
  `studioBridge.ts` only if needed
- `src/main.ts` (wire pump + map handle)
- `src/scene/streamMap.ts` (export draw-to-canvas hook if required — coordinate with SCN patterns;
  keep changes minimal)
- `src/output/README.md`, `docs/ops/air-runbook.md`

## Acceptance criteria

- [ ] Electron: NDI source `broadcast-web-2d` (or documented name) shows the race map
- [ ] `STREAM_MAP_NDI_BRIDGE_SUPPORTED === true`; tab toggle starts/stops **only** the 2D sender
- [ ] Hiding stream PiP / collapsing sidebar does not blank 2D NDI (offscreen path)
- [ ] AR NDI still has no map burn-in
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers (exact resolution choice for 2D frames)
5. Suggested memo bullets for OUT
