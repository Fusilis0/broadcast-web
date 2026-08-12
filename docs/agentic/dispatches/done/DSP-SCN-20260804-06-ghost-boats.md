# Dispatch DSP-SCN-20260804-06-ghost-boats



## Meta

- From orchestrator: BW → SCN (Phase 8.6)

- Worker role: WORKER(DSP-SCN-20260804-06-ghost-boats)

- Priority: P0

- Phase: Phase 8 — Visual & authoring QoL

- Related: Unity ghost/invisible boat modes; fleet registry; boat catalogue

- **Status: DONE** (SCN+BW accepted 2026-08-04 � Phase 8 complete)



## Goal



Support **ghost / invisible** boats: track pose + tag (or minimal marker) without a full opaque hull — Unity parity for ops/air when a boat should not dominate the plate.



## Background

- Full hull + tag exists; Unity had modes for semi-transparent / hull-hidden tracking.

- Category colours (8.3) and Frame boats already land.



## In scope

1. Per-boat or per-fleet visibility mode: at least `solid` | `ghost` | `hidden` (names flexible; document).

2. Ghost: translucent hull or tag-only + optional ring/dot; still receives poses.

3. Hidden: no mesh (or fully invisible) but optional map-dot still tracks if useful — document choice.

4. Ops control: Fleet panel and/or catalogue field; session or RaceProject persistence if schema allows without breaking parse (prefer session + optional project field with soft default).

5. Docs + tests; build green.



## Out of scope

- New glTF hero boats

- Stream map NDI burn-in

- Editor snap



## Acceptance criteria

- [x] Can set a live boat to ghost and see translucent/minimal visual while pose updates

- [x] Hidden boat does not draw full hull on air preview

- [x] Docs; build green



## Worker report (summary)



1. **Summary:** Per-boat `solid` | `ghost` | `hidden` via Fleet / Live select (sessionStorage). Ghost = translucent hull + category-tinted water ring + tag; hidden = no 3D hull/tag while pose + **map-dot still track**. Soft RaceProject `fleet.boatVisibility` (junk dropped; default solid). Unity sibling had no dedicated ghost script — matched ops intent from asset-port notes.

2. **Files:** `src/scene/boatVisibility.ts` (+test), `boatEntity.ts`, `fleetLivePanel.ts`, `createScene.ts`, `index.ts`, `main.ts`, `style.css`; soft project parse/build/types + contract; READMEs + roadmap 8.6 done.

3. **Verify:** `npm test` (294 + server 8) green; `npm run build` green. Manual: Fleet row → ghost (translucent + ring while mock poses move); → hidden (no hull on preview, map square continues).

4. **Follow-ups:** Map-chrome (8.7) may want ghost/hidden dot styling; optional glTF material whitelist if ghost alpha fights PBR maps.

5. **SCN memo bullets:** Phase 8.6 landed; modes on Fleet session + soft `fleet.boatVisibility`; hidden keeps map-dot tracking by design.



## Worker paste block



```

You are WORKER(DSP-SCN-20260804-06-ghost-boats).



Mandatory reads:

1. docs/agentic/dispatches/active/DSP-SCN-20260804-06-ghost-boats.md

2. docs/roadmap/phases-roadmap.md Phase 8.6

3. src/scene/boatEntity.ts, fleetLivePanel.ts, boatNames/*

4. Sibling Unity boat visibility behaviour if findable (read-only)



Implement ghost/invisible boat modes. No NDI map burn-in, no map chrome DSP scope.

Report back per dispatch.

```

