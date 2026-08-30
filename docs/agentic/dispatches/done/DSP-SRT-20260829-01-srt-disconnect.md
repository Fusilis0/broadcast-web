# Dispatch DSP-SRT-20260829-01-srt-disconnect

## Meta
- From orchestrator: BW (route to SRT)
- Worker role: WORKER(DSP-SRT-20260829-01-srt-disconnect)
- Priority: P1
- Phase: 18.5 (SRT half)
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active** — unblocked 2026-08-29. `DSP-TEL-20260829-01-telemetry-disconnect` has landed and is accepted.
- Depends on: `DSP-TEL-20260829-01-telemetry-disconnect` — **done**

## What TEL already landed (read this before you start)

The telemetry half of the panel is finished and merged. Match it; do not restructure it.

- Telemetry **Disconnect** was `insertBefore`'d next to Reconnect. `applySrtBtn` still sits at the **end of that row**, deliberately left there for you — add **Disconnect SRT** beside Connect SRT.
- Pattern to copy: `ingest.disconnectLive()` → `stop({ retainSlots: true })`, which bumps a **generation tag**, sets `intentionalStop`, clears retry timers, detaches handlers, then closes. Late callbacks from a dead socket are ignored by generation, **not** by awaiting a close handshake. Do the same for SRT rather than awaiting ffmpeg teardown.
- Stay-disconnected is enforced by a flag (`liveExplicitlyDisconnected`) that reopen paths consult. Your equivalent must be consulted by `maybeFallbackSrtDecodeStall` / `beginFfmpegH264Fallback`.
- TEL's checkbox answer: **uncheck closes that id now**, check opens it now while connected. Scope item 4 says match it — so **uncheck Vid closes that POV now**.
- Status vocabulary already in use: `open` / `connecting` / `closed` / `retrying/500ms`, summarised as `3 of 4 open · 1 retrying` or `disconnected`. Button greying: Connect off while anything is open/connecting/retrying; Disconnect off when nothing is active.
- `:disabled` styling for these buttons already exists in `src/style.css`.

## Goal

Give the SRT video ingest a real Disconnect, and make Connect SRT and the Vid checkboxes mean what they appear to mean. Operator lock: **separate** disconnect controls for telemetry and SRT, each beside its own Connect. Reuse the button pattern, states, and status vocabulary that TEL just established, so the two halves of the panel look and behave the same.

## Background

BW traced this. As with telemetry, Connect SRT is not fake — it is genuinely a stop-then-start:

- `applySrt` → `main.ts` `onSrtApply` (L2580–2614) awaits `bridge.close('all')` and then reopens each Vid-enabled POV, capped at four.
- `teardownSession` in `desktop/srtReader.cjs` L461–470 clears retry, kills the ffmpeg child, and on Windows kills the process tree with `taskkill /t /f`. The process really dies.

The gaps:

1. **No Disconnect exists.** The only ways to stop SRT are to press Connect SRT again, destroy the window, or quit the app.
2. **Unchecking Vid closes nothing** (`fleetLivePanel.ts` L809–812). ffmpeg keeps running for that POV until the next Connect SRT.
3. **The renderer never closes SRT on unload.** `beforeunload` (`main.ts` L2730–2757) disposes `videoStreamManager` but does not call `bridge.close('all')`, so ffmpeg can outlive a reload until window teardown.
4. **A stall watchdog can reopen SRT on its own.** `maybeFallbackSrtDecodeStall` runs every 500 ms and can call `beginFfmpegH264Fallback` → `bridge.open({ transcodeToH264: true })` (`main.ts` L790–835). After an explicit Disconnect this would resurrect a connection the operator just killed.
5. **The last decoded frame persists.** `videoStreamManager` deliberately keeps the last frame so the picture never goes black. After a deliberate Disconnect that is misleading — the AR underlay would still show a frozen live-looking picture.

## In scope

1. Add a **Disconnect SRT** control beside Connect SRT, matching the pattern TEL introduced. It closes every SRT session (`close('all')`), kills the ffmpeg children, and clears the per-POV status maps.
2. Make disconnected stick: after an explicit Disconnect, the decode-stall watchdog and the H.264 fallback path must not reopen anything. Only an explicit Connect SRT may reopen.
3. Decide and implement what the AR underlay shows after a deliberate Disconnect. BW's call: the frozen last frame must not be presented as if live. Either fall back to the alpha/plate background or show an unmistakable "SRT disconnected" state — the "never go black" rule exists for mid-show dropouts, not for a connection the operator deliberately closed. Say which you chose.
4. Make **unchecking Vid** on a POV close that POV's session, rather than deferring to the next Connect SRT — or make the panel state plainly that changes apply on Connect. Match whatever TEL decided for the Live checkbox so the two halves are consistent.
5. Close SRT on renderer unload so a reload cannot leak ffmpeg processes.
6. Per-POV status in the panel: idle / connecting / live with bitrate / retrying with the backoff delay / closed. Button enabled states follow, as on the telemetry side.
7. Tests: disconnect tears down all sessions and blocks the stall-fallback reopen; unchecking Vid closes only that POV; unload path calls close.

