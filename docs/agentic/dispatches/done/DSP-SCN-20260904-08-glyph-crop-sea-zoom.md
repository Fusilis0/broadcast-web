# Dispatch DSP-SCN-20260904-08-glyph-crop-sea-zoom

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260904-08-glyph-crop-sea-zoom)
- Priority: **P0**
- Phase: **19.15** — look-dev: leftover plates + heightM slab + sea too “zoomed in”
- Related: `done/DSP-SCN-20260904-07-fog-off-deep-water.md` **human Fail 2026-09-04 19:16**
- Worker result: **code done 2026-09-04; Fail follow-up same day** — plate-off crop (pixel AABB **or** `glyphCropFromPlan` + UV); A–B canvas so `heightM` 100/120 cannot grow a slab; `OCEAN_LOOK_XZ_SCALE` **1/9** (48→5.33 … 7→0.78; streak/noise ×9) after operator rejected ×3. Fragment **does not flatten** shading under board footprints. Distance numbers cropped too. Vertex disp **0**. Dark hexes unchanged. Library PNGs not replaced. Chain still upright. Suite **1193 + 26**, `npm run build` green. SCN **code-accept**.
- **Human Pass 2026-09-04 20:02** — logos on water, no teal slabs; sea 1/9 accepted (operator: “too few iterations” but **go next**). Follow-up: `active/DSP-SCN-20260904-09-onair-2d-chrome.md` (19.2b). Do not re-tune sea unless they reopen.

## Goal

1. Water-plane Rolex / Vodafone / Senexus / START / FINISH: **glyph only**. No teal/grey rectangle the size of the board. Wave texture around the mark.
2. Flat sponsor **world quad stays in the GPS A–B canvas region**. Inspector `heightM` must **not** grow a 36–120 m north slab. Sea is flat — do **not** keep the old “lift it out of the waves” size/Y hack.
3. Sea fragment look reads **zoomed out** (smaller ripples, less near-field detail). Keep 04-07 dark hexes. Vertex `displacementScale` stays **0**.

Do not re-seed library PNGs. No Cesium vendor. No NDI pumps. No `STUDIO_TICK_FPS`. Do **not** strip boat-tag chips. Upright **billboardChain** stays a vertical ribbon (plate on); this DSP is water-plane marks + sea look.

## Background

**04-07 Fail (operator shot):** dark sea is OK; **solid teal/grey quads remain** under START / Rolex / Senexus / Vodafone / FINISH. Fog-off was not enough: the mesh is still a **full-board transparent plane** (`PlaneGeometry(widthM, heightM)` / 24 m START band) mapping a canvas that is mostly empty around a contain-fit logo. That empty quad still reads as a rectangle.

**heightM “grows to upside”:** demo pack has flat sponsors at `heightM` **36 / 100 / 120** with `boardAspect` rewritten by `applySponsorScaleOnEdit` (`src/scene/sponsors/sponsorLayout.ts`). `sponsorPlaneSize` uses `heightM` as **across-track metres** (or `widthM / boardAspect` after a height edit). Caption already says `heightM (uniform scale)` — the mesh does **not** do that; it extends one axis on the water (screen-up / north in the shot). Operator used this while waves buried boards. **Vertex disp is 0 now — that workaround is obsolete.** World Y for flat boards stays `WATER_PLANE_Y + WATER_PLANE_Y_OFFSET` (0.08). Never `+ heightM / 2` on `placement: 'flat'` (that path is upright chain only).

**Lock — canvas region:** GPS A–B is the along-water **canvas**. Across-water size follows **logo / default board aspect** (`DEFAULT_SPONSOR_BOARD_ASPECT` 2), **not** a free 100 m short side. `heightM` may scale the **glyph inside** that fixed A–B quad (contain-fit; clamp so it cannot enlarge the OBB past the A–B canvas). Stretching A–B may still scale the whole mark uniformly. Do not persist a new schema field unless tests require it.

