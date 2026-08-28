# Dispatch DSP-TEL-20260826-10-matched-hold

## Meta
- From orchestrator: BW → TEL
- Worker role: WORKER(DSP-TEL-20260826-10-matched-hold)
- Priority: P0
- Phase: Phase 17.4 — matched pose must wait for video NTP
- Related: `done/DSP-TEL-20260826-08-matched-pose-cutover.md` (shipped seam that silently free-runs)
- Follow-up UI: `done/DSP-SCN-20260826-10-telem-srt-flow-panel.md`
- Handoff to SCN: `docs/agentic/handoffs/HO-TEL-SCN-20260826-01.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-27 (merged tree `npm test` **856 + 23**, `npm run build` green). SCN-10 Flow panel shipped in parallel. Soft leftover: boats with `t_sync === false` still not stored.

## Goal

When **AR bg = video** and a live SRT picture exists, the 3D pose (drones, boats, buoys) must be sampled at the **presented video frame’s NTP**, not at wall-clock now. Telemetry always arrives earlier than SRT; the 30 s history already exists — **stop pushing newest packets into the scene** while video is the clock.

Operator report 2026-08-26 evening: SRT picture is visible, but hull/camera move the instant the pilot inputs. That is the TEL-08 **free-run fallback** (`activeMatchedNtp() == null` → `onDrone`/`onBoat`/`onBuoy` call `upsert` toward now). A silent fallback to “looks live” is worse than a held pose + badge.

## Background

Read, in order:

1. `docs/architecture/ar-video-underlay-ntp-sync.md` §1 (pull vs push)
2. `docs/architecture/ntp-matching.md` §2 (wire `ts` / `time` / `stream_anchor`)
3. `src/pose/pipeline.ts` — `onDrone` early-return only when `activeMatchedNtp() != null`; `tick` free-runs otherwise
4. `src/telemetry/telemetryHistory.ts` — `droneUsable` **requires finite lat/lon/alt** and `ntp_synced === true`
5. LUT: `onAnchor` keys `getPtsNtpMap(stream_id)` (producer telem id). `resolveMatchedNtp` looks up `getLutStreamId(povId)` (**SRT id**). If those strings differ, `pacingCount === 0` → free-run even with healthy anchors.

**Missing GPS is not a reason to drop NTP.** DJI often sends gimbal/rot with `pos` ≈ 0 or omitted. `ts` is still the matching clock. Pipeline already holds last ENU when GPS is unusable (`holdDroneEnu`). History currently **refuses** those packets, so `sampleAt` has nothing to wait on.

## In scope

1. **No silent free-run while video is the clock**
   - If `matchClock.enabled()` (AR bg video) **and** the active POV has a presented PTS (`getPresentedPts90k`) **or** SRT picture (`framesDecoded > 0` — inject a `hasPicture?(povId)` if counters are not in this module), then:
     - Do **not** `upsert` from `onDrone` / `onBoat` / `onBuoy`.
     - `tick` must **not** lerp toward newest.
     - If LUT/`toNtp` is not ready: **hold last matched pose** (or last `sampleAt` that succeeded). Do not walk to the latest packet.
   - Alpha plate (`enabled() === false`) stays today’s push+lerp. Isolation tests must stay green.
   - Free-run is allowed only when video mode is off, **or** there is no presented video clock yet **and** no picture (connecting). Surface FREE-RUN on existing sync debug (`pacingCount === 0` is not enough if we are holding).

2. **LUT alias (telem id ↔ SRT id)**
   - `stream_anchor.stream_id` is the producer id (telemetry POV). LUT lookup today uses SRT catalog id. Alias both keys: `addAnchor` into `getPtsNtpMap(stream_id)` **and** into `getPtsNtpMap(srtId)` when the operator has mapped that POV.
   - Inject `getSrtIdForTelemId?(telemId)` / `getTelemIdForSrtId?` from `main.ts` (Fleet `srtByPovId`). Do not assume they are equal.
   - `resolveMatchedNtp`: try SRT id first, then telem `povId`. First healthy `toNtp` wins.
   - Tests: anchors on `"5"`, LUT lookup `"1"` with mapping 5→1 still matches; unmapped mismatch still holds (does not free-run) when video PTS exists.

3. **History accepts attitude-only drones**
   - `addDrone` must succeed with `id` + finite `ts` even if `pos.lat/lon` are 0, missing, or non-finite. Default missing pos to `{lat:0,lon:0,alt:0}` inside the stored packet so converters stay typed.
   - Do **not** require `ntp_synced === true` to *store* the packet (inspector + matching need `ts`). Keep a `degraded` / quality flag when unsynced or `ntp_err_ms === DJI_NTP_ERR_UNSYNCED`.
   - `sampleDroneAt` interpolates gimbal/rot even when GPS is 0,0. ENU hold stays in `pipeline.ts` (`holdDroneEnu`) — do not GEO-project 0,0.
   - Boats/buoys: still need `time` + id. If lat/lon missing, store and hold last lat/lon on sample (same idea). Do not drop a packet that has `time` just because GPS is late.

4. **Flow tap API (for SCN-10 — no DOM here)**
   - New small module e.g. `src/telemetry/flowTap.ts`: ring of last **N** events per entity id (default N=12, cap memory).
   - Event shape: `{ receivedAtMs, kind: 'drone'|'boat'|'buoy'|'anchor'|'srt', id, body: unknown }`.
   - `push` copies JSON-safe fields only. **Never store raw SRT URLs with tokens** — if a later OUT/SCN pusher passes a URL, redact `streamid` last segment (reuse `redactSrtUrl` from output, or accept only already-redacted bodies).
   - `snapshot()` returns a serialisable list for the panel. Pure; unit-tested.
   - Wire pushes from pose pipeline / ingest: every accepted drone/boat/buoy packet and every `stream_anchor`. Do not stringify 10 Hz into the DOM.

5. Tests + docs
   - Matched + video PTS + empty LUT → pose **does not** jump to newest yaw within one packet interval.
   - Attitude-only drone (`pos` 0,0) still `addDrone` true and `sampleDroneAt` returns gimbal.
   - LUT alias test above.
   - Alpha isolation unchanged.
   - Update `src/pose/README.md` and `src/telemetry/README.md`. Memo bullets for TEL.

## Out of scope

- JSON panel / floating windows (SCN-10).
- SRT ffmpeg, demux, HEVC, colour bars (OUT).
- `STUDIO_TICK_FPS`, NDI fps (PRF).
- Changing `syncTrimMs` sign (CAL).
- Raising history window above 30 s unless a test proves 30 s is too short (default stay 30 s).
- Inventing boat/drone motion from yaw when GPS is missing (hold ENU only).

## Likely files

- `src/pose/pipeline.ts`, `src/pose/matchedPipeline.test.ts`, `src/pose/README.md`
- `src/telemetry/telemetryHistory.ts`, `src/telemetry/telemetryHistory.test.ts`
- `src/telemetry/flowTap.ts` (new) + test
- `src/telemetry/ptsNtpMap.ts` only if alias cannot live in pipeline `onAnchor`
- `src/main.ts` — inject SRT↔telem mapping + optional `hasPicture`
- `src/telemetry/README.md`

## Inputs provided

- History window 30 s already. Do not rebuild a second buffer.
- `t_ntp = toNtp(pts) + syncTrimMs` (positive = AR leads video).
- `getLutStreamId` in `main.ts` is SRT id; telemetry `povId` is Fleet id.
- Adaptive 100–400 ms is OUT presentation; you pick **which** pose, not how often we render.

## Acceptance criteria

- [ ] AR bg video + presented PTS: newest telemetry packet does **not** move the scene until `sampleAt(t_ntp(pts))`.
- [ ] AR bg video + presented PTS + no anchors yet: last pose **held**, not free-run lerp; sync path can still show why (no pacing).
- [ ] AR bg alpha: push+lerp unchanged (existing tests).
- [ ] Anchors keyed by telem id still resolve when LUT lookup uses a different SRT id (mapping injected).
- [ ] `addDrone` true for gimbal-only packets with finite `ts`; `sampleDroneAt` returns that attitude; camera does not fling to GEO 0,0.
- [ ] `flowTap.snapshot()` unit-tested; tokens never appear.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary (hold vs free-run rule you shipped; LUT alias; GPS-optional)
2. Files touched
3. Tests run
4. Follow-ups / blockers (e.g. producer never sends `stream_anchor` — then LUT cannot match; panel will show it)
5. Suggested TEL memo bullets
