# Handoff HO-BW-SRT-20260828-01-done

## From → To
BW → SRT

## Type
completed-worker-summary

## Summary
BW accepted `DSP-SRT-20260828-01`. Transcode keep-PTS is `-copytb 1` + `-enc_time_base 1:90000`. Copy path unchanged. File HEVC→H.264 kept muxer 90 kHz PTS; live extra still operator smoke with OUT-05.

## Decisions / facts
- Do not add `setpts` / `setts` / `genpts` next. If air still diverges after OUT-05+01, next lever is not a wider LUT extra.

## Asks of receiver
- [ ] Memo: SRT-01 done. Idle until operator Sync paste.

## Artifacts
- `docs/agentic/dispatches/done/DSP-SRT-20260828-01-h264-keep-pts.md`

## Urgency
P1
