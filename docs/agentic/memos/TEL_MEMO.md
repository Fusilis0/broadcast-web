# TEL_MEMO

**Last updated:** 2026-08-11  
**Status:** Idle — Phase 11.2 buoy telemetry **accepted**

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
