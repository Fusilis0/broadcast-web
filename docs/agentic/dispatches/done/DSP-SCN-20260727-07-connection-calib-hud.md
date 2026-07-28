# Dispatch DSP-SCN-20260727-07-connection-calib-hud

## Meta
- From orchestrator: SCN (BW-opened Phase **3.4**; CAL workstream in-scope with file ownership)
- Worker role: WORKER(DSP-SCN-20260727-07-connection-calib-hud)
- Priority: P1
- Phase: Phase 3.4 — Connection / calib HUD harden
- Related handoffs: none required (CAL panel stays under `src/calibration/`)
- BW ask: harden ops HUD while studio **3.5** is human-pending; no WHEP; no NDI; no CON deeplink
- **Status: DONE** (worker report accepted by BW 2026-07-28)

## Goal

Make the ops overlay air-usable: show **telemetry connection health** (especially live WS) on the SCN stub HUD, and harden the **CAL offset panel** so ops can pick which POV/device they are calibrating (not hard-wired to `"1"` only). One worker may implement both slices; keep ownership: HUD/status in `src/scene/`, calib UI in `src/calibration/`, thin TEL expose only as needed for live status.

## Background

- Roadmap: `docs/roadmap/phases-roadmap.md` § Phase 3.4 (CAL+SCN)
- Stub HUD: `src/scene/stubHud.ts` — mode, POV, countdown, ENU/counts; no WS status today
- Live source already has `LiveWsStatus` + `onStatus` / `getStatus()` (`src/telemetry/liveSource.ts`) but `IngestHandle` does not expose them (`src/telemetry/ingest.ts`)
- CAL panel: `src/calibration/offsetSliders.ts` — device `"1"` only (`DEFAULT_CALIB_DEVICE_ID`); store is already per-device
- POV list: `loadConfig().povIds` (default `["1","2"]`); active POV via HUD / `scene.setActivePovId`
- 3.5 vMix runbook is human-gated — do not block on studio Results
- OUT chroma/timecode already exist — do not regress

## In scope

### A. Connection status (SCN + thin TEL)

1. Expose live connection status from ingest without inventing a second bus:
   - Prefer: `IngestHandle` gains optional `getLiveStatus?: () => Record<channel, LiveWsStatus>` and/or `onLiveStatus` callback wired only in `live` mode
   - Mock/replay: HUD shows a clear non-live label (e.g. `ws=n/a (mock)` / `ws=n/a (replay)`)
2. Stub HUD status line (or compact row) shows per-channel state for channels that exist today (`drone` / `boat` at minimum), e.g. `ws drone=open boat=connecting`
3. Update when status changes (callback or light poll from `main` → `hud.setConnectionStatus(...)`)
4. Empty live URLs / failed connect must be visible as `closed` / idle — do not fake `open`
5. No reconnect UX redesign beyond surfacing existing live-source behavior

### B. Calib panel harden (CAL)

6. Device picker on the calib panel: select among **`povIds`** (from config / handle API), default to active POV or `povIds[0]`
7. Changing device reloads slider values from `getOffsets(deviceId)`; writes continue via `setOffsets` / `resetOffsets` for **that** id only
8. Wire from `main.ts`: when HUD POV changes, optionally sync calib device to the new active POV (recommended UX); allow manual override via picker
9. Keep ranges / reset / FOV default `66.8832` behavior from existing panel
10. Persistence (localStorage) is **optional nice-to-have** — only if cheap; not required for acceptance

### C. Polish (light)

11. Keep panels usable in chroma/preview: ops overlays remain DOM (not keyed); no need to hide unless already easy
12. README notes under `src/scene/README.md` + `src/calibration/README.md`

## Out of scope

- Phase **3.3** WHEP underlay
- Phase **3.5** studio execution / filling Results table
- Phase **3.6** console deeplink parser
- Live multi-URL / multi-boat WS follow-ups (TEL)
- New pose math, GEO, boat meshes, course/sponsors/flags
- NDI / native helpers
- Full design-system redesign; keep monospace ops chrome

## Likely files

- `src/telemetry/ingest.ts`, `src/telemetry/index.ts`, `src/telemetry/README.md` (+ small test if status expose needs it)
- `src/scene/stubHud.ts`, `src/scene/README.md`, maybe `src/scene/index.ts`
- `src/calibration/offsetSliders.ts`, `src/calibration/index.ts`, `src/calibration/README.md`, tests
- `src/main.ts`, `src/style.css` (light)

## Inputs provided

- `LiveWsStatus`: `'idle' | 'connecting' | 'open' | 'closed'`
- Config: `povIds`, `telemetryMode`, `wsUrl`, `wsBoatUrl`
- Existing `startOffsetSliders` / `startStubHud` handle patterns

## Acceptance criteria

- [ ] Live mode: HUD shows drone/boat WS status that updates on connect/disconnect
- [ ] Mock/replay: HUD clearly shows non-live (no fake open sockets)
- [ ] Calib panel can target each id in `povIds`; sliders read/write that device’s store
- [ ] Switching POV (HUD) can sync calib device (or documented manual pick if sync skipped — prefer sync)
- [ ] `npm test` + `npm run build` green
- [ ] No WHEP / NDI / deeplink / 3.5 runbook changes required

## Report back

When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (incl. live status if URLs empty vs mock)
4. Follow-ups / blockers
5. Suggested memo bullets for SCN + CAL

## Worker paste block

```
You are WORKER(DSP-SCN-20260727-07-connection-calib-hud).
Mandatory reads:
1. docs/agentic/dispatches/active/DSP-SCN-20260727-07-connection-calib-hud.md (full)
2. docs/agentic/DISPATCH_PROTOCOL.md (worker rules)
3. src/scene/stubHud.ts + src/calibration/offsetSliders.ts
4. src/telemetry/liveSource.ts + src/telemetry/ingest.ts (IngestHandle)
5. src/main.ts (HUD + calib mount)

Implement in scope only (connection status + multi-device calib).
No WHEP, no NDI, no console deeplink, no studio runbook edits.
When finished, report using the dispatch Report back section.
```
