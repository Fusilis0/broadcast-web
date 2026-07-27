# Dispatch DSP-SCN-20260727-06-boat-name-colour-json

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260727-06-boat-name-colour-json)
- Priority: P0
- Phase: Phase 2.7 — name/colour JSON (SCN-only; closes Phase 2 content / Milestone B)
- Related handoffs: none
- BW ask: boat name/colour JSON; wire tags to names/colours; **no chroma** yet
- **Status: DONE** (worker report accepted by SCN 2026-07-27)

## Goal

Load a **boat name/colour catalogue** JSON and apply it to fleet **boat tags** (display name + category tint). Missing catalogue entries keep today’s stub (`Boat {id}`). No chroma/output modes, no TEL protocol changes.

## Acceptance criteria

- [x] Demo name JSON loads via `boatNamesUrl`
- [x] Boats `21–24` show catalogue names on tags (Bora/Aksu/Mira/Lira)
- [x] Tags show distinct category colours (Pembe pink / Mavi blue)
- [x] Unknown id → stub fallback; Unity nested JSON supported
- [x] Async load + `setTagIdentity` late apply
- [x] No chroma / TEL changes
- [x] `npm test` + `npm run build` green — SCN re-verified **123/123** (2026-07-27)
- [x] Unity untouched

## Worker report (summary)

Unity nested fixture; keyword colours + optional hex; `loadBoatNamesFromUrl` before TEL; hull tint/map dots skipped.

## Files delivered

- `public/fixtures/boats/demo-istanbul-names.json`, `README.md`
- `public/config.json` (`boatNamesUrl`)
- `src/scene/boatNames/*`
- `src/scene/{boatTag,boatEntity,createScene,index,README}`
- `src/config/*`, `src/main.ts`

## Full original dispatch

See git history for full in/out-of-scope text. Scope was SCN 2.7 name/colour → tags only.
