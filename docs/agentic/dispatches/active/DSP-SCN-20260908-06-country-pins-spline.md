# Dispatch DSP-SCN-20260908-06-country-pins-spline

## Meta
- From orchestrator: SCN (BW issued 2026-09-08)
- Worker role: WORKER(DSP-SCN-20260908-06-country-pins-spline)
- Priority: **P0**
- Phase: **21.2b** — country pins + continuous globe path
- Related: `DSP-SCN-20260908-02`. Design: `docs/architecture/commercial-video.md` §3–4 (Human Pass 2026-09-08)
- **Worker result 2026-09-08:** **code-complete.** Many globe shots, shared boundary poses. Country pins (canvas sprites). Holds 4.5 / 6.8 / 1.4 / 1.5 Mm. ENU 32–60 untouched. Tile warm is 07.

## Goal

Operator: path is mostly good but **cities are unreadable** and **shot cuts teleport**. Reframe globe as **countries** with **labeled pins**, and make **every globe move a spline** (including Turkey → İstanbul). Keep 60 s. ENU 32–60 unchanged.

## Background

Spline only interpolates **inside** a shot (`evaluateCinematicAt` → `shotAtTime`). Chicago at t=8 starts at 800 km over Illinois while the world shot ended at ~10,000 km over Europe — that is the teleport. `lookId` is authoring-only; **no pin meshes**.

## In scope

1. **Pins** — sequence-level `pins[]`: `{ id, label, lat, lon }`. Globe: ECEF (or geodetic→GEO) markers + **readable labels** (USA, Canada, UK, Turkey). Hide when `domain=enu`. Moscow may stay a world-only pin; do **not** add a Russia country hold. Centroids:

| id | Label | lat | lon |
| --- | --- | --- | --- |
| usa | USA | 39.83 | −98.58 |
| canada | Canada | 56.13 | −106.35 |
| uk | UK | 54.0 | −2.5 |
| turkey | Turkey | 39.0 | 35.2 |

2. **Country framing** — at each hold, **whole country in frame** (CONUS / Canada / UK / Turkey). Altitude is country-scale (thousands of km for USA/Canada; ~1 Mm class for UK/Turkey). Look-at = country centroid, **not** Chicago / Winnipeg / London.

3. **Times** (still `durationSec` 60). Steal hold for transit:

| t | Shot |
| --- | --- |
| 0–5 | World + all country pins (Moscow pin OK) |
| 5–8 | Transit → USA |
| 8–10 | USA hold |
| 10–13 | Transit USA → Canada |
| 13–15 | Canada hold |
| 15–18 | Transit Canada → UK |
| 18–20 | UK hold |
| 20–23 | Transit UK → Turkey |
| 23–26 | Turkey hold |
| 26–32 | Fly Turkey → Marmara / İstanbul → cloud |
| 32–60 | **Do not retouch** ENU keyframes from DSP-02 |

4. **Continuity** — last keyframe of shot N equals first of shot N+1 whenever both are `globe` (same lat/lon/alt/look). Turkey hold last pose = first Marmara keyframe. Ease `easeInOut` on transits. Cloud still only near 26–32 cut (stepped JSON OK).

5. Prefer **one globe shot 0–26** plus Marmara cloud shots **or** many shots with shared boundary poses. Do not invent player lerp across mismatched poses.

6. Tests: parse pins; no `chicago`/`winnipeg`/`london` as hold look-ats (centroids above); globe boundary poses match within 1e-4 deg / 1 m; duration 60; no `rumeli`. README shot table.

## Out of scope

- Tile prefetch / disk cache (07 + PLT-01)
- MP4, GEO formulas, ENU hero path, Rumeli, audio, credits
- Smooth `cloud01` lerp in the player (JSON steps OK)

## Likely files

- `public/cinematics/intro-bosphorus.json`
- `src/scene/cinematics/types.ts`, `parseSequence.ts`, tests, README
- `src/scene/cinematics/pins.ts` (or similar) + hook from `createScene.ts` apply-sample
- **Do not** edit `src/output/`, `src/geodesy/cinematicFrame.ts`, `createTerrain.ts`

## Acceptance criteria

- [ ] Play 60 s: no globe teleport (scrub t=7.9 vs 8.1 — camera has moved, not jumped continents).
- [ ] USA/Canada/UK/Turkey holds: country in frame + labeled pin. Not a city street.
- [ ] Turkey → İstanbul is a continuous fly, then cloud.
- [ ] Pins gone on ENU. Race Off restores.
- [ ] `npm test` cinematic + scene. Pre-existing `library.test.ts` / OUT tsc not yours.

## Report back

1. Summary (one globe shot vs many; pin implementation)
2. Files
3. Alts you used per hold
4. Tests
5. Memo bullets for SCN

## Worker paste

```
Role: WORKER(DSP-SCN-20260908-06-country-pins-spline)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260908-06-country-pins-spline.md
3. docs/architecture/commercial-video.md §3–4
4. public/cinematics/intro-bosphorus.json
5. src/scene/cinematics/evaluate.ts
6. src/scene/cinematics/spline.ts

Country pins + labels on globe. Whole-country framing (not Chicago/London). Continuous spline — no teleports. Steal hold time for transits. Turkey → Istanbul is a fly. ENU 32–60 unchanged. No tile cache. No MP4. No ECEF math.

Implement that dispatch only.
```
