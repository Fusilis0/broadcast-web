# Sponsors

Owned by **SCN** (`src/scene/sponsors/*`). Fixed world panels between GPS A–B
(Unity `BillboardBetweenTwoPoints` spirit). `billboardChain` reuses the same
panel builder.

## Board composition (Phase 16.4)

Every panel is a **canvas board**, not a floating logo:

1. Opaque background (default `#f4f4f2`)
2. Dark slate frame stroke
3. Inner margin
4. Then either the loaded logo **contain-fit** (aspect preserved, no stretch)
   or a procedural `label` on the same board

`textureUrl` failure falls back to the label on the same board. Materials are
opaque (`transparent: false`). Orientation stays A–B span (not camera-billboard).

Optional additive hex fields `panelColor` / `frameColor` (WorldFeature + fixture
JSON). Omit → defaults; old packs unchanged.

## Public helpers

| Symbol | Role |
| --- | --- |
| `createSponsorBillboard` | Mesh + composed canvas map |
| `recordSponsorBoardDraws` / `planSponsorBoard` / `containFitRect` | Pure compose (tests) |
| `parseOptionalHexColor` | Additive `#rrggbb` / `0x` / number |
| `normalizeSponsors` / `buildSponsorLayout` / `loadSponsors` | Fixture → ENU → mount |

Demo textures: `public/textures/sponsors/{rolex,vodafone,senexus}.png`.
Schema: `public/fixtures/sponsors/README.md`.
