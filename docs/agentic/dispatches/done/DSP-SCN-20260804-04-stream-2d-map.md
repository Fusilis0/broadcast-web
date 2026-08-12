# Dispatch DSP-SCN-20260804-04-stream-2d-map

## Meta
- From orchestrator: BW → SCN (+ OUT consult for on-air compositing)
- Worker role: WORKER(DSP-SCN-20260804-04-stream-2d-map)
- Priority: P0
- Phase: Phase 8.1 — Stream / on-air 2D map
- Related: `map2d.ts`, shared features, OUT clear modes
- **Status: DONE** (SCN+BW accepted 2026-08-04)

## Goal

Ship a **larger, stream-friendly 2D race map** driven by the same world features + boat positions (not only the tiny ops HUD map). Usable as PiP / corner graphic in preview and chroma/transparent plates without breaking NDI air cam.

## Background

- Ops map2d exists for correction/editor.
- Roadmap 8.1 (was 4.2b): on-air graphic from shared features.
- OUT owns plate modes; SCN owns the map graphic.

## In scope

1. Stream map view: larger canvas/CSS overlay or Three HUD layer — document choice.
2. Draw course / gates / sponsors / S/F / boat dots from shared feature layout + live boat ENU.
3. Toggle show/hide from HUD (default off for air clutter).
4. Works in preview; does not steal WebGL camera from active POV / NDI.
5. README + basic test or manual checklist; build green.

## Out of scope

- Tile basemap (Phase 11 / was 4.3)
- Full broadcast graphic package / lower-thirds
- Unity asset mesh port (DSP-SCN-20260804-05)
- Hetzner

## Likely files

- `src/scene/map2d.ts` or new `src/scene/streamMap/*`
- `src/scene/stubHud.ts`, `createScene.ts`, `main.ts`
- `src/scene/features/*` for layout read
- OUT README note if overlay interacts with clear alpha

## Acceptance criteria

- [x] Toggleable stream map shows shared course + live boats
- [x] NDI/air still active POV (no free-cam hijack)
- [x] Docs; build green

## Worker report (2026-08-04)

**Choice:** CSS overlay canvas 2D (`createStreamMap2d` → `createMap2d({ variant: 'stream' })`), not Three HUD — never touches WebGL / NDI cameras.

**Shipped:**
- `src/scene/streamMap.ts` — 400px PiP, default hidden
- HUD **stream map** checkbox (default off)
- Shared layout + live poses + boat-dot colours synced with ops map
- Docs: `src/scene/README.md`, `src/output/README.md`, `docs/ops/air-runbook.md`
- Tests: `streamMap.test.ts`; `npm test` + `npm run build` green

**OUT flag:** DOM PiP is **not** on Electron NDI (`readPixels` WebGL only). Visible in preview + Chrome chroma window capture. Follow-up if stream map must burn into NDI/alpha plate.

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-04-stream-2d-map).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-04-stream-2d-map.md
2. docs/roadmap/phases-roadmap.md (Phase 8.1)
3. src/scene/map2d.ts, features layout, stubHud
4. docs/ops/air-runbook.md (overlay clutter)

Implement toggleable stream/on-air 2D map from shared features + boats. No basemap tiles, no Unity mesh port.
Report back per dispatch. Flag OUT if alpha/compositing needs a follow-up.
```
