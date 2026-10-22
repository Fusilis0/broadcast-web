# Dispatches index

## Bootstrap (open orchestrator chats)

| File | Opens |
| --- | --- |
| [`BOOTSTRAP_BW.md`](./BOOTSTRAP_BW.md) | Broadcast-Web Master Orchestrator |
| [`BOOTSTRAP_PLT.md`](./BOOTSTRAP_PLT.md) | Platform & DevEx — **start here after BW** |
| [`BOOTSTRAP_TEL.md`](./BOOTSTRAP_TEL.md) | Telemetry Ingest |
| [`BOOTSTRAP_GEO.md`](./BOOTSTRAP_GEO.md) | Geodesy & World Frame |
| [`BOOTSTRAP_SCN.md`](./BOOTSTRAP_SCN.md) | Scene & Visuals |
| [`BOOTSTRAP_OUT.md`](./BOOTSTRAP_OUT.md) | Output & Compositing |
| [`BOOTSTRAP_CON.md`](./BOOTSTRAP_CON.md) | Console Bridge |
| [`BOOTSTRAP_CAL.md`](./BOOTSTRAP_CAL.md) | Calibration & Vision |
| [`BOOTSTRAP_PRF.md`](./BOOTSTRAP_PRF.md) | Performance — frame budgets, dual clock, measurement |
| [`BOOTSTRAP_SRT.md`](./BOOTSTRAP_SRT.md) | SRT ingest + Phase 22 program out |

## Active / done worker dispatches

Orchestrators save concrete `DSP-*.md` files into:

- `active/` — not finished  
- `done/` — completed (optional archive)

Templates: see `../DISPATCH_PROTOCOL.md`.

### Active 2026-09-15 (Phase 22.4 program cameras)

Design: [`../../architecture/srt-program-cameras.md`](../../architecture/srt-program-cameras.md). Briefs: [`../briefs/phase22/README.md`](../briefs/phase22/README.md).

| DSP | Owner | Status |
| --- | --- | --- |
| [`active/DSP-OUT-20260915-01-srt-ar-1080.md`](./active/DSP-OUT-20260915-01-srt-ar-1080.md) | OUT | **Code-complete** — Human **E** |
| [`active/DSP-SCN-20260915-01-srt-ar-look-freeze.md`](./active/DSP-SCN-20260915-01-srt-ar-look-freeze.md) | SCN | **Code-complete** — Human **F** |
| [`active/DSP-SCN-20260915-02-srt-visibility-presets.md`](./active/DSP-SCN-20260915-02-srt-visibility-presets.md) | SCN | **Code-complete** — Human **G** |
| [`active/DSP-SCN-20260915-03-srt-3d-program-cam.md`](./active/DSP-SCN-20260915-03-srt-3d-program-cam.md) | SCN | **Code-complete** — Human **H** |
| [`active/DSP-SCN-20260915-04-srt-2d-program-cam.md`](./active/DSP-SCN-20260915-04-srt-2d-program-cam.md) | SCN | **Code-complete** — Human **I** |
| [`active/DSP-PRF-20260915-01-srt-30x3.md`](./active/DSP-PRF-20260915-01-srt-30x3.md) | PRF | **Code-complete** — Human **A**. **no `STUDIO_TICK_FPS`** |

### Active 2026-09-09 (Phase 22 local SRT)

Design: [`../../architecture/srt-egress.md`](../../architecture/srt-egress.md). Briefs: [`../briefs/phase22/README.md`](../briefs/phase22/README.md).

| DSP | Owner | Status |
| --- | --- | --- |
| [`active/DSP-SRT-20260909-01-local-srt-out.md`](./active/DSP-SRT-20260909-01-local-srt-out.md) | SRT+OUT | **Code-complete 2026-09-09** — Human Pass = OBS 30×3 |

VPS is **not** this DSP. Do **not** use NDI pack/IPC.

### Active 2026-09-08 (Phase 21 cinematic MP4)

Design: [`../../architecture/commercial-video.md`](../../architecture/commercial-video.md). Briefs: [`../briefs/phase21/README.md`](../briefs/phase21/README.md).

| DSP | Owner | Status |
| --- | --- | --- |
| [`active/DSP-GEO-20260908-01-cinematic-globe.md`](./active/DSP-GEO-20260908-01-cinematic-globe.md) | GEO | **Code-accept 2026-09-08** — ECEF exports in tree |
| [`active/DSP-SCN-20260908-01-cinematic-player.md`](./active/DSP-SCN-20260908-01-cinematic-player.md) | SCN | **Code-complete 2026-09-08** — Human Pass = Play `_empty` |
| [`active/DSP-SCN-20260908-02-intro-bosphorus.md`](./active/DSP-SCN-20260908-02-intro-bosphorus.md) | SCN | **Code-complete 2026-09-08** — Human Pass look → 06/07 |
| [`active/DSP-SCN-20260908-06-country-pins-spline.md`](./active/DSP-SCN-20260908-06-country-pins-spline.md) | SCN | **Code-complete 2026-09-08** — Human Pass = pins + no teleport |
| [`active/DSP-PLT-20260908-01-cinematic-tile-disk.md`](./active/DSP-PLT-20260908-01-cinematic-tile-disk.md) | PLT | **Code-complete 2026-09-08** — cache dir |
| [`active/DSP-SCN-20260908-07-cinematic-tile-warm.md`](./active/DSP-SCN-20260908-07-cinematic-tile-warm.md) | SCN | **Code-complete 2026-09-09** — Human Pass = second Play, no pop |
| [`active/DSP-SCN-20260909-01-intro-human-pass.md`](./active/DSP-SCN-20260909-01-intro-human-pass.md) | SCN | **Code-complete 2026-09-09** — Human Pass = Play west/east path + Save tile list |
| [`active/DSP-SCN-20260909-02-studio-boot-defaults.md`](./active/DSP-SCN-20260909-02-studio-boot-defaults.md) | SCN | **Code-complete 2026-09-09** — empty / free cam / authoring closed / aerial; NDI off in same tree |
| [`active/DSP-OUT-20260908-01-cinematic-mp4.md`](./active/DSP-OUT-20260908-01-cinematic-mp4.md) | OUT | **Code-complete 2026-09-09** — Human Pass = Electron Record ~60 s MP4 |

NDI Send off at boot: [`../handoffs/HO-SCN-OUT-20260909-01.md`](../handoffs/HO-SCN-OUT-20260909-01.md) — OUT owns, not SCN.

Do **not** mix Phase 20 hero smoke into these chats. No SRT, no NDI capture, no play-then-live, no credits, no CesiumJS.

### Active 2026-09-07 (SCN — Phase 20 OSM Buildings + heroes)

Design: [`../../architecture/3d-environment-buildings.md`](../../architecture/3d-environment-buildings.md). Brief: [`../briefs/phase20/SCN_PHASE20.md`](../briefs/phase20/SCN_PHASE20.md). Handoff in: [`../handoffs/HO-BW-SCN-20260907-01.md`](../handoffs/HO-BW-SCN-20260907-01.md).

