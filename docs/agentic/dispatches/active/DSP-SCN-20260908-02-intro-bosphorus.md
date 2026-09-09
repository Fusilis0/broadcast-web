# Dispatch DSP-SCN-20260908-02-intro-bosphorus

## Meta
- From orchestrator: SCN (BW issued 2026-09-08)
- Worker role: WORKER(DSP-SCN-20260908-02-intro-bosphorus)
- Priority: **P1**
- Phase: **21.2** — first sequence JSON
- Related: `DSP-SCN-20260908-01`. Design: `docs/architecture/commercial-video.md` §4
- **SCN-01 code-complete 2026-09-08** — start when play/scrub works (Human Pass on `_empty` can wait). No MP4. No GEO math. No new tileset.
- **Worker result 2026-09-08:** **code-complete.** `intro-bosphorus` in catalogue; Play 60 s. Cloud stepped 0.5 s JSON. Moscow = 0–8 pin. Human Pass = scrub alts / Maiden’s / strait speed.

## Goal

Ship `public/cinematics/intro-bosphorus.json` (~60 s) matching the locked shot list. Rough keyframes are OK — operator will scrub. **Do not** look at Rumeli Hisarı.

## In scope

1. Sequence `intro-bosphorus`: 1920×1080, fps 30, `durationSec` 60, silent.
2. Shots and times from the design table. Domains + fog/ocean/cloud flags as designed.
3. **Pins / look-ats** (starting GPS, not a survey):

| Shot | Eye / look (start) |
| --- | --- |
| World | High ECEF over Atlantic/Europe, look Earth centre or 40°N 30°E |
| Chicago | 41.8781, −87.6298, alt ~500–800 km |
| Winnipeg | 49.8951, −97.1384 |
| London | 51.5074, −0.1278 |
| Turkey | 39.93, 32.86 then 41.01, 28.98 |
| Marmara → cloud | Lower to ~80–150 km over 40.9, 29.0 |
| 3rd bridge | Yavuz Sultan Selim ≈ 41.2044, 29.1113 then south |
| FSM (2nd) | 41.0912, 29.0615 — fly-by on the south path |
| 15 July | 41.0451, 29.0340 |
| Maiden’s Tower | 41.0211, 29.0041 |
| Peninsula | Ayasofya 41.0086, 28.9802 · Sultanahmet 41.0054, 28.9768 · Topkapı 41.0115, 28.9833 |
| Galata | 41.0256, 28.9741, look toward strait |
| Çırağan | 41.045, 29.016 |

4. Ease in/out on shot boundaries. Cloud `cloud01` 0→1 in last 2 s of Marmara, 1→0 in first 2 s of 3rd-bridge shot.
5. Tests: parse + duration 60; no `rumeli` in look-at ids; shot t-ranges cover [0,60) without gaps.
6. README lists shot table + “meshes TBD, GPS is the path.”

## Out of scope

- Player (01)
- MP4
- Importing glTF (human later)
- Rumeli Hisarı
- Credits / audio

## Likely files

- `public/cinematics/intro-bosphorus.json`
- `src/scene/cinematics/intro-bosphorus.test.ts` (parse only)
- Catalogue **ids** for bridges/peninsula only if 01 already has a pin layer — otherwise JSON lookats are enough

## Acceptance criteria

- [ ] Ops can select `intro-bosphorus` and Play ~60 s without throw.
- [ ] Globe first, ENU after cloud, ocean on only on ENU strait shots.
- [ ] Human smoke: path is recognisable even if altitudes need a later nudge.
- [ ] `npm test` + `npm run build` green.

## Report back

1. Summary  
2. Files  
3. Which GPS you used  
4. What still looks wrong from a Play  
5. Memo bullets for SCN

## Worker paste

```
Role: WORKER(DSP-SCN-20260908-02-intro-bosphorus)

Read in order:
1. docs/agentic/RULES.md
2. docs/agentic/dispatches/active/DSP-SCN-20260908-02-intro-bosphorus.md
3. docs/architecture/commercial-video.md §4 (locked times)
4. public/cinematics/_empty.json
5. src/scene/cinematics/constants.ts
6. src/scene/cinematics/parseSequence.ts

Ship public/cinematics/intro-bosphorus.json (~60 s, 1080p30). Add it to CINEMATIC_CATALOGUE. Shot times from the design table. GPS from this DSP. Cloud cloud01 0→1 in the last 2 s of Marmara, 1→0 in the first 2 s of the 3rd-bridge shot (not a 1 s white plate). Moscow is a world pin on 0–8, not a dedicated zoom. Do not look at Rumeli Hisarı. Do not rewrite the player. No MP4. No ECEF math.

Implement that dispatch only.
```
