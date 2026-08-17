# Dispatch DSP-SCN-20260817-05-map-wind-readout

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260817-05-map-wind-readout)
- Priority: P1
- Phase: Phase 14.3d
- Prerequisite: 14.3a `windBus` accepted (14.3b API is optional; operator/default is enough)
- Parallel-safe with: `DSP-SCN-20260817-04-shore-foam` (you own 2D map chrome; they own
  Gerstner). Do not edit `src/scene/environment/` or `src/scene/terrain/`.
- Design: `docs/architecture/wind-data-and-vfx.md` §4 P1 readout
- **Status: DONE** — worker complete + BW accepted 2026-08-17 (ops+stream wind pills; from-000° screen-down; suite 534+23)

## Goal

Show wind on the **ops and stream 2D maps**: direction + speed, driven by `windBus`. This is
the graphic audiences actually understand. Do not add 3D ribbons or ocean streaks.

## Background

- Maps are north-up (`enuToMapPx`). Compass ring already exists on the stream map
  (`drawStreamCompass` in `mapChrome.ts`).
- `WindFrame.directionFromDeg` is meteorological **from**. The arrow should show **travel**
  (where the wind is going) using `windTravelSceneXZ` / from+180°, and the label should
  still say **from NNN° · XX kt** so it matches Ops and the committee.
- Subscribe to `windBus` (replay last frame) and `redraw()` — same pattern as pose updates.
  Do not poll Open-Meteo from the map.
- Stream map may be on NDI (`broadcast-web-2d`). Keep the graphic readable at 1920×1080
  letterbox; do not make it ops-only.

## In scope

1. Draw a wind indicator on **ops** and **stream** maps (arrow or barb + speed in kt).
2. Use `windBus.getSnapshot()` / `subscribe`. Stale/default still draws (opacity or
   “default” cue is nice, not required).
3. Tests: 000° from → arrow toward south on the north-up map (screen down); 090° from →
   arrow toward west (screen left). Use the real helper.
4. Docs: `src/scene/README.md` + design 14.3d status.

## Out of scope

- Gerstner / shore foam / wind streaks in the ocean shader.
- 3D world-space wind ribbon (14.3f).
- Anemometer (14.3c).
- Changing `windBus` types.

## Likely files

- `src/scene/mapChrome.ts`, `src/scene/map2d.ts`, `src/scene/map2d.test.ts`
- `src/style.css` only if needed
- Docs listed above

## Inputs provided

- `windBus`, `windTravelSceneXZ`, `msToKnots`, `directionFromDeg`
- Stream vs ops variants in `mapChrome.ts`

## Acceptance criteria

- [ ] Both maps show from-deg + kt and a travel arrow
- [ ] Cardinal tests: from-N → screen-down; from-E → screen-left
- [ ] No fetch; no ocean/terrain edits
- [ ] `npm test` + `npm run build` green

## Report back
When done, reply with:
1. Summary (ops vs stream styling)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