| DSP | Owner | Status |
| --- | --- | --- |
| [`active/DSP-SCN-20260907-01-osm-buildings.md`](./active/DSP-SCN-20260907-01-osm-buildings.md) | SCN | **Human Fail 2026-09-07** — no boxes (fixed by 03) |
| [`active/DSP-SCN-20260907-03-osm-buildings-visible.md`](./active/DSP-SCN-20260907-03-osm-buildings-visible.md) | SCN | **Human Pass 2026-09-07** — white OSM boxes on Bing hills |
| [`active/DSP-SCN-20260907-04-grey-aerial.md`](./active/DSP-SCN-20260907-04-grey-aerial.md) | SCN | **Human Fail 2026-09-07** — B&W satellite filter, not road map |
| [`active/DSP-SCN-20260907-05-road-overlay.md`](./active/DSP-SCN-20260907-05-road-overlay.md) | SCN | **Human Pass 2026-09-07** — keep road + aerial; decide default later |
| [`active/DSP-SCN-20260907-02-hero-gltf.md`](./active/DSP-SCN-20260907-02-hero-gltf.md) | SCN | **Code-accept 2026-09-07** — three named proxies; Human Pass pending |
| [`active/DSP-SCN-20260908-03-hero-gltf-pack.md`](./active/DSP-SCN-20260908-03-hero-gltf-pack.md) | SCN | **Code-accept 2026-09-08** — Human Pass pending (street-scale smoke) |
| [`active/DSP-SCN-20260908-04-hero-buildings-panel.md`](./active/DSP-SCN-20260908-04-hero-buildings-panel.md) | SCN | **Code-accept 2026-09-08** — Human Pass pending |
| [`active/DSP-SCN-20260908-05-rumeli-mesh.md`](./active/DSP-SCN-20260908-05-rumeli-mesh.md) | SCN | **Code-accept 2026-09-08** — `hisar2.skp` mounted; Human Pass pending |

Do **not** start 02 in the same chat as 01. After 01+02 Human Pass → **BW** (`BOOTSTRAP_BW.md`). No SRT, no commercial video, no CesiumJS, no Google Photorealistic, no IBB, no MapTiler engine.

### Active 2026-09-02 (PRF — idle vs mouse)

| DSP | Owner | Status |
| --- | --- | --- |
| [`active/DSP-PRF-20260902-01-idle-vs-mouse-dump.md`](./active/DSP-PRF-20260902-01-idle-vs-mouse-dump.md) | PRF | **Open** — dump stamps session + preview/hitch/Send; no fake input; caps 30/30/30 tick 60 |

Playbook: `docs/architecture/performance-budgets.md` (idle vs mousedown A/B/C). Handoff in: `HO-BW-PRF-20260902-01`. Do not HO-PRF-OUT until dumps name a hog.

**OUT P0 bind-spy** [`done/DSP-OUT-20260902-05-ndi-pbo-bind-spy.md`](./done/DSP-OUT-20260902-05-ndi-pbo-bind-spy.md) — **human Pass 2026-09-02**. AR/3D Send live (3D 20–25 / AR 17–20 one-on; three-on 14/14/5). Preview all-off 60, one-on ~30, three-on ~11–12 (operator parked). No SYNC READBACK. Do **not** restore skip-forever or `fallToSync`.

**OUT P0 send-when-checked** [`done/DSP-OUT-20260902-04-ndi-send-when-checked.md`](./done/DSP-OUT-20260902-04-ndi-send-when-checked.md) — stub Pass; live **Fail** (AR/3D `live · no send`, OBS black, no banner). `__webglTexture` not on live Three objects. Do **not** restore skip-forever.

**OUT P0 hitch** [`done/DSP-OUT-20260902-03-ndi-hitch-skip-not-sync.md`](./done/DSP-OUT-20260902-03-ndi-hitch-skip-not-sync.md) — hitch/banner **Pass** (all-off >60, no SYNC READBACK; one-on preview ~37 / 2D >60). AR/3D send **Fail** (`live · no send`, OBS black). 2D Send ~10–11. Do **not** restore skip-forever.

**OUT P0 PBO** [`done/DSP-OUT-20260902-01-restore-ndi-pbo.md`](./done/DSP-OUT-20260902-01-restore-ndi-pbo.md) — code done 2026-09-02 (suite **1058 + 23**). Live **Fail** (banner latched; 1 NDI → preview 15–20). Do **not** clone.

### Active 2026-09-01 — Phase 19 SCN Wave B (chrome)

Design: [`../../architecture/phase19-senexus-qol.md`](../../architecture/phase19-senexus-qol.md). SCN memo: [`../memos/SCN_MEMO.md`](../memos/SCN_MEMO.md). Library **seeded** (`HO-PLT-SCN-20260902-01`).

**Wave B1 complete 2026-09-02.** Look-dev **04-08 Human Pass**. **19.2b Human Pass** (05-02). **19.17 Human Pass** (05-03). **BW gated 2026-09-05** (`HO-SCN-BW-20260905-01` accepted). Next orchestrator: **OUT** (`HO-BW-OUT-20260905-01`). GEO 19.18 parked. No MapTiler.

### Done 2026-09-05 (SCN — 19.17 lists first)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260905-03-project-switch-lists-first.md`](./done/DSP-SCN-20260905-03-project-switch-lists-first.md) | SCN | **Human Pass 2026-09-05** — 2D + lists before remount |

Handoff out: [`../handoffs/HO-SCN-BW-20260905-01.md`](../handoffs/HO-SCN-BW-20260905-01.md). In: [`../handoffs/HO-PLT-SCN-20260905-01.md`](../handoffs/HO-PLT-SCN-20260905-01.md).

### Done 2026-09-05 (SCN — 19.2b names / rounding)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260905-02-onair-2d-names-rounding.md`](./done/DSP-SCN-20260905-02-onair-2d-names-rounding.md) | SCN | **Human Pass 2026-09-05** — names; no marks/drones; S/F centered; buoy rounding; course scale |

Handoff: [`../handoffs/HO-SCN-PLT-20260905-01.md`](../handoffs/HO-SCN-PLT-20260905-01.md) — PLT **19.17** investigation first.

### Done 2026-09-05 (SCN — 19.2b 1080p + boat slider)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260905-01-onair-2d-1080-boat-scale.md`](./done/DSP-SCN-20260905-01-onair-2d-1080-boat-scale.md) | SCN | **Human Pass (local) 2026-09-05** — 1920×1080; Boat size 0.5. Follow-up 05-02 |

### Done 2026-09-04 (SCN — 19.2b declutter)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-10-onair-2d-declutter.md`](./done/DSP-SCN-20260904-10-onair-2d-declutter.md) | SCN | **Fail 2026-09-05** — boats still collide; 960×540 soft. Follow-up 05-01 |

### Done 2026-09-04 (SCN — 19.2b on-air 2D)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-09-onair-2d-chrome.md`](./done/DSP-SCN-20260904-09-onair-2d-chrome.md) | SCN | **Fail 2026-09-04** — 960 px card; colliding chain/boat pills. Follow-up 04-10 |

### Done 2026-09-04 (SCN — glyph crop + sea zoom)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-08-glyph-crop-sea-zoom.md`](./done/DSP-SCN-20260904-08-glyph-crop-sea-zoom.md) | SCN | **Human Pass 2026-09-04** — glyph crop; A–B canvas; sea 1/9; no fragment flatten |

### Done 2026-09-04 (SCN — fog off + deep water)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-07-fog-off-deep-water.md`](./done/DSP-SCN-20260904-07-fog-off-deep-water.md) | SCN | **Fail 2026-09-04** — rectangles remain; heightM grows north of GPS canvas. Follow-up 04-08 |

### Done 2026-09-04 (SCN — logo alpha + sea reads)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-06-logo-alpha-sea-reads.md`](./done/DSP-SCN-20260904-06-logo-alpha-sea-reads.md) | SCN | **Fail 2026-09-04** — fog on transparent boards; sea too bright. Follow-up 04-07 |

### Done 2026-09-04 (SCN — logo knockout + teal sea)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-05-logo-knockout-sea-teal.md`](./done/DSP-SCN-20260904-05-logo-knockout-sea-teal.md) | SCN | **Fail 2026-09-04** — luma key missed white-RGB a=0; sea hex too small under grey fog. Follow-up 04-06 |

### Done 2026-09-04 (SCN — sea plates + soft light)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-04-sea-plates-soft-light.md`](./done/DSP-SCN-20260904-04-sea-plates-soft-light.md) | SCN | **Fail 2026-09-04** — fill skipped; PNG black backs remain. Follow-up 04-05 |

