# Dispatch DSP-SCN-20260903-05-sponsor-logo-plate-alpha

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260903-05-sponsor-logo-plate-alpha)
- Priority: **P1**
- Phase: 19.7 / 19.11 look follow-up
- Sequencing: **parallel OK** with DSP-04. **Not** parallel with DSP-06 (`assetInspector` / authoring inspector).

## Goal

Sponsors on 3D/AR: show the **Library logo**, not the name/label text (name “xxx” must not print on the plate). Add a **plate colour** field. Logo **aspect stays** (contain-fit, no stretch). Stretching the A–B line **uniformly enlarges** the board (width **and** height together). **Alpha** on plate colour — and the same alpha control on **other plate/colour fields** (billboard chain plate, sponsor frame if exposed).

## Background

`boardCompose`: logo contain-fit **or** procedural **label**. Missing/failed `textureUrl` falls back to label — so a named sponsor with no wired logo shows “xxx”. Operator: chosen logo must win; name/label stay in the Assets list only, **not** burned on the mesh when a logo is set.

`panelColor` exists in schema; Assets Details has plate colour for **chains** only, not sponsors. Authoring inspector has a colour draft — confirm it remounts 3D.

A–B today = board **width**; `heightM` = across-water **depth** independently → stretching A–B makes a wide strip and the logo slot changes. Operator: longer A–B → **same ratio** board (logo grows, aspect locked). When GPS A/B span changes, scale across-water with the span so aspect is conserved; `heightM` still edits the short side (updates stored ratio). Do not UV-stretch the logo.

Alpha: colours are `0xRRGGBB` today. Add additive **alpha 0–1** (default **1** = opaque). Apply to sponsor plate **and** chain ribbon plate (and frame if it has a picker). Canvas + mesh must honour alpha (`transparent` / premultiplied as already used). Preview/AR may show see-through boards; do **not** change NDI pumps (OUT FYI only).

## In scope

1. If `textureUrl` / logos resolve: **never** draw name/label on the 3D board.
2. Sponsor **Plate colour** in Assets Details + authoring (same as chain). Persist `panelColor`.
3. Uniform A–B scale + contain-fit logo.
4. Alpha slider (0–1) next to plate colour for sponsor **and** chain; persist additively (`panelAlpha` or rgba — pick one, parse/save round-trip).
5. Tests + READMEs. `npm test` + `npm run build`.

## Out of scope

- Boat alt / water m (DSP-04)
- Buoy mesh/tag toggles (DSP-06)
- Rewriting ribbon geometry, Cesium, NDI FourCC

## Likely files

- `src/scene/sponsors/boardCompose.ts`, `sponsorBillboard.ts`, `sponsorLayout.ts`
- `src/scene/billboardLogos.ts` / ribbon alpha
- `src/scene/sidebar/assetInspector.ts`, `src/scene/authoringInspector.ts`
- `src/scene/features/types.ts`, parse/build RaceProject

## Acceptance criteria

- [x] Sponsor with Library logo: 3D/AR shows the logo, not the name string.
- [x] Plate colour changes the board fill; alpha < 1 makes it more transparent.
- [x] Chain plate colour also has alpha.
- [x] Longer A–B: board grows in **both** axes; logo not stretched.
- [x] `npm test` + `npm run build` green.

## Worker result 2026-09-03

- **Label vs logo:** chosen `textureUrl` contain-fits the logo and **never** draws the name (`suppressLabel`). Failed load → coloured plate only, not “xxx”. Label text only when no logo URL is set (Assets list still shows name).
- **A–B uniform scale:** additive `boardAspect` (along / across). Stretching GPS A–B keeps the ratio and rewrites `heightM` to the new short side. Compose canvas matches plane aspect (no UV stretch). `heightM` edits the short side and updates the ratio. Old packs omit `boardAspect` until the next span/height edit.
- **Alpha field:** `panelAlpha` 0–1 (omit = 1). Sponsor + chain plate pickers. Canvas fill uses `rgba`; mesh `transparent` when alpha < 1. No NDI pump changes.
- Suite **1163 + 26**, `npm run build` green.
