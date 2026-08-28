# Dispatch DSP-TEL-20260826-08-matched-pose-cutover

## Meta
- From orchestrator: BW → TEL (+ SCN for the scene seam)
- Worker role: WORKER(DSP-TEL-20260826-08-matched-pose-cutover)
- Priority: P0
- Phase: Phase 17.3 — matched-time render cutover
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §1, §4.3, §4.4, §4.5
- **Wave 3 — wave 1 + 2 accepted 2026-08-26.** `npm test` **795 + 23**, `npm run build` green.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` **808 + 23**, `npm run build` green). Matched only on video + healthy LUT; alpha isolation unit-tested. Live SRT smoke remains human.

## Wave 2 seams you must use (do not reimplement)

| Piece | Where |
| --- | --- |
| LUT | `getPtsNtpMap(srtId)` — **LUT key is SRT id, not `povId`** (`main.ts` `getLutStreamId`) |
| Presented PTS | `videoStreamManager.getCounters(povId).presentedPts90k` |
| Adaptive policy pose clock | `startVideoStreamManager({ getNewestPoseNtp })` currently caches `drone.ts` by **`packet.id`**. `povId` is the telemetry id; SRT id is different. Keep pose lookup on **telemetry `povId`**. If you inject `getNewestPoseNtp`, return the newest **matched-buffer** drone NTP for that POV, not wall-clock now. |
| `syncTrimMs` | **Not applied yet** in the decode `toNtp`. You must: `t_ntp = toNtp(pts) + getOffsets(povId).syncTrimMs`. Sign locked: positive = AR leads video. |
| Sync HUD | `collectSyncDebugSnapshots` in `main.ts` — decoder counters are filled; **pose/boat DR rows are still `—`**. Fill `poseMode` / `poseAgeMs` / `boats` from `sampleAt`. FREE-RUN is `health.pacingCount === 0`. |
| POV + video | Manager already polls `getActivePovId` and swaps textures (`setTexture(null)` never on switch). You still must swap the **matched LUT + sampled pose** with the POV. |
| Env | L8 already: video → ocean/sky off on AR. Do not touch. |

## Goal

Make the AR scene render at the **presented video frame's capture time** instead of at wall-clock now, using the modules the earlier dispatches built. Then wire POV switching so camera and video source move together.

Every hard part is already built and green by the time you start. Your job is the seam — and the seam is where this phase either works or quietly does not.

## Background

Today (`src/pose/pipeline.ts`) is a **push** model: a packet lands, `MidpointLerp.setTarget` aims at it, an RAF loop lerps using `performance.now()`, and `poseBus` emits whatever the smoother currently holds. `TelemetryData.ts` is carried on `PoseEvent` and never read for timing. Line 163 says outright: `// stream_anchor intentionally ignored for ENU`.

Target is a **pull** model: the presented frame's PTS → `ptsNtpMap.toNtp()` → `+ syncTrimMs` → `telemetryHistory.sampleAt()` → convert → apply → render.

You now have: `createPtsNtpMap` (TEL-01), `createTelemetryHistory` (TEL-02), the SRT byte path (OUT-03), the background compositor (OUT-04), the decode + presentation queue (OUT-06), and `syncTrimMs` on `CalibrationOffsets` (CAL-05).

### The rule that governs this dispatch

**`arBackground: 'alpha'` must behave exactly as it does today** — same push smoother, same feel, byte-identical alpha plate. That is the shipped air path and the documented fallback (L1); it is not being replaced. Matched mode is additive and engages only with `arBackground: 'video'` and a healthy LUT.

Get that isolation wrong and you have regressed production to ship a new feature.

## In scope

1. **Wire the plumbing** that wave 1 deliberately left unwired:
   - Subscribe `telemetryBus.on('stream_anchor')` → `ptsNtpMap` per `stream_id`.
   - Subscribe `drone` / `boat` / `buoy` → `telemetryHistory`.
   - Both were built pure precisely so this is a small, reviewable change.
2. **Matched pose path**:
   - Per presented frame: PTS → `toNtp` → apply the POV's `syncTrimMs` → `sampleDroneAt` / `sampleBoatAt` → existing `droneRawPose` / `boatRawPose` → `applyCalibration` → `poseBus`.
   - **Reuse the existing converters.** Do not fork GPS→ENU or calibration; that is GEO/CAL contract surface and forking it is how the two paths silently diverge.
   - Bypass `MidpointLerp` in matched mode — sampling at an explicit time and then smoothing toward it would reintroduce exactly the lag we are removing.
