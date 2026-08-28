# Dispatch DSP-OUT-20260826-07-srt-config-sync-hud

## Meta
- From orchestrator: BW → OUT
- Worker role: WORKER(DSP-OUT-20260826-07-srt-config-sync-hud)
- Priority: P1
- Phase: Phase 17.2 — per-POV stream config + sync diagnostics
- Design: `docs/architecture/ar-video-underlay-ntp-sync.md` §6
- **Wave 2** — TEL-01 accepted. Parallel-safe with OUT-06.
- File ownership: Fleet panel SRT rows, URL compose helper, race-project stream fields, sync overlay, and the **video→env-off gate** in `main.ts` `applyLocalChannelFocus`. Do not touch `src/calibration/*`, `ptsNtpMap.ts`, `videoBackground.ts`, or OUT-06 demux/decode files.
- **Status: DONE** — worker complete + BW accepted 2026-08-26 (merged tree `npm test` 795+23, `npm run build` green). `{srtId}` template + Vid checkbox; L8 env-off; sync HUD DOM-only. Early `tsc` blame on OUT-06 is gone in HEAD.

## Goal

Three things the phase cannot be commissioned without:

1. **Per-POV SRT identity** — telemetry id and SRT stream id are **different fields**. One shared URL template; the system substitutes the SRT id.
2. **Video forces environment off** (L8) so flipping AR bg to video actually shows the feed.
3. **A sync-debug overlay** — the numbers an operator needs to tell "correctly matched" from "plausibly wrong."

## Background

### On the overlay not being optional

Everything else in Phase 17 produces a picture with an overlay on it. When alignment is off, the picture looks *almost* right, and there is no way to tell from pixels alone whether the cause is the LUT, the telemetry buffer, the trim, the FOV, or the network. Without instrumentation the first on-site session becomes guesswork.

It is also the only way to see the failure modes we already know about: extrapolation past the anchor window, telemetry stalls pinning the latency clamp, boats held because `brg === 0`, and the free-run fallback engaging when a stream has no anchors at all (§4.5 — *"a silent degradation to 'looks roughly right' is worse than a visible badge, because nobody will investigate a feature that appears to work"*).

### On stream ids (user lock L9 — 2026-08-26)

Telemetry `povId` and the SRT camera id are **not the same number**. Example: drone telemetry id `"5"` may watch SRT cam `"30"`.

Relay URL shape (token is a secret — **do not commit**):

```
srt://49.13.20.49:9000?mode=caller&streamid=read:cam30:pub30:<token>
```

Operator enters:

| Field | Example | Where |
| --- | --- | --- |
| URL template (shared) | `srt://49.13.20.49:9000?mode=caller&streamid=read:cam{srtId}:pub{srtId}:TOKEN` | One input, next to the existing WS base URLs |
| Per-row **telemetry / POV id** | existing Fleet id | already there |
| Per-row **SRT id** | `30` | **new field next to the POV id** |

Compose with a pure helper `buildSrtCallerUrl(template, srtId)` that replaces **every** `{srtId}` (and `{id}` as an alias). Empty SRT id → do not open. Do not invent a second per-row full-URL box unless the template is empty and a full `srt://` is pasted (escape hatch).

`stream_anchor.stream_id` is still the producer's id for the LUT. Default LUT key = SRT id (the camera number on the wire), with an optional override if needed. Do not assume LUT key = `povId`.

## In scope

1. **URL template + per-POV SRT id:**
   - `buildSrtCallerUrl` in `src/output/` (testable): `{srtId}` substitution, reject listener URLs, keep `mode=caller`.
   - Fleet Live: SRT id input **on each drone/POV row** beside the telemetry id. Shared template input with the WS bases.
   - Session persistence via existing `sessionStorage` key. Race-pack: optional `output.srtUrlTemplate` + per-boat/pov `srtId` (soft-parse; old packs unchanged).
   - Per-POV enable for video (independent of Live WS checkbox if that is cleaner — say which you chose).
   - **Relay token in `streamid` is a secret** — RULES §11. Never log the composed URL at info level (redact `streamid` / token). Do not write the token into `public/config.json` or a committed pack. Session-only for the token portion, or pack-local with that called out in the README.
