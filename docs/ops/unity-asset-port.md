# Unity visual asset port — inventory & checklist

**Owner:** SCN  
**Slices:** DSP-SCN-20260804-05 (Phase 8.5 first slice) · DSP-SCN-20260804-08 (Phase 8.8 mild 3D polish)  
**Unity sibling (read-only):** `C:\Users\PC\Documents\GitHub\broadcast` (`../broadcast`)

Prefer real textures/glTF from Unity over more procedural stubs. This doc tracks what exists in Unity, what landed in broadcast-web, and the backlog.

## License / path notes

| Item | Note |
| --- | --- |
| Source tree | Unity project assets under `broadcast/Assets/` — **do not mutate** from broadcast-web workers unless a dispatch says otherwise. |
| Copied demo textures | `public/textures/sponsors/*` — race sponsor logos copied from `Assets/Sprites/` for local/demo air only. Re-export or replace with licensed pack assets before public distribution. |
| No Unity FBX dump | Hull already shipped as compact `public/models/boat.glb` (see `src/assets/README.md`). Start/Finish/Distances in Unity are **UI canvases**, not meshes — web ports are procedural textured planes matching those prefabs. |
| glTF budget | Keep new binary assets small; prefer PNG logos + canvas text over multi‑MB FBX. |

## Inventory

| Asset | Unity path | Kind | Web status | Follow-up |
| --- | --- | --- | --- | --- |
| Start line | `Assets/Prefabs/Start.prefab` + `BillboardBetweenTwoPoints.cs` | World-space canvas (flat water “START” + red bar) | **Ported** — `src/scene/lineSigns/` procedural plane | Optional TMP font parity |
| Finish line | `Assets/Prefabs/Finish.prefab` | Same as Start (“FINISH”) | **Ported** — same module | — |
| Sponsor logos on sea | `Assets/Prefabs/Sponsors/*LogoOnSea.prefab` | Canvas + sprite | **Partial** — texture slots + 3 demo PNGs; procedural fallback polished | Full logo pack + BillboardChain tiling |
| Billboard panel tex | `Assets/Sprites/billboard1.png` | PNG (~887 KB) | Not copied (size); procedural frame used | Optional panel chrome |
| Position / distance marks | `Assets/Prefabs/Distances.prefab` | TMP numbers 100–1000 on water | **Ported visual** — `src/scene/positionMarkers/` + demo fixture | Editor WorldFeature type; pull GPS from Unity scenes |
| CW / RCW arrows | `Assets/Prefabs/CWArrow.prefab`, `RCWArrow.prefab` + sprites | Canvas icons | **Map glyphs** — procedural chevron / arc (`mapChrome`); Unity PNGs (~110 KB) not copied | Optional PNG port; 3D water icons still stub |
| Countdown flags | Flag_* prefabs + PNGs | Canvas flags | Procedural planes already (Phase 2.6) | Optional PNG dump |
| Boat hull | Models / Boat.prefab | Mesh | `public/models/boat.glb` shipped | Category hull variants (8.3) |
| Ghost / invisible boats | Boat scripts / materials | Runtime mode | **Landed** (DSP-06) — see backlog note | — |
| 2D map boat / chrome | `2DMapBoat.prefab`, `Sprites/2d*.png`, `tekne_yeni.png`, sail icons | Sprites | **Ported** — `public/textures/map/*` + `src/scene/mapChrome.ts` | Optional 2d/2dd decorative chrome |
| Buoys | `BuoyMarker.cs` + CourseRenderer | Procedural poles | **Polished (8.8)** — float + band + stem + cap; gate accent | Optional Unity mesh dump |
| Gates | CourseRenderer `LineRenderer` | Line segments | **Polished (8.8)** — MeshStandard tubes on water | — |
| Water / shore cue | Cesium / none (Unity uses globe) | Environment | **Mild cue (8.8)** — AABB pads in `course/waterCue.ts` | No Cesium; no landmarks |
| Nametag plate | `nametag_*.png` | Sprite | Canvas boat tags | Optional plate texture |

## Demo fixtures wired

