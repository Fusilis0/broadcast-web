# OUT_MEMO

**Last updated:** 2026-07-31  
**Status:** Active — **human gate** (vMix alpha check)

## Focus
Human: [`docs/ops/vmix-ndi-alpha-runbook.md`](../../ops/vmix-ndi-alpha-runbook.md) → fill Results

## Decisions
- 7.3b **accepted**: `transparent` + Electron alpha NDI (`grandi` / SDK 6.3.2)
- Named source: `broadcast-web` → `HOSTNAME (broadcast-web)`
- Chroma still interim air; skip B
- Next DSP: **7.6** on Pass, or thin 7.5 polish on Fail

## Issued dispatches
- DSP-OUT-20260731-05 — done (archived)
- None active — awaiting human

## Run
`npm run dev` then  
`$env:BROADCAST_WEB_URL="http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent"; npm run desktop:dev`
