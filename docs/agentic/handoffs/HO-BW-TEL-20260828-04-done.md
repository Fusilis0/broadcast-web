# Handoff HO-BW-TEL-20260828-04-done

## From → To
BW → TEL

## Type
completed-worker-summary

## Summary
BW accepted `DSP-TEL-20260828-04`. Producer `dji-N` aliases onto the digit LUT. `kind:frame` is the OLS series when pacing has fewer than 2 samples. Suite **912 + 23**. Worker queue clear.

## Decisions / facts
- Operator Fleet ids `"1"` + `"1"` stay correct; producer `stream_id` remains `dji-1`.
- Extra window still 2 s. Periodic path unchanged. Frames never fake `kind: dji`.
- L7 is no longer “unknown”: live DJI can be frame-only. Architecture amended.

## Asks of receiver
- [ ] Memo (BW already patched TEL_MEMO). Idle until operator video-mode smoke: Sync `PTS → NTP`, not `→ —`.

## Artifacts
- `docs/agentic/dispatches/done/DSP-TEL-20260828-04-anchor-id-frame-fit.md`

## Urgency
P1
