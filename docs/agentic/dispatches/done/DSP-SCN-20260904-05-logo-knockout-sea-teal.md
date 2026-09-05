# Dispatch DSP-SCN-20260904-05-logo-knockout-sea-teal

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-05-logo-knockout-sea-teal)
- Priority: **P0** (operator Fail on plates + palette)
- Phase: **19.15** — water-plane logos without PNG backing; sea teal palette
- Related: `done/DSP-SCN-20260904-04-sea-plates-soft-light.md` — **Fail** on “plain area behind assets”. Operator 2026-09-04 18:00 + two screenshots (grey logo slabs; teal sea reference)
- Worker result: **code done 2026-09-04** — suite **1186 + 26**, build green. Library PNGs **not** replaced. Vertex disp still **0**. SCN **code-accept**. **Human Fail 2026-09-04** — white-RGB a=0 + mips; sea still grey. Follow-up: `done/DSP-SCN-20260904-06-logo-alpha-sea-reads.md`.

## Goal

1. Flat sponsors: **only the logo/glyph on the water** — no grey/black rectangle. START/FINISH already letters-only; do not regress.
2. Sea **colour** matches the operator teal reference: deep slate-teal, lighter teal bands, not charcoal-grey troughs.

Vertex disp stays **0**. Do **not** re-seed library files (PLT). No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`.

## Background

**04-04 Fail (plates):** code skipped canvas `fillRect` when `panelAlpha` is 0 (`demo-istanbul` already has `panelAlpha: 0`). The remaining “plain area” is the **library PNG itself**: Rolex / Vodafone / Senexus are **opaque black rectangles** with the mark on top (`public/assets/library/image/*.png`). `drawImage` copies that black into the board. Fog + JPEG makes the black quad look like a **grey plate**.

Do **not** replace/re-seed those files (PLT 19.16). At **compose time**, when the water-plane plate is off, **knock out near-black** pixels to alpha 0 (luminance key, small threshold, soft edge so no halo). Keep the green Rolex type, gold crown, red Vodafone, cyan Senexus. Do **not** key white (Vodafone sphere is white).

Apply the same knockout when composing water-plane logos. Upright chain may keep its wall plate; knockout on the ribbon is OK if it removes black boxes on the blue strip, but do not make the chain wall disappear.

**Palette (operator shot 2):** deep teal ~`#2c4d5b` / `#2b4f60`, lighter bands ~`#3d6678`, fine glitter, subtle wind streaks. Today `GERSTNER_OCEAN_DEFAULTS.deepColor` is `0x1e3a4c` and trough does `uDeepColor * 0.58` × mix **0.82** → **charcoal** bands (operator shot 1). Raise deep toward **`0x2c4d5b`**. Keep/adjust shallow toward **`0x3d6678`** (already `0x3d6a78`). **Soften trough darkening** so bands stay teal, not grey. Do not restore vertex bounce. Do not crank glitter sharpness (quadrant blowout).

## In scope

1. Luminance-key (near-black → alpha 0) when drawing library logos onto **no-plate** water boards. Tests: black-bg canvas → transparent; coloured glyph remains.
2. Sea defaults: deep/shallow + gentler trough toward the teal ref. README one-liner.
3. `npm test` + `npm run build`.

## Out of scope

- Replacing PNGs in `public/assets/library/`
- Vertex Gerstner, Cesium vendor, 19.2b / 19.17
- Boat-tag chrome (the GEMINI III chip in the ref is a tag, not a sponsor plate)

## Likely files

- `src/scene/sponsors/boardCompose.ts` / `sponsorBillboard.ts` (+ tests)
- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/README.md`, `SCN_MEMO.md`

## Acceptance criteria

- [x] Realistic 3D: Rolex / Vodafone / Senexus **marks sit on water** with **no** black/grey quad. *(compose luma key — human smoke)*
- [x] Sea reads **teal / slate**, not charcoal-grey troughs. Still flat mesh. Foam still travels. *(deep `0x2c4d5b` / shallow `0x3d6678`; trough 0.82 / 0.48; disp 0)*
- [x] START/FINISH letters only. Inspector plate alpha still restores a plate.
- [x] `npm test` + `npm run build` green. *(1186 + 26)*

## Report back (worker 2026-09-04)

1. **Knockout:** Rec. 601 luma. Hard **18** / soft **16** (fully opaque at 34). Runs when water-plane plate is off (`!drawPlate`). Chain ribbon logos also keyed; blue `fillRect` wall stays. Does not key white.
2. **Sea:** deep **`0x2c4d5b`**, shallow **`0x3d6678`**, trough `deep * 0.82` × mix **0.48**. Disp **0**.
3. **Memo:** worker bullets in `SCN_MEMO.md`; await human smoke. Hold 19.2b.

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-05-logo-knockout-sea-teal).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-05-logo-knockout-sea-teal.md
2. public/assets/library/image/*.png (opaque black backs — do not replace files)
3. src/scene/sponsors/boardCompose.ts (drawImage after skip fill)
4. src/scene/environment/gerstnerOcean.ts (deepColor 0x1e3a4c, trough * 0.58)
5. docs/agentic/memos/SCN_MEMO.md

P0: 04-04 Fail — grey plates are the PNG black backgrounds, not fillRect. Knock out near-black when composing water-plane logos. Shift sea to operator teal (#2c4d5b / #3d6678), gentler troughs. Vertex disp 0. Do not re-seed library. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS.
Report back per dispatch.
```
