# Dispatch DSP-SCN-20260818-07-billboard-frames

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260818-07-billboard-frames)
- Priority: P1
- Phase: Phase 16.4 — sponsor billboard frame/background
- Design: `docs/architecture/phase16-visual-upgrade.md` §5
- Related: user 2026-08-18 — SailGP reference frame: sponsor band is an opaque **board** (white background, repeated brand, clean border), not a floating logo. Today a `textureUrl` replaces the whole panel with the bare logo image.
- Parallel-safe with: SCN-04/05/06/08. **You own** `src/scene/sponsors/*`.
- **Status: DONE** — worker complete + BW accepted 2026-08-18 (merged tree `npm test` 640+23, `npm run build` green).

## Goal

Sponsor / billboard-chain panels look like broadcast boards: opaque background, framed border, logo composed **onto** the board — for both textured and procedural panels. Defaults need no data changes; optional colors are additive.

## Background

- `src/scene/sponsors/sponsorBillboard.ts`: `createProceduralSponsorTexture` already draws brand fill + inner plate + label (used only when no texture). With `textureUrl`, the loaded image **is** the material map — logos with transparency float in the air (user complaint).
- `billboardChain` repeats the same panel along a polyline — must inherit the same board look.

## In scope

1. **Board composition:** compose every panel on a canvas: background (default white `#f4f4f2`), border frame (default dark slate), inner margin, then the loaded logo centered/contain-fit (preserve aspect, no stretch). Procedural (no texture) path keeps its label but adopts the same background/frame so both looks match.
2. Optional additive feature fields `panelColor` / `frameColor` (hex) on sponsor + billboardChain features; omit → defaults. Parse additively (old packs unchanged); include in editor export round-trip.
3. Texture failure fallback unchanged (procedural label on the same board).
4. Panels remain fixed world orientation (A–B span) — no billboarding change.
5. Tests: composed canvas path (logo drawn onto board, aspect preserved — testable via draw-call recorder or exported data), additive field parse round-trip.
6. Docs: `src/scene/sponsors/` README/comments, `docs/contracts/race-project.md` (additive fields), `docs/ops/unity-asset-port.md` row.

## Out of scope

- BillboardChain tiling/spacing logic changes.
- New sponsor textures/assets; library picker changes.
- Boats/tags (SCN-06), course (SCN-08), environment (SCN-04/05), sidebar (SCN-09).

## Likely files

- `src/scene/sponsors/sponsorBillboard.ts` (+ tests), `types.ts`, `loadSponsors.ts`
- Feature parse/export only for the two additive fields
- Docs above

## Inputs provided

- SailGP reference image (white board band, black frame line, repeated brand).
- Existing demo textures: `public/textures/sponsors/{rolex,vodafone,senexus}.png`.

## Acceptance criteria

- [ ] Textured sponsors render as framed boards with the logo on a background — no floating transparent logos.
- [ ] Procedural sponsors match the same board style.
- [ ] BillboardChain panels inherit the look.
- [ ] Old packs unchanged without new fields; `panelColor`/`frameColor` round-trip when set.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (composition approach, defaults)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested SCN memo bullets
