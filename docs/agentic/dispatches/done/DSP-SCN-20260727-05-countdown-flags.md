# Dispatch DSP-SCN-20260727-05-countdown-flags

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260727-05-countdown-flags)
- Priority: P0
- Phase: Phase 2.6 — countdown flags (SCN-only)
- Related handoffs: none
- BW ask: countdown flags; **no chroma**; **no 2.7** boat name/colour JSON
- **Status: DONE** (worker report accepted by SCN 2026-07-27)

## Goal

Add a **Bodrum Cup–style race-start countdown**: two GPS-anchored flag poles + a world timer, driven by a small JSON fixture and a ticking remaining-time state machine (Unity `CountdownFlagController` spirit). Procedural flag meshes/colors are fine. Visible under default mock near the Istanbul course. No chroma, no boat name catalogue.

## Acceptance criteria

- [x] Demo fixture loads; P1/P2 flags near course under mock
- [x] Phase logic matches Unity defaults — unit-tested; demo via `demoTimeScale: 20`
- [x] Countdown `MM:SS` above P1; HUD Start / Pause / Reset / Restart
- [x] Placement via `gpsToEnuAmsl` only; no chroma; no 2.7 boat names
- [x] `npm test` + `npm run build` green — SCN re-verified **115/115** (2026-07-27)
- [x] Unity untouched; no binary dump
- [x] Config `flagsUrl`; blue-white extra height 6 m (vs Unity 35) documented

## Worker report (summary)

`flagsUrl` + `demo-istanbul-countdown.json`; `demoTimeScale: 20` (~18 s for 6-min timeline); procedural flags; auto-start + HUD controls.

## Files delivered

- `public/fixtures/flags/*`, `public/config.json`
- `src/scene/flags/*`
- `src/scene/{createScene,stubHud,index,README}`
- `src/main.ts`, `src/style.css`
- `src/config/{types,loadConfig,index,README,loadConfig.test}`

## Full original dispatch

See git history for full in/out-of-scope text. Scope was SCN 2.6 countdown flags only.
