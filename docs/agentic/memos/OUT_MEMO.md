# OUT_MEMO

**Last updated:** 2026-09-05  
**Status:** **Idle** — operator parked 30×3 until they call. HUD live proof matched. No OUT worker.

## Operator calls (2026-09-05)

| Item | Call |
| --- | --- |
| NDI **30×3** | **Wait.** Coworker work incoming. Do not issue a fps DSP until the operator says so. Cap still 30/30/30. |
| **10.1 Unity** | **Retire Unity.** Broadcast-web is primary air. |
| **10.2 Console deep-link** | **Future.** SPA already parses; wait for console emit. |
| **19.14 Billboard vanish** | **Close.** Did not happen again. Reopen only on a new live case. |
| **19.15 Sea holes** | **Close.** Flat-sea + texture is enough. No more ocean punch-through. |
| **14.3c Anemometer** | **Cancelled.** Open-Meteo forecast is enough. Do not issue a live wind-sensor channel. |
| **19.18 / Cesium vendor** | Still parked (Q5). Not this list. |

HUD rows matched the 02-05 baseline (all-off ~60; one-on Send live; three-on live, not 30×3). No yellow banner.

## Phase 19 OUT (product)

| Item | Status |
| --- | --- |
| 19.1 / 19.3 OBS / 19.4 | Done |
| Hitch `02-03` / Send `02-05` | Pass |
| 30×3 climb | **Parked — wait for operator call** |

## Locks
- Dual clock = two timers, **one** JS thread.
- Send checked ⇒ send. Skip = one busy tick.
- No skip-forever / no `fallToSync` as always-on.
- Do not clone `DSP-OUT-20260902-01` / `-03` / `-05`.
- `STUDIO_TICK_FPS` stays 60. Do not fake mouse.

## Next
No OUT worker. Handoff `HO-OUT-BW-20260905-03` (Unity / 19.14 / 30×3 wait) and `HO-OUT-BW-20260905-04` (14.3c cancelled; 19.15 closed).