### Done 2026-09-04 (SCN — sea look unify)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-03-sea-look-unify.md`](./done/DSP-SCN-20260904-03-sea-look-unify.md) | SCN | **Human Pass 2026-09-04** — notes → 04-04 (crests, plates, light cutoff) |

### Done 2026-09-04 (SCN — flat sea 2D motion)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-02-flat-sea-2d-motion.md`](./done/DSP-SCN-20260904-02-flat-sea-2d-motion.md) | SCN | **Partial Pass 2026-09-04** — fragment motion OK; sun vs matte + gust curtains → 04-03 |

### Done 2026-09-04 (SCN — 19.15 Fail follow-up)

| DSP | Owner | Status |
| --- | --- | --- |
| [`done/DSP-SCN-20260904-01-flat-sea-alt-level.md`](./done/DSP-SCN-20260904-01-flat-sea-alt-level.md) | SCN | **Human Pass 2026-09-04** — assets / sea m / Alt. Look-dev → 04-02 |

Handoff: [`../handoffs/HO-PLT-SCN-20260902-01-library-seeded.md`](../handoffs/HO-PLT-SCN-20260902-01-library-seeded.md).

**Wave B1 done:**

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-SCN-20260829-03-remove-pip-minimap.md`](./done/DSP-SCN-20260829-03-remove-pip-minimap.md) | SCN | ★ **19.2** PiP gone; `.local-2d-map-host`; 960×540 16:9 |
| [`done/DSP-SCN-20260901-03-start-finish-scale.md`](./done/DSP-SCN-20260901-03-start-finish-scale.md) | SCN | ★ **19.10** Start+finish band 24 m / default span 100 m |
| [`done/DSP-SCN-20260901-01-world-authoring-toggle.md`](./done/DSP-SCN-20260901-01-world-authoring-toggle.md) | SCN | ★ **19.6** Header World chip; no overlay Close |
| [`done/DSP-SCN-20260901-02-save-load-status.md`](./done/DSP-SCN-20260901-02-save-load-status.md) | SCN | ★ **19.9** loading/loaded · saving/saved under Project |
| [`done/DSP-SCN-20260902-01-explicit-race-load.md`](./done/DSP-SCN-20260902-01-explicit-race-load.md) | SCN | ★ Pick copies id only; **Load** / Enter = full `switchRace` |
| [`done/DSP-SCN-20260902-02-pack-features-replace-world.md`](./done/DSP-SCN-20260902-02-pack-features-replace-world.md) | SCN | ★ **P0** `features: []` complete world; dispose leftover 3D chains |
| [`done/DSP-SCN-20260902-03-billboard-library-picker.md`](./done/DSP-SCN-20260902-03-billboard-library-picker.md) | SCN | ★ **19.11** library picker; chain `#2A6FA6`; AABAB weights; vertical height |
| [`done/DSP-SCN-20260902-04-authoring-inspector-place.md`](./done/DSP-SCN-20260902-04-authoring-inspector-place.md) | SCN | ★ **19.7** inspector + coord Add + instant Assets |
| [`done/DSP-SCN-20260902-05-hidden-boat-keeps-tag.md`](./done/DSP-SCN-20260902-05-hidden-boat-keeps-tag.md) | SCN | ★ **19.8** hidden = hull off, tag on; clone hull materials per boat |
| [`done/DSP-SCN-20260902-06-osm-zoom-coverage.md`](./done/DSP-SCN-20260902-06-osm-zoom-coverage.md) | SCN | ★ **19.12** OSM pad + coarsen z + previous-z underlay; stream still no OSM |
| [`done/DSP-SCN-20260903-01-ar-3d-white-after-load.md`](./done/DSP-SCN-20260903-01-ar-3d-white-after-load.md) | SCN | ★ **P0** Load white = VRAM OOM from ~1550 chain canvases; ribbon remount + contextlost gate |
| [`done/DSP-SCN-20260903-02-billboard-chain-ribbon.md`](./done/DSP-SCN-20260903-02-billboard-chain-ribbon.md) | SCN | ★ **19.11b** continuous abutting ribbon; `spacingM` = logo pitch; frameless plate |
| [`done/DSP-SCN-20260903-03-boat-foam-wakes.md`](./done/DSP-SCN-20260903-03-boat-foam-wakes.md) | SCN | ★ **19.13** per-hull foam strip 8–12 m @ y≈0.05; hidden skips; not Gerstner |
| [`done/DSP-SCN-20260903-04-boat-alt-and-water-discard.md`](./done/DSP-SCN-20260903-04-boat-alt-and-water-discard.md) | SCN | ★ **P0** hull ENU y from Alt MSL; water m **−20…+5**; heightM uniform scale |
| [`done/DSP-SCN-20260903-05-sponsor-logo-plate-alpha.md`](./done/DSP-SCN-20260903-05-sponsor-logo-plate-alpha.md) | SCN | ★ **P1** sponsor Library logo (not name); `panelAlpha`; A–B uniform `boardAspect` |
| [`done/DSP-SCN-20260903-06-buoy-mesh-tag-visibility.md`](./done/DSP-SCN-20260903-06-buoy-mesh-tag-visibility.md) | SCN | ★ **P1** buoy `visibleBuoyMesh` / `visibleTag`; full hide stays `visible3d` |
| [`done/DSP-SCN-20260903-07-sea-over-assets.md`](./done/DSP-SCN-20260903-07-sea-over-assets.md) | SCN | ★ **19.15** flatten+discard holes — **human Fail 2026-09-04**. Follow-up `done/DSP-SCN-20260904-01` |
| [`done/DSP-SCN-20260904-01-flat-sea-alt-level.md`](./done/DSP-SCN-20260904-01-flat-sea-alt-level.md) | SCN | ★ **P0** flat sea + sea m + GEO alt Y — **human Pass 2026-09-04** (assets). Look-dev follow-up `DSP-SCN-20260904-02` |
| [`done/DSP-SCN-20260904-02-flat-sea-2d-motion.md`](./done/DSP-SCN-20260904-02-flat-sea-2d-motion.md) | SCN | ★ **P0** fragment Gerstner N/foam — **partial Pass 2026-09-04**. Look unify `DSP-SCN-20260904-03` |
| [`done/DSP-SCN-20260904-03-sea-look-unify.md`](./done/DSP-SCN-20260904-03-sea-look-unify.md) | SCN | ★ **P1** look unify — **human Pass 2026-09-04** with notes. Follow-up `DSP-SCN-20260904-04` |
| [`done/DSP-SCN-20260904-04-sea-plates-soft-light.md`](./done/DSP-SCN-20260904-04-sea-plates-soft-light.md) | SCN | ★ **P1** darker crests; skip fill — **human Fail 2026-09-04** (PNG black backs). Follow-up `DSP-SCN-20260904-05` |
| [`done/DSP-SCN-20260904-05-logo-knockout-sea-teal.md`](./done/DSP-SCN-20260904-05-logo-knockout-sea-teal.md) | SCN | ★ **P0** luma-key PNG black — **human Fail 2026-09-04** (white-RGB a=0 + mips). Follow-up `DSP-SCN-20260904-06` |
| [`done/DSP-SCN-20260904-06-logo-alpha-sea-reads.md`](./done/DSP-SCN-20260904-06-logo-alpha-sea-reads.md) | SCN | ★ **P0** zero RGB on a=0; no mips — **human Fail 2026-09-04** (fog plates + bright cyan). Follow-up `DSP-SCN-20260904-07` |
| [`done/DSP-SCN-20260904-07-fog-off-deep-water.md`](./done/DSP-SCN-20260904-07-fog-off-deep-water.md) | SCN | ★ **P0** `fog: false` on water boards; dark deep `0x0c2f3a` / `0x164a55` — **code done 2026-09-04**, pending operator smoke |

