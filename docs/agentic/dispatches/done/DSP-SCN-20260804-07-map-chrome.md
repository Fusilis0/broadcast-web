# Dispatch DSP-SCN-20260804-07-map-chrome

## Meta
- From orchestrator: BW → SCN (Phase 8.7 + light 8.5+)
- Worker role: WORKER(DSP-SCN-20260804-07-map-chrome)
- Priority: P0
- Phase: Phase 8 — Visual & authoring QoL
- Related: `map2d`, stream map, Unity 2DMapBoat / sail icons
- **Status: DONE** (SCN+BW accepted 2026-08-04 � Phase 8 complete)

## Goal

Polish **2D map chrome** (ops map + stream PiP): boat icons (sail / category-aware), clearer course overlays, readable S/F — closer to Unity map graphic without a tile basemap.

## Background
- Stream map CSS PiP done (8.1); dots coloured (8.3).
- Unity backlog: 2DMapBoat, sail icons, overlays; CW/RCW arrows if cheap.

## In scope
1. Boat representation beyond flat dots (icon/sprite; category colour preserved).
2. Course / gate / sponsor / S/F overlay readability pass (line weights, labels if needed).
3. Shared draw path so ops map2d and stream map stay consistent.
4. Optional: CW/RCW arrow glyphs if fixtures/features already exist — else document defer.
5. Docs + checklist; build green.

## Out of scope
- Tile basemap (Phase 11)
- NDI burn-in
- Ghost boats (06)
- Full 3D water (08)

## Acceptance criteria
- [x] Stream + ops maps show improved boat chrome with category colour
- [x] Course overlay clearer than pre-slice
- [x] Docs; build green

## Worker report (summary)

1. **Summary:** Shared `mapChrome` draw path for ops + stream: category-tinted sailboat icons (Unity `tekne_yeni` + sail accent, procedural fallback), yaw from pose `brg`, thicker S/F/gate/sponsor overlays with label pills, procedural arrow/rotation glyphs (Unity CW/RCW PNGs deferred — ~110 KB each).
2. **Files:** `src/scene/mapChrome.ts` (+test), `map2d.ts` (+test yaw field), `streamMap.ts`, `scene/index.ts`, `public/textures/map/*`, READMEs (`scene`, `boatNames`, textures/map), `docs/ops/unity-asset-port.md`.
3. **Verify:** `npm run build` green. Map chrome unit tests pass. Full `npm test`: **3 failures in `boatVisibility.test.ts`** (`document is not defined`) — DSP-06 ghost-boat entity tests under node env; not introduced by this slice.
4. **Follow-ups:** Optional copy of Unity `2d.png`/`2dd.png` decorative chrome; CW/RCW PNG port if size budget OK; OUT NDI map burn-in still separate.
5. **SCN memo bullets:** Phase 8.7 map chrome landed — shared `mapChrome`, sail icons + S/F pills, procedural map arrows; Unity CW/RCW sprites deferred.

## Worker paste block

```
You are WORKER(DSP-SCN-20260804-07-map-chrome).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260804-07-map-chrome.md
2. docs/ops/unity-asset-port.md (if present)
3. src/scene/map2d.ts, streamMap.ts
4. Unity 2D map references (read-only) if available

Polish 2D map chrome for ops + stream PiP. No tiles, no ghost boats, no 3D water.
Report back per dispatch.
```
