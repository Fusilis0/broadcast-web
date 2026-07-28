# TEL_MEMO

**Last updated:** 2026-07-28  
**Status:** Idle — 4.1 polish done

## Focus
None active. Live multi-URL still deferred.

## Decisions
- Channel bands: drones `1–4`, cams `11–12`, boats `21–52`; pilots deferred
- `boatIds` / `povIds` mock multi-emit — DONE
- Live: single `wsUrl` / `wsBoatUrl`
- **4.1:** replay loop (`fixture.loop` + optional `replayLoop`); one-shot `ended` + restart; clearer fixture errors; `getReplayStatus`; live reconnect documented (500ms→10s cap); `stop()` cancels timers

## Done (recent)
- Through **DSP-TEL-20260727-01** (multi-POV)
- **DSP-TEL-20260728-01-replay-reconnect-polish** — **DONE** (4.1)

## Blockers
- None

## Next
1. Idle until BW opens live multi-URL or recorder
