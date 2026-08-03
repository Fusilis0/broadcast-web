# TEL_MEMO

**Last updated:** 2026-08-03  
**Status:** Idle — DSP-TEL-20260803-01 **accepted**

## Latest
- Live Connect opens **enabled** ids only (Fleet Live checkboxes; session `enabledBoatIds` / `enabledPovIds`).
- Per-id status + `lastPacketAgeMs`; HUD e.g. `ws b40=open/nopkt` vs packet age; soft warn ~8s open/nopkt.
- Explicit empty id lists do not fall back to `21–24` / `1–2` for live sockets.
- Archived: `docs/agentic/dispatches/done/DSP-TEL-20260803-01-live-socket-hygiene.md`

## Ops
Enable Live on the id(s) you want → Connect. Handshake ≠ data until age replaces `nopkt`.