## `src/main.ts` region lock (BW, 2026-08-29)

You are one of **three** wave-2 workers editing `src/main.ts` in parallel. The original wave plan called wave 2 disjoint; it is not, and BW is resolving that with region locks rather than by serialising the wave.

**Your region only:** `onSrtApply` (~L2580–2614), `maybeFallbackSrtDecodeStall` / `beginFfmpegH264Fallback` (~L790–835), `beforeunload` (~L2730–2757), and a new `onSrtDisconnect` beside `onSrtApply`.

**Do not touch, even to tidy:** the fleet-registry rebuild sites (~L1780–1783), the `buildFlowCards` call site, and `pushSrtFlowSnapshots` (~L997–1022) — those belong to `DSP-TEL-20260829-02`. The studio-tick subscriber registrations (~L2061–2301) belong to `DSP-PRF-20260829-01`.

No import reordering, no reformatting, no drive-by renames anywhere in the file. Keep every edit minimal and local so the three sets of changes merge cleanly.

**In `fleetLivePanel.ts` you are alone** — TEL-01 is merged and no other wave-2 worker touches that file. Keep to the SRT section regardless, so the telemetry half stays as TEL left it.

## Out of scope

- Telemetry connection work — `DSP-TEL-20260829-01` owns it; take its panel pattern as given and do not restructure it.
- HEVC / codec / transcode decisions. The `-c copy` plus WebCodecs path and its H.264 fallback stay exactly as they are; you are only preventing the fallback from firing after a deliberate disconnect.
- PTS, NTP matching, `PtsNtpMap` behaviour, `syncTrimMs`.
- NDI, colour, or frame-rate work.
- The SRT catalog and URL template.

## Likely files

- `src/scene/fleetLivePanel.ts` — Disconnect SRT button and status (SRT section only)
- `src/main.ts` — `onSrtDisconnect`, the stall-watchdog guard, `beforeunload`
- `src/output/srtBridge.ts` (or equivalent bridge module) — close semantics
- `src/output/videoStreamManager.ts` — what is presented after a deliberate disconnect
- `desktop/srtReader.cjs` — only if teardown needs a guarantee it does not already give
- tests alongside; `src/output/README.md` or the SRT doc

## Inputs provided

- Teardown already works: `teardownSession` (`desktop/srtReader.cjs` L461–470), `killSessionChild` with `taskkill /t /f` (L110–123).
- Retry backoff `[1000, 2000, 4000, 8000, 15000, 30000]` ms (`srtHelpers.cjs` L13); `session.closing` already suppresses it.
- Warm POV cap is 4 (`SRT_WARM_POV_CAP`, `MAX_SESSIONS` in `srtHelpers.cjs` L10).
- Reminder from RULES: never log the SRT `streamid` or passphrase. The Electron connect logs may still print `streamid` — if you touch that line, redact it; it is a known soft leftover.

## Acceptance criteria

- [ ] A Disconnect SRT control exists beside Connect SRT and terminates every ffmpeg session.
- [ ] After Disconnect, no session reopens on its own; a test proves the decode-stall fallback is suppressed.
- [ ] The AR underlay does not keep showing a frozen frame as though it were live after a deliberate disconnect; the chosen behaviour is documented.
- [ ] Unchecking Vid closes that POV's session, or the panel says plainly that Connect applies changes — consistent with the telemetry half.
- [ ] Reloading the renderer leaves no orphan `ffmpeg.exe` running.
- [ ] Per-POV status is accurate and button states follow it.
- [ ] No SRT tokens appear in logs.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** with SRT live, press Disconnect SRT — the picture stops, Task Manager shows no `ffmpeg.exe`, and nothing reconnects on its own for at least a minute. Press Connect SRT — the picture returns.

## Report back

1. What Disconnect tears down and how the reopen paths are suppressed
2. What the AR background shows after a deliberate disconnect, and why you chose it
3. Files touched and tests added
4. Confirmation that no orphan ffmpeg survives a reload
5. Suggested memo bullets for SRT