### Done 2026-08-27 (PRF measurement)

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-PRF-20260826-01-measure-gpu-hitch.md`](./done/DSP-PRF-20260826-01-measure-gpu-hitch.md) | PRF | GPU HUD + hitch/s + live NDI Send fps; `powerPreference: high-performance`; **no cap change**. Electron smoke not run. |

PRF accepted 2026-08-27 (`npm test` **869 + 23**). Operator 2026-08-28: HUD matches then-caps. **Studio 60 cancelled.** Lock is three NDI senders at 30.

### Active 2026-08-29 — Phase 18 (operator notes)

Roadmap: [`../../roadmap/phases-roadmap.md`](../../roadmap/phases-roadmap.md) → Phase 18. Root causes traced and operator locks recorded in `BW_MEMO` (2026-08-29). **Ten dispatches issued; wave 1 accepted 2026-08-29.** Each is one worker chat.

Everything inside a wave has **disjoint file ownership and runs in parallel**. Waves are sequential.

**Wave 1 — accepted 2026-08-29.** BW verified merged tree: `npm test` **950 + 23**, `npm run build` green.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260829-01-ndi-color-space.md`](./done/DSP-OUT-20260829-01-ndi-color-space.md) | OUT | ★ `applyNdiCaptureColorSpace` pins AR/3D FBOs `SRGBColorSpace` on create **and** resize; `createScene` pins `renderer.outputColorSpace`. 2D untouched (already canvas sRGB). Alpha not rewritten. **OBS smoke accepted 2026-08-29** — operator: match is fine, slightly more saturated/bright, no follow-up. |
| [`done/DSP-SCN-20260829-01-project-fleet-fidelity.md`](./done/DSP-SCN-20260829-01-project-fleet-fidelity.md) | SCN | ★ `boats` present (incl. `[]`) is the complete fleet; never `DEFAULT_BOAT_IDS`. Out-of-band ids round-trip; loaded pack beats stale session. `loadConfig.normalizeBoatIds` untouched for config/mock. |
| [`done/DSP-SCN-20260829-02-sponsor-flat-on-sea.md`](./done/DSP-SCN-20260829-02-sponsor-flat-on-sea.md) | SCN | Sponsors flat on water via shared `applyFlatOnWaterPlacement` (`y = 0.08`, polygon offset −4); `billboardChain` → `createUprightSponsorBillboard`. `heightM` is now across-water depth. |
| [`done/DSP-TEL-20260829-01-telemetry-disconnect.md`](./done/DSP-TEL-20260829-01-telemetry-disconnect.md) | TEL | `disconnectLive()` + `intentionalStop` + generation bump; only Connect / Reconnect reopen. Uncheck Live closes that id now. SRT half left structurally alone for SRT-01. |

**Wave-1 note for future waves:** SCN-02 reported a "pre-existing TEL flake" in `live.test.ts` (`retrying` vs `closed`). BW re-ran that file **six times at HEAD: 22/22 every run**. It is deterministic (fake timers + `ManualWebSocket`). That report was a mid-merge artefact, not a flake and not pre-existing — the same pattern as OUT-07 in Phase 17 wave 2. **Do not chase it.**

**Human smoke 2026-08-29:** OBS colour **accepted** (slightly bright/saturated, no work). Telemetry + SRT Connect/Disconnect **accepted**. Sponsor flat-on-sea still open (not re-checked this session). FPS still failed — that is the dump below, not a wave-1 miss.

**Wave 2 — accepted 2026-08-29.** BW verified merged tree: `npm test` **982 + 23**, `npm run build` green. The `src/main.ts` region locks **held** — all hunks fall inside their owners' ranges.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-PRF-20260829-01-ndi-stage-timing.md`](./done/DSP-PRF-20260829-01-ndi-stage-timing.md) | PRF | ★ Instrument landed; **operator dump received 2026-08-29**. Send AR **15** / 3D **15** / 2D **3**. Clock ~50 Hz (495 ticks / 10 s, mean 20.2 ms, max 109.5). Walls: `*EnqueueIpc` 17–23 ms, `2dGrab` 120–193 ms. `rgbaToBgra` 7 ms with `dropBusy=0`. Phase-lock drowned in a mixed `captureTicks` smear. |
| [`done/DSP-TEL-20260829-02-flow-live-assets.md`](./done/DSP-TEL-20260829-02-flow-live-assets.md) | TEL (+SCN file) | Registry ids always carded (incl. deliberately-disconnected); non-registry ids only within `FLOW_CARD_RECENCY_MS = 5000`. `buildFlowCards(snapshot, registry, nowMs)` is pure. `flowTap.remove` / `retain`; prune on allow-list rebuild + project load. |
| [`done/DSP-SRT-20260829-01-srt-disconnect.md`](./done/DSP-SRT-20260829-01-srt-disconnect.md) | SRT | Disconnect SRT: generation hold + `explicitlyDisconnected`; `srtReopenAllowed` consulted by the stall watchdog **and** `beginFfmpegH264Fallback`. Deliberate disconnect → **colour bars**, not the frozen last frame. `beforeunload` → `close('all')`. `open failed` logs povId only. |

**Region locks worked — keep doing this.** Three workers edited `src/main.ts` in parallel with zero conflicts. The only cross-boundary edit was PRF-01 adding `?.` to `fleetPanel?.setSrtStatus` on a line SRT-01 had just created, to satisfy `tsc`. BW checked it: `pushSrtPanelStatus()` already early-returns when the panel is null, so the `?.` is redundant-but-correct and hides nothing.

### Wave 3 — accepted 2026-08-30 (code). Live after-dump still open.

BW verified merged tree: `npm test` **1007 + 23**, `npm run build` green. Mid-wave red reports were merge artefacts.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260829-02-zero-copy-ndi-frames.md`](./done/DSP-OUT-20260829-02-zero-copy-ndi-frames.md) | OUT + PLT | ★ `grandi.FourCC` has **RGBA/RGBX**. Hot path native RGBA + `Buffer.copy`. Pool of 3, keep-newest. Rate 30/1. **Negative stride rejected** — AR/3D inverted until `-02` flip. |
| [`done/DSP-OUT-20260829-04-independent-channel-clocks.md`](./done/DSP-OUT-20260829-04-independent-channel-clocks.md) | OUT | ★ Phase gate ~32 nominal; PBO stagger retired; `canBegin()` before render; `sendFrame` via `setTimeout(0)`; slice replaced by stolen pixel ring. |
| [`done/DSP-OUT-20260830-01-2d-native-grab.md`](./done/DSP-OUT-20260830-01-2d-native-grab.md) | OUT | ★ Native-size `getImageData(srcW,srcH)` + `blitRgbaLetterbox` into pooled 1080p. Output still 1920×1080. |

**Cancelled:** [`done/DSP-OUT-20260829-05-gpu-swizzle.md`](./done/DSP-OUT-20260829-05-gpu-swizzle.md) — RGBA exists; nothing to swizzle.

**Known air regression:** AR/3D upside-down until [`done/DSP-OUT-20260830-02-ndi-capture-flip.md`](./done/DSP-OUT-20260830-02-ndi-capture-flip.md) — **accepted 2026-08-30** (GPU `blitFramebuffer` inverted dest Y before PBO). Human OBS smoke still open.

**Wave 4:**

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-OUT-20260829-05-gpu-swizzle.md`](./done/DSP-OUT-20260829-05-gpu-swizzle.md) | OUT | ★ **Cancelled** — `grandi` has RGBA |
| [`done/DSP-OUT-20260830-02-ndi-capture-flip.md`](./done/DSP-OUT-20260830-02-ndi-capture-flip.md) | OUT | ★ GPU Y-flip via `blitFramebuffer` inverted dest Y **before** PBO; `bottomUp: false`. 2D untouched. Suite **1014 + 23**. OBS smoke open. |
| [`active/DSP-OUT-20260829-03-remove-timecode-ui.md`](./active/DSP-OUT-20260829-03-remove-timecode-ui.md) | OUT | Timecode/qlock out of the picture; code kept (Phase **19.1**) |
| [`done/DSP-SCN-20260829-03-remove-pip-minimap.md`](./done/DSP-SCN-20260829-03-remove-pip-minimap.md) | SCN | ★ **19.2** — see Wave B table above |

