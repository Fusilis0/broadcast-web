# Sponsors

Owned by **SCN** (`src/scene/sponsors/*`). Sponsor features are **flat on the sea**
between GPS A–B (Unity `*LogoOnSea` spirit). `billboardChain` is a separate
continuous upright ribbon (`billboardChain.ts` / frameless `planChainRibbon`) —
not these framed sea boards.

## Board composition (Phase 16.4)

Every panel is a **canvas board**, not a floating logo:

1. Background (default `#f4f4f2`; optional `panelAlpha` 0–1). **Flat-on-water
   sponsors:** omit → **0** (no plate — logo/text only; sea shows through).
   **Upright chain ribbons:** omit → **1** (opaque). Alpha ≈ 0 skips fill + frame.
2. Dark slate frame stroke (skipped when alpha ≈ 0)
3. Inner margin
4. Then the loaded logo **contain-fit** (aspect preserved, no stretch).
   When the water-plane plate is off, compose **luminance-keys near-black**
   (hard 18 / soft 16) so library PNG backs do not stamp a grey quad, then
   **zero RGB where alpha is 0** (files are `(255,255,255,0)`, not black).
   Water-plane `CanvasTexture` has **mipmaps off** (`LinearFilter`) so those
   holes cannot average into a grey-blue slab. Flat `MeshBasicMaterial` is
   **`fog: false`** so scene fog cannot paint a rectangle on transparent
   pixels. When the plate is off, the canvas and mesh are **cropped to the
   opaque glyph AABB** (logo or label) so a full-board transparent quad cannot
   remain. Inspector plate-on skips the key, keeps the fill, and keeps the
   full plate mesh.
   Chain ribbon logos get the same key (blue wall plate stays).
   A chosen `textureUrl` **never** burns the name/label on the mesh
   (failed load → coloured plate only, or empty when alpha 0). Label text is
   only drawn when no logo URL is set.

A–B length is the along-water **canvas**. Across-water follows default board
aspect (2), **not** inspector `heightM` metres (packed 36/100/120 are glyph
scale, clamped so they cannot grow a slab). Stretching A–B still scales the
whole mark uniformly. Compose canvas matches the plane aspect so the logo is
not UV-stretched.

Sponsor materials match line signs (`transparent`, `depthWrite: false`, `fog: false`) plus polygon offset so a
filled board does not z-fight the ocean. Orientation is A–B span (not camera-billboard).

**Billboard chains (19.11 / ribbon):** omit `panelColor` → `#2A6FA6` (sponsors stay
`#f4f4f2`). Empty `logos` → solid coloured ribbon. Logos sit on the plate along U
with weighted fair interleave; no per-slot dark frames. `spacingM` = logo pitch;
`heightM` is vertical only. Chain plate colour has the same `panelAlpha` slider.

Optional additive hex fields `panelColor` / `frameColor`, `panelAlpha` (0–1), and
sponsor `boardAspect` (WorldFeature + fixture JSON). Omit → type-specific
defaults; old packs unchanged.

## Public helpers

| Symbol | Role |
| --- | --- |
| `createSponsorBillboard` | Flat-on-sea mesh + composed canvas map (default) |
| `createUprightSponsorBillboard` | Framed upright board (legacy helper; chain uses ribbon) |
| `recordSponsorBoardDraws` / `planSponsorBoard` / `containFitRect` | Pure compose (tests) |
| `parseOptionalHexColor` | Additive `#rrggbb` / `0x` / number |
| `parseOptionalAlpha` | Additive plate alpha 0–1 |
| `normalizeSponsors` / `buildSponsorLayout` / `loadSponsors` | Fixture → ENU → mount |

Demo textures: `public/textures/sponsors/{rolex,vodafone,senexus}.png`.
Schema: `public/fixtures/sponsors/README.md`.
