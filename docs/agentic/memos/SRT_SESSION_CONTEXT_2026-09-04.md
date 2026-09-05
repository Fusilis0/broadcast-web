# SRT session context — 2026-09-04 (round 4 frame identity)

**Role:** SRT (diagnosis + product code under user assignment for frame-identity plan).  
**Repo:** `broadcast-web` (uncommitted working tree).  
**Canonical memory:** `docs/agentic/memos/SRT_MEMO.md`

## Status

- **(b)** present-lock: fixed — do not re-open.
- **(a)** decode-error / KF-wait: fixed — do not re-open.
- **Post-a jitter:** fixed (trim + unstick-to-minL).
- **Round 4 AR frame identity:** **fixed + live-verified** (OUT freshness gate).

## Round 4 one-liner

> AR NDI re-captured the same `present()` PTS on consecutive ticks (~6.7 capture dup-run pairs/s; 71% overlapped `2dGrab`). `?ndi2d=off` only cut to 5.26/s (−21%); `?ndi3d=off` similarly 5.18/s — contention amplifies, not primary. AR freshness gate (`ndiFramePump`) → **0** dup-runs/s, sendSamePts **0%**.

## Key files (round 4)

| Path | Role | Domain |
| --- | --- | --- |
| `src/output/diagNdiContent.ts` | frameSeq, duplicate-run, 2dGrab overlap | SRT diag |
| `src/output/diagNdiChannelFlags.ts` | `?ndi2d=off` / `?ndi3d=off` | debug |
| `src/output/ndiFramePump.ts` | **freshness gate** | **OUT** |
| `src/output/ndiStageTiming.ts` | `freshness` skip cause | OUT |
| `src/main.ts` | channel flags + dump config | wiring |
| `desktop/main.cjs` | forward `[diag:frame-id]` | shell |
| `src/output/fixtures/frameIdentityReplay20260904.json` | A/B + postfix | fixture |

## Open

- Commit still user-gated; keep OUT pump (`ndiFramePump` / `ndiStageTiming`) separable from SRT diag/present.