**Cancelled:** portrait 1080×1920 for the 2D map — operator correction, 2D stays 1920×1080. The 2D UI redesign waits for the operator's next-iteration details.

### Pulled 2026-08-29 (no DSP) — HEVC WebCodecs copy-decode

`1a4e0ae` `fix(srt): unescape HEVC SPS so WebCodecs can copy-decode DJI`. EPB `0x000003` was leaking into `hev1.*` → transcode. `unescapeRbsp` in `tsDemux.ts`. ffmpeg `-c copy` + WebCodecs HEVC is the intended live path again; H.264 fallback stays for real stalls.

**Human:** Race ops `codec=hevc`, no `ffmpeg→h264`. Sync `PTS → NTP` still TEL-04.

### Done 2026-08-28 night (SRT NTP alias + frame fit)

### Done 2026-08-28 night (SRT NTP alias + frame fit)

BW verified merged tree: `npm test` **912 + 23**.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260828-04-anchor-id-frame-fit.md`](./done/DSP-TEL-20260828-04-anchor-id-frame-fit.md) | TEL | `dji-N` → digit LUT; `kind:frame` OLS when pacing &lt; 2; extra still 2 s |

Handoff: `HO-BW-TEL-20260828-04-done`.

### Done 2026-08-28 night (match-miss: do not freeze)

BW verified merged tree: `npm test` **910 + 23**.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260828-03-match-miss-freerun.md`](./done/DSP-TEL-20260828-03-match-miss-freerun.md) | TEL | LUT miss → free-run; `unavailable` past hold → newest; no `emitHeld` |
| [`done/DSP-OUT-20260828-08-lut-miss-play-newest.md`](./done/DSP-OUT-20260828-08-lut-miss-play-newest.md) | OUT | Empty LUT → newest frame `lut-miss-live`; stall-pin only with working LUT |

**Human smoke:** AR bg **video**. World and SRT picture should move even if Sync says FREE-RUN / PTS unmapped. When PTS maps, overlay should follow the picture (`matched`). Alpha workaround no longer required.

### Done 2026-08-28 night (2D off FBO stack)

BW verified merged tree: `npm test` **909 + 23**.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260828-07-2d-off-fbo-stack.md`](./done/DSP-OUT-20260828-07-2d-off-fbo-stack.md) | OUT | 2D deferred `setTimeout(0)`; worker + transferable grab; fail closed + `NDI_2D_SYNC_CAPTURE_NOTE`; still on@30 |

**Human smoke (open):** 2D **on**. Preview ≥30, hitch/s ~0, Send ~30/30/30. No `NDI 2D capture: async worker unavailable` in the console. Then Sync: presented vs last pacing on the same ruler; extra not ~34 s.

### Done 2026-08-28 night (stagger + PTS + keep-PTS)

BW verified merged tree: `npm test` **900 + 23**.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260828-04-one-ndi-fbo-per-tick.md`](./done/DSP-OUT-20260828-04-one-ndi-fbo-per-tick.md) | OUT | Tick 60; one FBO/tick including PBO; 2D stayed on |
| [`done/DSP-OUT-20260828-05-pts-transcode-lut.md`](./done/DSP-OUT-20260828-05-pts-transcode-lut.md) | OUT | `presentedPts90k` = 33-bit PES; LUT reset on H.264 fallback; Sync last pacing |
| [`done/DSP-SRT-20260828-01-h264-keep-pts.md`](./done/DSP-SRT-20260828-01-h264-keep-pts.md) | SRT | Transcode `-copytb 1` + `-enc_time_base 1:90000`; copy path unchanged |
| [`done/DSP-OUT-20260828-06-async-2d-ndi.md`](./done/DSP-OUT-20260828-06-async-2d-ndi.md) | OUT | **Superseded** by OUT-07 (never started) |

### Done 2026-08-28 evening (AR match)

BW verified merged tree: `npm test` **896 + 23**, `npm run build` green. **No active worker DSP.**

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260828-02-match-no-vanish.md`](./done/DSP-TEL-20260828-02-match-no-vanish.md) | TEL | Re-emit lastMatched on unavailable; Pose Δ / pacing; no lerp-to-newest |
| [`done/DSP-OUT-20260828-03-present-wait-lut.md`](./done/DSP-OUT-20260828-03-present-wait-lut.md) | OUT | PTS ±32 µs or null; LUT miss stall-pin 400 ms, not live-newest |

**Human smoke (open):** Sync `pacing` / PTS→NTP / Δ; overlay stays when video ahead of pose. Handoffs: `HO-BW-OUT-20260828-03` · `HO-BW-TEL-20260828-02`

### Done 2026-08-28 (Studio 30 + pose smoothing)

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260828-01-pose-smoothing.md`](./done/DSP-TEL-20260828-01-pose-smoothing.md) | TEL | Cubic Hermite + xyzw slerp in `sampleAt`; matched `t_ntp`; alpha lerp not stacked |
| [`done/DSP-OUT-20260828-01-async-ndi-pbo.md`](./done/DSP-OUT-20260828-01-async-ndi-pbo.md) | OUT | WebGL2 PBO + fence; 1-tick latency; fail closed to sync; 2D left sync |
| [`done/DSP-OUT-20260828-02-ndi-30-all-channels.md`](./done/DSP-OUT-20260828-02-ndi-30-all-channels.md) | OUT | AR/3D/2D **30**, 2D default on; async same-tick; `STUDIO_TICK_FPS` 30 |

**Human smoke (open):** Electron Send ~30/30/30 + hitch/s ~0. Handoffs: `HO-BW-OUT-20260828-02` · `HO-BW-TEL-20260828-01` · `HO-BW-PRF-20260828-05` · `HO-BW-PRF-20260828-06` · `HO-PRF-BW-20260828-03` (Studio 60 request; **void**)

### Phase 17.4 accepted 2026-08-27 (matched hold + Flow panel)

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260826-10-matched-hold.md`](./done/DSP-TEL-20260826-10-matched-hold.md) | TEL | No silent free-run while video clock; LUT alias; GPS-optional drones; `flowTap` |
| [`done/DSP-SCN-20260826-10-telem-srt-flow-panel.md`](./done/DSP-SCN-20260826-10-telem-srt-flow-panel.md) | SCN | Right-rail Flow JSON windows; Live JSON ≤4 Hz; DOM only |

BW verified merged tree: `npm test` **856 + 23**. Human smoke: overlay vs picture + Flow `anchor` / `ts` still open.

### Active 2026-08-26 (Phase 17 — AR video underlay + NTP match)

Design: [`../../architecture/ar-video-underlay-ntp-sync.md`](../../architecture/ar-video-underlay-ntp-sync.md) (locked). Source contracts: [`../../architecture/ntp-matching.md`](../../architecture/ntp-matching.md).

Drone **SRT video becomes the AR background** (replacing the alpha plate as a *mode*, not a replacement), video source switches with POV, and the scene renders at the **video frame's NTP capture time** via `stream_anchor` PTS→NTP instead of at wall-clock now.

**Wave 1 — accepted 2026-08-26.** BW verified merged tree: `npm test` **741 + 23**, `npm run build` green.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260826-01-pts-ntp-map.md`](./done/DSP-TEL-20260826-01-pts-ntp-map.md) | TEL | 30 s OLS fit; live extrapolate ≤2 s; wrap = mod `2^33` |
| [`done/DSP-TEL-20260826-02-telemetry-history.md`](./done/DSP-TEL-20260826-02-telemetry-history.md) | TEL | `sampleAt`; `brg === 0` hold; NED vel at this boundary |
| [`done/DSP-OUT-20260826-03-srt-transport.md`](./done/DSP-OUT-20260826-03-srt-transport.md) | OUT | ffmpeg `-c copy` caller; cap 4; PTS copyts |
| [`done/DSP-OUT-20260826-04-video-background.md`](./done/DSP-OUT-20260826-04-video-background.md) | OUT | In-WebGL pre-pass; `arBackground` mode; 3D FBO suppressed |
| [`done/DSP-CAL-20260826-05-sync-trim.md`](./done/DSP-CAL-20260826-05-sync-trim.md) | CAL | `syncTrimMs` ±500 step 5; stored only until TEL-08 |

