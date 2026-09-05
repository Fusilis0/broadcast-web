# Dispatch DSP-SCN-20260902-03-billboard-library-picker

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260902-03-billboard-library-picker)
- Priority: P0
- Phase: **19.11** — billboard plate, weights, library picker, vertical height
- Related: `HO-PLT-SCN-20260902-01` (library seeded). **19.7** waits on this picker.
- Worker result: **code done 2026-09-02** — `openLibraryLogoPicker`; `logos[]` + `weightedFairInterleave([3,2])` → AABAB; chain default `#2A6FA6`; empty = solid plate; `heightM` vertical only. Suite **1119 + 26**, build green.

## Goal

Billboard chains: default **bluish TV plate `#2A6FA6`**, empty list = solid framed plate, Library **picker modal**, integer **weights** → deterministic fair interleave (**A=3, B=2 → AABAB**), `heightM` = **vertical only** (logo aspect locked; `spacingM` unchanged).

## Background

- Catalogue: `listLibraryAssets` / `resolveLibraryAssetUrl` (`src/assets/library/`). Seed Rolex / Senexus / Vodafone. Do **not** re-seed files.
- Today: `DEFAULT_PANEL_COLOR` is `#f4f4f2` (sponsor boards). **Chain** default must be `#2A6FA6` when `panelColor` omitted. Sponsors may keep the light board unless they share the compose helper — if shared, add a chain-specific default; do not silently recolour every sea sponsor.
- `stubTexturePicker.ts` still lists `/textures/sponsors/…`. Replace with Library modal (Electron: `promptModal`, never `window.prompt`).
- Chain currently one `textureUrl`. Add additive `logos?: { url: string; weight: number }[]` (or equivalent) on `WorldFeature`; one URL + weight 1 is the 1-logo case. Parse/save round-trip.

## In scope

1. Shared **library logo picker** (small modal): thumbs from catalogue; returns URL. Used from chain details now; 19.7 will reuse for sponsors.
2. Default chain `panelColor` `#2A6FA6`. Empty logos → solid bluish plate + frame.
3. Assets details (chain): logo **rows** + integer **weight** each; add/remove via picker.
4. Pure helper `weightedFairInterleave(weights)` — `[3,2]` → repeating `AABAB` (indices `0,0,1,0,1`). Deterministic. Unit-test.
5. Chain `heightM` scales **vertical** size only; logos contain-fit / aspect locked. Do not stretch logos. Do not change `spacingM` unless the operator edits it.
6. Docs: features README + scene README. Tests for interleave + default colour + empty plate.

## Out of scope

- Full 19.7 inspector (project id hide, coord Add, drone RO) — next DSP
- 19.8 visibility, 19.12 OSM, Cesium vendor, re-seeding library PNGs

## Likely files

- `src/scene/sidebar/` picker (new) + `texturePicker.ts` / `stubTexturePicker.ts`
- `src/scene/billboardChain.ts` + test
- `src/scene/sponsors/boardCompose.ts` only if chain vs sponsor default must split
- `src/scene/features/types.ts`, parse/build RaceProject if logos persist
- `src/scene/sidebar/assetInspector.ts` (chain rows only)

## Acceptance criteria

- [x] New chain / omitted `panelColor` is bluish `#2A6FA6`; empty logos = solid plate, framed.
- [x] Picker shows Rolex / Senexus / Vodafone from `public/assets/library/`.
- [x] Two logos weights 3 and 2 tile **AABAB** along the chain.
- [x] Height change grows/shrinks vertically; logo ratio unchanged.
- [x] `npm test` + `npm run build` green.

## Worker result 2026-09-02

1. Picker: `src/scene/sidebar/libraryLogoPicker.ts` (`openLibraryLogoPicker`). Schema: `WorldFeature.logos?: { url: string; weight: number }[]` (empty `[]` = solid plate; omit falls back to `textureUrl` weight 1).
2. Interleave: `weightedFairInterleave` in `src/scene/billboardLogos.ts` — `[3,2]` → `[0,0,1,0,1]` (AABAB).
3. Tests: `billboardChain.test.ts`, `libraryLogoPicker.test.ts`, parse/geojson/editor round-trip. Suite **1119 + 26**, build green.
4. SCN memo: worker bullets below (pending orchestrator accept). No 19.7 / OSM / Cesium / re-seed.

## Report back

1. Picker module path; logos schema field
2. Interleave helper
3. Files / tests
4. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260902-03-billboard-library-picker).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260902-03-billboard-library-picker.md
2. docs/architecture/phase19-senexus-qol.md §19.11
3. src/assets/library/ (listLibraryAssets — do not re-seed)
4. src/scene/billboardChain.ts, boardCompose.ts, stubTexturePicker.ts, assetInspector.ts

Library picker modal + chain default #2A6FA6 + empty solid plate + weighted fair interleave AABAB (3:2) + heightM vertical only. No 19.7 inspector, no OSM, no Cesium vendor.
Report back per dispatch.
```
