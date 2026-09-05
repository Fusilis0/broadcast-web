# Dispatch DSP-SCN-20260904-04-sea-plates-soft-light

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-04-sea-plates-soft-light)
- Priority: **P1** (look-dev; holds 19.2b)
- Phase: **19.15** polish — darker crests; no solid water-plane plates; softer light falloff
- Related: `done/DSP-SCN-20260904-03-sea-look-unify.md` **human Pass** with notes (operator 2026-09-04 17:40)
- Worker result: **code done 2026-09-04** — suite **1183 + 26**, build green. SCN **code-accept**. **Human Fail 2026-09-04** — library PNG black backs still look like plates. Follow-up: `done/DSP-SCN-20260904-05-logo-knockout-sea-teal.md`. Hold 19.2b / 19.17.

## Goal

Three operator notes on an otherwise better sea:

1. Wave **bright bands a bit darker** (less near-white foam).
2. **No solid colour frames/plates** on start / finish / sponsors sitting on the 2D water — logo and text only; water shows through.
3. Lighting texture **still cuts off**. **Less lighting strength**, **smoother** falloff (no weird terminator).

Vertex displacement stays **0**. Do not bury boards. No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`.

## Background

04-03 Pass on motion + Gerstner-aligned troughs. Remaining:

**Crests too hot:** `foamColor` `0xe8eef2`, foam mix cap **0.90**, crest `* 0.62`. Reads as off-white stripes. Darken foam colour and/or lower mix + crest weight. Keep traveling foam — just quieter.

**Solid plates:** `resolvePanelAlpha` defaults to **1**. `recordSponsorBoardDraws` always `fillRect` the full canvas + `strokeRect` frame. Flat Rolex/Vodafone boards are grey/white slabs on the sea. Start/finish canvas is already mostly clear (glyph + underline bar) on a **24 m × ~100 m** plane — if that still reads as a white strip, drop/thin the full-width bar and keep letters. Inspector **panel alpha** stays so ops can put a plate back.

Lock: **flat-on-water** (`applyFlatOnWaterPlacement`) sponsors default **no plate** (alpha **0**): skip panel fill + frame when alpha ≈ 0; draw logo/label only. Upright chain ribbon may keep a plate (it is a wall, not a water decal) unless it is also a solid slab on the water in this pack — then same alpha-0 default for water-facing chain segments. Do not rewrite 19.10 band size.

**Light cutoff:** `wetSheen` (`OCEAN_SHEEN_DEFAULTS` 7 / 0.2) × `highFreqFade`, plus glitter 78 / 0.16, plus `waterCol *= mix(0.82, 1.05, ndl)`. Operator: lighting texture **ends not smoothly**. Lower sheen + glitter **intensity** (do not crank sharpness). Soften the sheen lobe (wider, weaker) so the blob **ramps** instead of a visible edge. If `OCEAN_DETAIL_FADE` (80–900 m) kills foam/sheen as a ring, widen/smooth that too. Do **not** delete glitter entirely (04-03: operator likes a mild sun hit).

## In scope

1. Darker crest/foam (colour and/or mix cap / crest weight).
2. Default **no plate** on water-plane sponsors (and start/finish backing if any). Logo/text remain. `panelAlpha` slider still works.
3. Weaker lighting + smoother sheen/glitter/fade falloff.
4. Tests + README one-liner. `npm test` + `npm run build`.

## Out of scope

- Vertex Gerstner, Cesium vendor, 19.2b / 19.17
- Buoy mesh flags, inspector layout rewrite
- Changing start/finish **span/depth metres** (19.10)

## Likely files

- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/sponsors/boardCompose.ts`, `sponsorBillboard.ts`
- `src/scene/lineSigns/lineSignMesh.ts`
- chain compose only if water-plane plates are in scope
- `src/scene/README.md`, `SCN_MEMO.md`

## Acceptance criteria

- [x] Crests/foam visibly **less white**; still travel. *(foamColor `0x9ab0bc`; crest 0.38; mix 0.55 — human smoke)*
- [x] Flat sponsors: **water through** the board; logo/text remain. Start/FINISH letters (not a solid white slab).
- [x] Orbit: sun lighting **ramps smoothly**; no hard texture cutoff. Mild blob OK. *(sheen 3.5/0.1; glitter 0.1; fade 40–1600 — human smoke)*
- [x] Vertex disp still 0. AR no ocean. `npm test` + `npm run build` green. *(1183 + 26)*

## Report back (worker 2026-09-04)

1. **Foam:** `0xe8eef2` → `0x9ab0bc`; crest 0.62 → 0.38; fold 0.85 → 0.55; mix 0.90 → 0.55.
2. **Plates:** flat omit α **0** (skip fill/frame, keep logo/label). Chain upright omit α **1**. START/FINISH letters only (bar gone). Inspector α restores plate.
3. **Light:** sheen 7/0.2 → 3.5/0.1 + fwidth; glitter 0.16 → 0.1; fade 80–900 → 40–1600; softer graze + ndl smoothstep.
4. **Memo:** worker bullets; await human smoke.

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-04-sea-plates-soft-light).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-04-sea-plates-soft-light.md
2. src/scene/environment/gerstnerOcean.ts (foam mix, OCEAN_SHEEN_DEFAULTS, glitter, highFreqFade)
3. src/scene/sponsors/boardCompose.ts (default panelAlpha 1, fillRect plate)
4. src/scene/lineSigns/lineSignMesh.ts
5. docs/agentic/memos/SCN_MEMO.md

P1: darker wave crests; no solid plates on water-plane start/finish/sponsors (logo/text only); weaker lighting with smoother falloff. Vertex disp stays 0. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS.
Report back per dispatch.
```