**Wave 2 — accepted 2026-08-26.** BW verified merged tree: `npm test` **795 + 23**, `npm run build` green. OUT-07's mid-wave `tsc` on `videoDecodePipeline.ts` is gone in HEAD.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260826-06-ts-demux-decode.md`](./done/DSP-OUT-20260826-06-ts-demux-decode.md) | OUT | In-repo TS demux + WebCodecs + 4-warm manager; PTS unwrap = TEL-01; HEVC probe-gated. Live picture **not smoked**. |
| [`done/DSP-OUT-20260826-07-srt-config-sync-hud.md`](./done/DSP-OUT-20260826-07-srt-config-sync-hud.md) | OUT | `{srtId}` template ≠ telem id; Vid independent of Live WS; token session-only; L8 video→env off; DOM sync HUD |

**Wave 3 — accepted 2026-08-26.** BW verified merged tree: `npm test` **808 + 23**, `npm run build` green.

| DSP | Owner | Result |
| --- | --- | --- |
| [`done/DSP-TEL-20260826-08-matched-pose-cutover.md`](./done/DSP-TEL-20260826-08-matched-pose-cutover.md) | TEL+SCN | Matched pull path on `arBackground: video` + healthy LUT; alpha stays push+lerp; LUT = SRT id; `syncTrimMs` applied. Live SRT smoke still human. |

**Phase 17 follow-up — accepted 2026-08-26.** [`done/DSP-OUT-20260826-09-srt-id-catalog.md`](./done/DSP-OUT-20260826-09-srt-id-catalog.md) — empty template → catalog cams 1–27 @ `127.0.0.1:9000` (placeholder tokens); filled `{srtId}` template still the escape hatch. Suite **818 + 23**.

**Phase 17 engineering complete.** Open: live SRT + clapper (`syncTrimMs` number), FOV/distortion (C6), mock anchors keyed by `povIds[0]` not SRT id. Electron SRT logs may still print `streamid` tokens (`desktop/srtHelpers.cjs`).

**User locks:** alpha stays as a mode · **DJI only, no GoPro** · SRT **caller** · adaptive latency clamped 100–400 ms · **4** warm POVs · H.264 **and** HEVC · per-AU frame anchors unconfirmed, so the ~1 Hz periodic fit is the primary path.

Human **10.1** (Unity cutover) still open. Phase 16 human look-dev smoke still open.

### Accepted 2026-08-18 pm (Phase 16)

Phase 16 engineering complete (waves 1 + 2 accepted). Open: human look-dev smoke; optional glTF sailboat; sponsor colour pickers.

### Accepted 2026-08-18 pm (Phase 16 wave 2)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260818-09-ops-layout.md`](./done/DSP-SCN-20260818-09-ops-layout.md) | Two overlay rails (`railLayout.ts`): left = Project/Fleet/Assets/World/Library/Race ops; right = Output/Calibration/Environment/Wind. Widths + collapse + accordion persist; Environment **water m** → `setTerrainWaterDiscardYM`. Suite 654+23. |

### Accepted 2026-08-18 pm (Phase 16 wave 1)

Design: `docs/architecture/phase16-visual-upgrade.md`. Merged tree `npm test` **640 + 23**, `npm run build` green.

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260818-04-ocean-shimmer-terrain-water.md`](./done/DSP-SCN-20260818-04-ocean-shimmer-terrain-water.md) | 256² mip noise + `fwidth` + 80–900 m fade; world-XZ masks; `liftY` 0.08. Terrain water **discarded via quantized-mesh watermask** (height fallback +0.5 m); gated on realistic ocean. |
| [`done/DSP-SCN-20260818-05-wind-strings.md`](./done/DSP-SCN-20260818-05-wind-strings.md) | `windStrings.ts` — 180 additive ribbons, 800 m disc, 4–10 m AGL, from-000° → +Z, fade &lt;0.5 m/s; ~0.075 ms/tick; AR-safe via realistic-env gate. |
| [`done/DSP-SCN-20260818-06-sailboat-category-colors.md`](./done/DSP-SCN-20260818-06-sailboat-category-colors.md) | Procedural sailboat (hull/deck/keel/mast/boom/main+jib, `sail`/`mastTop`); 10-swatch palette on fleet rows; tag leader line; additive `fleet.boats[].color`. |
| [`done/DSP-SCN-20260818-07-billboard-frames.md`](./done/DSP-SCN-20260818-07-billboard-frames.md) | Sponsor/chain panels are composed boards (`#f4f4f2` fill, `#2c3338` frame, contain-fit logo); additive `panelColor` / `frameColor`. |
| [`done/DSP-SCN-20260818-08-rounding-universal.md`](./done/DSP-SCN-20260818-08-rounding-universal.md) | Omit = **CW**; explicit `none` hides; ~8–9 m white torus + red heads; only CCW/Off persist. |

### Phase 15 accepted 2026-08-18

Phase 15 engineering accepted 2026-08-18. Human Electron smoke partially done (found the Phase 16 items above).

### Accepted 2026-08-18 (Phase 15)

| DSP | Result |
| --- | --- |
| [`done/DSP-OUT-20260818-01-preview-60.md`](./done/DSP-OUT-20260818-01-preview-60.md) | Dual clock: rAF preview when visible; `studio:tick` ~30 for NDI + hidden. AR FBO on studio tick. Caps AR 30 / 3D 10 / 2D off. Ops **preview** fps. |
| [`done/DSP-SCN-20260818-01-ocean-seams-cost-wind.md`](./done/DSP-SCN-20260818-01-ocean-seams-cost-wind.md) | Clipmap 1-cell overlap; glitter 0.16/78; inner 32 / 7 rings; `seaQuality`; 14.3f lite vane + stronger streaks. |
| [`done/DSP-SCN-20260818-02-buoy-rounding-arrows.md`](./done/DSP-SCN-20260818-02-buoy-rounding-arrows.md) | Per-feature `rounding` CW/CCW two-arrow ring; 5 s/rev; Istanbul corners default CW. |
| [`done/DSP-SCN-20260818-03-fleet-persist-static-hulls.md`](./done/DSP-SCN-20260818-03-fleet-persist-static-hulls.md) | `fleet.boats[]` persist; static hulls without telem; Load no longer dumps demo catalogue. |

`npm test` **600 + 23** green; `npm run build` green.

### Active 2026-08-17 (Phase 14)

Phase 14 engineering is complete (14.3c anemometer **cancelled 2026-09-05** — Open-Meteo only). 14.3f lite landed in 15.2.

### Accepted 2026-08-17 (Phase 14.3e)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-06-wind-streaks.md`](./done/DSP-SCN-20260817-06-wind-streaks.md) | Gerstner fragment gust mask; from-000° +Z; fade at ~0 m/s; no extra FBO |

### Accepted 2026-08-17 (Phase 14.2c + 14.3d)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-04-shore-foam.md`](./done/DSP-SCN-20260817-04-shore-foam.md) | Half-res terrain depth FBO; shore foam/shallow tint; no readPixels |
| [`done/DSP-SCN-20260817-05-map-wind-readout.md`](./done/DSP-SCN-20260817-05-map-wind-readout.md) | Ops + stream wind pills; travel arrow; from-000° screen-down |