| Fixture | Role |
| --- | --- |
| `public/fixtures/world/demo-istanbul-extras.json` | Start + finish LineString features (merged at boot) |
| `public/fixtures/markers/demo-istanbul.json` | Distance-style position markers near course |
| `public/fixtures/sponsors/demo-istanbul.json` | `textureUrl` → `/textures/sponsors/*.png` |
| `public/textures/sponsors/{rolex,vodafone,senexus}.png` | Copied from Unity Sprites |
| `public/textures/map/{tekne_yeni,sail-icon}.png` | Map boat / sail chrome (DSP-07) |

## Water / shore cue — clear behaviour

Tunables: `WATER_CUE_DEFAULTS` in [`src/scene/course/waterCue.ts`](../../src/scene/course/waterCue.ts) (`waterColor`, `waterOpacity`, `shoreColor`, `shoreOpacity`, `paddingM`, `shoreExtraPadM`).

| Mode | Expected |
| --- | --- |
| `preview` | Teal water pad + muted shore tint under the course on dark clear |
| `transparent` | Same pads, **semi-transparent**, `depthWrite: false` — only the race footprint writes partial alpha; empty sky/sea stay see-through for NDI |
| `chroma` | Same localized pads; **green key clear** remains outside the pad (do not expand padding to full-frame) |

If the pad looks too heavy on alpha air, lower `waterOpacity` / `shoreOpacity` (e.g. 0.25 / 0.12).

## Ops checklist (visual smoke)

1. Boot demo race (`npm run dev` or Electron) with free cam over Istanbul demo course.
2. **Start** — red “START” band flat on water across south gate span; not a grey map-only stub.
3. **Finish** — “FINISH” band across north mark span.
4. **Sponsors** — three panels show logo textures (or branded procedural if texture 404).
5. **Position markers** — semi-transparent meter labels (100 / 200 / 300) on water near course.
6. **Buoys (8.8)** — marks read as yellow float+cap (not plain stub cylinders); gate ends show green accent band/cap.
7. **Gates (8.8)** — green horizontal tubes across Gate1 (not hairline-only).
8. **Water/shore cue (8.8)** — teal pad under course AABB; shore tint slightly larger; does not fill the whole frame.
9. Map: start/finish thicker red bars + **START/FINISH** pills; boats as category-tinted sail icons (yaw); ops + stream share `mapChrome`.
10. Editor arrow/rotation: chevron / curved glyph on map (Unity CW/RCW PNG deferred).
11. Clear modes: `preview` dark; `?outputMode=transparent` empty areas see-through with pad only under course; `?outputMode=chroma` green outside pad.
12. `npm test` + `npm run build` green.

## Remaining backlog (report to SCN)

### Phase 8.6 — Ghost / invisible boats
- **Done** (`DSP-SCN-20260804-06`): `solid` | `ghost` | `hidden` via Fleet panel + session; soft `fleet.boatVisibility` on RaceProject.
- Ghost = translucent hull + water ring + tag; hidden = no 3D hull/tag, map-dot still tracks.
- Separate DSP — not this slice.

### Phase 8.7 — 2D map polish
- **Done (DSP-07):** `mapChrome` shared draw path; `tekne_yeni` + sail icon; S/F pills; procedural arrow glyphs.
- Optional: Unity `2d.png` / `2dd.png` decorative chrome; copy CW/RCW PNGs if size budget OK.
- Separate DSP — not this slice.

### Phase 8.8 — 3D world polish (this slice)
- [x] Buoy / gate materials + scale pass
- [x] Mild water/shore cue (no Cesium)
- [x] Lighting tweak for hull/sponsors on transparent/chroma
- Optional later: BillboardChain tiling for long sponsor runs; arrow/rotation water icons (`CWArrow` / `RCWArrow`).

### Still stub / not in this slice
- `arrow` / `rotation` 3D (editor may place; no Unity icon mesh yet).
- Position markers not yet a `WorldFeature` editor tool (fixture-only).
- Full sponsor logo library + BillboardChain.
- Landmark props (bridge, Kız Kulesi).
- Category hull variants.
