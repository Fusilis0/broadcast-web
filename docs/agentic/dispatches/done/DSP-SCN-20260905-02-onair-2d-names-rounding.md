# Dispatch DSP-SCN-20260905-02-onair-2d-names-rounding

## Meta
- From orchestrator: SCN
- Worker role: WORKER(DSP-SCN-20260905-02-onair-2d-names-rounding)
- Priority: **P0**
- Phase: **19.2b** — operator follow-up after 1080 + Boat size
- Related: `done/DSP-SCN-20260905-01-onair-2d-1080-boat-scale.md` **human Pass (local) 2026-09-05**; canvas 1920×1080 + slider stay
- Hold **19.17** (PLT). No Cesium. No NDI pump rewrite. No `STUDIO_TICK_FPS`. Vertex Gerstner `displacementScale` stays **0**.
- Worker result: **code done 2026-09-05** — stream names (not sail numbers); no marks/drones; S/F centered; buoy `name` pills; CW/CCW rounding around buoys/gates at 10 Hz; Boat size scales course chrome; hull AABB stroke removed. Suite **1217 + 26**, `npm run build` green. SCN **code-accept**.
- **Human Pass 2026-09-05.** Next: PLT **19.17** (`HO-SCN-PLT-20260905-01`).

## Goal

Stream / local **2D** (same 1920×1080 canvas NDI samples) is a race graphic:

- Fleet pills show **boat names**, not sail numbers.
- **No** `mark` features, **no** drones.
- **START / FINISH** text sits on the **middle of the line**.
- **Buoy names** on the map; **rounding arrows** around those buoys, same CW/CCW/Off as Assets Details.
- **Boat size** slider also scales START/FINISH, buoys, and rounding glyphs.
- Drop the thin **rectangle** around hull sprites.

Ops / World Authoring map stays as-is except the shared hull-box stroke (remove it there too — it is the same `drawTintedSprite` path).

## Background

Operator after 05-01 local smoke (2026-09-05): numbers next to hulls; yellow **marks** still on 2D; START/FINISH pills sit off the line; drones still drawn; buoys unlabeled; no 2D rounding rings; slider only thins hulls; sprite AABB `strokeRect` reads as a box around each boat.

Current code (do not “discover” a different bug):

- Stream fleet label is `` `${p.id}` `` in `map2d.ts` (catalogue names never reach the map). Colours already sync via `setBoatDotColors` / `boatColorsFromCatalogue` in `main.ts`.
- `isOnAirMapFeatureType` still allow-lists `mark`. Stream pose loop still `drawMapDroneIcon`.
- S/F pill: `drawLabelPill(..., mx + 5, my - 3, ...)` plus left/baseline pill box — not centered on the segment.
- Layout `mark` / `buoy` branch draws a circle and **no name**. 30 Ağustos buoys have `name: "Cıragan"` (etc.) and `label: "buoy"` — **use `name`**, not `label`.
- `scaleStreamBoatChrome` scales `boatLen` / `boatBeam` / fleet pill only. `drawMapLayoutFeatures` is called with **unscaled** `chrome`.
- Hull box: `drawTintedSprite` `ctx.strokeRect(-w/2, -h/2, w, h)`.

3D rounding (`src/scene/features/rounding.ts` + `course/roundingArrows.ts`): omit → **CW**; `'none'` hides; `'ccw'` opposite. From above the water, CW = clock. Inspector Assets Details is the source of truth. **Do not put rings on boat hulls** — rounding is a buoy/mark/gate field, not a boat field. Operator “arrows to the boats” = arrows on the 2D race picture around the **buoys the boats round**.

## In scope

1. **Boat names (stream only).** Wire catalogue names onto the stream map (mirror colours: e.g. `setBoatNames` + `boatNamesFromCatalogue`, or one catalogue sync). Stream fleet pill text = `entry.name` when non-empty, else id. Ops map still shows **id**. Fixture check: 21 → Bora, 22 → Aksu (`public/fixtures/boats/demo-istanbul-names.json`).

2. **Drop marks on stream.** `isOnAirMapFeatureType('mark')` → **false**. Keep `start`, `finish`, `buoy`, `gateLeft`, `gateRight`. Still `visible2d`. Ops `filterFeaturesFor2d` unchanged (marks stay on World Authoring). Stream must **not** draw the legacy `courseMarks` yellow-dot fallback. Flip `featureVisibility.test.ts` / `mapChrome.test.ts` allow-list expects.

3. **No drones on stream.** Skip pose `kind === 'drone'` entirely (icon + label). Ops still draws drones.

4. **START / FINISH on the line.** Shared `drawMapLayoutFeatures` S/F two-point path: pill **visual center** on the segment midpoint `(mx, my)`. No `+5` / `-3` offset. `drawLabelPill` today anchors top-left of the box at a baseline-left point — add a centered mode (or a small helper) so box + glyphs sit on the midpoint. Ops may use the same centering (one path).