### Accepted 2026-08-17 (Phase 14.2b + 14.3b)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-03-wind-coupled-ocean.md`](./done/DSP-SCN-20260817-03-wind-coupled-ocean.md) | Gerstner follows `windBus`; 3 s ramp; from-000° → +Z |
| [`done/DSP-TEL-20260817-02-open-meteo-wind.md`](./done/DSP-TEL-20260817-02-open-meteo-wind.md) | Open-Meteo poll ~10 min; operator hold 30 min; marine optional |

### Accepted 2026-08-17 (Phase 14.1 / 14.2a / 14.3a)

| DSP | Result |
| --- | --- |
| [`done/DSP-SCN-20260817-01-cesium-ion-terrain.md`](./done/DSP-SCN-20260817-01-cesium-ion-terrain.md) | ion World Terrain + Bing drape; default off; DOM credits 3D-only |
| [`done/DSP-SCN-20260817-02-gerstner-ocean.md`](./done/DSP-SCN-20260817-02-gerstner-ocean.md) | Gerstner clipmap; shared-clock; `waterCue` hidden when realistic |
| [`done/DSP-TEL-20260817-01-wind-bus.md`](./done/DSP-TEL-20260817-01-wind-bus.md) | `windBus` + `windTravelSceneXZ` (from-N → +Z) + Ops row |

### Accepted 2026-08-17 (Phase 14.0)

| DSP | Result |
| --- | --- |
| [`done/DSP-GEO-20260817-01-enu-handedness-fix.md`](./done/DSP-GEO-20260817-01-enu-handedness-fix.md) | Scene ENU `x=East, y=Up, z=−North`; `East × North = +Y` |

Human **10.1** (Unity cutover) still open.

### Active 2026-08-12 (follow-ups) — closed

Soft: if Electron UI still janks after OUT-06, default **3D NDI off**.
Human smokes recommended (FPS, place/delete boats, Project Save).

### Accepted 2026-08-12 (follow-up trio)

| DSP | Result |
| --- | --- |
| [`done/DSP-OUT-20260812-06-ndi-capture-perf.md`](./done/DSP-OUT-20260812-06-ndi-capture-perf.md) | AR 30 / 3D 10 / 2D off@10; AR↔3D stagger |
| [`done/DSP-SCN-20260812-03-fleet-map-pose-sync.md`](./done/DSP-SCN-20260812-03-fleet-map-pose-sync.md) | Delete clears map icons; place seeds without telem |
| [`done/DSP-PLT-20260812-02-electron-project-save-ux.md`](./done/DSP-PLT-20260812-02-electron-project-save-ux.md) | Electron Save→folder; name + Load dropdown |

`npm test` **476 + 23** green at accept.

### Accepted 2026-08-12 (Phase 13 wave 3)

| DSP | Phase | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260812-04-local-channel-switcher.md`](./done/DSP-OUT-20260812-04-local-channel-switcher.md) | 13.5 | Local 2D/3D/AR switcher; never stops NDI |
| [`done/DSP-OUT-20260812-05-ndi-delay-buffer.md`](./done/DSP-OUT-20260812-05-ndi-delay-buffer.md) | 13.6 | Per-channel delay; default 0; max 30000; warn &gt;3s |

`npm test` **461 + 23** green at accept.

### Accepted 2026-08-12 (Phase 13 wave 2)

| DSP | Phase | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260812-02-3d-ndi-channel-pump.md`](./done/DSP-OUT-20260812-02-3d-ndi-channel-pump.md) | 13.3 | Continuous `broadcast-web-3d`; opaque+env pass; AR restore |
| [`done/DSP-OUT-20260812-03-2d-map-ndi-pump.md`](./done/DSP-OUT-20260812-03-2d-map-ndi-pump.md) | 13.4 | `broadcast-web-2d`; letterbox 1920×1080; stub flag **true** |
| [`done/DSP-SCN-20260812-02-ar-calib-coordinate-overlay.md`](./done/DSP-SCN-20260812-02-ar-calib-coordinate-overlay.md) | 13.7 | ENU grid/marks overlay; Calib checkbox; ops doc |

`npm test` **439 + 23** green at accept. Human vMix: confirm all three sources (`broadcast-web`,
`-3d`, `-2d`).

### Accepted 2026-08-12 (Phase 13 wave 1)

| DSP | Phase | Result |
| --- | --- | --- |
| [`done/DSP-OUT-20260812-01-multi-sender-ndi-bridge.md`](./done/DSP-OUT-20260812-01-multi-sender-ndi-bridge.md) | 13.1 | Multi-sender `ar`/`3d`/`2d`; AR name still `broadcast-web` |
| [`done/DSP-SCN-20260812-01-sea-sky-environment.md`](./done/DSP-SCN-20260812-01-sea-sky-environment.md) | 13.2 | Water+Sky; forced off for transparent/chroma |
| [`done/DSP-PLT-20260812-01-electron-local-races-save.md`](./done/DSP-PLT-20260812-01-electron-local-races-save.md) | 13.8 | `races:*` IPC; public vs userData roots |

`npm test` **418 + 23** green at wave-1 accept (suite now **439 + 23** after wave 2). Human Electron
checklists (Save folder + vMix) still recommended.

### Accepted 2026-08-11 (Phase 11 follow-up — authoring + chrome)

Design: [`../../architecture/world-authoring-workspace.md`](../../architecture/world-authoring-workspace.md)

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-04-world-authoring-workspace.md`](./done/DSP-SCN-20260811-04-world-authoring-workspace.md) | SCN | Dedicated World Authoring window | **Accepted** |
| [`done/DSP-OUT-20260811-02-output-mode-into-sidebar.md`](./done/DSP-OUT-20260811-02-output-mode-into-sidebar.md) | OUT | Output mode → Ops sidebar | **Accepted** |
| [`done/DSP-CAL-20260811-01-calib-into-sidebar.md`](./done/DSP-CAL-20260811-01-calib-into-sidebar.md) | CAL | Calib sliders → Calib sidebar | **Accepted** |

### Accepted 2026-08-11 (Phase 11 follow-up #2 — authoring bugs + two 2D maps)

User testing found: Close button doesn't hide the workspace (CSS bug), nothing resizable
(map/sidebar), placement/editing is mouse-only (no Enter/Delete/drag), and the viewer-facing
stream map needs its own bigger/stylish look distinct from the ops map. BW reproduced the Close
bug live before dispatching, and re-verified both worker reports live (CDP + tests) before
accepting. Design addendum: [`../../architecture/world-authoring-workspace.md`](../../architecture/world-authoring-workspace.md#follow-up-workspace-usability-bugs-found-after-scn-04-shipped-2026-08-11)

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-05-authoring-workspace-fixes.md`](./done/DSP-SCN-20260811-05-authoring-workspace-fixes.md) | SCN | Close bug, resizable map + sidebar, Enter/Delete/drag editing | **Accepted** |
| [`done/DSP-SCN-20260811-06-stream-map-broadcast-graphic.md`](./done/DSP-SCN-20260811-06-stream-map-broadcast-graphic.md) | SCN | Distinct bigger/stylish viewer-facing 2D map | **Accepted** |

No active Phase 11 follow-up #2 workers.

### Accepted 2026-08-12 (Phase 11 follow-up #3 — `window.prompt()` throws in Electron, P0)

