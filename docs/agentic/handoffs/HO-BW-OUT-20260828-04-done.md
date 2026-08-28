# Handoff HO-BW-OUT-20260828-04-done

## From → To
BW → OUT

## Type
completed-worker-summary

## Summary
BW accepted `DSP-OUT-20260828-04`. Tick 60 NDI-only; one FBO/tick including PBO; 2D stayed on @ 30. Suite **900 + 23**. Remaining hitch is 2D on that tick → OUT-07.

## Decisions / facts
- `STUDIO_TICK_FPS = 60` is stagger only. Preview rAF.
- 2D does not occupy the FBO slot (by design) — that leftover is OUT-07.

## Asks of receiver
- [ ] Memo: OUT-04 done. Next worker is OUT-07 only.

## Artifacts
- `docs/agentic/dispatches/done/DSP-OUT-20260828-04-one-ndi-fbo-per-tick.md`

## Urgency
P1