**Lock — crop:** when the water-plane plate is off, **crop canvas + mesh to the opaque glyph AABB** (logo or START/FINISH letters). No full-board transparent quad. Keep `fog: false`, `transparent`, `depthWrite: false`, no mips, `alphaTest` 0.05. Inspector plate-on keeps the full plate mesh. Do not fill plates when alpha is 0.

**Lock — sea zoom:** operator wants the water to look like the camera is **higher** — details smaller. Do **not** change clipmap extent (that is coverage, not look). Scale **fragment** spatial frequency: Gerstner `WAVES` wavelengths **× ~3** (e.g. 48→144 … 7→21) and divide streak/noise UV freqs by the same factor (`0.016` / `0.22` / `streakNoise` `0.07`). One named constant (e.g. `OCEAN_LOOK_XZ_SCALE`) is better than magic numbers. Keep `displacementScale` **0**, dark hexes `0x0c2f3a` / `0x164a55` / horizon `0x2a4a52`, trough 0.82 / 0.48, glitter sharpness. AR: ocean still off.

## In scope

1. Tight-crop water-plane sponsor + line-sign canvas/mesh to opaque ink when plate is off. Tests: cropped size ≈ glyph AABB, not full 1024×512 empty canvas; `mat.fog === false` still.
2. Flat sponsor footprint = A–B canvas × aspect; `heightM` does not grow across-track metres. Update `sponsorPlaneSize` / `applySponsorScaleOnEdit` + inspector copy. Tests: `heightM` 100 on a short A–B does **not** yield a ~100 m across mesh; A–B stretch still uniform. World Y unchanged (no heightM lift).
3. Sea look zoom-out (wavelengths + noise/streak). Tests lock the scale constant / wavelengths. README one-liners.
4. `npm test` + `npm run build`.

## Out of scope

- Re-seeding `public/assets/library/image/*` (PLT)
- Billboard chain → flat, chain plate off, boat tags
- Vertex Gerstner (`displacementScale` stays 0)
- Cesium / MapTiler, 19.2b / 19.17, NDI, `STUDIO_TICK_FPS`
- Rewriting demo-istanbul `heightM` JSON (code must make 100/120 harmless)

## Likely files

- `src/scene/sponsors/boardCompose.ts`, `sponsorBillboard.ts`, `sponsorLayout.ts`
- `src/scene/lineSigns/lineSignMesh.ts`
- `src/scene/sidebar/assetInspector.ts` (sponsor height help text)
- `src/scene/environment/gerstnerOcean.ts` (+ tests)
- `src/scene/README.md`, `src/scene/sponsors/README.md`
- tests next to those modules

## Inputs provided

- Operator Fail shot: teal rectangles; Senexus strip elongates with `heightM`.
- Pack examples: `public/races/demo-istanbul/project.json` `sponsor:4` heightM 36, `sponsor:5` 100, `sponsor:6` 120 (`panelAlpha` 0).
- Sea defaults in `GERSTNER_OCEAN_DEFAULTS` / `WAVES`.

## Acceptance criteria

- [x] Plate-off water-plane sponsor + START/FINISH: mesh/canvas hug the glyph; tests for crop + `fog: false`.
- [x] Flat sponsor across-track size is A–B / aspect, **not** inspector `heightM` metres. `heightM` 100 does not create a ~100 m slab. World Y is not `heightM/2`.
- [x] Inspector plate alpha still restores a full plate.
- [x] Fragment sea look is spatially **finer** (`OCEAN_LOOK_XZ_SCALE` **1/9**, not 3×). Dark hexes unchanged. `displacementScale === 0`. Fragment does not flatten under boards.
- [x] Chain still upright with plate. Boat tags untouched. Library PNGs not replaced.
- [x] `npm test` + `npm run build` green.
- [x] Operator smoke: logos on water, no rectangle; sea 1/9 finer. **Human Pass 2026-09-04.**

## Report back

1. How crop works (canvas AABB vs mesh)
2. New `sponsorPlaneSize` / heightM rules + test names
3. Wavelength / look-scale numbers
4. Suite counts
5. SCN memo bullets
