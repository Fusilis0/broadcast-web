# Handoff HO-BW-20260804-01 — Open SCN for Phase 8

## To
**SCN — Scene & Visuals Orchestrator** (new Cursor chat)

## From
BW — 2026-08-04

## Mandate

Phase **8** is active (visual-first v1). Hetzner/cloud is **Phase 12 deferred** — do not plan deploy work.

### Issue workers in this order (P0 then P1)

| Order | DSP | Topic |
| --- | --- | --- |
| 1 | `DSP-SCN-20260804-01-editor-snap-validation` | Editor snap + validation + bearing |
| 2 | `DSP-SCN-20260804-02-hull-map-dot-colours` | Hull + map-dot category colours |
| 3 | `DSP-SCN-20260804-03-tag-billboard-preview-cam` | Billboard per preview vs air cam |
| 4 | `DSP-SCN-20260804-04-stream-2d-map` | Stream / on-air 2D map toggle |
| 5 | `DSP-SCN-20260804-05-unity-visual-assets-first-slice` | Unity assets first slice (P1) |

Paths: `docs/agentic/dispatches/active/DSP-SCN-20260804-*.md`

### SCN orchestrator behavior

1. Paste `BOOTSTRAP_SCN.md`, then this handoff.
2. Update `SCN_MEMO.md` with Phase 8 + issued DSPs.
3. Open **one worker chat per DSP** (paste worker block from each file).
4. Parallel OK for 01–03 if capacity; **04** after map2d/colours stable; **05** can start inventory in parallel.
5. Accept reports → move DSP to `done/` → tell BW.
6. OUT: only ping if stream map needs alpha/compositing follow-up (no OUT bootstrap required for kickoff).

### Out of scope for this wave

Phase 9 (auth/offline/calib), Phase 10 (Unity cutover / console 3.6), Phase 12 Hetzner.
