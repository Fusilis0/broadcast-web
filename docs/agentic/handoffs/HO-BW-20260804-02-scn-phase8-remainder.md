# Handoff HO-BW-20260804-02 — SCN Phase 8 remainder

## To
**SCN — Scene & Visuals Orchestrator**

## From
BW — 2026-08-04

## Context
Phase 8.1–8.5 **accepted**. Stream map stays **DOM-only** for v1 (`HO-BW-OUT-20260804-01`) — no NDI burn-in.

## Go-ahead
Drafting done by BW — **issue workers** for:

| Order | DSP | Topic |
| --- | --- | --- |
| 1 | `DSP-SCN-20260804-06-ghost-boats` | 8.6 Invisible / ghost boats |
| 2 | `DSP-SCN-20260804-07-map-chrome` | 8.7 Map chrome (+ 8.5+ arrows if cheap) |
| 3 | `DSP-SCN-20260804-08-world-3d-polish` | 8.8 Buoy/gate + mild water/shore |

Paths: `docs/agentic/dispatches/active/DSP-SCN-20260804-0{6,7,8}-*.md`

## SCN behavior
1. Update `SCN_MEMO` → Active wave 2.
2. One worker chat per DSP (paste blocks in files).
3. Parallel OK for 06 + 07; 08 can follow materials from 05 inventory.
4. Accept → `done/` → report BW when V1-A exit looks met (or list gaps).

## Out of scope
Phase 9–12, NDI map burn-in, Hetzner.