3. **`boatRawPose` and `spd`.** It currently ignores `spd` entirely (`src/pose/convert.ts` L42–55), which was fine for the push model. Under matched sampling the DR result from TEL-02 must actually reach the scene. Make the minimal change and keep the non-matched path's behaviour unchanged.
4. **Free-run fallback** (§4.5): no anchors for a stream, LUT unhealthy, or `toNtp` returns `unavailable` → fall back to today's push behaviour, and **surface it**. OUT-07's overlay has the badge; make sure the state reaches it. A silent degradation to "looks roughly right" is the worst outcome here — nobody investigates a feature that appears to work.
5. **POV switching moves both.** `setActivePovId` (`src/scene/createScene.ts` L738–745) currently swaps the camera and re-applies a cached pose. It must now also swap the presented video stream and the active LUT. Streams stay warm (L5), so the switch is a swap, not a reconnect. No black frame, no pose glitch on switch.
6. **Guard the clocks.** No change to `previewFrameClock` or `STUDIO_TICK_FPS`. NDI stays on `studio:tick`; preview stays on rAF when visible. The presentation policy decides *which frame*, never *how often we render*.
7. Tests: matched sampling end-to-end against fakes; mode isolation; free-run fallback; POV switch. Docs: `src/pose/README.md`, `src/telemetry/README.md`, and flip `docs/architecture/ar-video-underlay-ntp-sync.md` to shipped.

## Out of scope

- Rewriting `MidpointLerp` — leave it intact for the non-matched path.
- Changing `poseBus` / `PoseEvent` shape unless strictly required. If you must add a field, make it additive and say so loudly; `createScene.ts` and `stubHud.ts` both consume it.
- Geodesy (GEO owns `gpsToEnu`), calibration maths (CAL owns `applyCalibration`).
- Video decode internals (OUT-06), compositing (OUT-04), the overlay UI (OUT-07).
- FOV / distortion alignment (C6) — separate CAL track, expected to surface during smoke.

## Likely files

- `src/pose/pipeline.ts`, `src/pose/convert.ts`, `src/pose/README.md`
- `src/scene/createScene.ts` (POV switch seam)
- `src/main.ts` (wiring)
- Tests alongside

## Inputs provided

- `createPtsNtpMap` — `src/telemetry/ptsNtpMap.ts` (TEL-01)
- `createTelemetryHistory` — `src/telemetry/telemetryHistory.ts` (TEL-02)
- Presentation queue + presented-frame PTS — OUT-06
- `syncTrimMs` — `CalibrationOffsets` (CAL-05); note the **sign convention** CAL-05 documented, and apply it in that direction
- Current pipeline — `src/pose/pipeline.ts` L77–163; converters — `src/pose/convert.ts` L18–55
- POV switch — `src/scene/createScene.ts` L696–745

## Acceptance criteria

- [ ] `arBackground: 'video'` with a healthy LUT → the overlay tracks the video. A hard drone yaw shows boats/marks staying locked to the image instead of leading or trailing it.
- [ ] **`arBackground: 'alpha'` is unchanged from today** — same smoothing, same feel, alpha plate byte-identical. Regression-test explicitly; this is the shipped air path.
- [ ] No anchors → free-run, visibly badged, no crash and no frozen scene.
- [ ] POV switch moves camera **and** video together: no black frame, no pose glitch, correct LUT after the switch.
- [ ] Boat DR reaches the scene: a boat under way moves smoothly between ~2 Hz fixes instead of stepping.
- [ ] A boat with `brg === 0` is **held, not walked north** (TEL-02 enforces it; assert it survives the seam).
- [ ] Telemetry stall → latency clamp pins at 400 ms, degraded flag set, NDI still sending.
- [ ] Preview fps and NDI cadence unchanged from Phase 16 baselines.
- [ ] `npm test` + `npm run build` green.

## Human smoke (not a code gate — BW will request it)

1. Live drone, `arBackground: 'video'`. Hard yaw and a hard descent — does the overlay stay locked, or swim?
2. Trim `syncTrimMs` until a clapper or a sharp boat manoeuvre lines up. **Report the value that worked** — that is our first real measurement of the producer-side bias (C5) and it is the number nobody has yet.
3. Switch POVs repeatedly under load. Any black frame or pose jump?
4. Flip back to `alpha` mid-session and confirm vMix's existing alpha path is intact.
5. Watch for FOV/distortion mismatch (C6). DJI reports `cam.fov = 84`; our calibration default is `66.8832`. Expect this to be visible — it is a separate CAL track, but this is where it will first show up.

## Report back
When done, reply with:
1. Summary (seam design, how mode isolation is enforced, fallback behaviour)
2. Files touched
3. Tests run / how verified — especially how you proved the alpha path did not regress
4. Follow-ups / blockers — anything the smoke will need to settle, and any alignment error you already suspect is FOV rather than timing
5. Suggested TEL + SCN memo bullets
