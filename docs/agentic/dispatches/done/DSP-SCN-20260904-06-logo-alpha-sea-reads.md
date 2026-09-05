# Dispatch DSP-SCN-20260904-06-logo-alpha-sea-reads

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-06-logo-alpha-sea-reads)
- Priority: **P0**
- Phase: **19.15** — grey box still there; sea still looks the same
- Related: `done/DSP-SCN-20260904-05-logo-knockout-sea-teal.md` **human Fail 2026-09-04 18:17** (Vodafone slab + charcoal sea)
- Worker result: **code done 2026-09-04** — white-RGB a=0 sanitized; water-plane mips off; sea deep `0x15606c` / shallow `0x2e8a86` / horizon+fog `0x5a8a8c`; fresnel nadir 0. Vertex disp **0**. Library PNGs not replaced. Suite **1189 + 26**, `npm run build` green. SCN **code-accept**. **Human Fail 2026-09-04** — fog plates + too-bright cyan. Follow-up: `done/DSP-SCN-20260904-07-fog-off-deep-water.md`. Hold 19.2b / 19.17.

## Goal

Operator still sees a **solid grey-blue rectangle** under Vodafone, and the sea **does not look teal**. Fix both so a reload makes an **obvious** change: logos are marks on water (wave texture through the board), sea is **visibly greener/teal** in the near field.

Vertex disp stays **0**. Do **not** re-seed library PNGs. No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`.

## Background

**04-05 Fail — plates:** luma-18 black key does not match these files. Sampled `vodafone-9e90847a.png`: corners are **`(255,255,255,0)`**, not black. Almost all of the PNG is already alpha 0. Rolex/Senexus too. `knockOutNearBlackRgba` **skips `a === 0`**, so those pixels stay **white RGB + zero alpha**.

That is the slab:

1. `putImageData` / `drawImage` copies **straight-alpha white holes** onto the 1024×512 board.
2. `CanvasTexture` **mipmaps** (default on) average white RGB with logo → a **muddy grey-blue quad** the size of the contain-fit board.
3. Unpremultiplied + fog (`0x8a9aaa`) makes it read as an opaque plate. Wave texture does **not** show through (so it is not “knocked-out water”).

**Do not** raise the black luma threshold again as the only fix. It will miss white-RGB transparent pixels.

**Must:**

- After any logo blit (and after knockout), **zero RGB where alpha is 0** (fog-safe, mip-safe).
- Water-plane sponsor `CanvasTexture`: **`generateMipmaps = false`**, `minFilter = LinearFilter` (same for START/FINISH canvas if it still boxes).
- Optional `alphaTest` ~0.05 on the flat board material so leftover fringe dies.
- Keep inspector plate-on path (no key, plate fill OK).

**04-05 Fail — sea:** `0x1e3a4c` → `0x2c4d5b` is a few counts of RGB. Under **horizon `0x8a9aaa`**, **fog `0x8a9aaa`**, fresnel 0.10, and overcast sky, it still reads **charcoal**. Operator must **see** teal without squinting.

Lock a **clearly greener** near-field albedo (still muted, not tropical): e.g. deep **`0x15606c`**, shallow **`0x2e8a86`** (worker may tune ± but G must go up vs today). **Fog + ocean horizon** must not be the old grey `0x8a9aaa` — bias both toward the water (teal-grey). Drop down-view sky wash (fresnel floor 0.10 is stealing teal when looking down). Do not restore vertex bounce. Do not crank glitter sharpness.

## In scope

1. Sanitize transparent logo pixels (RGB 0 if a==0); disable mips on water-plane boards.
2. Sea + fog/horizon so near-field water is **obviously teal**, not the same grey.
3. Tests: white-RGB zero-alpha → RGB 0 after sanitize; mipmaps off on flat sponsor texture; new deep/shallow hex + fog/horizon. README. `npm test` + `npm run build`.

## Out of scope

- Replacing `public/assets/library/image/*.png`
- 19.2b / 19.17 / Cesium vendor / NDI / `STUDIO_TICK_FPS`

## Likely files

- `src/scene/sponsors/boardCompose.ts`, `sponsorBillboard.ts`, `lineSignMesh.ts`
- `src/scene/environment/gerstnerOcean.ts`, `realisticEnvironment.ts` (fogColor)
- tests + `src/scene/README.md` + `SCN_MEMO.md`

## Acceptance criteria

- [ ] Vodafone / Rolex / Senexus: **no** solid grey/blue rectangle; water texture visible around the mark.
- [ ] Near-field sea is **visibly teal/green-blue** vs 04-05 charcoal (operator should not need a hex picker to tell).
- [x] Vertex disp 0. Inspector plate alpha still restores a plate. AR no ocean. *(code; operator smoke pending)*
- [x] `npm test` + `npm run build` green. *(1189 + 26; build green)*

Visual criteria remain **operator smoke** (no grey slab; near-field teal).

## Report back

1. How white-RGB + mips were killed
2. New deep / shallow / fog / horizon / fresnel numbers
3. SCN memo bullets

## Worker paste block

```
You are WORKER(DSP-SCN-20260904-06-logo-alpha-sea-reads).

Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260904-06-logo-alpha-sea-reads.md
2. src/scene/sponsors/boardCompose.ts (knockOut skips a===0; PNGs are (255,255,255,0) not black)
3. src/scene/sponsors/sponsorBillboard.ts (CanvasTexture mips, premultiplyAlpha)
4. src/scene/environment/gerstnerOcean.ts + realisticEnvironment.ts fogColor 0x8a9aaa
5. docs/agentic/memos/SCN_MEMO.md

P0 Fail 04-05: grey Vodafone slab + sea still grey. PNGs are already transparent with WHITE rgb in a=0. Zero RGB on a=0; disable mips on water-plane boards. Make near-field sea obviously teal (not a 8-count hex tweak under grey fog). Vertex disp 0. Do not re-seed library. No Cesium vendor, no NDI pumps, no STUDIO_TICK_FPS.
Report back per dispatch.
```
