# Dispatch DSP-SCN-20260908-01-cinematic-player

## Meta
- From orchestrator: SCN (BW issued 2026-09-08)
- Worker role: WORKER(DSP-SCN-20260908-01-cinematic-player)
- Priority: **P0** (GEO-01 **in tree**)
- Phase: **21.1** — sequence player
- Related: `HO-BW-SCN-20260908-01`. Design: `docs/architecture/commercial-video.md`. GEO: `DSP-GEO-20260908-01` **code-accept**.
- **GEO-01 is in the tree — start now.** Hold MP4 encode (OUT). No CesiumJS, IBB, Google Photorealistic, NDI/SRT, `STUDIO_TICK_FPS=60`, no audio.
- Worker result: **code-complete 2026-09-08**. Player + 30 Hz + hide-race + globe/ENU remount + cloud + ops. Fixture `_empty` only. Record stub. Cinematic tests 54/54. Full suite 1315 pass / 1 fail `library.test.ts` pre-existing. tsc still red in `videoDecodePipeline.ts`. **Human Pass:** Play `_empty` (brief in `docs/ops/cinematic-heroes-smoke.md`). DSP-02 unblocked.

## Goal

A reusable **cinematic player**: load sequence JSON, drive the 3D camera on a **locked 30 Hz** clock, hide race chrome, set fog/ocean/imagery per shot, cloud overlay for globe→ENU. Ops can play / pause / scrub. Record button may be a disabled stub until OUT.

## Background

vMix will play an MP4; this player is **authoring only**. Globe shots: no ReorientationPlugin, coarse Aerial, OSM off, Gerstner off, `scene.fog` off. ENU shots: İstanbul origin, Aerial, OSM on, heroes on, ocean **after** cloud. Hide boats, course, sponsors, flags, 2D map, HUD, calibration, terrain credit DOM.

## In scope

1. **`src/scene/cinematics/`** — types + `loadSequence` from `/cinematics/*.json`. Schema: `id`, `durationSec`, `width` 1920, `height` 1080, `fps` 30, `shots[]` with `t0, t1, domain: globe|enu`, `fog`, `ocean`, `buildings`, `imagery: aerial|road`, `cloud01` (0–1 overlay), keyframes `{ lat, lon, altMsl, lookLat, lookLon, lookAltMsl, t01, ease? }`.
2. **Player** — `play | pause | seek(tSec)`. Sample spline in **sequence time**, not rAF dt. Convert via GEO ECEF or `gpsToEnuAmsl`. Apply camera pose each tick.
3. **Globe tiles:** second mount path or plugin flag: World Terrain + Aerial **without** `ReorientationPlugin` while `domain=globe`. ENU remounts today’s reoriented tiles during cloud (`cloud01` near 1). Do not leave two full globes drawing. Unload budget OK.
4. **Hide-race** while `cinematicActive`: boats/course/sponsors/flags/map/HUD/credits off. Restore on stop.
5. **Ocean:** `ocean: false` → Gerstner off **and** do not discard Cesium water. `ocean: true` → today’s land-only discard + Gerstner.
6. **Cloud:** full-screen pass (mesh or screen quad), opacity from shot `cloud01`. Not `scene.fog`.
7. **Ops (minimal):** Cinematics row — sequence select, Play, Pause, scrub slider, time readout. Default **off** (race view). No per-keyframe editor.
8. **Tests:** schema parse; 30 Hz seek at t=0 and t=duration; hide-race flag; globe vs ENU converter is called (mock GEO). `npm test` + `npm run build`.
9. **Docs:** `src/scene/cinematics/README.md` + one-liner in `src/scene/README.md`.

A **minimal valid JSON** (2 shots, dummy lat/lon) may ship so tests/load work. The real 60 s path is DSP-02.

## Out of scope

- `intro-bosphorus.json` keyframes (02)
- MP4 / MediaRecorder (OUT)
- Free-cam “insert keyframe”
- Hero mesh import
- Audio, credits, play-then-live
- Rewriting Gerstner internals (on/off + watermask gate only)

## Likely files

- New: `src/scene/cinematics/*`, `public/cinematics/_empty.json` (or fixture)
- Edit: `createScene.ts`, `stubHud.ts`, terrain mount (globe vs reorient)
- Do not rewrite `freeCam.ts` except disable it while cinematic plays

## Inputs provided

- GEO-01 (`src/geodesy/index.ts`) — **do not invent ECEF**:
  - `geodeticToEcefMeters(lat, lon, altMsl)` — globe eye / look target
  - `ellipsoidUpEcef(lat, lon)` — unit geodetic normal
  - `ecefLookAt(eyeEcef, targetEcef)` → `{ eye, forward, up, right }` (`right × up = forward`)
  - `enuKeyframeToScene(lat, lon, altMsl)` ≡ `gpsToEnuAmsl` (origin must be set)
  - `ECEF_LOOK_AT_EPSILON_M` — coincident look → **nadir**
- Globe camera: `position = eye`, `up = basis.up`, `lookAt(target)`. ENU: `enuKeyframeToScene` after `applyConfigOrigin`.
- Sequence flags from the design doc §3–6

## Acceptance criteria

- [ ] Ops Play: camera moves; race chrome gone; credits gone.
- [ ] Scrub is deterministic (same t → same pose).
- [ ] Globe shot: no ENU flattening; fog off; ocean off.
- [ ] ENU shot after cloud: ocean can turn on without a hard pop **if** cloud covers the switch (visual smoke).
- [ ] Follow/free cam unchanged when cinematic is stopped.
- [ ] AR/chroma still have no terrain/buildings (opaque-only).
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary  
2. Files  
3. Tests  
4. What OUT should hook for Record  
5. Memo bullets for SCN
