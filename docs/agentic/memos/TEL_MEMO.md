# TEL_MEMO

**Last updated:** 2026-08-28  
**Status:** Idle — TEL-04 accepted; wait video-mode smoke

## SRT NTP alias + frame fit accepted 2026-08-28 (BW)
- `done/DSP-TEL-20260828-04` — producer `dji-N` / `djiN` aliases onto the digit LUT; raw key kept. Fleet SRT↔telem aliases unchanged. Lookup still SRT id then `povId`.
- `kind:frame` is **not** in the `pacing` array. When pacing has &lt; 2 samples and ≥2 frames exist, frames **are** the OLS series (same unwrap, same 2 s extra). Periodic/`dji`/`gopro` ≥2 restores residual-only. No fake `kind: dji`.
- `pacingCount` / `lastPacingPts90k` follow the fit series so frame-only can show `PTS → NTP`.
- Suite **912 + 23** / build green. Handoff: `HO-BW-TEL-20260828-04-done`.
- Human: Sync must map; GPS 0,0 still out of scope.

## Live Electron 2026-08-28 (BW) — closed by TEL-04
Anchors were `stream_id: "dji-1"` `kind: "frame"`. Fleet ids `"1"`. `toNtp` never ran (`pacingCount` 0). Fixed in TEL-04.

## Match-miss free-run accepted 2026-08-28 (BW)
- `done/DSP-TEL-20260828-03` — TEL-10 hold-on-LUT-miss **void**. Video + flowing telem **free-runs** when `toNtp` is missing (`held: false`, `freeRun: true`).
- Skip upsert only when `activeMatchedNtp() != null`. Packets upsert again on LUT miss. `emitHeld` removed.
- Matched `sampleAt` unchanged when healthy. Past `DEFAULT_HOLD_MS` unavailable → newest history sample (no vanish, no infinite `lastMatched`).
- Suite **910 + 23** / build green. OUT-08 is the plate peer. Handoff: `HO-BW-TEL-20260828-03-done`.

## Match no-vanish accepted 2026-08-28 (BW)
- `done/DSP-TEL-20260828-02` — `emitMatched` re-emits `lastMatched` when `sampleAt` is null/`unavailable` (video NTP ahead of WS). No lerp-to-newest. Hermite stays in `sampleAt`.
- Debug: `tNtpMs` / `newestPoseNtpMs` / `poseMinusVideoMs` / `pacingCount`. Negative Δ = pose behind video; `pacingCount === 0` + held = no `stream_anchor`.
- Sync Pose row: newest, Δ, pacing (no rail restyle).
- Flow `telem: null` is still the 4 Hz empty card.
- Suite **896 + 23** / build green. Handoff: `HO-BW-TEL-20260828-02`.

## Pose smoothing accepted 2026-08-28 (BW)
- `done/DSP-TEL-20260828-01` — `sampleDroneAt`: cubic Hermite lat/lon/alt from NED vel (linear if vel unusable); xyzw **slerp** (no nearer-copy); extrapolate window still 150 ms then hold.
- Boats: cubic lat/lon only when both ends have usable GPS + valid brg/spd; `brg === 0` / `spd < 0.3` never project. Alt linear.
- `pipeline.ts` not touched. Matched path still `sampleAt(t_ntp)`. Alpha still push + MidpointLerp only (not double-smoothed).
- Suite **887 + 23** / build green. Handoff: `HO-BW-TEL-20260828-01`.
- Soft leftover: boats with `t_sync === false` still dropped (TEL-10).

## Phase 17.4 accepted 2026-08-27 (BW)

- `done/DSP-TEL-20260826-10` — no silent free-run while AR bg=video and PTS or picture: packets fill history only; `tick` samples `t_ntp` or **holds**. FREE-RUN only alpha / still-connecting. LUT alias telem `stream_id` ↔ Fleet SRT id (resolve SRT then `povId`).
- History: drones store on `id`+`ts` without GPS / without `ntp_synced` (`degraded`); gimbal interpolates; ENU hold stays in `holdDroneEnu`.
- `flowTap` (N=12, redacted) from pose ingest. SCN-10 consumes it.
- Soft leftover: boats with `t_sync === false` still dropped. If producer never sends `stream_anchor`, pose holds (not live-look).

