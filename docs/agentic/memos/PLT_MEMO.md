# PLT_MEMO

**Last updated:** 2026-09-09  
**Status:** Cinematic tile dir shipped; **SCN-07 warm in tree**. Idle.

## 2026-09-08 — DSP-PLT-20260908-01 code-complete

Electron `userData/cinematic-tiles`, Vite `.cache/cinematic-tiles`, gitignored. `getCinematicTileCacheDir` Node/Vitest only — not SPA. Vite `GET /cinematic-tiles/*`. Filename SHA-256 of URL minus token query. Packaged `--file` read of userData is SCN-07 (IPC/protocol). No prefetch.

## 2026-09-08 — cinematic tile disk (BW)

Operator: ion tiles on studio disk, not git. Manifest (SCN-07) lists ids. PLT: `getCinematicTileCacheDir`, gitignore `.cache/cinematic-tiles/`, Electron userData. Handoff `HO-BW-PLT-20260908-01`.

## Phase 19 domain roadmap (PLT)

Design: `docs/architecture/phase19-senexus-qol.md` §6 · brief: `docs/agentic/briefs/phase19/PLT_PHASE19.md`

| Wave | Item | DSP | Notes |
| --- | --- | --- | --- |
| **C** | 19.16 Seed library + git-trackable uploads | `DSP-PLT-20260901-01-library-seed` | **DONE** — 2026-09-02 |
| **D** | 19.17 Instant project switch | `DSP-PLT-20260905-01` + `DSP-SCN-20260905-03` | **Human Pass 2026-09-05** (SCN lists-first). Investigation: remount, not `races.read`. |

Does not own: World Authoring picker, remount/scene graph (SCN), NDI, Cesium vendor, calib ranges.

## 19.17 investigation (accepted)
- **Named await:** `scene.remountWorldFromFeatures` (`createScene.ts`) via `loadWorldForProject` → `applyLoadedRaceProject`.
- Electron `races.read` / `racesFs.readRaceProject`: **1–5 ms**. Static `loadRaceProject`: **5–84 ms**. Remount: **~0.6–0.8 s**.
- Secondary: `restartIngest` **281–1713 ms** after `setBoatIds` but before `fleetPanel.setState`.
- Lists + 2D (`applyWorldFeatures`) already sequenced **after** remount — SCN must split paint order.
- Load-button lock unchanged. Library not re-seeded. Gated timings: `?debug1917=1`.

## Handoffs
- **HO-PLT-SCN-20260902-01** — library seeded
- **HO-SCN-PLT-20260905-01** — start 19.17 investigation
- **HO-PLT-SCN-20260905-01** — remount is the stall; SCN splits lists+2D first  
  `docs/agentic/handoffs/HO-PLT-SCN-20260905-01.md`

## Next
- **Open SCN** with `HO-PLT-SCN-20260905-01`. PLT idle on 19.17 until SCN reports or BW gates.
- Human speed test only after an SCN split worker lands.

## 19.16 shipped
- Rolex / Senexus / Vodafone under `public/assets/library/image/`; git-trackable.

## Prior
- Phase 9.1 / 9.2, Phase 13 Electron races save, Phase 15.4 `fleet.boats`
