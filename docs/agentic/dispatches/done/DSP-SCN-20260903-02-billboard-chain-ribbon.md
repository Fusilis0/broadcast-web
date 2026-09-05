# Dispatch DSP-SCN-20260903-02-billboard-chain-ribbon

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-02-billboard-chain-ribbon)
- Priority: **P1**
- Phase: **19.11 follow-up** (geometry). 19.11 picker / weights / `#2A6FA6` / vertical `heightM` stay.
- Sequencing: **parallel OK** with `DSP-SCN-20260903-01` (stay in chain/compose). Not 19.7 inspector.
- Worker result: **code done 2026-09-03** — one upright plane per polyline segment (abutting); shared period texture along U; empty logos = solid `#2A6FA6`. `spacingM` = logo pitch. Frameless `planChainRibbon`. Suite **1125 + 26**, build green. Overlaps DSP-01 ribbon path (required to exit VRAM OOM).

## Goal

`billboardChain` must look like a **SailGP shoreline ribbon**: one **continuous flat field** along the polyline, logos **on** that field, **no gaps**, **not** a row of framed squares. Operator refs: continuous white/grey strip, repeating logos, no panel seams. Current 30agustos 3D: separate blue upright rectangles with black gaps.

## Background

Today (`billboardChain.ts`):

- `samplePolylineAtSpacing` + one `createUprightSponsorBillboard` per sample.
- `CHAIN_INSTANCE_WIDTH_M = 6`, default / pack `spacingM = 12` → **~6 m holes**.
- Each instance is a **framed** sponsor board (`boardCompose` dark slate frame) → “squares next to each other.”

19.11 locked colour, weights (**AABAB**), picker, vertical height. It explicitly left `spacingM` as panel pitch. Operator 2026-09-03 overrides that: **the chain is a ribbon, not discrete boards.**

**Keep:** `openLibraryLogoPicker`, `logos[]` + integer weights, `weightedFairInterleave`, omit `panelColor` → `#2A6FA6`, empty logos → solid plate colour (no label), `heightM` = vertical size only.

**`spacingM` meaning:** logo **repeat pitch along the ribbon** (distance between logo centres / slots), **not** a gap between separate boards. Adjacent ribbon segments must abut (shared edge, no air).

**Sponsors** (`type: sponsor`) stay individual framed boards. Do not recolour sea sponsors.

## In scope

1. Replace per-sample framed panels with a **continuous strip** along the polyline (one mesh per segment or one ribbon; worker picks cheapest that has **no visible gap** in 3D/AR).
2. Compose **one** (or few) plate texture(s): fill = `panelColor`; logos contain-fit **on** the plate along U; **no per-slot dark frame** (hairline top/bottom edge optional; no vertical bars between logos).
3. Weights still drive slot sequence along the strip (3:2 → AABAB repeating).
4. Tests: polyline length ≈ strip length; no `width < spacing` hole; interleave unchanged. Features README + scene README one-liners.
5. `npm test` + `npm run build`.

## Out of scope

- White AR/3D after Load (`DSP-SCN-20260903-01`)
- 19.7 inspector, OSM, Cesium vendor, library re-seed
- Changing standalone `sponsor` boards
- Billboard “vanish” if the whole view is white (that is DSP-01)

## Likely files

- `src/scene/billboardChain.ts` + `billboardChain.test.ts`
- `src/scene/billboardLogos.ts` (compose along U; keep interleave)
- `src/scene/sponsors/boardCompose.ts` only if you add a **frameless** ribbon plan (do not change default sponsor boards)
- `src/scene/sponsors/sponsorBillboard.ts` only if chain stops using upright framed boards
- `src/scene/features/README.md`, `src/scene/README.md`

## Inputs provided

- Refs (operator): SailGP continuous strip, logos on a flat field, no tiled squares.
- Current: 30agustos `billboardChain:4`, `spacingM` 12, blue framed squares with gaps.

## Acceptance criteria

- [x] 3D/AR: chain is a **continuous** band; **no** black sky/sea slits between squares. *(worker; human Pass still required)*
- [x] Logos sit on the plate; sequence still weighted fair interleave.
- [x] Height m grows **vertical** only; logo aspect locked.
- [x] Empty logo list = solid coloured ribbon (bluish default).
- [x] `npm test` + `npm run build` green.

## Report back

1. Geometry approach (segments vs one ribbon)
2. Files / tests
3. `spacingM` semantics after the change
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260903-02-billboard-chain-ribbon).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260903-02-billboard-chain-ribbon.md
2. docs/architecture/phase19-senexus-qol.md §19.11
3. src/scene/billboardChain.ts (CHAIN_INSTANCE_WIDTH_M 6 vs spacingM 12)
4. src/scene/billboardLogos.ts, boardCompose.ts

Chain = continuous SailGP ribbon, logos on the plate, no framed squares / gaps. Keep picker, weights AABAB, #2A6FA6, heightM vertical. spacingM = logo pitch on the strip, not panel gaps. Do not touch white-screen remount (DSP-01), inspector, OSM, Cesium, sponsor sea boards.
Report back per dispatch.
```