## Phase 17.3 TEL-08 (worker 2026-08-26)

- Pose pipeline always fills `telemetryHistory` + `getPtsNtpMap(stream_id)` from the bus.
- Matched sampling only when `arBackground === 'video'` **and** LUT healthy: `t_ntp = toNtp(pts) + syncTrimMs` (LUT key = **SRT id**), then `sampleAt` → existing `droneRawPose` / `boatRawPose`. MidpointLerp bypassed.
- `arBackground: 'alpha'` is still the push+lerp path (no matchClock / `enabled: false`). Free-run (no anchors / `toNtp` unavailable) falls back to that path; HUD FREE-RUN from `pacingCount === 0`.
- `getNewestPoseNtp` is the matched-buffer newest drone NTP (not wall `Date.now`, not raw `packet.ts` cache).
- Boat DR reaches ENU via sampled lat/lon (`spd` still unused in convert). `brg === 0` hold survives the seam.
- POV switch: SCN `onActivePovChange` → video `setActivePov` + pose `tick(0)`. Sync HUD pose/boat rows filled from `sampleAt`.

## Phase 17.1 accepted 2026-08-26 (BW)

- `done/DSP-TEL-20260826-01` — `createPtsNtpMap` / `getPtsNtpMap`. 30 s OLS, 1 s residual reject, 1 s backwards clock-step reset, 2 s forward extra. Slope ≈ 1. Wrap = mod `2^33` (JS `&` is 32-bit). `kind:frame` out of the fit; `health().residualMs` for OUT-07. Pure; no bus.
- `done/DSP-TEL-20260826-02` — `createTelemetryHistory`. Pull API only. `brg === 0` and `spd < 0.3` never DR. `fix_age_ms` > 200 skips DR; `0` is unknown. Drone `vel` stays NED; converters own ENU. Quality on the sample (`mode` + `sourceAgeMs` + `degraded`).
- TEL-08 wired the bus + `syncTrimMs` (see 17.3 above).

## Phase 14.3b accepted 2026-08-17
- `done/DSP-TEL-20260817-02-open-meteo-wind` — poll ~10 min at origin; `source: 'api'`;
  operator hold (Ops **hold** / **API**, 30 min, typing sets hold) beats API; last-good on
  failure; marine fields optional/additive. Free tier non-commercial — `customer-` key before air.
  Attribution CC BY in README/Ops title, not on-air.

## Phase 14.3a accepted 2026-08-17
- `done/DSP-TEL-20260817-01-wind-bus` — `windBus` + `directionFromDeg` + `windTravelSceneXZ`
  (from-north → **+Z**) + Ops row. Default 6 kt from 000°. Ops shows kt; SI on the bus.

## Phase 11
- **11.2** buoy telemetry (boat-shaped packet, own id namespace) — `done/DSP-TEL-20260811-01-buoy-telemetry.md` (worker done 2026-08-11)
  - Classification: `channel: 'buoy'` **or** boat-shaped frame whose `id` ∈ `buoyIds`
  - Empty/absent `buoyIds` → no buoy channel (backward compatible)
  - Mock demo: `"buoyIds": ["91"]` (`MOCK_BUOY_ID`); poseBus `kind: 'buoy'` via `boatRawPose`
  - Design: `docs/architecture/unified-ops-sidebar.md` §5. SCN bind UI still `DSP-SCN-20260811-02`/`-03`

## Prior (accepted)
- Live Connect opens **enabled** ids only (Fleet Live checkboxes; session `enabledBoatIds` / `enabledPovIds`).
- Per-id status + `lastPacketAgeMs`; HUD e.g. `ws b40=open/nopkt` vs packet age; soft warn ~8s open/nopkt.
- Explicit empty id lists do not fall back to `21–24` / `1–2` for live sockets.
- Archived: `docs/agentic/dispatches/done/DSP-TEL-20260803-01-live-socket-hygiene.md`

## Ops
Enable Live on the id(s) you want → Connect. Handshake ≠ data until age replaces `nopkt`.
Local buoy mock: set `"buoyIds": ["91"]` in `public/config.json` (not committed by default).
