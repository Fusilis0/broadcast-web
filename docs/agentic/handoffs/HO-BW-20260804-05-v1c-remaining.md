# Handoff HO-BW-20260804-05 — V1-C remaining (human)

## From
BW — 2026-08-04

## Status
| Item | State |
| --- | --- |
| 10.3 NDI smoke | **Pass** (OUT) |
| 10.2 SPA deeplink pack | **Done** (CON); contract stays **proposed** until console emits |
| 10.1 Parallel air vs Unity | **You** |

## What to do for 10.1
1. Read cutover section in `docs/ops/air-runbook.md` (+ NDI smoke results already logged).
2. Run dress or show segment: Unity path and Electron `broadcast-web` NDI side-by-side.
3. Score gaps (visual, latency, ops). Decide: **web primary** / **dual-path** / **keep Unity**.
4. Reply in BW chat with Pass/Fail + decision — then BW marks V1-C / opens Phase 11.

## Console (optional, parallel)
Send `docs/agentic/handoffs/HO-CON-console-team-20260804-01.md` to console team. Not required to air from studio manually / Fleet / `?race=`.
