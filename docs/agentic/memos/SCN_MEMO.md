# SCN_MEMO

**Last updated:** 2026-07-28  
**Status:** Idle — 3.4 accepted; awaiting BW next slice

## Focus
Ops HUD connection status landed; Phase 2 content complete.

## Decisions
- Owns: `src/scene/`, `src/assets/`, stub HUD, 2D map; no geo math / chroma / NDI
- **2.1–2.7 DONE**
- **3.4 DONE** (`DSP-SCN-20260727-07`): HUD shows live `ws drone=… boat=…` via ingest status; mock/replay `ws=n/a (mode)`; POV change syncs CAL device in `main`
- Thin TEL expose only (`getLiveStatus` / `onLiveStatus`) — no second bus

## Issued dispatches
- Through **DSP-SCN-20260727-07-connection-calib-hud** — **DONE** → `dispatches/done/`

## Handoffs
—

## Blockers
- None

## Next
1. BW routes **3.6** CON or other SCN polish
2. Human: **3.5** studio Results when ready
