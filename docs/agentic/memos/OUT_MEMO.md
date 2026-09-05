# OUT_MEMO

**Last updated:** 2026-09-02  
**Status:** **Idle** — Phase 19 OUT product done. `DSP-OUT-20260902-05` human **Pass**. 30×3 parked by operator.

## Phase 19 OUT (product)

| Item | Status |
| --- | --- |
| 19.1 barcode | Done |
| 19.3 stripes | Done (OBS Pass) |
| 19.4 hand toggles | Done |
| Hitch `02-03` | Pass (all-off 60, no banner, one-on not ~15) |
| Send `02-05` | **Pass** — AR/3D send when checked (bind-spy PBO) |

## Operator 02-05 (2026-09-02)

No yellow banner.

| NDI | Preview | Send |
| --- | --- | --- |
| All off | **60** | — |
| 3D only | ~**30** | **20–25** live |
| AR only | ~**30** | **17–20** live |
| 2D only | **60** | **10** |
| Three on | **11–12** | AR **14** / 3D **14** / 2D **5** live |

Operator: not optimum, **fine for now**. Do not issue another hitch DSP until BW reopens.

## Leftover (OUT/PRF, not now)
Three channels at **30+30+30** without preview ~11. Process split / non-NDI egress is **BW**. v1 still three outputs. **Not** “one channel is enough.”

## BW locks (still)
- Dual clock = two timers, **one** JS thread.
- Live: **not** `fallToSync` as always-on.
- Send checked ⇒ send.
- `STUDIO_TICK_FPS` stays 60. Do not fake mouse.

## Next
BW opens **CAL 19.5**, then **SCN**. This OUT chat issues no further DSP until BW says continue.
