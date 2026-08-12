# Dispatch DSP-OUT-20260812-01-multi-sender-ndi-bridge

## Meta
- From orchestrator: BW → OUT (Phase 13.1)
- Worker role: WORKER(DSP-OUT-20260812-01-multi-sender-ndi-bridge)
- Priority: P0
- Phase: Phase 13 — Multi-channel output
- Prerequisite: none (this is the blocking bridge prereq for 13.3 / 13.4 / 13.6)
- Parallel-safe with: `DSP-SCN-20260812-01`, `DSP-PLT-20260812-01` (PLT also edits `desktop/preload.cjs` + `desktop/main.cjs` — **touch only NDI regions**; leave any `races:*` namespace alone)
- Design: `docs/architecture/multi-output-streaming.md` §3
- **Status: DONE** — worker complete + BW accepted 2026-08-12 (`npm test` 418+23 green; human Electron/vMix AR smoke still recommended)

## Goal

Replace the single-`grandi`-sender NDI bridge with **N independently named senders** (at least
channels `ar` | `3d` | `2d`), each with its own start/stop/status/frame path, while keeping today's
AR air path working as the default sole active sender until later dispatches wire the other
channels.

## Background

- Today: `desktop/ndiSender.cjs` + one IPC pair (`ndi:start` / `ndi:stop` / `ndi:frame` /
  `ndi:status`) — see `src/output/ndiControllerPanel.ts` (`STREAM_MAP_NDI_BRIDGE_SUPPORTED = false`).
- Preload: `desktop/preload.cjs` exposes `window.broadcastStudio.ndi.*`.
- SPA: `src/output/studioBridge.ts`, `ndiFramePump.ts` — currently one pump → one sender.
- **BW lock:** keep studio resolution **1920×1080 landscape** (do **not** flip to 1080×1920).
- **BW lock:** no delay buffer in this DSP (13.6 later). No 2D/3D product pumps yet (13.3 / 13.4).

## In scope

1. Refactor `desktop/ndiSender.cjs` to a **Map of channelId → sender** with:
   - `start(channelId, name?)`, `stop(channelId | 'all')`, `sendFrame(channelId, frame)`,
     `getStatus(channelId)` / `getStatusAll()`.
   - Channel ids: at minimum `'ar' | '3d' | '2d'` (string enum documented).
2. IPC + preload API that supports per-channel operations. Prefer additive shape, e.g.:
   - `ndi.start({ channel, name })`, `ndi.sendFrame({ channel, …frame })`, `ndi.getStatus(channel?)`
   - **Back-compat:** existing SPA calls that omit `channel` must keep working as channel `'ar'`
     (today's air plate). Do not break `npm run desktop:dev` AR NDI.
3. Update `src/output/studioBridge.ts` (+ types) and `ndiFramePump.ts` to pass `channel: 'ar'`
   explicitly (behavior unchanged).
4. Extend NDI controller tab to show **per-channel** status rows (ar / 3d / 2d). Channels with no
   sender started yet → clear idle/unavailable state (not an error). Flip
   `STREAM_MAP_NDI_BRIDGE_SUPPORTED` **only if** you also ship a real 2D pump — otherwise leave
   `false` and document "bridge ready; pump in 13.4".
5. Docs: `desktop/README.md`, `src/output/README.md`, short note in `docs/ops/air-runbook.md`.
6. Unit/smoke: whatever is practical without requiring a physical NDI receiver (mock sender map,
   status shape tests). Manual Electron smoke: AR still appears in vMix / NDI tools under the
   usual name (or `broadcast-web-ar` if you rename — document the name change clearly).

## Out of scope

- Wiring continuous 3D or 2D frame pumps (13.3 / 13.4).
- Local 2D/3D/AR switcher UI (13.5).
- NDI delay / ring buffer (13.6).
- Sea/sky environment (SCN).
- Changing clear-color / outputMode policy.
- Portrait resolution change.
- Editing `races:*` IPC (PLT's parallel DSP).

## Likely files

- `desktop/ndiSender.cjs`, `desktop/main.cjs` (NDI IPC only), `desktop/preload.cjs` (NDI block only)
- `desktop/README.md`
- `src/output/studioBridge.ts`, `ndiFramePump.ts`, `ndiControllerPanel.ts` (+ tests), `index.ts`, `README.md`
- `docs/ops/air-runbook.md`

## Inputs provided

- `docs/architecture/multi-output-streaming.md` §3 (sketch API)
- Existing single-sender path as the `'ar'` default

## Acceptance criteria

- [ ] Main process can start ≥3 named senders independently without tearing down AR
- [ ] Omitting channel in SPA still drives `'ar'` (back-compat)
- [ ] NDI tab shows per-channel status; idle channels are not fatal errors
- [ ] `npm test` + `npm run build` green
- [ ] Electron smoke: AR NDI still works (`desktop:dev`); document source name(s)
- [ ] No product requirement that 2d/3d actually send frames yet

## Report back
When done, reply with:
1. Summary of changes
2. Files touched
3. Tests run / how verified (incl. Electron/NDI smoke if available)
4. Follow-ups / blockers (exact preload API shape for 13.3/13.4 workers)
5. Suggested memo bullets for OUT
