# Dispatch DSP-OUT-20260812-02-3d-ndi-channel-pump

## Meta
- From orchestrator: BW → OUT (Phase 13.3)
- Worker role: WORKER(DSP-OUT-20260812-02-3d-ndi-channel-pump)
- Priority: P0
- Phase: Phase 13 — Multi-channel output
- Prerequisites: `done/DSP-OUT-20260812-01` (multi-sender bridge), `done/DSP-SCN-20260812-01` (sea/sky + `setEnvironmentOpaqueClearSafe`)
- Parallel-safe with: `DSP-OUT-20260812-03` (2D pump), `DSP-SCN-20260812-02` (overlay — prefer not to fight `main.ts` simultaneously; rebase if needed)
- Design: `docs/architecture/multi-output-streaming.md` §2–3
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 439+23; human vMix AR+3D smoke recommended)

## Goal

Continuously render the **same** Three.js scene as AR (active POV camera) with an **opaque** clear
+ realistic environment allowed, and send that framebuffer on NDI channel **`3d`**
(`broadcast-web-3d` by default) **whether or not** the operator is looking at it. AR channel
(`'ar'`) must keep working unchanged.

## Background

- Bridge API (locked by 13.1):
  ```ts
  ndi.start({ channel: '3d', name? })
  ndi.sendFrame({ channel: '3d', width, height, data, bottomUp? })
  ndi.getStatus('3d') | getStatusAll()
  ```
- SCN API (13.2): `setEnvironmentOpaqueClearSafe(boolean)`, `setEnvironmentMode(...)`.
  OUT must set opaque-safe **true** for the 3D render pass and **false** when rendering the AR
  transparent pass (or otherwise ensure env never pollutes AR alpha).
- Today `startNdiFramePump` drives only `'ar'`. Reuse its FBO/readback patterns; do **not** invent
  a second scene graph.
- **BW lock:** 1920×1080; no delay buffer (13.6); no big 2D/3D/AR screen switcher yet (13.5) —
  local preview can stay as today. Always-on NDI for `3d` is the product change.

## In scope

1. A continuous **3D channel pump** (extend `ndiFramePump` or sibling module) that:
   - Starts sender `channel: '3d'` (default name `broadcast-web-3d`).
   - Each tick: set opaque clear for this pass, allow realistic env (`setEnvironmentOpaqueClearSafe(true)`
     for the pass), render active POV to an FBO, `readPixels`, `sendFrame({ channel: '3d', ... })`,
     then restore whatever AR/screen clear + `opaqueClearSafe` the app needs so the next AR/screen
     frame is correct.
2. AR pump remains the transparent/alpha air plate on `'ar'` (name still `broadcast-web`).
3. Both pumps run whenever the studio bridge is present (Electron), independent of Ops UI focus.
4. NDI tab: `3d` row should go live (not idle) when the pump is running.
5. Docs: `src/output/README.md`, `docs/ops/air-runbook.md` (how to confirm two sources in vMix).
6. Tests: channel tagging / restore-clear helpers where unit-testable; no requirement for physical NDI.

## Out of scope

- 2D map NDI (`DSP-OUT-20260812-03`).
- Local 2D/3D/AR screen switcher (13.5).
- Delay buffer (13.6).
- Changing sea/sky look (SCN).
- Renaming AR source away from `broadcast-web`.

## Likely files

- `src/output/ndiFramePump.ts` and/or new `ndiChannelPump.ts`, `main.ts` wiring
- `src/output/ndiControllerPanel.ts` (status only if needed)
- `src/output/README.md`, `docs/ops/air-runbook.md`
- Light coordination with `createScene` env API (call sites only)

## Acceptance criteria

- [ ] Electron: vMix (or NDI tools) can see **both** `broadcast-web` (AR alpha) and `broadcast-web-3d` (opaque + env when realistic on)
- [ ] AR alpha plate still correct (no opaque sea/sky baked into `'ar'`)
- [ ] 3D NDI keeps sending while ops free-cam / sidebar changes (same air-POV lock as AR)
- [ ] `npm test` + `npm run build` green
- [ ] Air-runbook notes how to verify the second source

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested memo bullets for OUT
