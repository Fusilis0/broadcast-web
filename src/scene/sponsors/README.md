# Sponsors

Owned by **SCN** (`src/scene/sponsors/*`). Sponsor features are **flat on the sea**
between GPS A–B (Unity `*LogoOnSea` spirit). `billboardChain` reuses the board
texture builder but stays **upright** via `createUprightSponsorBillboard`.

## Board composition (Phase 16.4)

Every panel is a **canvas board**, not a floating logo:

1. Opaque background (default `#f4f4f2`)
2. Dark slate frame stroke
3. Inner margin
4. Then either the loaded logo **contain-fit** (aspect preserved, no stretch)
   or a procedural `label` on the same board

`textureUrl` failure falls back to the label on the same board. Sponsor materials
match line signs (`transparent`, `depthWrite: false`) plus polygon offset so a
filled board does not z-fight the ocean. Orientation is A–B span (not camera-billboard).

Optional additive hex fields `panelColor` / `frameColor` (WorldFeature + fixture
JSON). Omit → defaults; old packs unchanged.

## Public helpers

| Symbol | Role |
| --- | --- |
| `createSponsorBillboard` | Flat-on-sea mesh + composed canvas map (default) |
| `createUprightSponsorBillboard` | Same board, upright wall for `billboardChain` only |
| `recordSponsorBoardDraws` / `planSponsorBoard` / `containFitRect` | Pure compose (tests) |
| `parseOptionalHexColor` | Additive `#rrggbb` / `0x` / number |
| `normalizeSponsors` / `buildSponsorLayout` / `loadSponsors` | Fixture → ENU → mount |

Demo textures: `public/textures/sponsors/{rolex,vodafone,senexus}.png`.
Schema: `public/fixtures/sponsors/README.md`.
