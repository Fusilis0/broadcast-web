# Dispatch DSP-SCN-20260909-01-intro-human-pass

## Meta
- From orchestrator: SCN (Phase **21** cinematic — not Phase 20 heroes)
- Worker role: WORKER(DSP-SCN-20260909-01-intro-human-pass)
- Priority: **P0**
- Related: `DSP-SCN-20260908-06` (pins/spline), `DSP-SCN-20260908-07` (tile warm)
- Worker result: **code-complete 2026-09-09**. Path Canada→UK then Russia→Turkey→İstanbul. SSE globe **8** / ENU **3**. Needle pins. Yavuz hold 2.5 s. ENU seams shared. Çırağan operator GPS. **Human Pass:** Play 60 s then Save tile list.
- No CesiumJS, Google Photorealistic, IBB, MP4, NDI, SRT, `STUDIO_TICK_FPS`.

## Goal

Human Pass look on `intro-bosphorus`: sharper Aerial, a readable **west then east** country path, better pins (plus İstanbul), a **hold on the 3rd bridge**, and **no camera teleports** on globe *or* ENU. Stay **60 s**.

## Background

06 made globe shots share boundary poses; **ENU 32–60 was frozen**. Operator still sees a **cut** from 15 July / Bosphorus into Maiden’s Tower (and later peninsula / Galata). Label **Moscow** is wrong — it is **Russia**. World shot currently looks at Moscow. Tile SSE already dropped to globe **16** / ENU **6**; operator still calls the map pixelated.

Çırağan look-at is wrong. Operator GPS: **41.04342388464562, 29.01532600006871**.

## In scope

### 1. HD Aerial (as sharp as Bing ion **2** allows)

- During **Play** (not only warm): lower `errorTarget` until Bing stops giving more detail. Start from globe **8** (try **6** if VRAM holds); İstanbul ENU **2–4** (today **6**).
- Keep cinematic remount **without** `TilesFadePlugin` / aggressive unload. Raise cinematic VRAM if fine tiles evict.
- After the change: operator **Save tile list** again. Do **not** invent Google Photorealistic / MapTiler / CesiumJS.
- Globe at 4–18 Mm will never look street-sharp — country holds should look like a **sharp satellite**, not a smear.

### 2. Country path (west → east)

Operator did not read USA→Canada→UK. New story:

| Beat | What |
| --- | --- |
| World 0–5 | All pins visible. Do **not** look-at Moscow as “Moscow”. Slow drift over Atlantic / Europe. |
| West | **Canada** hold, then **UK** hold (western countries). USA pin may stay on the globe; **no USA hold** unless leftover time after Russia/Turkey. |
| East | From UK fly **east** to **Russia** hold, then **Turkey** hold, then fly to **İstanbul**. |
| Pins | Rename `moscow` → **`russia`**, label **`Russia`**. Add pin **`istanbul`**, label **`İstanbul`**, GPS **41.0082, 28.9784** (city, not country centroid). Hide pins on ENU. |

Russia look-at = country-scale (not a street). Centroid OK around **61.5, 105** (whole RF) **or** European Russia **55.8, 37.6** if whole-RF is too empty — **label is still Russia**, never Moscow.

Steal hold time for transits. Shared **globe** boundary poses (last KF of N = first of N+1). Still `durationSec` 60.

### 3. Better pins

Replace the gold-dot + dark pill if it still looks cheap. Need a **map pin** (needle / stem) + **high-contrast label**. Readable at country altitude. İstanbul pin on the Marmara fly.

### 4. 3rd bridge hold

After cloud-out and the camera is on **Yavuz Sultan Selim** (3rd bridge), **hold 2–3 s** before flying south (FSM → 15 July). Steal the seconds from later ENU (not from the west/east globe story). Keep 60 s.

### 5. No teleports (ENU too)

**Camera never jumps.** Same rule as 06, now for **every** adjacent shot including ENU:

- Last keyframe of shot N **equals** first of shot N+1 (lat/lon/alt/look within 1e-4 deg / 1 m).
- Ease `easeInOut` on transits. Spline inside a shot is not enough if the next shot starts somewhere else.

Today: south-bridges shot **ends** near 15 July (~41.042, 29.042) while `maidens-tower` **starts** at 41.028, 29.015 — that is the teleport. Same check for maidens→peninsula, peninsula→Galata, Galata→Çırağan.

### 6. Çırağan look

`ciragan` + `hold` shots: `lookLat` **41.04342388464562**, `lookLon` **29.01532600006871**. Eye can orbit; look stays on that point.

## Out of scope

- MP4 (OUT)
- Rumeli Hisarı look-at
- Studio boot defaults (`DSP-SCN-20260909-02`)
- NDI checkboxes (OUT)
- Phase 20 hero meshes
- Do not wait for a new ion imagery product

## Likely files

- `public/cinematics/intro-bosphorus.json`
- `src/scene/cinematics/pins.ts`
- `src/scene/cinematics/warm.ts` / `createPlayer.ts` / `createTerrain.ts` (Play SSE)
- `src/scene/cinematics/README.md`, `intro-bosphorus.test.ts`, `pins.test.ts`
- `docs/ops/cinematic-heroes-smoke.md` §C table
- **Do not** edit `src/output/`, `src/geodesy/cinematicFrame.ts`

## Acceptance criteria

- [ ] Play 60 s: west **Canada → UK**, east **Russia → Turkey → İstanbul**. No pin labelled Moscow.
- [ ] İstanbul pin on the globe fly. Pins gone on ENU.
- [ ] Aerial looks sharper on country holds and on the strait (not mush). Not Google tiles.
- [ ] 2–3 s parked on the 3rd bridge after ENU reveal, then south. No jump to Maiden’s.
- [ ] Scrub every shot boundary (globe **and** ENU): camera **moves**, never pops.
- [ ] Çırağan look is the operator GPS above.
- [ ] `npm test` cinematic + scene. Pre-existing library/OUT tsc not yours.

## Worker paste

```
Role: WORKER(DSP-SCN-20260909-01-intro-human-pass)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260909-01-intro-human-pass.md
3. public/cinematics/intro-bosphorus.json
4. src/scene/cinematics/pins.ts
5. src/scene/cinematics/evaluate.ts

HD Aerial SSE. Country path Canada→UK then Russia→Turkey→Istanbul. Pin label Russia not Moscow. Better pins + Istanbul. Hold 2–3 s on 3rd bridge. No camera teleports on ENU. Ciragan look 41.04342388464562, 29.01532600006871. Stay 60 s. No MP4. No Google Photorealistic.

Implement that dispatch only.
```
