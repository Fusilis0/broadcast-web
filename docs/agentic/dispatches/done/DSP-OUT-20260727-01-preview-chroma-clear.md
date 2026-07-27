# Dispatch DSP-OUT-20260727-01-preview-chroma-clear

## Meta
- From orchestrator: OUT
- Worker role: WORKER(DSP-OUT-20260727-01-preview-chroma-clear)
- Priority: P0
- Phase: Phase 3.1 — `preview` / `chroma` clear modes
- Related handoffs: HO-SCN-OUT-20260727-01 (FYI / Phase 3 start pack)
- Related: BW route after Phase 2 Milestone B (`7eee8de`); FYI SCN (no scene content changes)
- BW ask: preview ↔ chroma clear-mode switch; no in-browser NDI; no scene/TEL ownership
- **Status: DONE** (worker report accepted by OUT 2026-07-27)

## Goal

Wire **`outputMode`** from config so the WebGL clear color switches between **preview** (dark) and **chroma** (key green, configurable). Own the mode under `src/output/`. Do not change boats, course, telemetry, or calibration.

## Acceptance criteria

- [x] `outputMode: "preview"` → dark clear (current look)
- [x] `outputMode: "chroma"` → green (or configured) clear; scene content still draws on top
- [x] Logic lives under `src/output/`; no boat/course/TEL feature work
- [x] Default committed config remains `preview`
- [x] `npm test` + `npm run build` green — worker: **136** tests; build green
- [x] `npm run dev`: flipping mode (config and/or UI) visibly changes background
- [x] No NDI claims; Unity untouched

## Worker report (summary)

`src/output/` owns clear-color mapping; boot from config; runtime OUT widget (`startOutputModeControl`, not persisted); optional `chromaKey`; thin `setClearColor` hook on SCN `createScene`.

## Files delivered

- `src/output/{types,applyOutputMode,applyOutputMode.test,outputModeControl,index,README}`
- `src/main.ts`, `src/style.css`
- `src/config/{types,loadConfig,loadConfig.test,README}`
- `src/scene/createScene.ts` (thin hook only)

## Full original dispatch

See git history for the issued in-scope / out-of-scope / paste-block text (adopted from SCN draft 2026-07-27).