User found billboard chain still won't finish (button or Enter) after `-05`. BW root-caused it:
Electron unconditionally overrides `window.prompt()` to throw — it's not a UI quirk, it's an
uncaught exception that silently kills whatever async function called it. Grepped every
`window.prompt(` call site in the repo; **7 call sites across 5 files** were affected (billboard
chain texture + spacing, boat/drone/buoy id placement, texture picker free text, Save as, Rename,
Duplicate). Split by owner per protocol — same root cause, coordinating note in each dispatch.

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-07-electron-prompt-modal.md`](./done/DSP-SCN-20260811-07-electron-prompt-modal.md) | SCN | Shared `promptModal()` utility + fix editor/texture-picker call sites | **Accepted** |
| [`done/DSP-PLT-20260811-03-electron-prompt-fixes.md`](./done/DSP-PLT-20260811-03-electron-prompt-fixes.md) | PLT | Swap Save as / Rename / Duplicate to `promptModal()` | **Accepted** |

Neither worker could click through the real Electron GUI themselves (no automated Electron UI
driver in their sessions), so BW did before accepting — launched the actual
`desktop/node_modules/electron/dist/electron.exe` against the running Vite dev server (not a
browser tab) and drove the real renderer via `webContents.executeJavaScript`:
- Confirmed `window.prompt()` genuinely throws (`"prompt() is not supported."`) in this exact
  renderer — the bug is real, not theoretical.
- Billboard chain: selected the tool, dispatched two `click`s on the map canvas, dispatched a
  window `keydown Enter` → texture `promptModal` appeared (default `"1"`) → submitted → spacing
  `promptModal` appeared (default `"12"`) → submitted → no modal left open → feature count went
  13 → 14 and a new `Chain 3 · billboardChain` row appeared in the Assets sidebar list. Proves the
  exact user-reported P0 (Enter-to-finish) is fixed end-to-end.
- Save as: clicked the button → id `promptModal` appeared (`"Save as — project id"`) → **Cancel**
  → aborted cleanly, no modal left open. Re-ran, submitted the id modal → name `promptModal`
  appeared (`"Save as — display name"`) → **Escape** → aborted cleanly, no modal left open, no
  crash either time.
- Rename/Duplicate share the same `promptIdName` → `promptModal` primitive already proven above;
  not separately re-driven live (needs a configured `projectsApiBase`), accepted on code review +
  green test suite.
- `npm test` (394 client + 23 server) and `npm run build` green at HEAD.

### Accepted 2026-08-11 (Phase 11 — V1-D unified ops sidebar)

Design: [`../../architecture/unified-ops-sidebar.md`](../../architecture/unified-ops-sidebar.md)

| DSP | Owner | Goal | Status |
| --- | --- | --- | --- |
| [`done/DSP-SCN-20260811-01-ops-sidebar-shell.md`](./done/DSP-SCN-20260811-01-ops-sidebar-shell.md) | SCN | Sidebar shell | **Accepted** |
| [`done/DSP-TEL-20260811-01-buoy-telemetry.md`](./done/DSP-TEL-20260811-01-buoy-telemetry.md) | TEL | Buoy telemetry | **Accepted** |
| [`done/DSP-PLT-20260811-01-asset-library.md`](./done/DSP-PLT-20260811-01-asset-library.md) | PLT | Asset library | **Accepted** |
| [`done/DSP-OUT-20260811-01-ndi-controller-tab.md`](./done/DSP-OUT-20260811-01-ndi-controller-tab.md) | OUT | NDI controller tab | **Accepted** (2nd source stubbed) |
| [`done/DSP-SCN-20260811-02-2d-map-authoring.md`](./done/DSP-SCN-20260811-02-2d-map-authoring.md) | SCN | 2D map authoring | **Accepted** |
| [`done/DSP-PLT-20260811-02-project-manager-sidebar.md`](./done/DSP-PLT-20260811-02-project-manager-sidebar.md) | PLT | Project manager | **Accepted** |
| [`done/DSP-SCN-20260811-03-asset-inspector-panel.md`](./done/DSP-SCN-20260811-03-asset-inspector-panel.md) | SCN | Asset inspector | **Accepted** |

**Milestone V1-D met.** No active Phase 11 workers. Optional: 11.8 revision history, 11.9 show-notes UX.

### Active (Phase 10 — Cutover & console)

| Item | Role |
| --- | --- |
| **10.1** human + BW | Unity vs broadcast-web parallel dress — [`../handoffs/HO-BW-20260804-05-v1c-remaining.md`](../handoffs/HO-BW-20260804-05-v1c-remaining.md) |
| Console emit ack | [`../handoffs/HO-CON-console-team-20260804-01.md`](../handoffs/HO-CON-console-team-20260804-01.md) |

10.2 SPA → `done/DSP-CON-20260804-01` (pending console). 10.3 → `done/DSP-OUT-20260804-01` (**Pass**). No active OUT/CON workers.

### Accepted 2026-08-04 (Phase 9 — V1-B LAN)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-PLT-20260804-01-auth-roles-lan.md`](./done/DSP-PLT-20260804-01-auth-roles-lan.md) | PLT | Editor vs air bearer |
| [`done/DSP-PLT-20260804-02-offline-venue-pack.md`](./done/DSP-PLT-20260804-02-offline-venue-pack.md) | PLT | Offline venue pack |
| [`done/DSP-CAL-20260804-01-calib-profiles-on-project.md`](./done/DSP-CAL-20260804-01-calib-profiles-on-project.md) | CAL | Calib on RaceProject |

### Accepted 2026-08-04 (Phase 8 — V1-A SCN)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-SCN-20260804-01-editor-snap-validation.md`](./done/DSP-SCN-20260804-01-editor-snap-validation.md) | SCN | Editor snap + bearing + validation |
| [`done/DSP-SCN-20260804-02-hull-map-dot-colours.md`](./done/DSP-SCN-20260804-02-hull-map-dot-colours.md) | SCN | Hull + map-dot category colours |
| [`done/DSP-SCN-20260804-03-tag-billboard-preview-cam.md`](./done/DSP-SCN-20260804-03-tag-billboard-preview-cam.md) | SCN | Billboard scale per preview vs air pass |
| [`done/DSP-SCN-20260804-04-stream-2d-map.md`](./done/DSP-SCN-20260804-04-stream-2d-map.md) | SCN | Stream/on-air 2D map (CSS PiP) |
| [`done/DSP-SCN-20260804-05-unity-visual-assets-first-slice.md`](./done/DSP-SCN-20260804-05-unity-visual-assets-first-slice.md) | SCN | Unity visual assets first slice |
| [`done/DSP-SCN-20260804-06-ghost-boats.md`](./done/DSP-SCN-20260804-06-ghost-boats.md) | SCN | Ghost / invisible boats (8.6) |
| [`done/DSP-SCN-20260804-07-map-chrome.md`](./done/DSP-SCN-20260804-07-map-chrome.md) | SCN | Map chrome — sail icons + S/F pills (8.7) |
| [`done/DSP-SCN-20260804-08-world-3d-polish.md`](./done/DSP-SCN-20260804-08-world-3d-polish.md) | SCN | Mild 3D polish — buoys/gates + water cue (8.8) |

Handoff: [`../handoffs/HO-BW-20260804-01-open-scn-phase8.md`](../handoffs/HO-BW-20260804-01-open-scn-phase8.md) (closed). OUT follow-up: [`../handoffs/HO-SCN-OUT-20260804-01.md`](../handoffs/HO-SCN-OUT-20260804-01.md).

### Accepted 2026-08-03 (ops polish batch)

| DSP | Owner | Goal |
| --- | --- | --- |
| [`done/DSP-TEL-20260803-01-live-socket-hygiene.md`](./done/DSP-TEL-20260803-01-live-socket-hygiene.md) | TEL | Enabled-id sockets + last-packet status |
| [`done/DSP-SCN-20260803-01-free-cam-ops-view.md`](./done/DSP-SCN-20260803-01-free-cam-ops-view.md) | SCN | Ops free cam (preview) |
| [`done/DSP-OUT-20260803-01-ndi-active-cam-lock.md`](./done/DSP-OUT-20260803-01-ndi-active-cam-lock.md) | OUT | NDI = active POV (dual-render) |
| [`done/DSP-SCN-20260803-02-world-anchor-ui.md`](./done/DSP-SCN-20260803-02-world-anchor-ui.md) | SCN | World-anchor lat/lon/altMsl UI |
| [`done/DSP-PLT-20260803-01-project-save-as-load.md`](./done/DSP-PLT-20260803-01-project-save-as-load.md) | PLT+SCN | Save / Save as / Load project |
