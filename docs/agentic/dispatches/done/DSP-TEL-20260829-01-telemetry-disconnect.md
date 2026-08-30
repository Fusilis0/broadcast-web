# Dispatch DSP-TEL-20260829-01-telemetry-disconnect

## Meta
- From orchestrator: BW (route to TEL)
- Worker role: WORKER(DSP-TEL-20260829-01-telemetry-disconnect)
- Priority: P1
- Phase: 18.5 (telemetry half)
- Related handoffs: [`HO-BW-20260829-01-phase18`](../../handoffs/HO-BW-20260829-01-phase18.md)
- Status: **active**
- Pairs with: `DSP-SRT-20260829-01-srt-disconnect` — **this one lands first**; the SRT worker reuses the button pattern and the shared panel file

## Goal

The telemetry connection controls must do what they say. The operator wants Connect, Disconnect, and Reconnect to genuinely open, close, and stop-then-start the live telemetry connection, with a status readout that reflects the real socket state rather than the last button pressed.

Operator lock: **separate** Disconnect controls for telemetry and for SRT, each next to its own Connect button. No master kill.

## Background

BW traced the current behaviour. The good news is that the existing buttons are not fake:

- **Connect live** and **Reconnect** both run `applyLive` → `main.ts` `onLiveApply` → `restartIngest`, which calls `ingest.stop()` before starting a new source (`main.ts` L516–532).
- `LiveTelemetrySource.stop()` really does close every socket, clear the reconnect timers, and set `intentionalStop` so `onclose` cannot schedule a comeback (`liveSource.ts` L197–208, L297–307).

The gaps are these:

1. **There is no Disconnect button at all.** The only way to stop live telemetry is to switch the Ops mode dropdown to mock or replay, which is a mode change, not a disconnect.
2. **The Live checkboxes close nothing.** Unchecking Live on a boat or drone, or deleting the row entirely, updates session state only (`fleetLivePanel.ts` L652–655, L783–786). The socket for that id stays open until the next Connect or Reconnect.
3. **Reconnect does not wait for the old sockets to die.** `ws.close()` is fire-and-forget and new sockets open immediately. It has not been observed failing, but under a slow or half-open connection two sockets for the same id can briefly coexist.
4. **The status text reports intent, not state.** There is a 250 ms status poll (`main.ts` L1928–1929), but the panel does not clearly distinguish connecting / open / closed / retrying-with-backoff.

## In scope

1. Add a **Disconnect** control for telemetry, beside Connect live and Reconnect in the Fleet/Live panel. It closes every live telemetry socket, cancels any pending backoff, and leaves the app in a clearly disconnected state that nothing spontaneously reverses.
2. Make disconnected mean disconnected: nothing may auto-reopen telemetry after an explicit Disconnect — not the reconnect backoff, not the status poll, not a mode reassertion. Only an explicit Connect or Reconnect brings it back.
3. Make **Reconnect** an honest stop-then-start: the previous sockets must be closed and their handlers detached before the new source opens, so a late `onclose` from the old socket cannot touch the new one. If waiting for a real close is impractical, generation-tag the source so stale callbacks are ignored, and say which approach you took.
4. Make **unchecking Live** on a row, or deleting the row, actually close that id's socket rather than waiting for the next Connect. If the panel's design intends changes to be staged until Connect is pressed, then say so in the UI instead — but the current silent divergence between what the checkbox shows and what the socket does must end.
5. Status readout that reflects reality: per-channel connecting / open / closed / retrying (with the backoff delay), and an overall summary such as "3 of 4 open". Button enable/disable states should follow: Disconnect greyed when nothing is open, Connect greyed while already connected, and so on.
6. Tests: `liveSource` closes and stays closed; disconnect cancels a scheduled reconnect; reconnect does not leave a stale socket able to fire callbacks; unchecking a live id closes that socket only.

## Out of scope

- **All SRT/video connection work** — `DSP-SRT-20260829-01` owns it. Do not touch `srtBridge`, `desktop/srtReader.cjs`, or the SRT half of the fleet panel. Keep your edits to `fleetLivePanel.ts` confined to the telemetry controls and leave the SRT section structurally alone so the next worker can add its button without a conflict.
- Clearing `flowTap`, `telemetryHistory`, `ptsNtpMap`, or the pose bus on disconnect. Deliberately excluded: the Flow panel's stale entries are `DSP-TEL-20260829-02`, and wiping history on disconnect could hide a real match bug. If you believe a specific buffer must be cleared for correctness, report it rather than doing it.
- The Ops telemetry mode dropdown behaviour (mock / replay / live).
- Fleet panel visual redesign; new layout rails.
- Auto-reconnect policy changes for unintended drops. The existing 500 ms → 10 s backoff stays for genuine network loss; it must simply never survive a deliberate Disconnect.

## Likely files

- `src/scene/fleetLivePanel.ts` — Disconnect button, button states, status text (telemetry section only)
- `src/telemetry/liveSource.ts` — close semantics, generation guard
- `src/telemetry/ingest.ts` — a disconnected state that `restartIngest` respects
- `src/main.ts` — `onLiveDisconnect` wiring, status poll
- tests alongside; `src/telemetry/README.md`

## Inputs provided

- Current call graph: `applyLive` (`fleetLivePanel.ts` L954–971, L979–980) → `onLiveApply` (`main.ts` L2553–2574) → `restartIngest` (L516–532) → `LiveTelemetrySource.stop()` / `.start()`.
- Backoff: initial 500 ms, cap 10 s (`liveSource.ts` L40–42, L310–318).
- `intentionalStop` already exists and is the right lever — extend it rather than inventing a parallel flag.

## Acceptance criteria

- [ ] A Disconnect control exists beside the telemetry Connect/Reconnect controls and closes all live telemetry sockets.
- [ ] After Disconnect, no socket reopens by itself; a test proves a scheduled reconnect is cancelled.
- [ ] Reconnect cannot leave a stale socket whose callbacks affect the new source; covered by a test.
- [ ] Unchecking Live on an id closes that id's socket (or the UI states plainly that Connect must be pressed).
- [ ] Status shows real per-channel state and the buttons' enabled states follow it.
- [ ] SRT files and the SRT section of the panel are untouched.
- [ ] `npm test` and `npm run build` green.
- [ ] **Human smoke:** in Electron with live telemetry flowing, press Disconnect — packets stop, Flow goes quiet, status says closed, and nothing comes back on its own. Press Connect live — it comes back. Press Reconnect while connected — a brief gap, then flow resumes with no duplicate ids.

## Report back

1. What Disconnect closes, and how "stay disconnected" is enforced
2. Whether Reconnect awaits close or uses a generation guard, and why
3. Files touched and tests added
4. Anything about the checkbox-versus-socket semantics you decided, and what the UI now says
5. Suggested memo bullets for TEL