5. **Buoy names (stream).** For `type === 'buoy'`, draw a name pill. Text = trimmed `f.name`; if empty, `f.label` **only when it is not a type echo** (`buoy` / `mark` / empty). Do **not** prefer `label` over `name` (30 Ağustos `label: "buoy"`). Ops: do not add stream-style name pills unless they already exist (keep ops dense).

6. **Rounding arrows (stream buoys + gates).** Canvas stand-in of the 3D ring: circle + **two** heads, spin with `roundingYawRad` / `ROUNDING_REVOLUTION_SEC` / `effectiveRounding`. Sense:

   | Assets Details | JSON | 2D |
   | --- | --- | --- |
   | CW (omit or cw) | omit / `'cw'` | clockwise on the north-up map |
   | CCW | `'ccw'` | opposite |
   | Off | `'none'` | no glyph |

   Canvas Y is down: geographic CW (from above) = `ctx.rotate` **clockwise**. `roundingYawRad('cw')` is **negative** 3D Y — 2D must still **look** clockwise; use the sign that matches 3D-from-above, not a blind copy of the 3D yaw onto canvas. Do **not** attach glyphs to boat poses. Radius scales with Boat size (`markR` or a derived px radius).

   Animate without a 60 fps 1080 loop: hitch to existing redraws **plus** a **≤10 Hz** timer/`rAF` throttle while the stream map is mounted (NDI samples this canvas). Cancel on `dispose`. Do **not** raise `STUDIO_TICK_FPS`. Do **not** rewrite NDI pumps.

7. **Boat size scales course chrome.** Extend `scaleStreamBoatChrome` (keep slider label **Boat size**, storage key, 0.25–2 / default 0.5). Also scale: `markR`, `gateEndR`, `courseLine`, `gateLine`, `sfFont`, S/F end-cap radius (today hardcoded `3.5`), rounding glyph. Pass the **scaled** metrics into `drawMapLayoutFeatures` on stream (today it gets unscaled `chrome`). Do **not** scale compass, title strip, OSM, or wind readout. Ops `boatLen` still **9**; ops setter still no-op.

8. **Hull rectangle.** Remove `strokeRect` in `drawTintedSprite`. Procedural hull fallback may keep its own outline (that is not an AABB box). Do not strip the stream canvas hairline (`drawStreamMapBackdrop`).

9. README one-liner. `npm test` + `npm run build`.

## Out of scope

- NDI pumps / `letterboxRect` / FourCC / `STUDIO_TICK_FPS`
- Ops restyle beyond shared hull-box removal
- Showing `type: mark` on stream (do not auto-promote marks to buoys)
- 3D rounding / inspector field changes
- Label collision solver
- 19.17, Cesium, library re-seed, 3D sea (`displacementScale` stays 0)
- Renaming the slider

## Likely files

- `src/scene/features/featureVisibility.ts` (+ tests)
- `src/scene/map2d.ts`, `mapChrome.ts` (+ tests)
- `src/scene/boatNames/categoryColor.ts` or a small names helper (+ `boatNames` tests)
- `src/main.ts` (sync names next to colours)
- `src/scene/features/rounding.ts` (reuse; do not fork the sense table)
- `src/scene/README.md`
- Stub map mocks if `setBoatNames` is added (`editorPanel.inspector.test.ts`)

## Inputs provided

- Operator 2026-09-05: names not numbers; no marks; no drones; S/F centered; buoy names; rounding = Assets Details; slider scales S/F + buoys; no hull rectangle.
- Catalogue: 21 Bora, 22 Aksu, 23 Mira, 24 Lira.
- 30 Ağustos buoys: `name` is the on-air word; `label` is `"buoy"`.
- 05-01: canvas 1920×1080; slider `bw.streamMap.boatScale` default 0.5.

## Acceptance criteria

- [x] Stream pills: **Bora / Aksu** (etc.), not **21 / 22**. Missing catalogue → id. Ops still **21 / 22**. *(code)*
- [x] Stream: no `mark` dots, no drone icons. Ops still has both. *(code)*
- [x] START and FINISH pills sit on the midpoint of their lines (not off to one side / above). *(code)*
- [x] Stream buoys show **names** (Cıragan / ARNAVUTKÖY / …), not the word “buoy”. *(code)*
- [x] Stream buoys with omit/CW spin **clockwise** from above; CCW opposite; Off hidden. Matches Assets Details. No rings on hulls. *(code)*
- [x] Boat size 0.5 vs 1.5: hulls, pills, S/F stroke/text, buoy dots/names, rounding glyphs all change. Compass / title / OSM do not. *(code)*
- [x] No thin rectangle around boat sprites. *(code)*
- [x] `npm test` + `npm run build` green. *(1217 + 26; build green)*
- [x] Operator smoke: local **2D** + OBS `broadcast-web-2d`. *(**Human Pass 2026-09-05**)*

## Report back

1. How names reach the stream map (API + fallback)
2. Allow-list change (`mark` / drones)
3. How S/F centering was implemented
4. Rounding: canvas sign vs `roundingYawRad`; animation Hz
5. What `scaleStreamBoatChrome` now scales; layout uses scaled metrics?
6. Hull `strokeRect` gone?
7. Suite counts
8. Suggested SCN memo bullets