2. **L8 — video forces env off:**
   - When `arBackground === 'video'` and local focus is AR, `setEnvironmentOpaqueClearSafe(false)` so ocean/sky/terrain unmount. 3D NDI opaque pass still forces env on for that FBO (existing `ndiOpaquePass`). Preview + video must show the underlay, not the Gerstner sea.
   - Test the gate. Do not redesign environment modules.
3. **Sync-debug overlay** — an ops panel or toggleable HUD block showing, per active stream:
   - Presented PTS and resolved NTP; `mode` (interpolated / extrapolated / unavailable) and `extrapolatedByMs`
   - Effective presentation latency vs the 100–400 ms clamps, and whether a clamp is currently pinned
   - Anchor health from `ptsNtpMap.health()`: pacing/frame counts, rate, fit slope, `residualMs`, last-anchor age, rejection counts
   - Pose sample age and mode; boat DR state (including *held because bearing unknown*)
   - Decoder counters: frames decoded, dropped, queue depth
   - Applied `syncTrimMs` for the POV (read-only here — CAL-05 owns the control)
   - Free-run badge when a stream has no anchors
   - Off by default, or at least not on the AR plate. **It must never reach NDI output.**
3. Docs: `src/output/README.md`, `docs/ops/air-runbook.md` (a short commissioning section — what good looks like, and what to do when each badge lights up).

## Out of scope

- SRT transport (OUT-03), demux/decode (OUT-06), compositing (OUT-04), `syncTrimMs` itself (CAL-05), pose cutover (TEL-08).
- Changing `ptsNtpMap.health()`'s shape — consume it. If it lacks something you need, report rather than editing TEL-01's module.
- Automatic trim estimation / CV alignment. Manual only, this phase.

## Likely files

- `src/scene/fleetLivePanel.ts`
- `src/projects/types.ts`, `parseRaceProject.ts`, `buildRaceProject.ts` (+ tests)
- `src/output/syncDebugPanel.ts` (+ test, new)
- `src/output/index.ts`, `src/output/README.md`, `docs/ops/air-runbook.md`, `docs/contracts/race-project.md`

## Inputs provided

- Fleet panel patterns — `src/scene/fleetLivePanel.ts` (base URLs, per-row Live checkbox, Connect, session key `broadcast-web.fleetLive.v1`)
- Soft-parse / optional-field precedent — `src/calibration/projectCalibration.ts`, `src/projects/parseRaceProject.ts`
- Ops rail placement — `src/scene/sidebar/railLayout.ts`; right rail = broadcast
- Health shape — `ptsNtpMap.health()` (TEL-01)
- Status counters precedent — `src/output/ndiControllerPanel.ts`

## Acceptance criteria

- [ ] Shared template + per-row SRT id: `srtId=30` yields `…streamid=read:cam30:pub30:…` (both slots). Telemetry id can be a different string and is **not** substituted into the SRT URL.
- [ ] `buildSrtCallerUrl` unit-tested (missing placeholder, empty id, `{id}` alias, listener URL rejected).
- [ ] Save → Load round-trips template + per-POV `srtId`; old packs unchanged.
- [ ] Token / composed `streamid` never logged in full; not committed as a filled default.
- [ ] `arBackground: video` unmounts realistic env on the AR plate (preview and AR NDI). 3D NDI still has env.
- [ ] Overlay shows every field above and updates live.
- [ ] **Overlay never appears in NDI output.**
- [ ] Free-run (no anchors) is visibly badged, not silent.
- [ ] Degraded states distinguishable: extrapolating, clamp pinned, pose stale, boat held.
- [ ] Runbook section tells an operator what to do for each badge.
- [ ] `npm test` + `npm run build` green.

## Report back
When done, reply with:
1. Summary (fields, where config lives, overlay layout, passphrase decision)
2. Files touched
3. Tests run / how verified
4. Follow-ups / blockers
5. Suggested OUT memo bullets
