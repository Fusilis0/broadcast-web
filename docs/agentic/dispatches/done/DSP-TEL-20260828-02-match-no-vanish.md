# Dispatch DSP-TEL-20260828-02-match-no-vanish

## Meta
- From orchestrator: BW → TEL
- Worker role: WORKER(DSP-TEL-20260828-02-match-no-vanish)
- Priority: P0
- Phase: Phase 17.6 — matched overlay must stay on the video clock
- Related: `HO-BW-TEL-20260828-02` · `done/DSP-TEL-20260826-10-matched-hold.md` · `done/DSP-TEL-20260828-01-pose-smoothing.md`
- Parallel with: `DSP-OUT-20260828-03-present-wait-lut` (you do not change decode/present)
- **Status: DONE** — worker complete + BW accepted 2026-08-28 (merged tree `npm test` **896 + 23**, `npm run build` green). Overlay re-emits lastMatched; Pose row shows Δ / pacing. Human smoke still open.

## Goal

When AR bg = video, the overlay is sampled at the presented frame’s NTP (PTS → `stream_anchor` LUT → `sampleAt`). It must **not** disappear when that NTP is slightly ahead of the pose buffer, and the operator must see **why** match is held vs matched. Do not free-run toward wall-clock now.

## Background

Producer (DJI NTP agent, 2026-08-28): SRT has no wall clock. Match is PTS → NTP via pacing `stream_anchor` (`kind` ∈ dji/periodic/gopro; **not** `kind:frame`) → interpolate pose/GPS. Telemetry is ~10 Hz (boats slower); there is **not** a packet on every video frame. Buffer + interpolate; short vel extrapolate; hold if unsynced / big gap / `t_err === -1`. Boat: no DR if `spd < 0.3` or `brg === 0`. Decoder must expose real 90 kHz PTS (OUT-03). GoPro `type=anchor` is **out of scope** (L2).

Operator: overlay and SRT picture not synced; SRT *looks* earlier than pose; Flow sometimes shows telemetry **null**.

What we already have (TEL-08/10, TEL-01/02): that 3-step chain. What still hurts live:

1. **`emitMatched` skips `unavailable`.** If presented `t_ntp` is newer than the last pose by more than the hold window (video faster than WS, or LUT mapped too far forward), the drone/boat is **omitted** from the pose bus → overlay vanishes. That is the “telemetry null” on the **scene**, not only Flow JSON.
2. **Flow `telem: null`** is also the 4 Hz card with no event in the last 12 taps. Do not treat that as a pose bug. You may add a one-line HUD/debug field; do not change Flow poll rate unless a single badge is missing.
3. **Video ahead of pose is allowed by physics** if SRT latency < pose WS. Then `sampleAt` should **hold last** (already a quality mode) and **still emit**. Do not lerp to newest (that was TEL-10).
4. Sync debug already has PTS/NTP and `pacing N`. Pose row must also show **newest drone NTP vs `t_ntp` delta** so the operator can tell “no anchors” (`pacingCount === 0`) from “anchors ok, pose buffer behind video.”

Hermite smoothing (TEL-01) is already in `sampleAt`. Do not add a second MidpointLerp on the video clock.

## In scope

1. **`emitMatched`:** if `sampleAt` is null or `unavailable`, **re-emit `lastMatched`** for that id (same as hold). Never drop the entity from the bus because the video NTP is slightly in the future.
2. **`getSyncPoseDebug`:** add fields the Output sync panel can print without guessing: `tNtpMs`, `newestPoseNtpMs`, `poseMinusVideoMs` (newest − t_ntp; negative = video ahead of buffer), `pacingCount` (from LUT used for this POV). Keep `matched` / `held` / `freeRun` semantics from TEL-10.
3. Wire those fields through `collectSyncDebugSnapshots` / `syncDebugPanel` **only if** that is a few lines in files TEL-08 already touches via main. If the panel is OUT-owned and you would rewrite layout, add the numbers to `PoseSyncDebug` and a **one-line** `kv` in the existing Pose row — do not restyle the rail. If blocked on OUT file ownership, put the numbers on `PoseSyncDebug` + test and report “panel follow-up.”
4. Tests in `matchedPipeline.test.ts`: video clock on, `t_ntp` 300 ms **after** last drone `ts` → overlay pose **still emitted** (held), yaw does not jump to a newer packet that arrived on the bus. `pacingCount === 0` still held, not FREE-RUN, when picture/PTS exists.
5. README one paragraph: “null telemetry” ≠ missing WS; unavailable sample holds last mesh.

## Out of scope

- `pickPresentationPts` / `onFrame` PTS map (OUT-03).
- Inventing anchors from SRT connect time.
- Changing `brg === 0` / GPS 0,0 ENU hold.
- GoPro router `type=anchor`.
- NDI fps.

## Likely files

- `src/pose/pipeline.ts` + `matchedPipeline.test.ts` + `src/pose/README.md`
- `src/output/syncDebugPanel.ts` (Pose line only, if you touch it)
- `src/main.ts` (`collectSyncDebugSnapshots`) only if needed to plumb new debug fields

## Inputs provided

- Match: `t_ntp = toNtp(presentedPts90k) + syncTrimMs`; LUT key SRT id then telem id.
- History hold after 150 ms extrapolate, then held, then unavailable (`telemetryHistory.ts`).
- Flow null is a card placeholder (`flowPanel.ts` `srtPlaceholder: 'null'`).

## Acceptance criteria

- [ ] Matched/hold path never **omits** a previously shown drone because `sampleAt` is unavailable.
- [ ] Still no lerp-to-newest while `videoClockActive`.
- [ ] Debug can distinguish: no pacing anchors vs pose buffer behind video NTP.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Hold-vs-omit behaviour; debug fields added
2. Files touched
3. Tests
4. Whether you touched the sync panel or left a follow-up
5. Suggested TEL memo bullets
