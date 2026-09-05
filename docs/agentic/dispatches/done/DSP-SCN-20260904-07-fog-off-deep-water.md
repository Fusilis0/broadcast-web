# Dispatch DSP-SCN-20260904-07-fog-off-deep-water

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-07-fog-off-deep-water)
- Priority: **P0**
- Phase: **19.15** — logo rectangles still there; sea too bright
- Related: `done/DSP-SCN-20260904-06-logo-alpha-sea-reads.md` **human Fail 2026-09-04 19:00**. Operator: still rectangles; wants **darker deep water**, not bright teal.
- Worker result: **code done 2026-09-04** — `fog: false` on flat sponsor + START/FINISH materials; sea deep `0x0c2f3a` / shallow `0x164a55` / horizon+fog `0x2a4a52`. Vertex disp **0**. Library PNGs not replaced. Boat tags untouched. Suite **1189 + 26**, `npm run build` green. SCN **code-accept**.
- **Human Fail 2026-09-04 19:16** — rectangles still there; `heightM` grows a north slab off the GPS canvas. Follow-up: `active/DSP-SCN-20260904-08-glyph-crop-sea-zoom.md`. Hold 19.2b / 19.17.

## Goal

1. Rolex / Vodafone / Senexus / START/FINISH: **no rectangular plate**. Wave texture must run through the board; only the glyph stays.
2. Sea is **dark deep water** (navy / dark slate, low luminance) — not the bright cyan from 04-06 (`0x2e8a86`).

Vertex disp stays **0**. Do not re-seed library PNGs. No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`. Do **not** strip boat-tag chips (GEMINI III–style name plates are HUD, not sponsor boards).

## Background

**04-06 Fail — rectangles:** operator shot still shows a **darker-teal quad the size of each board**, a different shade than the water. That is **scene fog on a transparent `MeshBasicMaterial`**. Three.js default `fog: true` mixes `scene.fog` (`0x5a8a8c`) into the whole plane, then blends — a fog-colored rectangle even when the canvas alpha is 0. Mip/RGB sanitize cannot fix that.

**Lock:** water-plane sponsor + line-sign materials **`fog: false`**. Keep `transparent` + `depthWrite: false` + no mips. Do not “fix” by filling the plate again.

**04-06 Fail — colour:** we pushed **bright** teal (`deep 0x15606c`, `shallow 0x2e8a86`, fog `0x5a8a8c`) so the operator could see a change. They rejected it: **darker, deep water**. Match the dark reference (GEMINI III shot): low-luma navy-teal, **not** tropical cyan, **not** the old charcoal-grey wash.

Lock (tune ± a few counts, keep it **dark**):

| Knob | 04-06 (too bright) | Target |
| --- | --- | --- |
| `deepColor` | `0x15606c` | **`0x0c2f3a`** |
| `shallowColor` | `0x2e8a86` | **`0x164a55`** |
| fog + horizon | `0x5a8a8c` | **`0x2a4a52`** (dark, not mid-teal) |

Troughs stay in the same family (do not crush to charcoal `* 0.58`). Foam stays quiet. Glitter sharpness unchanged.

## In scope

1. `fog: false` on flat sponsor + START/FINISH materials. Test asserts `mat.fog === false`.
2. Dark deep-water defaults + matching fog/horizon. Test hexes. README one-liner.
3. `npm test` + `npm run build`.

## Out of scope

- Library PNG replace, vertex Gerstner, Cesium, 19.2b / 19.17, boat-tag redesign

## Likely files

- `src/scene/sponsors/sponsorBillboard.ts`
- `src/scene/lineSigns/lineSignMesh.ts`
- `src/scene/environment/gerstnerOcean.ts`, `realisticEnvironment.ts`
- tests, `src/scene/README.md`, `SCN_MEMO.md`

## Acceptance criteria

- [x] `fog: false` on flat sponsor + START/FINISH materials. Test asserts `mat.fog === false`. *(code)*
- [x] Dark deep-water defaults + matching fog/horizon. Test hexes. README one-liner. *(code)*
- [ ] Logos: **no** teal/grey rectangle; water texture around the mark. *(**Fail 2026-09-04** — follow-up 04-08)*
- [ ] START/FINISH: letters only, no fog band. *(**Fail 2026-09-04**)*
- [x] Near-field sea is **dark** (deeper than 04-06 bright cyan). *(operator: sea colour OK)*
- [x] Vertex disp 0. Inspector plate alpha still restores a plate. AR no ocean. *(code)*
- [x] `npm test` + `npm run build` green. *(1189 + 26; build green)*

## Report back

1. Confirm `fog: false` on which meshes
2. New deep / shallow / fog / horizon hexes
3. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-07-fog-off-deep-water).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-07-fog-off-deep-water.md
2. src/scene/sponsors/sponsorBillboard.ts (MeshBasicMaterial, fog default true)
3. src/scene/lineSigns/lineSignMesh.ts
4. src/scene/environment/gerstnerOcean.ts (deep 0x15606c / shallow 0x2e8a86 — too bright)
5. docs/agentic/memos/SCN_MEMO.md

P0 Fail 04-06: rectangles are scene fog on transparent water-plane quads — set fog:false. Sea must go DARK deep water (0x0c2f3a / 0x164a55), not bright cyan. Vertex disp 0. Do not re-seed library. Do not strip boat tags. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS.
Report back per dispatch.
```
