# Dispatch DSP-SCN-20260826-10-telem-srt-flow-panel

## Meta
- From orchestrator: BW → SCN
- Worker role: WORKER(DSP-SCN-20260826-10-telem-srt-flow-panel)
- Priority: P1
- Phase: Phase 17.4 — operator JSON flow inspector
- Related: `done/DSP-TEL-20260826-10-matched-hold.md` (tap API)
- Handoff: `docs/agentic/handoffs/HO-TEL-SCN-20260826-01.md`
- **Status: DONE** — worker complete + BW accepted 2026-08-27. Operator smoked Flow rail in studio. Mid-merge `matchedPipeline` fails were TEL-10 in flight; merged tree **856 + 23** green.

## Goal

Give the operator a **toggleable ops panel** of per-asset windows they can open and close, showing arriving **telemetry JSON** and **SRT/decode JSON** (when that asset has a stream). Drones, boats, buoys, and any other pose ids on the buses. Some rows are telemetry-only; POV rows that have Vid/SRT also show the video clock (PTS, resolved NTP, decoder counters, redacted URL).

This is how we confirm: NTP is on the packet even without lat/lon; anchors are arriving; SRT PTS is moving; matching is holding vs free-running.

## Background

- Existing **sync debug** (`src/output/syncDebugPanel.ts`, Output rail) is a **numbers** HUD (latency, pacing, FREE-RUN). **Do not replace it.** This panel is raw-ish JSON per entity.
- Sidebar is DOM-only. **Never** draw this into WebGL / NDI (`src/scene/sidebar/README.md`).
- SRT `streamid` tokens are secrets (RULES §11). Display only `redactSrtUrl` output. Never dump `public/config.json` catalog tokens.
- TEL-10 adds `src/telemetry/flowTap.ts`. You render `snapshot()`. You also push **throttled** SRT snapshots into the same tap from `main.ts` (decode counters + presented PTS/NTP + redacted URL). Do not invent a second log.

## In scope

1. **Sidebar section** `flow` (label **Flow**), **right rail**, order **15** (between Output and Calib). Default **collapsed / off**. Persist accordion like other sections. Add the id to `OPS_RAIL_SECTIONS` + `railLayout.test.ts`.
2. **Master toggle** “Live JSON” (sessionStorage). When off: no poll, empty body. When on: poll ≤ **4 Hz** (not rAF).
3. **Per-entity cards** (one per id seen in tap + fleet registry so boats without packets still have a closed window):
   - Header: `kind` + `id` + badges: `telem` / `srt` / `anchor` as applicable.
   - Collapse/expand **per card**. Optional **Pop out**: `position: fixed` small window the operator can drag (or at least toggle fixed overlay). Closing pop-out returns to the accordion. Do not require a perfect window manager.
   - Two JSON `<pre>` blocks when open: **Telemetry** (latest drone/boat/buoy or `stream_anchor` body) and **SRT** (`null` / “no stream” for boats/buoys without Vid). Pretty-print `JSON.stringify(body, null, 2)`.
   - Show `receivedAtMs` as ISO or ms next to each block.
   - If TEL-10 stores attitude-only packets, they **must** appear here (proves GPS is not required for NTP `ts`).
4. **SRT push** (main wiring): on the same poll, for each Vid-enabled POV, `flowTap.push({ kind:'srt', id: povId, body: { srtId, presentedPts90k, presentedNtpMs, framesDecoded, codec, accessUnits, decodeError, redactedUrl, lutStreamId, pacingCount } })`. Pull from `videoStreamManager.getCounters`, `getPtsNtpMap(lutId).health()`, `redactSrtUrl`. No raw tokens.
5. CSS in `src/style.css` — dark, monospace, max-height + scroll on `<pre>`. Do not cover the whole canvas by default; pop-outs stay ops chrome.
6. Tests: rail id; redact (token string must not appear in rendered text if you unit-test a formatter); toggle off → no updates. Happy-dom is enough; no GPU fps asserts.

## Out of scope

- Changing pose matching, LUT, history gates (TEL-10).
- Replacing sync debug overlay.
- NDI / chroma / ffmpeg.
- Auto-estimating `syncTrimMs`.
- Pretty charts. JSON + collapse is the product.

## Likely files

- `src/scene/flowPanel.ts` (new) + `flowPanel.test.ts`
- `src/scene/sidebar/railLayout.ts` + test
- `src/scene/index.ts` export if needed
- `src/main.ts` mount + SRT push
- `src/style.css`
- `src/scene/sidebar/README.md` (one row in the section table)

## Inputs provided

- `createSidebar().registerSection`
- `redactSrtUrl` / `lutStreamIdForPov` already in `main.ts`
- TEL `flowTap` once TEL-10 lands

## Acceptance criteria

- [ ] Right-rail **Flow** section exists; default not flooding the operator.
- [ ] Operator can open/close per-asset JSON; boats without SRT show telemetry only.
- [ ] POV with SRT shows both telemetry (or anchor) and SRT clock JSON; `streamid` token never visible.
- [ ] Gimbal-only telemetry packets appear when TEL-10 stores them.
- [ ] Panel never appears in NDI (DOM overlay only).
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary (section id, pop-out or accordion-only)
2. Files touched
3. Tests run
4. Blocked on TEL-10? 
5. Suggested SCN memo bullets
